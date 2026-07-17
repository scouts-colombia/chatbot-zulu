import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizarCitas } from "@/lib/chat/citas";
import type {
  CitaNormalizada,
  MetadataServidor,
  RespuestaAsistente,
} from "@/lib/chat/contrato";
import {
  type IntentoModelo,
  llamarModelo,
  type TurnoHistorial,
} from "@/lib/chat/gemini";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export const maxDuration = 60;

const CuerpoSchema = z.object({
  conversationId: z.string().uuid(),
  mensaje: z.string().trim().min(1).max(2000),
});

const MENSAJE_BLOQUEADO =
  "No puedo ayudarte con ese tema desde este chat. Si necesitas apoyo, acude a un dirigente o adulto responsable de tu grupo.";
const MENSAJE_ERROR =
  "Tuvimos un problema generando la respuesta. Vuelve a intentarlo en un momento.";

function ahora() {
  return new Date().toISOString();
}

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

async function registrarEventos(
  admin: ClienteAdmin,
  base: {
    userId: string;
    conversationId: string;
    userMessageId: string;
    assistantMessageId?: string;
    modelId: string;
  },
  intentos: IntentoModelo[],
  opciones?: { safetyBlockSource?: string; calidad?: string[] }
) {
  const filas = intentos.map((intento) => {
    const esUltimo = intento.attemptIndex === intentos.length;
    const marcasCalidad =
      esUltimo && intento.status === "ok" && opciones?.calidad?.length
        ? opciones.calidad.join(",")
        : undefined;
    return {
      user_id: base.userId,
      conversation_id: base.conversationId,
      user_message_id: base.userMessageId,
      assistant_message_id: base.assistantMessageId ?? null,
      attempt_index: intento.attemptIndex,
      model_id: base.modelId,
      provider: "gemini",
      status: intento.status,
      latency_ms: intento.latencyMs,
      input_tokens: intento.inputTokens ?? null,
      output_tokens: intento.outputTokens ?? null,
      total_tokens: intento.totalTokens ?? null,
      grounding_disponible: intento.groundingDisponible,
      finish_reason: intento.finishReason ?? null,
      safety_block_source:
        intento.status === "blocked"
          ? (opciones?.safetyBlockSource ?? "proveedor")
          : null,
      error_code: intento.errorCode ?? marcasCalidad ?? null,
    };
  });

  const { error } = await admin.from("model_request_events").insert(filas);
  if (error) {
    console.error("No se pudo registrar model_request_events:", error.message);
  }
}

async function guardarMensajeAsistente(
  admin: ClienteAdmin,
  conversationId: string,
  contenido: string,
  responseJson: Record<string, unknown>
) {
  const { data, error } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender: "asistente",
      content: contenido,
      response_json: responseJson,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `No se pudo guardar el mensaje del asistente: ${error?.message}`
    );
  }
  return data.id as string;
}

function metadataDe(
  intentos: IntentoModelo[],
  modelId: string,
  requestId: string,
  safetyBlockSource?: MetadataServidor["safetyBlockSource"]
): MetadataServidor {
  const ultimo = intentos.at(-1);
  return {
    requestId,
    modelId,
    latencyMs: intentos.reduce((suma, i) => suma + i.latencyMs, 0),
    inputTokens: ultimo?.inputTokens,
    outputTokens: ultimo?.outputTokens,
    totalTokens: ultimo?.totalTokens,
    groundingDisponible: ultimo?.groundingDisponible ?? false,
    finishReason: ultimo?.finishReason,
    safetyBlockSource,
    createdAt: ahora(),
  };
}

