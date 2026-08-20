import assert from "node:assert/strict";
import test from "node:test";
import {
  esFalloDeVerificacionDeSesion,
  esSesionDeUsuarioEliminado,
} from "./sesion";

test("no confunde un visitante sin sesión con una falla de verificación", () => {
  assert.equal(
    esFalloDeVerificacionDeSesion({ name: "AuthSessionMissingError" }),
    false
  );
  assert.equal(esFalloDeVerificacionDeSesion(null), false);
  assert.equal(esFalloDeVerificacionDeSesion(undefined), false);
  assert.equal(
    esFalloDeVerificacionDeSesion({ code: "request_timeout" }),
    true
  );
});

test("reconoce la sesión de una identidad ya eliminada", () => {
  assert.equal(esSesionDeUsuarioEliminado({ code: "user_not_found" }), true);
  assert.equal(esSesionDeUsuarioEliminado({ code: "request_timeout" }), false);
  assert.equal(esSesionDeUsuarioEliminado(null), false);
});
