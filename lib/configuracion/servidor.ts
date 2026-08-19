import "server-only";
import { crearClienteAdmin } from "../supabase/admin";
import { CLAVES_CONFIGURACION_CHAT, resolverConfiguracionChat } from "./chat";

export async function cargarConfiguracionChat() {
  const { data, error } = await crearClienteAdmin()
    .from("app_settings")
    .select("clave, valor")
    .in("clave", [...CLAVES_CONFIGURACION_CHAT]);

  if (error) {
    console.error("[configuracion] No se pudo cargar app_settings:", error);
  }

  return {
    configuracion: resolverConfiguracionChat(data ?? []),
    error: error ? "No se pudo cargar la configuración operativa." : null,
  };
}
