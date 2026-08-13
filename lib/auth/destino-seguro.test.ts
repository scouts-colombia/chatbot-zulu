import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolverDestinoSeguro } from "./destino-seguro";

describe("resolverDestinoSeguro", () => {
  const origin = "https://zulu.example";

  it("conserva rutas internas con query y fragmento", () => {
    assert.equal(
      resolverDestinoSeguro("/chat/abc?desde=registro#mensaje", origin).href,
      "https://zulu.example/chat/abc?desde=registro#mensaje"
    );
  });

  it("rechaza destinos externos y rutas con barras invertidas", () => {
    for (const destino of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/%5Cevil.example",
      null,
    ]) {
      assert.equal(resolverDestinoSeguro(destino, origin).href, `${origin}/`);
    }
  });
});
