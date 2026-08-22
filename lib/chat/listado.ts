import "server-only";
import type { ConversacionListado } from "@/components/chat/tipos";
import { rangoDePagina } from "@/components/navegacion/paginacion";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Conversaciones activas del Scout, paginadas. PostgREST corta en
 * `db-max-rows` sin error: un tope fijo sin navegación dejaría hilos
 * antiguos inalcanzables.
 */
export async function listarConversacionesPropias(pagina: number) {
  const supabase = await crearClienteServidor();
  const [desde, hasta] = rangoDePagina(pagina);
  const { data, count, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at", { count: "exact" })
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .range(desde, hasta);

  if (error) {
    console.error("[listado] No se pudieron cargar las conversaciones:", error);
    return { conversaciones: [], total: null, error: true };
  }

  const conversaciones: ConversacionListado[] = (data ?? []).map((fila) => ({
    id: fila.id,
    title: fila.title,
  }));

  return { conversaciones, total: count, error: false };
}
