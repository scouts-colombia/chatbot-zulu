import { cookies } from "next/headers";
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
import { construirFilasEventos } from "@/lib/chat/telemetria";
import {
  COOKIE_DISPOSITIVO_INVITADO,
  COOKIE_PREFLIGHT_INVITADO,
  construirIdentidadInvitada,
  crearIdDispositivo,
  DURACION_PREFLIGHT_INVITADO_SEGUNDOS,
  esIdDispositivoValido,
  esIdPreflightValido,
  type IdentidadInvitada,
} from "@/lib/invitados/identidad";
import { respuestaRegistroPorLimite } from "@/lib/invitados/limites";

import {
  URL_POLITICA_PRIVACIDAD,
  VERSION_POLITICA_PRIVACIDAD,
} from "@/lib/privacidad";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export const maxDuration = 60;

const CuerpoSchema = z.object({
  conversationId: z.string().uuid().optional(),
  mensaje: z.string().trim().min(1).max(2000),
  aceptaPolitica: z.boolean().optional(),
});

const MENSAJE_BLOQUEADO =
  "No puedo ayudarte con ese tema desde este chat. Si necesitas apoyo, acude a un dirigente o adulto responsable de tu grupo.";
const MENSAJE_ERROR =
  "Tuvimos un problema generando la respuesta. Vuelve a intentarlo en un momento.";
const MENSAJE_ERROR_INVITADO =
  "No pudimos generar la respuesta de prueba. Para volver a intentarlo, crea una cuenta o inicia sesión.";

function ahora() {
  return new Date().toISOString();
}

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

