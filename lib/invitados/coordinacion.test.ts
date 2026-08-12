import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOQUEO_PREPARACION_INVITADA,
  coordinarPreparacionInvitada,
  ERROR_COORDINACION_INVITADA,
} from "./coordinacion";

test("serializa preparaciones concurrentes con el mismo bloqueo", async () => {
  let cola = Promise.resolve();
  let activas = 0;
  let maximoActivas = 0;
  const nombres: string[] = [];
  const gestor = {
    request<T>(
      nombre: string,
      _opciones: { mode: "exclusive" },
      operacion: () => Promise<T>
    ) {
      nombres.push(nombre);
      const resultado = cola.then(async () => {
        activas += 1;
        maximoActivas = Math.max(maximoActivas, activas);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return await operacion();
        } finally {
          activas -= 1;
        }
      });
      cola = resultado.then(
        () => undefined,
        () => undefined
      );
      return resultado;
    },
  };

  const resultados = await Promise.all([
    coordinarPreparacionInvitada(async () => "primera", gestor),
    coordinarPreparacionInvitada(async () => "segunda", gestor),
  ]);

  assert.deepEqual(resultados, ["primera", "segunda"]);
  assert.equal(maximoActivas, 1);
  assert.deepEqual(nombres, [
    BLOQUEO_PREPARACION_INVITADA,
    BLOQUEO_PREPARACION_INVITADA,
  ]);
});

test("falla cerrado cuando el navegador no puede coordinar pestañas", async () => {
  await assert.rejects(
    coordinarPreparacionInvitada(async () => "no debe ejecutarse", null),
    new RegExp(ERROR_COORDINACION_INVITADA)
  );
});
