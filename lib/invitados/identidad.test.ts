import assert from "node:assert/strict";
import { test } from "node:test";
import {
  construirHashesSolicitud,
  construirIdentidadInvitada,
  crearIdDispositivo,
  esHashInvitado,
  esIdDispositivoValido,
  esIdPreflightValido,
  leerPreparacionPreflightInvitado,
  obtenerIpCliente,
} from "./identidad";

const SECRET = "secreto-de-prueba-con-al-menos-32-caracteres";
const DEVICE_ID = "00000000-0000-4000-8000-000000000001";

function solicitud({
  ip = "203.0.113.10",
  userAgent = "Navegador de prueba",
  idioma = "es-CO,es;q=0.9",
}: {
  ip?: string;
  userAgent?: string;
  idioma?: string;
} = {}) {
  return new Request("https://zulu.example/api/chat", {
    headers: {
      "accept-language": idioma,
      "user-agent": userAgent,
      "x-vercel-forwarded-for": ip,
    },
  });
}

test("genera una identidad seudonima determinista sin exponer datos crudos", () => {
  const primera = construirIdentidadInvitada({
    request: solicitud(),
    deviceId: DEVICE_ID,
    secret: SECRET,
    esVercel: true,
  });
  const segunda = construirIdentidadInvitada({
    request: solicitud(),
    deviceId: DEVICE_ID,
    secret: SECRET,
    esVercel: true,
  });

  assert.deepEqual(primera, segunda);
  for (const valor of Object.values(primera)) {
    assert.equal(esHashInvitado(valor), true);
    assert.equal(valor.includes("203.0.113.10"), false);
    assert.equal(valor.includes("Navegador de prueba"), false);
  }
});

test("separa dispositivo, entorno y red para aplicar limites complementarios", () => {
  const base = construirIdentidadInvitada({
    request: solicitud(),
    deviceId: DEVICE_ID,
    secret: SECRET,
    esVercel: true,
  });
  const otroDispositivo = construirIdentidadInvitada({
    request: solicitud(),
    deviceId: "00000000-0000-4000-8000-000000000002",
    secret: SECRET,
    esVercel: true,
  });
  const otraRed = construirIdentidadInvitada({
    request: solicitud({ ip: "198.51.100.20" }),
    deviceId: DEVICE_ID,
    secret: SECRET,
    esVercel: true,
  });

  assert.notEqual(base.deviceHash, otroDispositivo.deviceHash);
  assert.equal(base.environmentHash, otroDispositivo.environmentHash);
  assert.equal(base.networkHash, otroDispositivo.networkHash);
  assert.notEqual(base.environmentHash, otraRed.environmentHash);
  assert.notEqual(base.networkHash, otraRed.networkHash);
});

test("prioriza la cabecera confiable de Vercel y toma solo la primera IP", () => {
  const request = new Request("https://zulu.example/api/chat", {
    headers: {
      "x-forwarded-for": "198.51.100.5",
      "x-vercel-forwarded-for": "203.0.113.8, 10.0.0.2",
    },
  });

  assert.equal(obtenerIpCliente(request, true), "203.0.113.8");
});

test("falla cerrado en Vercel si no hay IP confiable", () => {
  assert.throws(
    () => obtenerIpCliente(new Request("https://zulu.example"), true),
    /ip_invitado_no_disponible/
  );
});

test("rechaza secretos cortos e identificadores de dispositivo invalidos", () => {
  assert.throws(
    () =>
      construirHashesSolicitud({
        request: solicitud(),
        secret: "corto",
        esVercel: true,
      }),
    /guest_limit_secret_invalido/
  );
  assert.throws(
    () =>
      construirIdentidadInvitada({
        request: solicitud(),
        deviceId: "no-es-un-uuid",
        secret: SECRET,
        esVercel: true,
      }),
    /device_id_invitado_invalido/
  );
});

test("genera identificadores de dispositivo validos", () => {
  assert.equal(esIdDispositivoValido(crearIdDispositivo()), true);
});
test("valida identificadores de preflight antes de confiar en la cookie", () => {
  assert.equal(esIdPreflightValido(DEVICE_ID), true);
  assert.equal(esIdPreflightValido("no-es-un-uuid"), false);
  assert.equal(esIdPreflightValido(undefined), false);
});
test("lee el TTL efectivo devuelto por PostgreSQL", () => {
  const preparacion = leerPreparacionPreflightInvitado([
    { preflight_id: DEVICE_ID, ttl_seconds: 1800 },
  ]);
  assert.deepEqual(preparacion, {
    preflightId: DEVICE_ID,
    ttlSeconds: 1800,
  });
  assert.equal(
    leerPreparacionPreflightInvitado([
      { preflight_id: DEVICE_ID, ttl_seconds: 0 },
    ]),
    null
  );
  assert.equal(leerPreparacionPreflightInvitado(null), null);
});
