import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { esUuid } from "./uuid";

test("acepta los UUID v4 que produce el propio sistema", () => {
  assert.equal(esUuid(randomUUID()), true);
  assert.equal(esUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
});

test("rechaza lo que llega desde una URL o un almacen del navegador", () => {
  assert.equal(esUuid("../../../otro"), false);
  assert.equal(esUuid("no-es-un-uuid"), false);
  // v1: el generador del piloto nunca la produce.
  assert.equal(esUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301"), false);
  assert.equal(esUuid(null), false);
  assert.equal(esUuid(undefined), false);
});
