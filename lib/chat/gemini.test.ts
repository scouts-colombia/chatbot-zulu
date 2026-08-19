import assert from "node:assert/strict";
import { test } from "node:test";
import { type GenerateContentResponse, ThinkingLevel } from "@google/genai";
import { extraerUso, llamarModelo, resolverNivelRazonamiento } from "./gemini";

const entrada = {
  historial: [],
  pregunta: "Pregunta de prueba",
  storeNames: ["fileSearchStores/prueba"],
};

function respuestaValida(
  usageMetadata?: GenerateContentResponse["usageMetadata"]
): GenerateContentResponse {
  return {
    text: JSON.stringify({ estado: "sin_fuente", respuesta: "Sin fuente" }),
    candidates: [{ finishReason: "STOP" }],
    usageMetadata,
  } as unknown as GenerateContentResponse;
}

for (const [nivel, nivelSdk] of [
  ["minimal", ThinkingLevel.MINIMAL],
  ["low", ThinkingLevel.LOW],
  ["medium", ThinkingLevel.MEDIUM],
  ["high", ThinkingLevel.HIGH],
] as const) {
  test(`envía thinkingLevel ${nivel}`, async () => {
    let recibido: unknown;
    const resultado = await llamarModelo(entrada, {
      thinkingLevelValue: nivel,
      generateContent: (solicitud) => {
        recibido = solicitud.config?.thinkingConfig?.thinkingLevel;
        return Promise.resolve(respuestaValida());
      },
    });

    assert.equal(recibido, nivelSdk);
    assert.equal(resultado.intentos[0]?.thinkingLevel, nivel);
  });
}

test("usa medium cuando la variable está ausente", () => {
  assert.deepEqual(resolverNivelRazonamiento(undefined), {
    nivel: "medium",
    origen: "predeterminado",
  });
  assert.deepEqual(resolverNivelRazonamiento("   "), {
    nivel: "medium",
    origen: "predeterminado",
  });
});

test("rechaza el valor inválido antes del proveedor y cae a medium", () => {
  assert.deepEqual(resolverNivelRazonamiento("turbo"), {
    nivel: "medium",
    origen: "invalido",
  });
});

test("el retry reutiliza exactamente el mismo nivel", async () => {
  const niveles: unknown[] = [];
  let llamadas = 0;
  const resultado = await llamarModelo(entrada, {
    thinkingLevelValue: "low",
    generateContent: (solicitud) => {
      llamadas += 1;
      niveles.push(solicitud.config?.thinkingConfig?.thinkingLevel);
      if (llamadas === 1) {
        return Promise.resolve({
          text: "json inválido",
          candidates: [{ finishReason: "STOP" }],
        } as unknown as GenerateContentResponse);
      }
      return Promise.resolve(respuestaValida());
    },
  });

  assert.equal(resultado.tipo, "ok");
  assert.deepEqual(niveles, [ThinkingLevel.LOW, ThinkingLevel.LOW]);
  assert.deepEqual(
    resultado.intentos.map((intento) => intento.thinkingLevel),
    ["low", "low"]
  );
});

test("usa el modelo recibido desde la configuración operativa", async () => {
  let modeloRecibido: string | undefined;

  await llamarModelo(
    {
      historial: [],
      pregunta: "Pregunta",
      storeNames: ["stores/prueba"],
    },
    {
      modelValue: "gemini-configurado",
      generateContent: (solicitud) => {
        modeloRecibido = solicitud.model;
        return Promise.resolve(respuestaValida());
      },
    }
  );

  assert.equal(modeloRecibido, "gemini-configurado");
});

test("extrae todos los contadores exactos de usageMetadata", () => {
  assert.deepEqual(
    extraerUso(
      respuestaValida({
        promptTokenCount: 101,
        toolUsePromptTokenCount: 202,
        cachedContentTokenCount: 33,
        candidatesTokenCount: 44,
        thoughtsTokenCount: 505,
        totalTokenCount: 852,
      })
    ),
    {
      promptTokens: 101,
      toolUsePromptTokens: 202,
      cachedContentTokens: 33,
      candidatesTokens: 44,
      thoughtsTokens: 505,
      totalTokens: 852,
    }
  );
});

test("conserva undefined cuando usageMetadata omite campos", () => {
  assert.deepEqual(extraerUso(respuestaValida()), {
    promptTokens: undefined,
    toolUsePromptTokens: undefined,
    cachedContentTokens: undefined,
    candidatesTokens: undefined,
    thoughtsTokens: undefined,
    totalTokens: undefined,
  });
});
