import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

/**
 * Guardarraíl, no prueba de comportamiento: el filtro real vive en SQL
 * (`tomar_limpiezas_identidad_invitada` salta las filas con
 * `registration_pending_until` vigente) y solo se puede ejercer contra una base
 * real, en `pnpm verify:rls`.
 *
 * Lo que se protege aquí es una decisión que es fácil "arreglar" por error: la
 * ventana de registro pendiente es **monotónica**. Se fija al empezar el
 * registro y solo se libera al expirar. Añadir un camino que la cancele —porque
 * `updateUser` devolvió un error ambiguo, por ejemplo— permitiría que la
 * limpieza borre una identidad cuyo correo de confirmación ya salió, y esa
 * persona pierde su conversación al volver del enlace.
 *
 * No se fija el nombre del archivo de migración: el guardarraíl vale para todo
 * el esquema, y un rename no debe romperlo ni, peor, hacerlo pasar en vacío.
 */

const DIR_MIGRACIONES = resolve("supabase/migrations");

function leerMigraciones() {
  const archivos = readdirSync(DIR_MIGRACIONES).filter((n) =>
    n.endsWith(".sql")
  );
  if (archivos.length === 0) {
    // Sin migraciones, los `doesNotMatch` pasarían en vacío y el guardarraíl
    // diría que todo está bien sin haber mirado nada.
    throw new Error("no se encontró ninguna migración en supabase/migrations");
  }
  return archivos
    .map((nombre) => readFileSync(join(DIR_MIGRACIONES, nombre), "utf8"))
    .join("\n");
}

test("el registro invitado se protege al empezar y solo expira", () => {
  const sql = leerMigraciones();
  const acciones = readFileSync(resolve("app/(auth)/acciones.ts"), "utf8");

  assert.match(
    sql,
    /create function public\.marcar_registro_invitado_pendiente/,
    "la función que protege la identidad durante el registro no está en el esquema"
  );
  assert.match(
    acciones,
    /marcar_registro_invitado_pendiente/,
    "el registro de un invitado ya no protege su identidad"
  );
  assert.match(
    sql,
    /registration_pending_until = now\(\) \+ interval '24 hours'/,
    "la ventana de registro pendiente dejó de fijarse"
  );
});

test("no existe ningún camino que cancele la ventana antes de expirar", () => {
  assert.doesNotMatch(
    leerMigraciones(),
    /cancelar_registro_invitado_pendiente/
  );
  assert.doesNotMatch(
    readFileSync(resolve("app/(auth)/acciones.ts"), "utf8"),
    /cancelar_registro_invitado_pendiente/
  );
});
