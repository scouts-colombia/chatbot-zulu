"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export type EstadoAccion = { error: string | null };

/**
 * Activa/desactiva un documento con auditoría atómica (RPC): o se aplican
 * el cambio y el evento juntos, o no se aplica ninguno. Activar exige que
 * el documento tenga metadata sincronizada y sin error de indexación.
 */
export async function cambiarEstadoDocumento(
  _estadoPrevio: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const { user } = await requerirAdmin();

  const id = String(formData.get("id") ?? "");
  const activar = String(formData.get("activar") ?? "") === "true";
  if (!id) {
    return { error: "Falta el documento." };
  }

  const admin = crearClienteAdmin();
  const { error } = await admin.rpc("admin_cambiar_documento_activo", {
    p_admin_user_id: user.id,
    p_document_id: id,
    p_activar: activar,
    p_reason: activar
      ? "Activación manual desde el panel"
      : "Desactivación manual desde el panel",
  });

  if (error) {
    if (error.message.includes("documento_no_listo")) {
      return {
        error:
          "El documento no está listo para activarse: no tiene metadata confirmada con el proveedor o tiene un error de indexación.",
      };
    }
    return { error: `No se pudo cambiar el documento: ${error.message}` };
  }

  revalidatePath("/admin/documentos");
  return { error: null };
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

  // RPC atómica: el cambio de estado y su evento de auditoría se confirman
  // juntos; si la auditoría no se puede registrar, el cambio no ocurre.
  const admin = crearClienteAdmin();
  const { error } = await admin.rpc("admin_cambiar_estado_cuenta", {
    p_admin_user_id: user.id,
    p_user_id: userId,
    p_estado: estado,
    p_reason: `→ ${estado}: ${motivo}`,
  });

  if (error) {
    if (error.message.includes("perfil_no_encontrado")) {
      return { error: "No existe ese usuario." };
    }
    return { error: `No se pudo cambiar el estado: ${error.message}` };
  }

  revalidatePath("/admin/usuarios");
  return { error: null };
}
