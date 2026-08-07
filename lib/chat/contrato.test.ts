import assert from "node:assert/strict";
import { test } from "node:test";
import { responseJsonSchema } from "./contrato";

test("el contrato solicitado al modelo sigue siendo exclusivamente semántico", () => {
  assert.deepEqual(Object.keys(responseJsonSchema.properties).sort(), [
    "advertencias",
    "estado",
    "preguntaGuiada",
    "respuesta",
    "sugerencias",
  ]);

  for (const campoTecnico of [
    "tokens",
    "cost",
    "latency",
    "grounding",
    "thinkingLevel",
    "usageMetadata",
  ]) {
    assert.equal(
      campoTecnico in responseJsonSchema.properties,
      false,
      `${campoTecnico} no debe entrar al contrato del modelo`
    );
  }
});
