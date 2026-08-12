import assert from "node:assert/strict";
import test from "node:test";
import {
  esVersionPoliticaVigente,
  VERSION_POLITICA_PRIVACIDAD,
} from "./privacidad";

test("liga el consentimiento a la versión mostrada", () => {
  assert.equal(esVersionPoliticaVigente(VERSION_POLITICA_PRIVACIDAD), true);
  assert.equal(esVersionPoliticaVigente("version-anterior"), false);
  assert.equal(esVersionPoliticaVigente(undefined), false);
});