export async function POST(request: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ codigo: "no_autenticado" }, { status: 401 });
  }

  // Estado de cuenta: lógica de API, no RLS (CLAUDE.md).
  const { data: perfil } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .single();

  if (perfil?.account_status !== "activo") {
    return NextResponse.json(
      {
        codigo: "cuenta_inactiva",
        mensaje: "Tu cuenta no está habilitada para usar el chat.",
      },
      { status: 403 }
    );
  }

  let cuerpo: z.infer<typeof CuerpoSchema>;
  try {
    cuerpo = CuerpoSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ codigo: "solicitud_invalida" }, { status: 400 });
  }

  // Conversación propia y activa (la RLS limita a lo propio).
  const { data: conversacion } = await supabase
    .from("conversations")
    .select("id, archived, title")
    .eq("id", cuerpo.conversationId)
    .single();

  if (!conversacion) {
    return NextResponse.json(
      { codigo: "conversacion_no_encontrada" },
      { status: 404 }
    );
  }
  if (conversacion.archived) {
    return NextResponse.json(
      { codigo: "conversacion_archivada" },
      { status: 409 }
    );
  }

  // Guard de cuota ANTES de llamar al modelo y de guardar el mensaje (D-11).
  const maximoDiario = Number.parseInt(
    process.env.MAX_CHAT_TURNS_PER_USER_PER_DAY ?? "30",
    10
  );
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: cuota } = await supabase
    .from("daily_chat_turns_by_user")
    .select("chat_turns")
    .eq("usage_date", hoy)
    .maybeSingle();

  if ((cuota?.chat_turns ?? 0) >= maximoDiario) {
    return NextResponse.json(
      {
        codigo: "limite_diario",
        mensaje: `Alcanzaste el límite de ${maximoDiario} preguntas por día. Vuelve mañana.`,
      },
      { status: 429 }
    );
  }

  // Mensaje del usuario con SU JWT: la RLS y los privilegios de columna
  // aplican (sender usuario, sin response_json ni created_at del cliente).
  const { data: mensajeUsuario, error: errorInsercion } = await supabase
    .from("messages")
    .insert({
      conversation_id: cuerpo.conversationId,
      sender: "usuario",
      content: cuerpo.mensaje,
    })
    .select("id")
    .single();

  if (errorInsercion || !mensajeUsuario) {
    return NextResponse.json(
      { codigo: "no_se_pudo_guardar", mensaje: errorInsercion?.message },
      { status: 500 }
    );
  }

  // Primer mensaje: el título de la conversación pasa a ser la pregunta.
  if (conversacion.title === "Nueva conversación") {
    await supabase
      .from("conversations")
      .update({ title: cuerpo.mensaje.slice(0, 80) })
      .eq("id", cuerpo.conversationId);
  }

  const admin = crearClienteAdmin();
  const modelId = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const requestId = crypto.randomUUID();
  const baseEventos = {
    userId: user.id,
    conversationId: cuerpo.conversationId,
    userMessageId: mensajeUsuario.id as string,
    modelId,
  };

  // Store(s) de File Search desde los documentos activos.
  const { data: documentos } = await admin
    .from("knowledge_documents")
    .select("file_search_store_name")
    .eq("active", true);

  const storeNames = [
    ...new Set(
      (documentos ?? []).map((d) => d.file_search_store_name as string)
    ),
  ];

  if (storeNames.length === 0) {
    const respuesta: RespuestaAsistente = {
      estado: "error",
      respuesta:
        "El chat aún no tiene documentos configurados. Contacta a la organización.",
      citas: [],
      metadata: metadataDe([], modelId, requestId, "servidor"),
    };
    const asistenteId = await guardarMensajeAsistente(
      admin,
      cuerpo.conversationId,
      respuesta.respuesta,
      { estado: "error", respuesta: respuesta.respuesta }
    );
    await registrarEventos(
      admin,
      { ...baseEventos, assistantMessageId: asistenteId },
      [
        {
          attemptIndex: 1,
          latencyMs: 0,
          status: "error",
          errorCode: "sin_documentos_activos",
          groundingDisponible: false,
        },
      ]
    );
    return NextResponse.json({ ...respuesta, mensajeId: asistenteId });
  }

  // Historial: últimos mensajes de la conversación (§10), sin el recién creado.
  const { data: previos } = await supabase
    .from("messages")
    .select("id, sender, content")
    .eq("conversation_id", cuerpo.conversationId)
    .order("created_at", { ascending: false })
    .limit(11);

  const historial: TurnoHistorial[] = (previos ?? [])
    .filter((m) => m.id !== mensajeUsuario.id && m.sender !== "sistema")
    .slice(0, 8)
    .reverse()
    .map((m) => ({
      role: m.sender === "usuario" ? ("user" as const) : ("model" as const),
      texto: m.content,
    }));

  const resultado = await llamarModelo({
    historial,
    pregunta: cuerpo.mensaje,
    storeNames,
  });

  if (resultado.tipo === "bloqueado") {
    // Bloqueo del proveedor: estado seguro de producto, no error (D-08).
    const respuestaJson = {
      estado: "bloqueado_por_seguridad",
      respuesta: MENSAJE_BLOQUEADO,
    };
    const asistenteId = await guardarMensajeAsistente(
      admin,
      cuerpo.conversationId,
      MENSAJE_BLOQUEADO,
      respuestaJson
    );
    await registrarEventos(
      admin,
      { ...baseEventos, assistantMessageId: asistenteId },
      resultado.intentos,
      { safetyBlockSource: "proveedor" }
    );
    const respuesta: RespuestaAsistente = {
      estado: "bloqueado_por_seguridad",
      respuesta: MENSAJE_BLOQUEADO,
      citas: [],
      metadata: metadataDe(resultado.intentos, modelId, requestId, "proveedor"),
    };
    return NextResponse.json({ ...respuesta, mensajeId: asistenteId });
  }

  if (resultado.tipo === "json_invalido") {
    const respuestaJson = { estado: "error", respuesta: MENSAJE_ERROR };
    const asistenteId = await guardarMensajeAsistente(
      admin,
      cuerpo.conversationId,
      MENSAJE_ERROR,
      respuestaJson
    );
    await registrarEventos(
      admin,
      { ...baseEventos, assistantMessageId: asistenteId },
      resultado.intentos
    );
    const respuesta: RespuestaAsistente = {
      estado: "error",
      respuesta: MENSAJE_ERROR,
      citas: [],
      metadata: metadataDe(resultado.intentos, modelId, requestId),
    };
    return NextResponse.json({ ...respuesta, mensajeId: asistenteId });
  }

  // JSON válido: normalizar citas del grounding (D-07) y persistir.
  const modelo = resultado.respuesta;
  const { citas: citasCrudas, faltaKnowledgeDocumentId } = normalizarCitas(
    resultado.response
  );

  // sin_fuente exige citas vacías (§7.2); las citas solo acompañan respuestas
  // con fundamento.
  const citas: CitaNormalizada[] =
    modelo.estado === "respondido" ? citasCrudas : [];

  const marcasCalidad: string[] = [];
  if (modelo.estado === "respondido" && citas.length === 0) {
    marcasCalidad.push("respondido_sin_citas");
  }
  if (faltaKnowledgeDocumentId && modelo.estado === "respondido") {
    marcasCalidad.push("missing_knowledge_document_id");
  }

  const asistenteId = await guardarMensajeAsistente(
    admin,
    cuerpo.conversationId,
    modelo.respuesta,
    // La respuesta normalizada NO duplica el arreglo de citas (D-12).
    modelo as unknown as Record<string, unknown>
  );

  if (citas.length > 0) {
    const { error: errorCitas } = await admin.from("citations").insert(
      citas.map((cita) => ({
        message_id: asistenteId,
        knowledge_document_id: cita.knowledgeDocumentId ?? null,
        document_title_snapshot: cita.documentTitleSnapshot,
        document_version_snapshot: cita.documentVersionSnapshot ?? null,
        page_number: cita.pageNumber ?? null,
        fragment: cita.fragment ?? null,
        file_search_store_name: cita.fileSearchStoreName ?? null,
        file_search_document_name: cita.fileSearchDocumentName ?? null,
        media_id: cita.mediaId ?? null,
      }))
    );
    if (errorCitas) {
      console.error("No se pudieron guardar las citas:", errorCitas.message);
    }
  }

  if (modelo.preguntaGuiada) {
    const { data: pregunta } = await admin
      .from("guided_questions")
      .insert({
        message_id: asistenteId,
        type: modelo.preguntaGuiada.tipo,
        text: modelo.preguntaGuiada.texto,
        allows_free_input: true,
      })
      .select("id")
      .single();
    if (pregunta) {
      await admin.from("guided_question_options").insert(
        modelo.preguntaGuiada.opciones.map((label, indice) => ({
          guided_question_id: pregunta.id,
          order_index: indice,
          label,
        }))
      );
    }
  }

  await registrarEventos(
    admin,
    { ...baseEventos, assistantMessageId: asistenteId },
    resultado.intentos,
    { calidad: marcasCalidad }
  );

  const respuesta: RespuestaAsistente = {
    estado: modelo.estado,
    respuesta: modelo.respuesta,
    citas,
    preguntaGuiada: modelo.preguntaGuiada,
    sugerencias: modelo.sugerencias,
    advertencias: modelo.advertencias,
    metadata: metadataDe(
      resultado.intentos,
      modelId,
      requestId,
      modelo.estado === "bloqueado_por_seguridad" ? "modelo" : undefined
    ),
  };

  return NextResponse.json({ ...respuesta, mensajeId: asistenteId });
}
