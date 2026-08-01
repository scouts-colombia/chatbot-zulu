import "server-only";
import type { MensajeUI } from "@/components/chat/tipos";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Mensajes por tramo. PostgREST corta la respuesta en `db-max-rows` (1000 por
 * defecto en Supabase) SIN devolver error, así que una consulta sin acotar se
 * lee como historial completo: con la cuota de 30 turnos/día (2 filas por
 * turno) un hilo cruza ese tope en ~17 días, y `citations` antes todavía (una
 * fila por chunk de grounding). El tramo es chico para que la consulta de citas
 * de un tramo quede lejos del mismo tope, y para no montar cientos de burbujas
 * de Markdown de golpe en un móvil.
 */
export const MENSAJES_POR_TRAMO = 60;

export type Tramo = {
  mensajes: MensajeUI[];
  /** Quedan mensajes más antiguos por cargar. */
  hayMasAntiguos: boolean;
  /**
   * `created_at` del mensaje más antiguo de este tramo. Es el cursor para pedir
   * el siguiente: un desplazamiento numérico se desfasa en cuanto el usuario
   * envía un turno nuevo (la conversación crece por el final), y el tramo
   * siguiente repetiría mensajes ya visibles.
   */
  cursor: string | null;
  /**
   * La carga falló. Incluye el fallo de las consultas de citas y preguntas
   * guiadas: renderizar los mensajes sin ellas mostraría respuestas
   * fundamentadas como si no tuvieran fuentes y aclaraciones sin sus opciones.
   */
  error: boolean;
};

/**
 * Carga un tramo de la transcripción, del más reciente hacia atrás.
 * Sin `antesDe` devuelve el tramo final; con él, los anteriores a ese instante.
 *
 * La RLS limita a conversaciones propias, así que este cliente (JWT del
 * usuario) no puede leer un hilo ajeno.
 */
export async function cargarTramo(
  conversationId: string,
  antesDe?: string
): Promise<Tramo> {
  const supabase = await crearClienteServidor();
  const vacio: Tramo = {
    mensajes: [],
    hayMasAntiguos: false,
    cursor: null,
    error: false,
  };

  // Se pide uno de más para saber si quedan anteriores sin depender de un
  // `count` total, que con cursor no diría nada sobre este tramo.
  let consulta = supabase
    .from("messages")
    .select("id, sender, content, created_at, response_json")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MENSAJES_POR_TRAMO + 1);
  if (antesDe) {
    consulta = consulta.lt("created_at", antesDe);
  }
  const { data: filasDesc, error: errorMensajes } = await consulta;

  if (errorMensajes) {
    return { ...vacio, error: true };
  }

  const recibidas = filasDesc ?? [];
  const hayMasAntiguos = recibidas.length > MENSAJES_POR_TRAMO;
  const filas = [...recibidas.slice(0, MENSAJES_POR_TRAMO)].reverse();
  const cursor = (filas.at(0)?.created_at as string | undefined) ?? null;

  const idsAsistente = filas
    .filter((fila) => fila.sender === "asistente")
    .map((fila) => fila.id);

  const [
    { data: citas, count: totalCitas, error: errorCitas },
    { data: preguntas, count: totalPreguntas, error: errorPreguntas },
  ] = await Promise.all([
    idsAsistente.length > 0
      ? supabase
          .from("citations")
          .select("message_id, document_title_snapshot, page_number", {
            count: "exact",
          })
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[], count: 0, error: null }),
    idsAsistente.length > 0
      ? supabase
          .from("guided_questions")
          .select(
            "id, message_id, text, guided_question_options(label, order_index)",
            { count: "exact" }
          )
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[], count: 0, error: null }),
  ]);

  // Adjuntos incompletos hacen fallar el tramo entero: mostrar los mensajes sin
  // ellos dejaría una respuesta fundamentada sin sus fuentes y una aclaración
  // sin sus opciones, sin que el usuario tenga forma de notarlo. El `count`
  // frente a las filas recibidas delata además el corte por `db-max-rows`, que
  // llega sin error.
  const adjuntosIncompletos =
    Boolean(errorCitas) ||
    Boolean(errorPreguntas) ||
    (totalCitas ?? 0) > (citas ?? []).length ||
    (totalPreguntas ?? 0) > (preguntas ?? []).length;

  if (adjuntosIncompletos) {
    return { ...vacio, error: true };
  }

  const mensajes: MensajeUI[] = filas.map((fila) => {
    const estado = (fila.response_json as { estado?: string } | null)?.estado;
    const pregunta = (preguntas ?? []).find((p) => p.message_id === fila.id);
    return {
      id: fila.id,
      sender: fila.sender as MensajeUI["sender"],
      content: fila.content,
      estado: estado === "respondido" ? undefined : estado,
      citas: (citas ?? [])
        .filter((cita) => cita.message_id === fila.id)
        .map((cita) => ({
          titulo: cita.document_title_snapshot,
          pagina: cita.page_number,
        })),
      preguntaGuiada: pregunta
        ? {
            texto: pregunta.text,
            opciones: [...(pregunta.guided_question_options ?? [])]
              .sort((a, b) => a.order_index - b.order_index)
              .map((opcion) => opcion.label),
          }
        : undefined,
    };
  });

  return { mensajes, hayMasAntiguos, cursor, error: false };
}
