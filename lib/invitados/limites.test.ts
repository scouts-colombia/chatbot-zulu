import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { respuestaRegistroPorLimite } from "./limites";

describe("respuestaRegistroPorLimite", () => {
  it("explica el agotamiento temporal de una red compartida", () => {
    const respuesta = respuestaRegistroPorLimite("limite_red_invitada");
    assert.equal(respuesta.codigo, "registro_requerido");
    assert.match(respuesta.mensaje, /esta red se agotó por hoy/);
  });

  it("atribuye al dispositivo solo su propio turno consumido", () => {
    const respuesta = respuestaRegistroPorLimite("limite_invitado");
    assert.equal(respuesta.codigo, "registro_requerido");
    assert.match(respuesta.mensaje, /Ya usaste tu pregunta de prueba/);
    assert.doesNotMatch(respuesta.mensaje, /esta red/);
  });
});
