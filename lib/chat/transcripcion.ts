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
  /** La consulta de mensajes falló: no es lo mismo que una conversación vacía. */
  error: boolean;
  /**
   * Citas o preguntas guiadas incompletas (consulta fallida o cortada por
   * `db-max-rows`). Los mensajes sí se muestran, pero la UI avisa en vez de
   * dejar una respuesta fundamentada como si no tuviera fuentes.
   */
  adjuntosIncompletos: boolean;
};

/**
 * Carga un tramo de la transcripción, del más reciente hacia atrás.
 * `saltar` es cuántos mensajes omitir contando desde el final, así que el
 * tramo 0 son los últimos `MENSAJES_POR_TRAMO`.
 *
 * La RLS limita a conversaciones propias, así que este cliente (JWT del
 * usuario) no puede leer un hilo ajeno.
 */
export async function cargarTramo(
  conversationId: string,
  saltar = 0
): Promise<Tramo> {
  const supabase = await crearClienteServidor();
  const vacio: Tramo = {
    mensajes: [],
    hayMasAntiguos: false,
    error: false,
    adjuntosIncompletos: false,
  };

  const {
    data: filasDesc,
    count: totalMensajes,
    error: errorMensajes,
  } = await supabase
    .from("messages")
    .select("id, sender, content, response_json", { count: "exact" })
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(saltar, saltar + MENSAJES_POR_TRAMO - 1);

  if (errorMensajes) {
    return { ...vacio, error: true };
  }

  const filas = [...(filasDesc ?? [])].reverse();
  const hayMasAntiguos = (totalMensajes ?? 0) > saltar + filas.length;

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

  // El `count` frente a las filas recibidas delata el corte por `db-max-rows`,
  // que llega sin error.
  const adjuntosIncompletos =
    Boolean(errorCitas) ||
    Boolean(errorPreguntas) ||
    (totalCitas ?? 0) > (citas ?? []).length ||
    (totalPreguntas ?? 0) > (preguntas ?? []).length;

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

  return { mensajes, hayMasAntiguos, error: false, adjuntosIncompletos };
}
