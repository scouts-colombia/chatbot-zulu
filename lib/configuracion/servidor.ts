import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLAVES_CONFIGURACION_CHAT,
  type ConfiguracionChat,
  resolverConfiguracionChat,
} from "./chat";

type ResultadoConfiguracion =
  | { configuracion: ConfiguracionChat; error: null }
  | { configuracion: null; error: string };

function resolverResultado(
  data: { clave: string; valor: string }[] | null,
  error: { message: string } | null
): ResultadoConfiguracion {
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

export async function cargarConfiguracionChat(
  supabase: SupabaseClient
): Promise<ResultadoConfiguracion> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("clave, valor")
    .in("clave", [...CLAVES_CONFIGURACION_CHAT]);

  return resolverResultado(data, error);
}

export async function cargarConfiguracionChatPublica(
  supabase: SupabaseClient
): Promise<ResultadoConfiguracion> {
  const { data, error } = await supabase.rpc("leer_configuracion_chat_publica");
  return resolverResultado(data, error);
}
