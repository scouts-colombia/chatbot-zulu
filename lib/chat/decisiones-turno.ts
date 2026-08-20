import type { MensajeUI } from "@/components/chat/tipos";
import { estadoConEtiqueta } from "@/lib/chat/contrato";
import { ERROR_COORDINACION_INVITADA } from "@/lib/invitados/coordinacion";
import { esUuid } from "@/lib/uuid";

/**
 * Decisiones del turno del chat, separadas del componente que las aplica.
 *
 * `enviar()` tenía doce salidas distintas anidadas sobre cuerpos de respuesta
 * sin tipar, en la pantalla de entrada del producto y sin una sola prueba. Aquí
 * la decisión es una función pura sobre `(ok, cuerpo, esInvitado)` y el
 * componente solo la ejecuta, así que cada rama se puede probar sin DOM.
 *
 * Cada decisión declara si hay que retirar la burbuja optimista: el único caso
 * en que NO se retira es `turno_invitado_consumido`, porque ahí la pregunta sí
 * quedó registrada y borrarla de pantalla mentiría sobre la cuota gastada.
 */

/**
 * Motivos con los que el chat abre la puerta de registro. Todos prometen lo
 * mismo —que el borrador escrito no se pierde— porque el flujo de traspaso lo
 * garantiza; escritos suelto uno por uno, una variante podía dejar de
 * prometerlo sin que nada lo delatara.
 */
export const MOTIVOS_REGISTRO = {
  cupoAgotado: "Crea una cuenta o inicia sesión para continuar usando el chat.",
  respuestaSinConfirmar:
    "No pudimos confirmar la respuesta de prueba. Crea una cuenta o inicia sesión para continuar sin perder tu pregunta.",
  sinCoordinacion:
    "Tu navegador no permite coordinar de forma segura la prueba entre pestañas. Crea una cuenta o inicia sesión para continuar sin perder tu pregunta.",
  conexionPerdida:
    "Se perdió la conexión mientras procesábamos tu pregunta de prueba. Crea una cuenta o inicia sesión para continuar sin perderla.",
  turnoUsado:
    "Tu pregunta de prueba ya fue usada. Crea una cuenta o inicia sesión para continuar.",
} as const;

const AVISOS = {
  preparacionFallida:
    "No pudimos preparar tu sesión de prueba. Inténtalo de nuevo.",
  conversacionInvalida:
    "No pudimos preparar tu conversación de prueba. Inténtalo de nuevo.",
  sesionInvitadaPerdida:
    "No pudimos establecer tu sesión de prueba. Inténtalo de nuevo.",
  envioFallido:
    "No se pudo enviar el mensaje. Inténtalo de nuevo en un momento.",
  respuestaIlegible: "No se pudo leer la respuesta. Inténtalo de nuevo.",
  sinConexion: "No hay conexión con el servidor. Inténtalo de nuevo.",
  politicaCambio:
    "La política de privacidad cambió. Revísala y vuelve a aceptarla.",
} as const;

/** Cuerpo de respuesta del servidor tal como llega: sin garantías de forma. */
export type CuerpoServidor = Record<string, unknown> | null;

export type Decision =
  | { tipo: "politica_actualizada"; mensaje: string; versionPolitica?: string }
  | { tipo: "registro"; mensaje?: string; conversationId?: string }
  | { tipo: "aviso"; mensaje: string }
  | { tipo: "reintentar_sesion_invitada"; mensaje: string }
  | { tipo: "sesion_invitada_lista"; conversationId: string }
  | { tipo: "respuesta"; cuerpo: Record<string, unknown> };

export type ResultadoDecision = { decision: Decision; revertir: boolean };

function texto(valor: unknown) {
  return typeof valor === "string" && valor.length > 0 ? valor : undefined;
}

function politicaActualizada(cuerpo: CuerpoServidor): Decision | null {
  if (cuerpo?.codigo !== "politica_actualizada") {
    return null;
  }
  return {
    tipo: "politica_actualizada",
    mensaje: texto(cuerpo.mensaje) ?? AVISOS.politicaCambio,
    versionPolitica: texto(cuerpo.versionPolitica),
  };
}

/** Respuesta de `POST /api/chat/invitado`, que establece la sesión de prueba. */
export function decidirPreparacionInvitada(
  ok: boolean,
  cuerpo: CuerpoServidor
): ResultadoDecision {
  if (!(ok && cuerpo)) {
    const politica = politicaActualizada(cuerpo);
    if (politica) {
      return { decision: politica, revertir: true };
    }
    if (cuerpo?.codigo === "registro_requerido") {
      return {
        decision: { tipo: "registro", mensaje: texto(cuerpo.mensaje) },
        revertir: true,
      };
    }
    return {
      decision: {
        tipo: "aviso",
        mensaje: texto(cuerpo?.mensaje) ?? AVISOS.preparacionFallida,
      },
      revertir: true,
    };
  }

  // Sin un id de conversación válido no hay dónde poner el turno, y seguir
  // dejaría al servidor abriendo un hilo distinto del que ve la pantalla.
  if (!esUuid(cuerpo.conversationId)) {
    return {
      decision: { tipo: "aviso", mensaje: AVISOS.conversacionInvalida },
      revertir: true,
    };
  }

  return {
    decision: {
      tipo: "sesion_invitada_lista",
      conversationId: cuerpo.conversationId,
    },
    revertir: false,
  };
}

