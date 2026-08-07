import type { IntentoModelo } from "./gemini";

export type BaseEventoModelo = {
  userId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId?: string;
  modelId: string;
};

export type OpcionesEventoModelo = {
  safetyBlockSource?: string;
  calidad?: string[];
};

/**
 * Traduce la telemetría normalizada a la fila de Postgres. Los aliases
 * `input_tokens`/`output_tokens` se mantienen para compatibilidad con los
 * eventos y vistas anteriores; las columnas con nombres exactos conservan el
 * desglose de usageMetadata. Un contador ausente siempre se persiste como null.
 */
export function construirFilasEventos(
  base: BaseEventoModelo,
  intentos: IntentoModelo[],
  opciones?: OpcionesEventoModelo
) {
  return intentos.map((intento) => {
    const esUltimo = intento.attemptIndex === intentos.length;
    const marcasCalidad =
      esUltimo && intento.status === "ok" && opciones?.calidad?.length
        ? opciones.calidad.join(",")
        : undefined;

    return {
      user_id: base.userId,
      conversation_id: base.conversationId,
      user_message_id: base.userMessageId,
      assistant_message_id: base.assistantMessageId ?? null,
      attempt_index: intento.attemptIndex,
      model_id: base.modelId,
      provider: "gemini",
      status: intento.status,
      latency_ms: intento.latencyMs,
      // Aliases históricos: prompt y candidatos, respectivamente.
      input_tokens: intento.promptTokens ?? null,
      output_tokens: intento.candidatesTokens ?? null,
      total_tokens: intento.totalTokens ?? null,
      prompt_tokens: intento.promptTokens ?? null,
      tool_use_prompt_tokens: intento.toolUsePromptTokens ?? null,
      cached_content_tokens: intento.cachedContentTokens ?? null,
      candidates_tokens: intento.candidatesTokens ?? null,
      thoughts_tokens: intento.thoughtsTokens ?? null,
      thinking_level: intento.thinkingLevel ?? null,
      grounding_disponible: intento.groundingDisponible,
      finish_reason: intento.finishReason ?? null,
      safety_block_source:
        intento.status === "blocked"
          ? (opciones?.safetyBlockSource ?? "proveedor")
          : esUltimo && intento.status === "ok"
            ? (opciones?.safetyBlockSource ?? null)
            : null,
      error_code: intento.errorCode ?? marcasCalidad ?? null,
    };
  });
}
