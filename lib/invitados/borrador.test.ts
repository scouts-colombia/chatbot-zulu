import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claveBorradorInvitado,
  guardarBorradorInvitado,
  leerBorradorPendiente,
  restaurarBorradorInvitado,
} from "./borrador";

function crearAlmacen() {
  const valores = new Map<string, string>();
  return {
    getItem: (clave: string) => valores.get(clave) ?? null,
    removeItem: (clave: string) => valores.delete(clave),
    setItem: (clave: string, valor: string) => valores.set(clave, valor),
  };
}

describe("borrador invitado", () => {
  it("conserva temporalmente un borrador sin conversación", () => {
    const almacen = crearAlmacen();
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      texto: "¿Quién era BP?",
      ahora: 1000,
    });
    assert.equal(leerBorradorPendiente(almacen, 2000), "¿Quién era BP?");
  });

  it("elimina el borrador temporal cuando expira", () => {
    const almacen = crearAlmacen();
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      texto: "Pregunta privada",
      ahora: 1000,
    });
    assert.equal(leerBorradorPendiente(almacen, 1_802_000), null);
    assert.equal(almacen.getItem(claveBorradorInvitado(null)), null);
  });

  it("migra el borrador temporal al UUID sin sobrescribir uno asociado", () => {
    const almacen = crearAlmacen();
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      texto: "Pendiente",
      ahora: 1000,
    });
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: "conv-1",
        ahora: 2000,
      }),
      "Pendiente"
    );
    assert.equal(almacen.getItem(claveBorradorInvitado(null)), null);

    almacen.setItem(claveBorradorInvitado("conv-2"), "Asociado");
    guardarBorradorInvitado({
      almacen,
      conversationId: null,
      texto: "Otro pendiente",
      ahora: 3000,
    });
    assert.equal(
      restaurarBorradorInvitado({
        almacen,
        conversationId: "conv-2",
        ahora: 4000,
      }),
      "Asociado"
    );
  });
});
