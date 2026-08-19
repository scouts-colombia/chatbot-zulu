/**
 * Comprueba el modelo configurado con el mismo wrapper de producción:
 * File Search, salida estructurada, grounding y thinking low en una llamada.
 * No persiste ni imprime la respuesta del proveedor.
 *
 * Uso: pnpm smoke:model
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { normalizarCitas } from "../lib/chat/citas";
import { llamarModelo } from "../lib/chat/gemini";
import {
  CLAVES_CONFIGURACION_CHAT,
  resolverConfiguracionChat,
} from "../lib/configuracion/chat";

loadEnv({ path: ".env.local" });

function exigirEnv(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre} en .env.local`);
  }
  return valor;
}

async function main() {
  const supabase = createClient(
    exigirEnv("NEXT_PUBLIC_SUPABASE_URL"),
    exigirEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  exigirEnv("GEMINI_API_KEY");

  const [
    { data: filas, error: errorConfiguracion },
    { data: documentos, error },
  ] = await Promise.all([
    supabase
      .from("app_settings")
      .select("clave, valor")
      .in("clave", [...CLAVES_CONFIGURACION_CHAT]),
    supabase
      .from("knowledge_documents")
      .select("id, file_search_store_name")
      .eq("active", true)
      .order("id"),
  ]);

  const configuracion = resolverConfiguracionChat(filas ?? []);
  if (errorConfiguracion || !configuracion) {
    throw new Error(
      errorConfiguracion
        ? `No se pudo leer la configuración: ${errorConfiguracion.message}`
        : `Configuración inválida; claves recibidas: ${(filas ?? [])
            .map((fila) => fila.clave)
            .sort()
            .join(", ")}`
    );
  }
  if (configuracion.modelo !== "gemini-3.7-flash") {
    throw new Error(`Modelo inesperado: ${configuracion.modelo}`);
  }
  if (error || !documentos?.length) {
    throw new Error(error?.message ?? "No hay documentos activos");
  }

  const resultado = await llamarModelo(
    {
      historial: [],
      pregunta: "¿Qué es la Red de Jóvenes y quiénes pueden participar?",
      storeNames: [
        ...new Set(
          documentos.map(
            (documento) => documento.file_search_store_name as string
          )
        ),
      ],
      metadataFilter: documentos
        .map(
          (documento) => `knowledge_document_id = "${documento.id as string}"`
        )
        .join(" OR "),
    },
    { modelValue: configuracion.modelo, thinkingLevelValue: "low" }
  );

  if (resultado.tipo !== "ok") {
    throw new Error(`El smoke terminó como ${resultado.tipo}`);
  }

  const citas = normalizarCitas(resultado.response).citas;
  const intento = resultado.intentos.at(-1);
  if (!intento?.groundingDisponible || citas.length === 0) {
    throw new Error("El modelo respondió sin grounding utilizable");
  }

  console.log({
    modelo: configuracion.modelo,
    thinking: intento.thinkingLevel,
    estado: resultado.respuesta.estado,
    salidaEstructurada: true,
    grounding: intento.groundingDisponible,
    citas: citas.length,
    latenciaMs: intento.latencyMs,
    tokensTotales: intento.totalTokens,
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
