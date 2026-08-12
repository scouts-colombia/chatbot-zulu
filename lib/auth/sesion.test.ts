import assert from "node:assert/strict";
import test from "node:test";
import { esSesionAusente, esSesionDeUsuarioEliminado } from "./sesion";

test("distingue una sesión ausente de una identidad eliminada", () => {
  assert.equal(esSesionAusente({ name: "AuthSessionMissingError" }), true);
  assert.equal(esSesionDeUsuarioEliminado({ code: "user_not_found" }), true);
  assert.equal(esSesionDeUsuarioEliminado({ code: "request_timeout" }), false);
  assert.equal(esSesionDeUsuarioEliminado(null), false);
});
