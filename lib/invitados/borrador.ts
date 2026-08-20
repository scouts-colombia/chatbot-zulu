import { esUuid } from "@/lib/uuid";

const BORRADOR_INVITADO_PREFIJO = "zulu:borrador-invitado";
const BORRADOR_INVITADO_PENDIENTE_PREFIJO = `${BORRADOR_INVITADO_PREFIJO}:pendiente:`;
const BORRADOR_INVITADO_PENDIENTE_ANTERIOR = `${BORRADOR_INVITADO_PREFIJO}:pendiente`;
const VIGENCIA_BORRADOR_PENDIENTE_MS = 30 * 60 * 1000;

type AlmacenBorrador = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type AlmacenBorradorEnumerable = AlmacenBorrador &
  Pick<Storage, "key" | "length">;

type BorradorPendiente = {
  texto: string;
  guardadoEn: number;
  conversationIdDestino?: string;
};

export function crearIdTraspasoBorrador() {
  return crypto.randomUUID();
}

export function claveBorradorInvitado(conversationId: string) {
  return `${BORRADOR_INVITADO_PREFIJO}:${conversationId}`;
}

function claveBorradorPendiente(traspasoId: string) {
  return `${BORRADOR_INVITADO_PENDIENTE_PREFIJO}${traspasoId}`;
}

export function eliminarClaveGlobalAnterior(almacen: AlmacenBorrador) {
  almacen.removeItem(BORRADOR_INVITADO_PREFIJO);
  almacen.removeItem(BORRADOR_INVITADO_PENDIENTE_ANTERIOR);
}

export function guardarBorradorInvitado({
  almacen,
  almacenPendiente = almacen,
  conversationId,
  conversationIdDestino,
  traspasoId,
  texto,
  ahora = Date.now(),
}: {
  almacen: AlmacenBorrador;
  almacenPendiente?: AlmacenBorrador;
  conversationId: string | null;
  conversationIdDestino?: string | null;
  traspasoId?: string | null;
  texto: string;
  ahora?: number;
}) {
  if (conversationId) {
    almacen.setItem(claveBorradorInvitado(conversationId), texto);
    return true;
  }
  if (
    !esUuid(traspasoId) ||
    (conversationIdDestino !== null &&
      conversationIdDestino !== undefined &&
      !esUuid(conversationIdDestino))
  ) {
    return false;
  }
  almacenPendiente.setItem(
    claveBorradorPendiente(traspasoId),
    JSON.stringify({
      texto,
      guardadoEn: ahora,
      ...(conversationIdDestino ? { conversationIdDestino } : {}),
    })
  );
  return true;
}

function leerBorradorPendiente(
  almacen: AlmacenBorrador,
  traspasoId: string,
  ahora: number
): BorradorPendiente | null {
  const clave = claveBorradorPendiente(traspasoId);
  const valor = almacen.getItem(clave);
  if (!valor) {
    return null;
  }
  try {
    const datos = JSON.parse(valor) as Record<string, unknown>;
    const edad =
      typeof datos.guardadoEn === "number" ? ahora - datos.guardadoEn : -1;
    const destinoValido =
      datos.conversationIdDestino === undefined ||
      esUuid(datos.conversationIdDestino);
    if (
      typeof datos.texto === "string" &&
      datos.texto.length > 0 &&
      datos.texto.length <= 2000 &&
      edad >= 0 &&
      edad <= VIGENCIA_BORRADOR_PENDIENTE_MS &&
      destinoValido
    ) {
      return {
        texto: datos.texto,
        guardadoEn: datos.guardadoEn as number,
        ...(typeof datos.conversationIdDestino === "string"
          ? { conversationIdDestino: datos.conversationIdDestino }
          : {}),
      };
    }
  } catch {
    // Un valor inválido no se conserva ni se expone.
  }
  almacen.removeItem(clave);
  return null;
}

export function limpiarBorradoresPendientesExpirados(
  almacen: AlmacenBorradorEnumerable,
  ahora = Date.now()
) {
  const claves: string[] = [];
  for (let indice = 0; indice < almacen.length; indice += 1) {
    const clave = almacen.key(indice);
    if (clave?.startsWith(BORRADOR_INVITADO_PENDIENTE_PREFIJO)) {
      claves.push(clave);
    }
  }

  for (const clave of claves) {
    const traspasoId = clave.slice(BORRADOR_INVITADO_PENDIENTE_PREFIJO.length);
    if (!esUuid(traspasoId)) {
      almacen.removeItem(clave);
      continue;
    }
    leerBorradorPendiente(almacen, traspasoId, ahora);
  }
}

export function restaurarBorradorInvitado({
  almacen,
  almacenPendiente = almacen,
  conversationId,
  traspasoId,
  ahora = Date.now(),
}: {
  almacen: AlmacenBorrador;
  almacenPendiente?: AlmacenBorrador;
  conversationId: string | null;
  traspasoId?: string | null;
  ahora?: number;
}) {
  // Nunca se restaura un borrador pendiente en la portada pública: solo puede
  // cruzar a una conversación concreta mediante el token opaco del flujo auth.
  if (!conversationId) {
    return null;
  }

  const clave = claveBorradorInvitado(conversationId);
  if (esUuid(traspasoId)) {
    const pendiente = leerBorradorPendiente(
      almacenPendiente,
      traspasoId,
      ahora
    );
    if (
      pendiente?.conversationIdDestino &&
      pendiente.conversationIdDestino !== conversationId
    ) {
      return almacen.getItem(clave);
    }
    if (pendiente?.texto && !almacen.getItem(clave)) {
      almacen.setItem(clave, pendiente.texto);
    }
    almacenPendiente.removeItem(claveBorradorPendiente(traspasoId));
  }
  return almacen.getItem(clave);
}

export function limpiarBorradorInvitado(
  almacen: AlmacenBorrador,
  conversationId: string | null,
  traspasoId?: string | null,
  almacenPendiente: AlmacenBorrador = almacen
) {
  if (conversationId) {
    almacen.removeItem(claveBorradorInvitado(conversationId));
  }
  if (esUuid(traspasoId)) {
    almacenPendiente.removeItem(claveBorradorPendiente(traspasoId));
  }
}
