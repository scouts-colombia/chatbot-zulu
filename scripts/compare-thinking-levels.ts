/**
 * Smoke test controlado de niveles de razonamiento para gemini-3.5-flash.
 *
 * Mantiene constantes la capa de producción, el prompt, el modelo, los stores,
 * el metadataFilter y las preguntas. No escribe mensajes, eventos ni respuestas
 * crudas en Supabase. El artefacto normalizado queda en data/ (fuera de Git).
 *
 * Uso: pnpm compare:thinking -- --run
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { normalizarCitas } from "../lib/chat/citas";
import {
  type IntentoModelo,
  llamarModelo,
  type NivelRazonamientoGemini,
} from "../lib/chat/gemini";

loadEnv({ path: ".env.local" });

const MODELO_REQUERIDO = "gemini-3.5-flash";
const NIVELES: NivelRazonamientoGemini[] = ["medium", "low", "minimal"];
const CASOS = [
  {
    id: "spike-red-jovenes",
    categoria: "frecuente",
    pregunta: "¿Qué es la Red de Jóvenes y quiénes pueden participar en ella?",
    estadoEsperado: "respondido",
  },
  {
    id: "fuera-licencia-conduccion",
    categoria: "fuera_de_alcance",
    pregunta:
      "¿Cuál es el procedimiento oficial para renovar una licencia de conducción en Colombia?",
    estadoEsperado: "sin_fuente",
  },
] as const;

type ResultadoComparacion = {
  casoId: string;
  categoria: string;
  nivel: NivelRazonamientoGemini;
  tipo: "ok" | "bloqueado" | "json_invalido";
  estado?: string;
  respuesta?: string;
  calidadBasica: boolean;
  citasCrudas?: {
    knowledgeDocumentId?: string;
    documentTitleSnapshot: string;
    documentVersionSnapshot?: string;
    pageNumber?: number;
  }[];
  citasVisibles?: number;
  intentos: IntentoModelo[];
};

function exigirEnv(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre} en .env.local`);
  }
  return valor;
}

async function main() {
  if (!process.argv.includes("--run")) {
    console.log(
      `Plan: ${CASOS.length} casos × ${NIVELES.length} niveles = ${CASOS.length * NIVELES.length} llamadas primarias (máximo ${CASOS.length * NIVELES.length * 2} con retry).`
    );
    console.log("Ejecuta con: pnpm compare:thinking -- --run");
    return;
  }

  const model = process.env.GEMINI_MODEL ?? MODELO_REQUERIDO;
  if (model !== MODELO_REQUERIDO) {
    throw new Error(
      `La comparación exige GEMINI_MODEL=${MODELO_REQUERIDO}; recibido ${model}`
    );
  }

  const supabase = createClient(
    exigirEnv("NEXT_PUBLIC_SUPABASE_URL"),
    exigirEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  exigirEnv("GEMINI_API_KEY");

  const { data: documentos, error } = await supabase
    .from("knowledge_documents")
    .select("id, file_search_store_name")
    .eq("active", true)
    .order("id");
  if (error) {
    throw new Error(`No se pudo leer el corpus activo: ${error.message}`);
  }
  if (!documentos?.length) {
    throw new Error("No hay documentos activos para la comparación");
  }

  const storeNames = [
    ...new Set(documentos.map((doc) => doc.file_search_store_name as string)),
  ];
  const metadataFilter = documentos
    .map((doc) => `knowledge_document_id = "${doc.id as string}"`)
    .join(" OR ");

  const resultados: ResultadoComparacion[] = [];
  for (const caso of CASOS) {
    for (const nivel of NIVELES) {
      console.log(`Ejecutando ${caso.id} con ${nivel}...`);
      const resultado = await llamarModelo(
        {
          historial: [],
          pregunta: caso.pregunta,
          storeNames,
          metadataFilter,
        },
        { thinkingLevelValue: nivel }
      );

      if (resultado.tipo !== "ok") {
        resultados.push({
          casoId: caso.id,
          categoria: caso.categoria,
          nivel,
          tipo: resultado.tipo,
          calidadBasica: false,
          intentos: resultado.intentos,
        });
        continue;
      }

      const normalizadas = normalizarCitas(resultado.response).citas;
      const citasVisibles =
        resultado.respuesta.estado === "respondido" ? normalizadas : [];
      const calidadBasica =
        resultado.respuesta.estado === caso.estadoEsperado &&
        (caso.estadoEsperado !== "respondido" || citasVisibles.length > 0);

      resultados.push({
        casoId: caso.id,
        categoria: caso.categoria,
        nivel,
        tipo: resultado.tipo,
        estado: resultado.respuesta.estado,
        respuesta: resultado.respuesta.respuesta,
        calidadBasica,
        citasCrudas: normalizadas.map((cita) => ({
          knowledgeDocumentId: cita.knowledgeDocumentId,
          documentTitleSnapshot: cita.documentTitleSnapshot,
          documentVersionSnapshot: cita.documentVersionSnapshot,
          pageNumber: cita.pageNumber,
        })),
        citasVisibles: citasVisibles.length,
        intentos: resultado.intentos,
      });
    }
  }

  const resumen = NIVELES.map((nivel) => {
    const porNivel = resultados.filter((item) => item.nivel === nivel);
    const intentos = porNivel.flatMap((item) => item.intentos);
    const sumar = (campo: keyof (typeof intentos)[number]) =>
      intentos.reduce((total, intento) => {
        const valor = intento[campo];
        return total + (typeof valor === "number" ? valor : 0);
      }, 0);

    return {
      nivel,
      casos: porNivel.length,
      calidadBasicaAprobada: porNivel.filter((item) => item.calidadBasica)
        .length,
      intentos: intentos.length,
      retries: intentos.length - porNivel.length,
      latenciaMs: sumar("latencyMs"),
      promptTokens: sumar("promptTokens"),
      toolUsePromptTokens: sumar("toolUsePromptTokens"),
      cachedContentTokens: sumar("cachedContentTokens"),
      candidatesTokens: sumar("candidatesTokens"),
      thoughtsTokens: sumar("thoughtsTokens"),
      totalTokens: sumar("totalTokens"),
      groundingDisponible: intentos.filter(
        (intento) => intento.groundingDisponible
      ).length,
    };
  });

  const artefacto = {
    createdAt: new Date().toISOString(),
    model,
    storeNames,
    activeDocumentCount: documentos.length,
    niveles: NIVELES,
    casos: CASOS,
    resumen,
    resultados,
  };
  const salida = resolve(
    "data",
    `thinking-comparison-${new Date().toISOString().replaceAll(":", "-")}.json`
  );
  mkdirSync(resolve("data"), { recursive: true });
  writeFileSync(salida, JSON.stringify(artefacto, null, 2), "utf8");

  console.table(resumen);
  console.log(`Resultado normalizado: ${salida}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
