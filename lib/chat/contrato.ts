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
  // Siempre true por contrato (§6.1): un false del modelo es JSON inválido
  // y entra por la ruta de retry único (D-09).
  permiteInputLibre: z.literal(true),
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

/** Estados que sí llevan etiqueta: `respondido` es el caso normal y no la lleva. */
export type EstadoConEtiqueta = Exclude<
  RespuestaAsistente["estado"],
  "respondido"
>;

/**
 * Etiqueta visible por estado. Vive aquí y no en el componente del chat porque
 * el panel admin debe mostrar exactamente la misma indicación que vio el Scout;
 * si divergieran, un revisor no podría distinguir una respuesta normal de una
 * ruta de seguridad. El `Record` va tipado por la unión a propósito: si mañana
 * se agrega un estado al contrato, el compilador exige su etiqueta en vez de
 * dejar la burbuja sin ninguna.
 */
export const ETIQUETAS_ESTADO: Record<EstadoConEtiqueta, string> = {
  sin_fuente: "Sin fuente en los manuales",
  necesita_aclaracion: "Necesita aclaración",
  bloqueado_por_seguridad: "Tema bloqueado por seguridad",
  error: "Error",
};

/**
 * Frontera de confianza del estado: llega desde `response_json` (jsonb, sin
 * garantías) o por la red. Devuelve `undefined` para `respondido`, para un
 * estado desconocido y para cualquier valor que no sea texto.
 */
export function estadoConEtiqueta(
  valor: unknown
): EstadoConEtiqueta | undefined {
  return typeof valor === "string" && valor in ETIQUETAS_ESTADO
    ? (valor as EstadoConEtiqueta)
    : undefined;
}
