import {
  type Content,
  type GenerateContentResponse,
  GoogleGenAI,
  ThinkingLevel,
} from "@google/genai";
import {
  NIVELES_RAZONAMIENTO,
  type NivelRazonamientoGemini,
} from "../configuracion/chat";
import {
  type ModeloRespuesta,
  ModeloRespuestaSchema,
  responseJsonSchema,
} from "./contrato";
import { PROMPT_CORRECTIVO, SYSTEM_PROMPT } from "./prompt";

export type TurnoHistorial = { role: "user" | "model"; texto: string };

export type { NivelRazonamientoGemini } from "../configuracion/chat";

export type ResolucionNivelRazonamiento = {
  nivel: NivelRazonamientoGemini;
  origen: "configurado" | "predeterminado" | "invalido";
};

const NIVEL_SDK: Record<NivelRazonamientoGemini, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * `medium` conserva el comportamiento por defecto documentado de
 * gemini-3.5-flash cuando la variable falta. Un valor inválido nunca se envía
 * al proveedor: también cae a `medium` y se marca para emitir un aviso de
 * configuración exclusivamente en servidor.
 */
export function resolverNivelRazonamiento(
  valor: string | undefined
): ResolucionNivelRazonamiento {
  const normalizado = valor?.trim().toLowerCase();
  if (!normalizado) {
    return { nivel: "medium", origen: "predeterminado" };
  }
  if (NIVELES_RAZONAMIENTO.includes(normalizado as NivelRazonamientoGemini)) {
    return {
      nivel: normalizado as NivelRazonamientoGemini,
      origen: "configurado",
    };
  }
  return { nivel: "medium", origen: "invalido" };
}

export type IntentoModelo = {
  attemptIndex: number;
  latencyMs: number;
  status: "ok" | "error" | "blocked";
  errorCode?: string;
  finishReason?: string;
  promptTokens?: number;
  toolUsePromptTokens?: number;
  cachedContentTokens?: number;
  candidatesTokens?: number;
  thoughtsTokens?: number;
  totalTokens?: number;
  thinkingLevel?: NivelRazonamientoGemini;
  groundingDisponible: boolean;
};

export type ResultadoModelo =
  | {
      tipo: "ok";
      respuesta: ModeloRespuesta;
      response: GenerateContentResponse;
      intentos: IntentoModelo[];
    }
  | { tipo: "bloqueado"; intentos: IntentoModelo[]; finishReason?: string }
  | { tipo: "json_invalido"; intentos: IntentoModelo[] };

export function extraerUso(response: GenerateContentResponse) {
  const uso = response.usageMetadata;
  return {
    promptTokens: uso?.promptTokenCount,
    toolUsePromptTokens: uso?.toolUsePromptTokenCount,
    cachedContentTokens: uso?.cachedContentTokenCount,
    candidatesTokens: uso?.candidatesTokenCount,
    thoughtsTokens: uso?.thoughtsTokenCount,
    totalTokens: uso?.totalTokenCount,
  };
}

type SolicitudGenerateContent = Parameters<
  GoogleGenAI["models"]["generateContent"]
>[0];

type DependenciasLlamada = {
  generateContent?: (
    solicitud: SolicitudGenerateContent
  ) => Promise<GenerateContentResponse>;
  modelValue?: string;
  thinkingLevelValue?: string;
};

function estaBloqueado(response: GenerateContentResponse) {
  const candidato = response.candidates?.[0];
  return Boolean(
    response.promptFeedback?.blockReason ||
      candidato?.finishReason === "SAFETY" ||
      !candidato ||
      (!response.text && !candidato.content)
  );
}

/**
 * Llamada al modelo con File Search + salida estructurada, en UNA sola
 * llamada (validado en el spike de Fase 1). Bloqueo del proveedor se
 * detecta fuera del JSON (D-08); JSON inválido tiene un único reintento
 * con prompt correctivo (D-09).
 */
export async function llamarModelo(
  {
    historial,
    pregunta,
    storeNames,
    metadataFilter,
  }: {
    historial: TurnoHistorial[];
    pregunta: string;
    storeNames: string[];
    /**
     * File Search recupera a nivel de store: el filtro por
     * knowledge_document_id restringe la recuperación a los documentos
     * ACTIVOS aunque el store contenga desactivados.
     */
    metadataFilter?: string;
  },
  dependencias: DependenciasLlamada = {}
): Promise<ResultadoModelo> {
  const model =
    dependencias.modelValue ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const nivelResuelto = resolverNivelRazonamiento(
    dependencias.thinkingLevelValue ?? process.env.GEMINI_THINKING_LEVEL
  );
  if (nivelResuelto.origen === "invalido") {
    console.error(
      "[gemini] GEMINI_THINKING_LEVEL inválido; se usará medium. Valores permitidos: minimal, low, medium, high."
    );
  }

  let generateContent = dependencias.generateContent;
  if (!generateContent) {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY as string,
    });
    generateContent = (solicitud) => ai.models.generateContent(solicitud);
  }

  const contents: Content[] = [
    ...historial.map((turno) => ({
      role: turno.role,
      parts: [{ text: turno.texto }],
    })),
    { role: "user", parts: [{ text: pregunta }] },
  ];

  const intentos: IntentoModelo[] = [];

  for (let attemptIndex = 1; attemptIndex <= 2; attemptIndex++) {
    const systemInstruction =
      attemptIndex === 1 ? SYSTEM_PROMPT : SYSTEM_PROMPT + PROMPT_CORRECTIVO;

    const inicio = Date.now();
    let response: GenerateContentResponse;
    try {
      response = await generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: NIVEL_SDK[nivelResuelto.nivel],
          },
          tools: [
            {
              fileSearch: {
                fileSearchStoreNames: storeNames,
                ...(metadataFilter ? { metadataFilter } : {}),
              },
            },
          ],
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      });
    } catch (error) {
      intentos.push({
        attemptIndex,
        latencyMs: Date.now() - inicio,
        status: "error",
        errorCode: `provider_error:${error instanceof Error ? error.message.slice(0, 120) : "desconocido"}`,
        thinkingLevel: nivelResuelto.nivel,
        groundingDisponible: false,
      });
      if (attemptIndex === 2) {
        return { tipo: "json_invalido", intentos };
      }
      continue;
    }

    const latencyMs = Date.now() - inicio;
    const grounding = Boolean(
      response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length
    );
    const base = {
      attemptIndex,
      latencyMs,
      finishReason: response.candidates?.[0]?.finishReason,
      groundingDisponible: grounding,
      thinkingLevel: nivelResuelto.nivel,
      ...extraerUso(response),
    };

    if (estaBloqueado(response)) {
      intentos.push({ ...base, status: "blocked" });
      return {
        tipo: "bloqueado",
        intentos,
        finishReason: base.finishReason,
      };
    }

    let parseado: unknown;
    try {
      parseado = JSON.parse(response.text ?? "");
    } catch {
      parseado = null;
    }
    const validacion = ModeloRespuestaSchema.safeParse(parseado);

    if (validacion.success) {
      intentos.push({ ...base, status: "ok" });
      return {
        tipo: "ok",
        respuesta: validacion.data,
        response,
        intentos,
      };
    }

    intentos.push({
      ...base,
      status: "error",
      errorCode: "invalid_model_json",
    });
  }

  return { tipo: "json_invalido", intentos };
}
