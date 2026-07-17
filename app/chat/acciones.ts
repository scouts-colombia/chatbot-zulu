"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function crearConversacion() {
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

  redirect(`/chat/${data.id}`);
}

export async function archivarConversacion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  const supabase = await crearClienteServidor();
  await supabase.from("conversations").update({ archived: true }).eq("id", id);
  revalidatePath("/");
  redirect("/");
}
