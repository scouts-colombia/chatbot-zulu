import assert from "node:assert/strict";
import { test } from "node:test";
import type { IntentoModelo } from "./gemini";
import { construirFilasEventos } from "./telemetria";

const base = {
  userId: "00000000-0000-4000-8000-000000000001",
  conversationId: "00000000-0000-4000-8000-000000000002",
  userMessageId: "00000000-0000-4000-8000-000000000003",
  assistantMessageId: "00000000-0000-4000-8000-000000000004",
  modelId: "gemini-3.5-flash",
};

test("persiste el desglose completo y conserva aliases compatibles", () => {
  const intento: IntentoModelo = {
    attemptIndex: 1,
    latencyMs: 1234,
    status: "ok",
    promptTokens: 100,
    toolUsePromptTokens: 200,
    cachedContentTokens: 30,
    candidatesTokens: 40,
    thoughtsTokens: 500,
    totalTokens: 840,
    thinkingLevel: "low",
    groundingDisponible: true,
    finishReason: "STOP",
  };

  const [fila] = construirFilasEventos(base, [intento]);
  assert.equal(fila?.input_tokens, 100);
  assert.equal(fila?.output_tokens, 40);
  assert.equal(fila?.prompt_tokens, 100);
  assert.equal(fila?.tool_use_prompt_tokens, 200);
  assert.equal(fila?.cached_content_tokens, 30);
  assert.equal(fila?.candidates_tokens, 40);
  assert.equal(fila?.thoughts_tokens, 500);
  assert.equal(fila?.total_tokens, 840);
  assert.equal(fila?.thinking_level, "low");
});

test("persiste null para cada contador opcional ausente", () => {
  const [fila] = construirFilasEventos(base, [
    {
      attemptIndex: 1,
      latencyMs: 10,
      status: "error",
      groundingDisponible: false,
    },
  ]);

  assert.equal(fila?.input_tokens, null);
  assert.equal(fila?.output_tokens, null);
  assert.equal(fila?.prompt_tokens, null);
  assert.equal(fila?.tool_use_prompt_tokens, null);
  assert.equal(fila?.cached_content_tokens, null);
  assert.equal(fila?.candidates_tokens, null);
  assert.equal(fila?.thoughts_tokens, null);
  assert.equal(fila?.total_tokens, null);
  assert.equal(fila?.thinking_level, null);
});

test("la fila no contiene respuesta cruda del proveedor", () => {
  const [fila] = construirFilasEventos(base, [
    {
      attemptIndex: 1,
      latencyMs: 10,
      status: "ok",
      thinkingLevel: "medium",
      groundingDisponible: false,
    },
  ]);
  const claves = Object.keys(fila ?? {});

  assert.equal(claves.includes("response"), false);
  assert.equal(claves.includes("raw_response"), false);
  assert.equal(claves.includes("provider_response"), false);
});
