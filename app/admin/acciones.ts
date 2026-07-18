"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export type EstadoAccion = { error: string | null };

/**
 * Registra el motivo de acceso a una conversación ajena (P-RF-16/17).
 * Sin motivo no hay acceso; el evento es append-only.
 */
export async function registrarAccesoConversacion(
  _estadoPrevio: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const { user } = await requerirAdmin();

  const conversationId = String(formData.get("conversationId") ?? "");
  const categoria = String(formData.get("categoria") ?? "").trim();
  const detalle = String(formData.get("detalle") ?? "").trim();

  if (!conversationId) {
    return { error: "Falta la conversación." };
  }
  if (!categoria) {
    return { error: "Selecciona un motivo." };
  }
  if (categoria === "Otro" && detalle.length < 10) {
    return { error: "Describe el motivo (mínimo 10 caracteres)." };
  }

  const reason = detalle ? `${categoria}: ${detalle}` : categoria;

  const admin = crearClienteAdmin();
  const { error } = await admin.from("admin_audit_events").insert({
    admin_user_id: user.id,
    action: "view_user_conversation",
    target_type: "conversation",
    target_id: conversationId,
    reason,
  });

  if (error) {
    return { error: `No se pudo registrar el acceso: ${error.message}` };
  }

  revalidatePath(`/admin/conversaciones/${conversationId}`);
  return { error: null };
}

export async function cambiarEstadoDocumento(formData: FormData) {
  const { user } = await requerirAdmin();

  const id = String(formData.get("id") ?? "");
  const activar = String(formData.get("activar") ?? "") === "true";
  if (!id) {
    return;
  }

  const admin = crearClienteAdmin();
  const { error } = await admin
    .from("knowledge_documents")
    .update({ active: activar })
    .eq("id", id);

  if (!error) {
    await admin.from("admin_audit_events").insert({
      admin_user_id: user.id,
      action: "change_document_active",
      target_type: "knowledge_document",
      target_id: id,
      reason: activar
        ? "Activación manual desde el panel"
        : "Desactivación manual desde el panel",
    });
  }

  revalidatePath("/admin/documentos");
}

export async function cambiarEstadoCuenta(
  _estadoPrevio: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const { user } = await requerirAdmin();

  const userId = String(formData.get("userId") ?? "");
  const estado = String(formData.get("estado") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!["activo", "pendiente_autorizacion", "bloqueado"].includes(estado)) {
    return { error: "Estado inválido." };
  }
  if (motivo.length < 5) {
    return { error: "Escribe el motivo del cambio (mínimo 5 caracteres)." };
  }
  if (userId === user.id) {
    return { error: "No puedes cambiar tu propio estado." };
  }

  const admin = crearClienteAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ account_status: estado })
    .eq("id", userId);

  if (error) {
    return { error: `No se pudo cambiar el estado: ${error.message}` };
  }

  await admin.from("admin_audit_events").insert({
    admin_user_id: user.id,
    action: "change_user_status",
    target_type: "profile",
    target_id: userId,
    reason: `→ ${estado}: ${motivo}`,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}
