import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rutaTrasArchivar } from "./ruta-tras-archivar";

const actual = "11111111-1111-4111-8111-111111111111";
const otra = "22222222-2222-4222-8222-222222222222";

describe("rutaTrasArchivar", () => {
  it("vuelve al otro hilo y cae al inicio si se archivó el actual", () => {
    assert.equal(
      rutaTrasArchivar(actual, `/chat/${otra}`, false),
      `/chat/${otra}`
    );
    assert.equal(rutaTrasArchivar(actual, `/chat/${actual}`, false), "/");
    assert.equal(rutaTrasArchivar(actual, "https://evil.example/", false), "/");
    assert.equal(
      rutaTrasArchivar(actual, `/chat/${otra}`, true),
      `/chat/${otra}?aviso=archivar`
    );
  });
});
