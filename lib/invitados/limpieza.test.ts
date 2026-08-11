import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type ClienteLimpiezaInvitados,
  limpiarIdentidadesInvitadasPendientes,
} from "./limpieza";

const PREFERIDA = "11111111-1111-4111-8111-111111111111";
const SECUNDARIA = "22222222-2222-4222-8222-222222222222";

function silenciarErrores<T>(accion: () => Promise<T>) {
  const original = console.error;
  console.error = () => undefined;
  return accion().finally(() => {
    console.error = original;
  });
}

describe("limpieza de identidades invitadas", () => {
  it("reclama un lote acotado y conserva para retry los borrados fallidos", async () => {
    const eliminadas: string[] = [];
    let parametros: unknown;
    const admin: ClienteLimpiezaInvitados = {
      rpc: (_funcion, recibidos) => {
        parametros = recibidos;
        return Promise.resolve({
          data: [
            { guest_user_id: PREFERIDA },
            { guest_user_id: "valor-invalido" },
            { guest_user_id: SECUNDARIA },
          ],
          error: null,
        });
      },
      auth: {
        admin: {
          deleteUser: (id) => {
            eliminadas.push(id);
            return Promise.resolve({
              error: id === PREFERIDA ? { message: "fallo transitorio" } : null,
            });
          },
        },
      },
    };

    const resultado = await silenciarErrores(() =>
      limpiarIdentidadesInvitadasPendientes(admin, {
        limite: 99,
        preferida: PREFERIDA,
      })
    );

    assert.deepEqual(parametros, {
      p_limite: 10,
      p_preferida: PREFERIDA,
    });
    assert.deepEqual(eliminadas, [PREFERIDA, SECUNDARIA]);
    assert.deepEqual(resultado, { reclamadas: 2, eliminadas: 1 });
  });

  it("no intenta borrar si PostgreSQL no puede reclamar la cola", async () => {
    let borrados = 0;
    const admin: ClienteLimpiezaInvitados = {
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { message: "base no disponible" },
        }),
      auth: {
        admin: {
          deleteUser: () => {
            borrados += 1;
            return Promise.resolve({ error: null });
          },
        },
      },
    };

    const resultado = await silenciarErrores(() =>
      limpiarIdentidadesInvitadasPendientes(admin, {
        limite: 0,
        preferida: "no-es-uuid",
      })
    );

    assert.equal(borrados, 0);
    assert.deepEqual(resultado, { reclamadas: 0, eliminadas: 0 });
  });
});
