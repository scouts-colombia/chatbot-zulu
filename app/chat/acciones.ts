"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarTramo } from "@/lib/chat/transcripcion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esUuid } from "@/lib/uuid";

export async function crearConversacion(formData?: FormData) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear la conversación: ${error?.message}`);
  }

  const borrador = formData?.get("borrador");
  const query = esUuid(borrador)
    ? `?borrador=${encodeURIComponent(borrador)}`
    : "";
  redirect(`/chat/${data.id}${query}`);
}

export async function archivarConversacion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  const supabase = await crearClienteServidor();
  // La RLS ya limita a conversaciones propias; un id ajeno afecta cero filas
  // sin error, así que se pide el id de vuelta para saber si pasó algo.
  const { data, error } = await supabase
    .from("conversations")
    .update({ archived: true })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  revalidatePath("/");
  // Sin esto, un fallo devolvía al listado con la conversación aún ahí y sin
  // ningún aviso: la lectura natural es que el botón está roto.
  if (error || !data) {
    redirect("/?aviso=archivar");
  }
  redirect("/");
}

/**
 * Devuelve el tramo anterior a `cursor` para el botón "Ver mensajes
 * anteriores". La RLS limita a conversaciones propias, así que el cursor no
 * puede usarse para leer un hilo ajeno.
 */
export async function cargarMensajesAnteriores(
  conversationId: string,
  cursor: string
) {
  const tramo = await cargarTramo(conversationId, cursor);
  return {
    mensajes: tramo.mensajes,
    hayMasAntiguos: tramo.hayMasAntiguos,
    cursor: tramo.cursor,
    error: tramo.error,
  };
}
