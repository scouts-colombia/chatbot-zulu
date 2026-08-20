import "server-only";
import { cookies } from "next/headers";
import type { crearClienteAdmin } from "@/lib/supabase/admin";
import { esUuid } from "@/lib/uuid";
import {
  COOKIE_DISPOSITIVO_INVITADO,
  COOKIE_PREFLIGHT_INVITADO,
  construirIdentidadInvitada,
  crearIdDispositivo,
  type IdentidadInvitada,
  leerPreparacionPreflightInvitado,
} from "./identidad";

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

const UN_ANO_EN_SEGUNDOS = 60 * 60 * 24 * 365;

function opcionesCookie(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Identidad seudónima del visitante: cookie de dispositivo (se crea si falta o
 * si el valor no es un UUID propio) más los hashes HMAC de red y entorno. No se
 * guarda IP ni user-agent en claro (errata 8 del alcance).
 *
 * Lanza si `GUEST_LIMIT_SECRET` no está configurado o si la IP no se puede
 * determinar en Vercel: sin identidad no hay forma de aplicar el límite, y
 * seguir sin ella regalaría turnos ilimitados.
 */
export async function asegurarIdentidadInvitada(
  request: Request
): Promise<IdentidadInvitada> {
  const cookieStore = await cookies();
  const cookieActual = cookieStore.get(COOKIE_DISPOSITIVO_INVITADO)?.value;
  const deviceId = esUuid(cookieActual) ? cookieActual : crearIdDispositivo();

  if (deviceId !== cookieActual) {
    cookieStore.set(
      COOKIE_DISPOSITIVO_INVITADO,
      deviceId,
      opcionesCookie(UN_ANO_EN_SEGUNDOS)
    );
  }

  return construirIdentidadInvitada({
    request,
    deviceId,
    secret: process.env.GUEST_LIMIT_SECRET ?? "",
  });
}

export function leerPreflightPendiente(cookieStore: {
  get: (nombre: string) => { value: string } | undefined;
}) {
  const valor = cookieStore.get(COOKIE_PREFLIGHT_INVITADO)?.value;
  return esUuid(valor) ? valor : null;
}

export type PreparacionPreflight =
  | { tipo: "listo"; preflightId: string }
  | { tipo: "limite"; mensajeError: string }
  | { tipo: "no_disponible" };

/**
 * Reserva el cupo del turno de prueba ANTES de crear la identidad anónima y de
 * llamar al modelo, y deja el id en cookie para que un reintento no consuma un
 * cupo nuevo. Distingue el límite alcanzado (respuesta de producto: puerta de
 * registro) de una indisponibilidad técnica.
 */
export async function prepararPreflightInvitado(
  admin: ClienteAdmin,
  identidad: IdentidadInvitada,
  etiquetaLog: string
): Promise<PreparacionPreflight> {
  const { data, error } = await admin.rpc("preparar_turno_invitado_v2", {
    p_device_hash: identidad.deviceHash,
    p_environment_hash: identidad.environmentHash,
    p_network_hash: identidad.networkHash,
  });
  const preparacion = leerPreparacionPreflightInvitado(data);

  if (error || !preparacion) {
    const mensajeError = error?.message ?? "";
    if (/limite_invitado|limite_red_invitada/.test(mensajeError)) {
      return { tipo: "limite", mensajeError };
    }
    console.error(`${etiquetaLog} No se pudo preparar el turno:`, error);
    return { tipo: "no_disponible" };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    COOKIE_PREFLIGHT_INVITADO,
    preparacion.preflightId,
    opcionesCookie(preparacion.ttlSeconds)
  );
  return { tipo: "listo", preflightId: preparacion.preflightId };
}

export async function olvidarPreflightInvitado() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_PREFLIGHT_INVITADO);
}

/**
 * Devuelve el cupo reservado y borra la cookie. Si la liberación falla, la
 * cookie se conserva a propósito: el cupo sigue reservado en la base y borrarla
 * dejaría una reserva huérfana hasta que expire su TTL.
 */
export async function liberarPreflightInvitado(
  admin: ClienteAdmin,
  preflightId: string | null,
  etiquetaLog: string
) {
  if (!preflightId) {
    // Nada que devolver en la base, pero la cookie sí se limpia: puede ser un
    // resto de una sesión de prueba anterior y dejarla haría que el siguiente
    // intento se leyera como pendiente.
    await olvidarPreflightInvitado();
    return true;
  }
  const { error } = await admin.rpc("liberar_preflight_turno_invitado", {
    p_preflight_id: preflightId,
  });
  if (error) {
    console.error(`${etiquetaLog} No se pudo liberar el preflight:`, error);
    return false;
  }
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_PREFLIGHT_INVITADO);
  return true;
}

/** Hilo único del visitante: se reutiliza para que el turno no cree otro. */
export async function obtenerOCrearConversacionInvitada(
  admin: ClienteAdmin,
  userId: string,
  etiquetaLog: string
) {
  const { data, error } = await admin.rpc(
    "obtener_o_crear_conversacion_invitada",
    { p_user_id: userId }
  );
  if (error || typeof data !== "string") {
    console.error(`${etiquetaLog} No se pudo preparar la conversación:`, error);
    return null;
  }
  return data;
}
