import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claveBorradorInvitado,
  esIdTraspasoBorradorValido,
  guardarBorradorInvitado,
  restaurarBorradorInvitado,
} from "./borrador";

const TRASPASO = "11111111-1111-4111-8111-111111111111";

function crearAlmacen() {
  const valores = new Map<string, string>();
  return {
    getItem: (clave: string) => valores.get(clave) ?? null,
    removeItem: (clave: string) => valores.delete(clave),
    setItem: (clave: string, valor: string) => valores.set(clave, valor),
  };
}

describe("borrador invitado", () => {
  it("no conserva un borrador sin conversación ni traspaso explícito", () => {
    const almacen = crearAlmacen();
    assert.equal(
      guardarBorradorInvitado({
        almacen,
        conversationId: null,
        texto: "Pregunta privada",
      }),
      false
    );
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: null,
      }),
      null
    );
  });

  it("no muestra el borrador pendiente en otra visita pública", () => {
    const almacen = crearAlmacen();
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      traspasoId: TRASPASO,
      texto: "¿Quién era BP?",
      ahora: 1000,
    });
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: null,
        traspasoId: TRASPASO,
        ahora: 2000,
      }),
      null
    );
  });

  it("migra el borrador solo con el token explícito correcto", () => {
    const almacen = crearAlmacen();
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      traspasoId: TRASPASO,
      texto: "Pendiente",
      ahora: 1000,
    });

    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: "conv-1",
        traspasoId: "22222222-2222-4222-8222-222222222222",
        ahora: 2000,
      }),
      null
    );
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: "conv-1",
        traspasoId: TRASPASO,
        ahora: 2000,
      }),
      "Pendiente"
    );
    assert.equal(almacen.getItem(claveBorradorInvitado("conv-1")), "Pendiente");
  });

  it("recupera el borrador en otra pestaña solo con el token explícito", () => {
    const almacenCompartido = crearAlmacen();
    const primeraPestana = crearAlmacen();
    const pestanaDelCorreo = crearAlmacen();
    guardarBorradorInvitado({
      almacen: primeraPestana,
      almacenPendiente: almacenCompartido,
      conversationId: null,
      traspasoId: TRASPASO,
      texto: "Pendiente entre pestañas",
      ahora: 1000,
    });

    assert.equal(
      restaurarBorradorInvitado({
        almacen: pestanaDelCorreo,
        almacenPendiente: almacenCompartido,
        conversationId: "conv-correo",
        traspasoId: TRASPASO,
        ahora: 2000,
      }),
      "Pendiente entre pestañas"
    );
    assert.equal(
      pestanaDelCorreo.getItem(claveBorradorInvitado("conv-correo")),
      "Pendiente entre pestañas"
    );
  });
  it("elimina el borrador pendiente cuando expira", () => {
    const almacen = crearAlmacen();
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      traspasoId: TRASPASO,
      texto: "Pregunta privada",
      ahora: 1000,
    });
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: "conv-1",
        traspasoId: TRASPASO,
        ahora: 1_802_000,
      }),
      null
    );
  });

  it("valida identificadores opacos de traspaso", () => {
    assert.equal(esIdTraspasoBorradorValido(TRASPASO), true);
    assert.equal(esIdTraspasoBorradorValido("../../../otro"), false);
    assert.equal(esIdTraspasoBorradorValido(null), false);
  });
});