/** Respuesta de `POST /api/chat`, que produce el turno completo. */
export function decidirTurno({
  ok,
  cuerpo,
  esInvitado,
}: {
  ok: boolean;
  cuerpo: CuerpoServidor;
  esInvitado: boolean;
}): ResultadoDecision {
  if (!ok) {
    // La pregunta se registró y consumió cuota, pero la respuesta no llegó: la
    // burbuja del usuario se queda en pantalla porque existe de verdad.
    if (esInvitado && cuerpo?.codigo === "turno_invitado_consumido") {
      return {
        decision: {
          tipo: "aviso",
          mensaje: texto(cuerpo.mensaje) ?? AVISOS.envioFallido,
        },
        revertir: false,
      };
    }

    const politica = politicaActualizada(cuerpo);
    if (politica) {
      return { decision: politica, revertir: true };
    }
    if (cuerpo?.codigo === "registro_requerido") {
      return {
        decision: {
          tipo: "registro",
          mensaje: texto(cuerpo.mensaje) ?? MOTIVOS_REGISTRO.cupoAgotado,
          conversationId: texto(cuerpo.conversationId),
        },
        revertir: true,
      };
    }
    if (esInvitado && cuerpo?.codigo === "sesion_invitada_requerida") {
      return {
        decision: {
          tipo: "reintentar_sesion_invitada",
          mensaje: AVISOS.sesionInvitadaPerdida,
        },
        revertir: true,
      };
    }
    // Un 500 sin cuerpo o un 504 del gateway devuelven HTML: para un invitado
    // el turno pudo consumirse igual, así que se ofrece conservar la pregunta
    // creando cuenta en vez de decirle que reintente y la pierda.
    if (esInvitado && !cuerpo) {
      return {
        decision: {
          tipo: "registro",
          mensaje: MOTIVOS_REGISTRO.respuestaSinConfirmar,
        },
        revertir: true,
      };
    }
    return {
      decision: {
        tipo: "aviso",
        mensaje: texto(cuerpo?.mensaje) ?? AVISOS.envioFallido,
      },
      revertir: true,
    };
  }

  if (!cuerpo) {
    return {
      decision: esInvitado
        ? { tipo: "registro", mensaje: MOTIVOS_REGISTRO.respuestaSinConfirmar }
        : { tipo: "aviso", mensaje: AVISOS.respuestaIlegible },
      revertir: true,
    };
  }

  return { decision: { tipo: "respuesta", cuerpo }, revertir: false };
}

/** La petición nunca llegó a producir respuesta (red caída, locks, abort). */
export function decidirFallo({
  error,
  esInvitado,
  solicitudPrincipalIniciada,
}: {
  error: unknown;
  esInvitado: boolean;
  solicitudPrincipalIniciada: boolean;
}): ResultadoDecision {
  if (error instanceof Error && error.message === ERROR_COORDINACION_INVITADA) {
    return {
      decision: { tipo: "registro", mensaje: MOTIVOS_REGISTRO.sinCoordinacion },
      revertir: true,
    };
  }
  // Ya se había llamado a /api/chat: el turno pudo quedar registrado del otro
  // lado, así que no se promete un reintento limpio.
  if (esInvitado && solicitudPrincipalIniciada) {
    return {
      decision: { tipo: "registro", mensaje: MOTIVOS_REGISTRO.conexionPerdida },
      revertir: true,
    };
  }
  return {
    decision: { tipo: "aviso", mensaje: AVISOS.sinConexion },
    revertir: true,
  };
}

/** Traduce la respuesta del servidor a la burbuja del asistente. */
export function construirMensajeAsistente(
  cuerpo: Record<string, unknown>,
  idPorDefecto: string
): MensajeUI {
  const citas = Array.isArray(cuerpo.citas) ? cuerpo.citas : [];
  const guiada = cuerpo.preguntaGuiada as
    | { texto: string; opciones: string[] }
    | undefined;

  return {
    id: texto(cuerpo.mensajeId) ?? idPorDefecto,
    sender: "asistente",
    content: typeof cuerpo.respuesta === "string" ? cuerpo.respuesta : "",
    estado: estadoConEtiqueta(cuerpo.estado),
    citas: citas.map((cita) => {
      const fila = cita as {
        documentTitleSnapshot?: string;
        pageNumber?: number;
      };
      return {
        titulo: fila.documentTitleSnapshot ?? "Documento sin título",
        pagina: fila.pageNumber,
      };
    }),
    preguntaGuiada: guiada
      ? { texto: guiada.texto, opciones: guiada.opciones }
      : undefined,
  };
}