async function obtenerIdentidadInvitada(request: Request) {
  const secret = process.env.GUEST_LIMIT_SECRET ?? "";
  const cookieStore = await cookies();
  const cookieActual = cookieStore.get(COOKIE_DISPOSITIVO_INVITADO)?.value;
  const deviceId = esIdDispositivoValido(cookieActual)
    ? (cookieActual as string)
    : crearIdDispositivo();

  if (deviceId !== cookieActual) {
    cookieStore.set(COOKIE_DISPOSITIVO_INVITADO, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return construirIdentidadInvitada({ request, deviceId, secret });
}

async function liberarPreflight(
  admin: ClienteAdmin,
  preflightId: string | null
) {
  if (!preflightId) {
    return true;
  }
  const { error } = await admin.rpc("liberar_preflight_turno_invitado", {
    p_preflight_id: preflightId,
  });
  if (error) {
    console.error("[chat] No se pudo liberar el preflight invitado:", error);
    return false;
  }
  return true;
}

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
  const filas = construirFilasEventos(base, intentos, opciones);

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

async function descartarRespuestaIncompleta(
  admin: ClienteAdmin,
  assistantMessageId: string
) {
  const { error } = await admin
    .from("messages")
    .delete()
    .eq("id", assistantMessageId);
  if (error) {
    console.error(
      "[chat] No se pudo descartar la respuesta incompleta:",
      error
    );
  }
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
    inputTokens: ultimo?.promptTokens,
    outputTokens: ultimo?.candidatesTokens,
    totalTokens: ultimo?.totalTokens,
    groundingDisponible: ultimo?.groundingDisponible ?? false,
    finishReason: ultimo?.finishReason,
    safetyBlockSource,
    createdAt: ahora(),
  };
}

export async function POST(request: Request) {
  let cuerpo: z.infer<typeof CuerpoSchema>;
  try {
    cuerpo = CuerpoSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ codigo: "solicitud_invalida" }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  const admin = crearClienteAdmin();
  const cookieStore = await cookies();
  const {
    data: { user },
    error: errorAutenticacion,
  } = await supabase.auth.getUser();
  const sesionAusente = errorAutenticacion?.name === "AuthSessionMissingError";
  if (errorAutenticacion && !sesionAusente) {
    console.error("[chat] No se pudo verificar la sesión:", errorAutenticacion);
    return NextResponse.json(
      {
        codigo: "autenticacion_no_disponible",
        mensaje: "No pudimos verificar tu sesión. Intenta de nuevo.",
      },
      { status: 503 }
    );
  }

  const preflightCookie = cookieStore.get(COOKIE_PREFLIGHT_INVITADO)?.value;
  let identidadInvitada: IdentidadInvitada | null = null;
  let preflightId: string | null = null;
  const limpiarPreparacionInvitada = async () => {
    const liberado = await liberarPreflight(admin, preflightId);
    if (liberado) {
      preflightId = null;
      cookieStore.delete(COOKIE_PREFLIGHT_INVITADO);
    }
  };
  const responderLiberandoPreflight = async (
    cuerpoRespuesta: Record<string, unknown>,
    init: ResponseInit
  ) => {
    await limpiarPreparacionInvitada();
    return NextResponse.json(cuerpoRespuesta, init);
  };

  if (!user) {
    return NextResponse.json(
      {
        codigo: "sesion_invitada_requerida",
        mensaje: "Prepara tu sesión de prueba e intenta de nuevo.",
      },
      { status: 401 }
    );
  }

  const esInvitado = user.is_anonymous === true;
  if (esInvitado && esIdPreflightValido(preflightCookie)) {
    preflightId = preflightCookie as string;
  }

  // Estado de cuenta y consentimiento: lógica de API, no RLS (CLAUDE.md).
  const { data: perfil, error: errorPerfil } = await supabase
    .from("profiles")
    .select("account_status, privacy_policy_version_accepted")
    .eq("id", user.id)
    .maybeSingle();

  if (errorPerfil) {
    console.error("[chat] No se pudo verificar el perfil:", errorPerfil);
    return responderLiberandoPreflight(
      {
        codigo: "perfil_no_disponible",
        mensaje: "No pudimos verificar tu acceso. Intenta de nuevo.",
      },
      { status: 503 }
    );
  }

  if (perfil?.account_status !== "activo") {
    return responderLiberandoPreflight(
      {
        codigo: "cuenta_inactiva",
        mensaje: "Tu cuenta no está habilitada para usar el chat.",
      },
      { status: 403 }
    );
  }

  // Gate de consentimiento (P-RF-04). Se activa fijando PRIVACY_POLICY_VERSION
  // cuando la organización publique el texto de la política; hasta entonces no
  // hay versión que aceptar.
  const requiereConsentimiento =
    perfil.privacy_policy_version_accepted !== VERSION_POLITICA_PRIVACIDAD;
  if (requiereConsentimiento && !(esInvitado && cuerpo.aceptaPolitica)) {
    return responderLiberandoPreflight(
      {
        codigo: "consentimiento_requerido",
        mensaje:
          "Debes aceptar la política de privacidad vigente antes de usar el chat.",
      },
      { status: 403 }
    );
  }

  // Conversación propia y activa (la RLS limita a lo propio).
  if (esInvitado && !identidadInvitada) {
    try {
      identidadInvitada = await obtenerIdentidadInvitada(request);
    } catch (error) {
      console.error("[chat] Identidad invitada no disponible:", error);
      return responderLiberandoPreflight(
        {
          codigo: "invitado_no_disponible",
          mensaje:
            "El turno de prueba no est\u00e1 disponible en este momento. Intenta de nuevo m\u00e1s tarde.",
        },
        { status: 503 }
      );
    }
  }

  if (esInvitado && !preflightId && identidadInvitada) {
    const preflight = await admin.rpc("preparar_turno_invitado", {
      p_device_hash: identidadInvitada.deviceHash,
      p_environment_hash: identidadInvitada.environmentHash,
      p_network_hash: identidadInvitada.networkHash,
    });
    if (preflight.error || !preflight.data) {
      if (
        /limite_invitado|limite_red_invitada/.test(
          preflight.error?.message ?? ""
        )
      ) {
        return responderLiberandoPreflight(
          respuestaRegistroPorLimite(preflight.error?.message ?? ""),
          { status: 429 }
        );
      }
      console.error(
        "[chat] No se pudo preparar el turno invitado:",
        preflight.error
      );
      return responderLiberandoPreflight(
        {
          codigo: "invitado_no_disponible",
          mensaje:
            "El turno de prueba no est\u00e1 disponible en este momento. Intenta de nuevo m\u00e1s tarde.",
        },
        { status: 503 }
      );
    }
    preflightId = preflight.data as string;
    cookieStore.set(COOKIE_PREFLIGHT_INVITADO, preflightId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_PREFLIGHT_INVITADO_SEGUNDOS,
    });
  }
  let conversationId = cuerpo.conversationId;
  if (!conversationId && esInvitado) {
    const { data: preparada, error: errorPreparada } = await admin.rpc(
      "obtener_o_crear_conversacion_invitada",
      { p_user_id: user.id }
    );
    if (errorPreparada || !preparada) {
      console.error(
        "[chat] No se pudo preparar la conversación invitada:",
        errorPreparada
      );
      return responderLiberandoPreflight(
        {
          codigo: "conversacion_no_disponible",
          mensaje: "No pudimos preparar tu conversación. Intenta de nuevo.",
        },
        { status: 503 }
      );
    }
    conversationId = preparada as string;
  }
  if (!conversationId) {
    return responderLiberandoPreflight(
      { codigo: "solicitud_invalida" },
      { status: 400 }
    );
  }

  const { data: conversacion, error: errorConversacion } = await supabase
    .from("conversations")
    .select("id, archived, title")
    .eq("id", conversationId)
    .maybeSingle();

  if (errorConversacion) {
    console.error(
      "[chat] No se pudo verificar la conversación:",
      errorConversacion
    );
    return responderLiberandoPreflight(
      {
        codigo: "conversacion_no_disponible",
        mensaje: "No pudimos abrir la conversación. Intenta de nuevo.",
      },
      { status: 503 }
    );
  }
  if (!conversacion) {
    return responderLiberandoPreflight(
      { codigo: "conversacion_no_encontrada" },
      { status: 404 }
    );
  }
  if (conversacion.archived) {
    return responderLiberandoPreflight(
      { codigo: "conversacion_archivada" },
      { status: 409 }
    );
  }

  // Cuota + inserción del mensaje en UNA operación atómica (D-11): la función
  // serializa por usuario con advisory lock, así N requests concurrentes no
  // pueden superar el límite. Corre con el JWT del usuario (security invoker):
  // la RLS y los privilegios de columna siguen aplicando por dentro.
  let idTurno: unknown;
  let errorTurno: { message: string } | null = null;

  if (esInvitado) {
    if (!identidadInvitada || !preflightId) {
      return responderLiberandoPreflight(
        {
          codigo: "invitado_no_disponible",
          mensaje:
            "El turno de prueba no est\u00e1 disponible en este momento. Intenta de nuevo m\u00e1s tarde.",
        },
        { status: 503 }
      );
    }

    const reserva = await admin.rpc("reservar_turno_invitado_v2", {
      p_preflight_id: preflightId,
      p_user_id: user.id,
      p_conversation_id: conversationId,
      p_content: cuerpo.mensaje,
      p_device_hash: identidadInvitada.deviceHash,
      p_environment_hash: identidadInvitada.environmentHash,
      p_network_hash: identidadInvitada.networkHash,
      p_policy_version: VERSION_POLITICA_PRIVACIDAD,
      p_policy_url: URL_POLITICA_PRIVACIDAD,
      p_user_agent_hash: identidadInvitada.userAgentHash,
    });
    idTurno = reserva.data;
    errorTurno = reserva.error;
    if (errorTurno || !idTurno) {
      await limpiarPreparacionInvitada();
    } else {
      preflightId = null;
      cookieStore.delete(COOKIE_PREFLIGHT_INVITADO);
    }
  } else {
    const turno = await supabase.rpc("insertar_turno_usuario", {
      p_conversation_id: conversationId,
      p_content: cuerpo.mensaje,
    });
    idTurno = turno.data;
    errorTurno = turno.error;
  }

  if (errorTurno || !idTurno) {
    if (
      esInvitado &&
      /limite_invitado|limite_red_invitada/.test(errorTurno?.message ?? "")
    ) {
      return NextResponse.json(
        respuestaRegistroPorLimite(errorTurno?.message ?? ""),
        { status: 429 }
      );
    }
    const limite = errorTurno?.message.match(/limite_diario:(\d+)/);
    if (limite) {
      return NextResponse.json(
        {
          codigo: "limite_diario",
          mensaje: `Alcanzaste el límite de ${limite[1]} preguntas por día. Vuelve mañana.`,
        },
        { status: 429 }
      );
    }
    // El detalle crudo de Postgres (funciones, columnas, constraints, timeouts
    // del rol) no va a la pantalla de un Scout: se registra en servidor.
    if (errorTurno) {
      console.error(
        esInvitado
          ? "[chat] reservar_turno_invitado"
          : "[chat] insertar_turno_usuario",
        errorTurno
      );
    }
    return NextResponse.json(
      {
        codigo: "no_se_pudo_guardar",
        mensaje:
          "No pudimos registrar tu pregunta. Inténtalo de nuevo en un momento.",
      },
      { status: 500 }
    );
  }

  const mensajeUsuario = { id: idTurno as string };

  try {
    // Primer mensaje: el título pasa a ser la pregunta. Todo turno aceptado
    // toca updated_at para que la lista ordene por actividad real (el trigger
    // set_updated_at pone el valor).
    if (conversacion.title === "Nueva conversación") {
      const clienteEscritura = esInvitado ? admin : supabase;
      await clienteEscritura
        .from("conversations")
        .update({ title: cuerpo.mensaje.slice(0, 80) })
        .eq("id", conversationId);
    } else {
      await admin
        .from("conversations")
        .update({ updated_at: ahora() })
        .eq("id", conversationId);
    }
    const modelId = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
    const requestId = crypto.randomUUID();
    const baseEventos = {
      userId: user.id,
      conversationId,
      userMessageId: mensajeUsuario.id as string,
      modelId,
    };

    // Store(s) y documentos ACTIVOS. File Search recupera a nivel de store,
    // así que además del nombre del store se construye un metadataFilter por
    // knowledge_document_id: un documento desactivado no debe fundamentar
    // respuestas aunque siga dentro del store.
    const { data: documentos, error: errorDocumentos } = await admin
      .from("knowledge_documents")
      .select("id, file_search_store_name")
      .eq("active", true);

    if (errorDocumentos) {
      throw new Error("consulta_documentos_activos_fallida");
    }

    const storeNames = [
      ...new Set(
        (documentos ?? []).map((d) => d.file_search_store_name as string)
      ),
    ];
    const metadataFilter = (documentos ?? [])
      .map((d) => `knowledge_document_id = "${d.id as string}"`)
      .join(" OR ");

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
        conversationId,
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
      return NextResponse.json({
        ...respuesta,
        mensajeId: asistenteId,
        conversationId,
      });
    }

    // Historial: últimos mensajes de la conversación (§10), sin el recién creado.
    const { data: previos, error: errorHistorial } = await supabase
      .from("messages")
      .select("id, sender, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(11);

    if (errorHistorial) {
      throw new Error("consulta_historial_fallida");
    }

    // Cada turno del historial va acotado: el límite duro vive en la base
    // (constraint de 0007 para sender='usuario'), y este slice defiende el
    // prompt ante filas legadas o respuestas largas del asistente.
    const historial: TurnoHistorial[] = (previos ?? [])
      .filter((m) => m.id !== mensajeUsuario.id && m.sender !== "sistema")
      .slice(0, 8)
      .reverse()
      .map((m) => ({
        role: m.sender === "usuario" ? ("user" as const) : ("model" as const),
        texto: m.content.slice(0, 4000),
      }));

    const resultado = await llamarModelo({
      historial,
      pregunta: cuerpo.mensaje,
      storeNames,
      metadataFilter,
    });

    if (resultado.tipo === "bloqueado") {
      // Bloqueo del proveedor: estado seguro de producto, no error (D-08).
      const respuestaJson = {
        estado: "bloqueado_por_seguridad",
        respuesta: MENSAJE_BLOQUEADO,
      };
      const asistenteId = await guardarMensajeAsistente(
        admin,
        conversationId,
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
        metadata: metadataDe(
          resultado.intentos,
          modelId,
          requestId,
          "proveedor"
        ),
      };
      return NextResponse.json({
        ...respuesta,
        mensajeId: asistenteId,
        conversationId,
      });
    }

    if (resultado.tipo === "json_invalido") {
      const mensajeError = esInvitado ? MENSAJE_ERROR_INVITADO : MENSAJE_ERROR;
      const respuestaJson = { estado: "error", respuesta: mensajeError };
      const asistenteId = await guardarMensajeAsistente(
        admin,
        conversationId,
        mensajeError,
        respuestaJson
      );
      await registrarEventos(
        admin,
        { ...baseEventos, assistantMessageId: asistenteId },
        resultado.intentos
      );
      const respuesta: RespuestaAsistente = {
        estado: "error",
        respuesta: mensajeError,
        citas: [],
        metadata: metadataDe(resultado.intentos, modelId, requestId),
      };
      return NextResponse.json({
        ...respuesta,
        mensajeId: asistenteId,
        conversationId,
      });
    }

    // JSON válido: normalizar citas del grounding (D-07) y persistir.
    const modelo = resultado.respuesta;

    // Bloqueo emitido por el MODELO en JSON válido (§15.1): mismo mensaje
    // seguro y breve que el bloqueo del proveedor. No se persiste ni se
    // muestra el texto del modelo (minimización de datos con menores).
    if (modelo.estado === "bloqueado_por_seguridad") {
      const respuestaJson = {
        estado: "bloqueado_por_seguridad",
        respuesta: MENSAJE_BLOQUEADO,
      };
      const asistenteId = await guardarMensajeAsistente(
        admin,
        conversationId,
        MENSAJE_BLOQUEADO,
        respuestaJson
      );
      await registrarEventos(
        admin,
        { ...baseEventos, assistantMessageId: asistenteId },
        resultado.intentos,
        { safetyBlockSource: "modelo" }
      );
      const respuesta: RespuestaAsistente = {
        estado: "bloqueado_por_seguridad",
        respuesta: MENSAJE_BLOQUEADO,
        citas: [],
        metadata: metadataDe(resultado.intentos, modelId, requestId, "modelo"),
      };
      return NextResponse.json({
        ...respuesta,
        mensajeId: asistenteId,
        conversationId,
      });
    }

    const { citas: citasCrudas, faltaKnowledgeDocumentId } = normalizarCitas(
      resultado.response
    );

    // sin_fuente exige citas vacías (§7.2); las citas solo acompañan respuestas
    // con fundamento.
    let citas: CitaNormalizada[] =
      modelo.estado === "respondido" ? citasCrudas : [];

    // El snapshot de versión confiable es el de knowledge_documents (§7.1
    // regla 3); el custom_metadata del proveedor queda solo como fallback.
    const idsDocumentos = [
      ...new Set(
        citas
          .map((cita) => cita.knowledgeDocumentId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    // El título NO se sobrescribe con `display_name`: §7.1 regla 4 pide guardar
    // `retrievedContext.title` como título visible citado, o sea el nombre del
    // artefacto que el grounding devolvió de verdad. Pisarlo con la etiqueta
    // (mutable) de la base ocultaría un desajuste entre el store y la tabla, así
    // que cuando difieren se emite una marca de calidad y se reindexa el
    // documento, que es lo que corrige el origen.
    let tituloDesalineado = false;
    if (idsDocumentos.length > 0) {
      const { data: documentos, error: errorMetadataCitas } = await admin
        .from("knowledge_documents")
        .select("id, version, display_name")
        .in("id", idsDocumentos);
      if (errorMetadataCitas) {
        console.error(
          "[chat] No se pudo consultar la metadata local de las citas:",
          errorMetadataCitas
        );
        throw new Error("consulta_metadata_citas_fallida");
      }
      const docPorId = new Map(
        (documentos ?? []).map((doc) => [doc.id as string, doc])
      );
      citas = citas.map((cita) => {
        const doc = cita.knowledgeDocumentId
          ? docPorId.get(cita.knowledgeDocumentId)
          : undefined;
        if (!doc) {
          return cita;
        }
        if (doc.display_name !== cita.documentTitleSnapshot) {
          tituloDesalineado = true;
        }
        return { ...cita, documentVersionSnapshot: doc.version as string };
      });
    }

    const marcasCalidad: string[] = [];
    if (modelo.estado === "respondido" && citas.length === 0) {
      marcasCalidad.push("respondido_sin_citas");
    }
    if (faltaKnowledgeDocumentId && modelo.estado === "respondido") {
      marcasCalidad.push("missing_knowledge_document_id");
    }
    // El documento del store y su fila local llevan títulos distintos: el store
    // quedó desactualizado (su displayName no se puede editar en sitio) y hay que
    // reindexar ese documento. Se registra en vez de taparlo pisando el snapshot.
    if (tituloDesalineado) {
      marcasCalidad.push("titulo_desalineado");
    }

    const asistenteId = await guardarMensajeAsistente(
      admin,
      conversationId,
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
        // La tabla citations es la única fuente de verdad (D-12): si no se
        // persistieron, no se devuelven citas que desaparecerían al recargar.
        console.error("No se pudieron guardar las citas:", errorCitas.message);
        citas = [];
        marcasCalidad.push("citas_no_persistidas");
      }
    }

    if (modelo.preguntaGuiada) {
      const { data: pregunta, error: errorPregunta } = await admin
        .from("guided_questions")
        .insert({
          message_id: asistenteId,
          type: modelo.preguntaGuiada.tipo,
          text: modelo.preguntaGuiada.texto,
          allows_free_input: true,
        })
        .select("id")
        .single();
      if (errorPregunta || !pregunta) {
        console.error(
          "[chat] No se pudo guardar la pregunta guiada:",
          errorPregunta
        );
        await descartarRespuestaIncompleta(admin, asistenteId);
        throw new Error("persistencia_pregunta_guiada_fallida");
      }

      const { error: errorOpciones } = await admin
        .from("guided_question_options")
        .insert(
          modelo.preguntaGuiada.opciones.map((label, indice) => ({
            guided_question_id: pregunta.id,
            order_index: indice,
            label,
          }))
        );
      if (errorOpciones) {
        console.error(
          "[chat] No se pudieron guardar las opciones guiadas:",
          errorOpciones
        );
        await descartarRespuestaIncompleta(admin, asistenteId);
        throw new Error("persistencia_opciones_guiadas_fallida");
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
      metadata: metadataDe(resultado.intentos, modelId, requestId),
    };

    return NextResponse.json({
      ...respuesta,
      mensajeId: asistenteId,
      conversationId,
    });
  } catch (error) {
    console.error("[chat] Fallo posterior a registrar la pregunta:", error);
    if (esInvitado) {
      return NextResponse.json(
        {
          codigo: "registro_requerido",
          mensaje:
            "Tu pregunta de prueba quedó registrada, pero no pudimos completar la respuesta. Crea una cuenta o inicia sesión para continuar.",
        },
        { status: 503 }
      );
    }
    throw error;
  } finally {
    if (esInvitado) {
      try {
        const finalizacion = await admin.rpc("finalizar_turno_invitado", {
          p_user_message_id: mensajeUsuario.id,
          p_anonymous_user_id: user.id,
        });
        if (finalizacion.error || finalizacion.data !== true) {
          console.error(
            "[chat] No se pudo finalizar el turno invitado:",
            finalizacion.error
          );
        }
      } catch (error) {
        console.error(
          "[chat] Falló la finalización del turno invitado:",
          error
        );
      }
    }
  }
}
