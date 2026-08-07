import { createHmac, randomUUID } from "node:crypto";

export const COOKIE_DISPOSITIVO_INVITADO = "zulu_guest_device";

const HEX_64 = /^[0-9a-f]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type IdentidadInvitada = {
  deviceHash: string;
  environmentHash: string;
  networkHash: string;
  userAgentHash: string;
};

export function esIdDispositivoValido(value: string | undefined) {
  return Boolean(value && UUID.test(value));
}

export function crearIdDispositivo() {
  return randomUUID();
}

export function esHashInvitado(value: string) {
  return HEX_64.test(value);
}

function normalizarCabecera(value: string | null, maximo: number) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .slice(0, maximo);
}

function hmac(secret: string, etiqueta: string, value: string) {
  return createHmac("sha256", secret)
    .update(`zulu-guest-v1:${etiqueta}:${value}`)
    .digest("hex");
}

export function obtenerIpCliente(request: Request, esVercel: boolean) {
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim();

  if (ip) {
    return ip;
  }
  if (esVercel) {
    throw new Error("ip_invitado_no_disponible");
  }
  return "desarrollo-local";
}

export function construirHashesSolicitud({
  request,
  secret,
  esVercel = process.env.VERCEL === "1",
}: {
  request: Request;
  secret: string;
  esVercel?: boolean;
}) {
  if (secret.length < 32) {
    throw new Error("guest_limit_secret_invalido");
  }
  const ip = obtenerIpCliente(request, esVercel);
  const userAgent = normalizarCabecera(request.headers.get("user-agent"), 512);
  return {
    ipHash: hmac(secret, "network", ip),
    userAgentHash: hmac(secret, "user-agent", userAgent),
    ip,
    userAgent,
  };
}

export function construirIdentidadInvitada({
  request,
  deviceId,
  secret,
  esVercel = process.env.VERCEL === "1",
}: {
  request: Request;
  deviceId: string;
  secret: string;
  esVercel?: boolean;
}): IdentidadInvitada {
  if (secret.length < 32) {
    throw new Error("guest_limit_secret_invalido");
  }
  if (!esIdDispositivoValido(deviceId)) {
    throw new Error("device_id_invitado_invalido");
  }

  const { ip, userAgent, ipHash, userAgentHash } = construirHashesSolicitud({
    request,
    secret,
    esVercel,
  });
  const idioma = normalizarCabecera(
    request.headers.get("accept-language"),
    128
  );

  return {
    deviceHash: hmac(secret, "device", deviceId),
    environmentHash: hmac(
      secret,
      "environment",
      `${ip}\n${userAgent}\n${idioma}`
    ),
    networkHash: ipHash,
    userAgentHash,
  };
}
