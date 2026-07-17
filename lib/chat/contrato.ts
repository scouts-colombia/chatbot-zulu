import { z } from "zod";

/**
 * Contrato del piloto (pilot-scope §6). El modelo produce SOLO contenido
 * semántico; la metadata la calcula el servidor (D-03) y las citas se
 * derivan del grounding (D-07, D-12).
 */

export const PreguntaGuiadaSchema = z.object({
  tipo: z.enum(["aclaracion", "modo_guiado", "sugerencia"]),
  texto: z.string(),
  opciones: z.array(z.string()).min(2).max(4),
  permiteInputLibre: z.boolean(),
});

export const ModeloRespuestaSchema = z.object({
  estado: z.enum([
    "respondido",
    "sin_fuente",
    "necesita_aclaracion",
    "bloqueado_por_seguridad",
  ]),
  respuesta: z.string(),
  preguntaGuiada: PreguntaGuiadaSchema.optional(),
  sugerencias: z.array(z.string()).optional(),
  advertencias: z.array(z.string()).optional(),
});

export type PreguntaGuiada = z.infer<typeof PreguntaGuiadaSchema>;
export type ModeloRespuesta = z.infer<typeof ModeloRespuestaSchema>;

/** JSON Schema equivalente, para responseJsonSchema de @google/genai. */
export const responseJsonSchema = {
  type: "object",
  properties: {
    estado: {
      type: "string",
      enum: [
        "respondido",
        "sin_fuente",
        "necesita_aclaracion",
        "bloqueado_por_seguridad",
      ],
    },
    respuesta: { type: "string" },
    preguntaGuiada: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["aclaracion", "modo_guiado", "sugerencia"],
        },
        texto: { type: "string" },
        opciones: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 4,
        },
        permiteInputLibre: { type: "boolean" },
      },
      required: ["tipo", "texto", "opciones", "permiteInputLibre"],
    },
    sugerencias: { type: "array", items: { type: "string" } },
    advertencias: { type: "array", items: { type: "string" } },
  },
  required: ["estado", "respuesta"],
} as const;

export type CitaNormalizada = {
  knowledgeDocumentId?: string;
  documentTitleSnapshot: string;
  documentVersionSnapshot?: string;
  pageNumber?: number;
  fragment?: string;
  fileSearchStoreName?: string;
  fileSearchDocumentName?: string;
  mediaId?: string;
};

export type MetadataServidor = {
  requestId: string;
  modelId: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  groundingDisponible: boolean;
  finishReason?: string;
  safetyBlockSource?: "modelo" | "proveedor" | "servidor";
  createdAt: string;
};

/** Contrato compuesto por el backend para el frontend (§6.2). */
export type RespuestaAsistente = {
  estado: ModeloRespuesta["estado"] | "error";
  respuesta: string;
  citas: CitaNormalizada[];
  preguntaGuiada?: PreguntaGuiada;
  sugerencias?: string[];
  advertencias?: string[];
  metadata: MetadataServidor;
};
