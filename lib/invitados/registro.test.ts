import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const acciones = readFileSync(resolve("app/(auth)/acciones.ts"), "utf8");
const migracion = readFileSync(
  resolve(
    "supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql"
  ),
  "utf8"
);

test("la protección del registro invitado es monotónica hasta que expire", () => {
  assert.match(acciones, /marcar_registro_invitado_pendiente/);
  assert.match(
    migracion,
    /registration_pending_until = now\(\) \+ interval '24 hours'/
  );
  assert.doesNotMatch(acciones, /cancelar_registro_invitado_pendiente/);
  assert.doesNotMatch(migracion, /cancelar_registro_invitado_pendiente/);
});