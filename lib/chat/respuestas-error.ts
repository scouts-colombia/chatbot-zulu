import { NextResponse } from "next/server";
import { VERSION_POLITICA_PRIVACIDAD } from "@/lib/privacidad";

/**
 * Respuestas de error que comparten `/api/chat` y `/api/chat/invitado`. Estaban
 * escritas dos veces con el mismo código y el mismo texto (una copia incluso
 * con las tildes escapadas como `á`), así que el visitante podía leer dos
 * mensajes distintos para la misma causa según por dónde entrara.
 *
 * El detalle crudo de Postgres o del proveedor nunca viaja aquí: se registra en
 * servidor y la pantalla muestra algo accionable (§16, usuarios desde 15 años).
 */
export const ERROR_AUTENTICACION_NO_DISPONIBLE = {
  codigo: "autenticacion_no_disponible",
  mensaje: "No pudimos verificar tu sesión. Intenta de nuevo.",
} as const;

export const ERROR_INVITADO_NO_DISPONIBLE = {
  codigo: "invitado_no_disponible",
  mensaje:
    "El turno de prueba no está disponible en este momento. Intenta de nuevo más tarde.",
} as const;

export const ERROR_CONVERSACION_NO_DISPONIBLE = {
  codigo: "conversacion_no_disponible",
  mensaje: "No pudimos preparar tu conversación. Intenta de nuevo.",
} as const;

export const ERROR_CONSENTIMIENTO_REQUERIDO = {
  codigo: "consentimiento_requerido",
  mensaje:
    "Debes aceptar la política de privacidad vigente antes de usar el chat.",
} as const;

export const ERROR_POLITICA_ACTUALIZADA = {
  codigo: "politica_actualizada",
  mensaje:
    "La política de privacidad cambió. Revisa y acepta la versión vigente antes de enviar.",
  versionPolitica: VERSION_POLITICA_PRIVACIDAD,
} as const;

type CuerpoError = { codigo: string; mensaje?: string };

export function respuestaError(cuerpo: CuerpoError, status: number) {
  return NextResponse.json(cuerpo, { status });
}
