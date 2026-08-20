import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claveBorradorInvitado,
  guardarBorradorInvitado,
  limpiarBorradoresPendientesExpirados,
  restaurarBorradorInvitado,
} from "./borrador";

const TRASPASO = "11111111-1111-4111-8111-111111111111";
const OTRO_TRASPASO = "22222222-2222-4222-8222-222222222222";
const CONVERSACION = "33333333-3333-4333-8333-333333333333";
const OTRA_CONVERSACION = "44444444-4444-4444-8444-444444444444";

function crearAlmacen() {
  const valores = new Map<string, string>();
  return {
    get length() {
      return valores.size;
    },
    getItem: (clave: string) => valores.get(clave) ?? null,
    key: (indice: number) => [...valores.keys()][indice] ?? null,
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
        conversationId: CONVERSACION,
        traspasoId: OTRO_TRASPASO,
        ahora: 2000,
      }),
      null
    );
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: CONVERSACION,
        traspasoId: TRASPASO,
        ahora: 2000,
      }),
      "Pendiente"
    );
    assert.equal(
      almacen.getItem(claveBorradorInvitado(CONVERSACION)),
      "Pendiente"
    );
  });

  it("recupera el borrador en otra pestaña solo con el token explícito", () => {
    const almacenCompartido = crearAlmacen();
    const primeraPestana = crearAlmacen();
    const pestanaDelCorreo = crearAlmacen();
    guardarBorradorInvitado({
      almacen: primeraPestana,
      almacenPendiente: almacenCompartido,
      conversationId: null,
      conversationIdDestino: CONVERSACION,
      traspasoId: TRASPASO,
      texto: "Pendiente entre pestañas",
      ahora: 1000,
    });

    assert.equal(
      restaurarBorradorInvitado({
        almacen: pestanaDelCorreo,
        almacenPendiente: almacenCompartido,
        conversationId: CONVERSACION,
        traspasoId: TRASPASO,
        ahora: 2000,
      }),
      "Pendiente entre pestañas"
    );
    assert.equal(
      pestanaDelCorreo.getItem(claveBorradorInvitado(CONVERSACION)),
      "Pendiente entre pestañas"
    );
  });

  it("no aplica un borrador ligado a otra conversación", () => {
    const almacenCompartido = crearAlmacen();
    guardarBorradorInvitado({
      almacen: crearAlmacen(),
      almacenPendiente: almacenCompartido,
      conversationId: null,
      conversationIdDestino: CONVERSACION,
      traspasoId: TRASPASO,
      texto: "Contexto del hilo original",
      ahora: 1000,
    });

    assert.equal(
      restaurarBorradorInvitado({
        almacen: crearAlmacen(),
        almacenPendiente: almacenCompartido,
        conversationId: OTRA_CONVERSACION,
        traspasoId: TRASPASO,
        ahora: 2000,
      }),
      null
    );
    assert.equal(
      restaurarBorradorInvitado({
        almacen: crearAlmacen(),
        almacenPendiente: almacenCompartido,
        conversationId: CONVERSACION,
        traspasoId: TRASPASO,
        ahora: 2000,
      }),
      "Contexto del hilo original"
    );
  });

  it("purga borradores expirados sin conocer su token", () => {
    const almacen = crearAlmacen();
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      traspasoId: TRASPASO,
      texto: "Pregunta expirada",
      ahora: 1000,
    });
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      traspasoId: OTRO_TRASPASO,
      texto: "Pregunta vigente",
      ahora: 1_000_000,
    });

    limpiarBorradoresPendientesExpirados(almacen, 1_802_000);

    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: CONVERSACION,
        traspasoId: TRASPASO,
        ahora: 1_802_000,
      }),
      null
    );
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: OTRA_CONVERSACION,
        traspasoId: OTRO_TRASPASO,
        ahora: 1_802_000,
      }),
      "Pregunta vigente"
    );
  });
});
