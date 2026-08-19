"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/admin/guard";
import { ConfiguracionChatSchema } from "@/lib/configuracion/chat";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export type EstadoAccion = { error: string | null };

/**
 * Errores que las RPC administrativas levantan a propósito (0008, 0009). El
 * detalle crudo de Postgres —nombres de funciones, columnas, constraints— no
 * llega a la UI: se registra en servidor y el admin ve algo accionable.
 */
const MENSAJES_ERROR: Record<string, string> = {
  admin_no_autorizado:
    "Tu sesión de administrador ya no está activa. Vuelve a iniciar sesión.",
  documento_no_listo:
    "El documento no está listo para activarse: no tiene metadata confirmada con el proveedor o tiene un error de indexación.",
  documento_no_encontrado: "No existe ese documento.",
  perfil_no_encontrado: "No existe ese usuario.",
  estado_invalido: "Estado inválido.",
  auto_cambio_no_permitido: "No puedes cambiar tu propio estado.",
  configuracion_invalida:
    "Alguno de los valores está fuera del rango permitido.",
};

function mensajeDeError(error: { message: string }, contexto: string): string {
  for (const [codigo, mensaje] of Object.entries(MENSAJES_ERROR)) {
    if (error.message.includes(codigo)) {
      return mensaje;
    }
  }
  console.error(`[admin] ${contexto}`, error);
  return "No se pudo aplicar el cambio. Intenta de nuevo.";
}

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
    return { error: mensajeDeError(error, "cambiarEstadoDocumento") };
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
    return { error: mensajeDeError(error, "cambiarEstadoCuenta") };
  }

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export type EstadoConfiguracion = {
  error: string | null;
  guardado: boolean;
};

export async function guardarConfiguracionChat(
  _estadoPrevio: EstadoConfiguracion,
  formData: FormData
): Promise<EstadoConfiguracion> {
  const { user } = await requerirAdmin();
  const resultado = ConfiguracionChatSchema.safeParse({
    modelo: formData.get("modelo"),
    nivelRazonamiento: formData.get("nivelRazonamiento"),
    maxTurnosRegistradoPorDia: formData.get("maxTurnosRegistradoPorDia"),
    maxTurnosInvitadoPorPersonaPorDia: formData.get(
      "maxTurnosInvitadoPorPersonaPorDia"
    ),
    maxTurnosInvitadoPorRedPorDia: formData.get(
      "maxTurnosInvitadoPorRedPorDia"
    ),
  });

  if (!resultado.success) {
    return {
      error: "Revisa el modelo y los límites indicados.",
      guardado: false,
    };
  }

  const configuracion = resultado.data;
  const { error } = await crearClienteAdmin().rpc(
    "admin_actualizar_configuracion_chat",
    {
      p_admin_user_id: user.id,
      p_gemini_model: configuracion.modelo,
      p_gemini_thinking_level: configuracion.nivelRazonamiento,
      p_max_registered_daily: configuracion.maxTurnosRegistradoPorDia,
      p_max_guest_person_daily: configuracion.maxTurnosInvitadoPorPersonaPorDia,
      p_max_guest_network_daily: configuracion.maxTurnosInvitadoPorRedPorDia,
    }
  );

  if (error) {
    return {
      error: mensajeDeError(error, "guardarConfiguracionChat"),
      guardado: false,
    };
  }

  revalidatePath("/admin/configuracion");
  return { error: null, guardado: true };
}
