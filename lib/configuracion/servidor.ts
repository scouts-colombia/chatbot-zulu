import "server-only";
import { crearClienteAdmin } from "../supabase/admin";
import {
  CLAVES_CONFIGURACION_CHAT,
  type ConfiguracionChat,
  resolverConfiguracionChat,
} from "./chat";

type ResultadoConfiguracion =
  | { configuracion: ConfiguracionChat; error: null }
  | { configuracion: null; error: string };

export async function cargarConfiguracionChat(): Promise<ResultadoConfiguracion> {
  const { data, error } = await crearClienteAdmin()
    .from("app_settings")
    .select("clave, valor")
    .in("clave", [...CLAVES_CONFIGURACION_CHAT]);

  if (error) {
    console.error("[configuracion] No se pudo cargar app_settings:", error);
    return {
      configuracion: null,
      error: "No se pudo cargar la configuración operativa.",
    };
  }

  const configuracion = resolverConfiguracionChat(data ?? []);
  if (!configuracion) {
    console.error(
      "[configuracion] app_settings está incompleta o es inválida."
    );
    return {
      configuracion: null,
      error: "La configuración operativa está incompleta o es inválida.",
    };
  }

  return { configuracion, error: null };
}
