const BORRADOR_INVITADO_PREFIJO = "zulu:borrador-invitado";
const BORRADOR_INVITADO_PENDIENTE = `${BORRADOR_INVITADO_PREFIJO}:pendiente`;
const VIGENCIA_BORRADOR_PENDIENTE_MS = 30 * 60 * 1000;

type AlmacenBorrador = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function claveBorradorInvitado(conversationId: string | null) {
  return conversationId
    ? `${BORRADOR_INVITADO_PREFIJO}:${conversationId}`
    : BORRADOR_INVITADO_PENDIENTE;
}

export function eliminarClaveGlobalAnterior(almacen: AlmacenBorrador) {
  almacen.removeItem(BORRADOR_INVITADO_PREFIJO);
}

export function guardarBorradorInvitado({
  almacen,
  conversationId,
  texto,
  ahora = Date.now(),
}: {
  almacen: AlmacenBorrador;
  conversationId: string | null;
  texto: string;
  ahora?: number;
}) {
  const clave = claveBorradorInvitado(conversationId);
  if (!conversationId) {
    almacen.setItem(clave, JSON.stringify({ texto, guardadoEn: ahora }));
    return;
  }
  almacen.setItem(clave, texto);
}

export function leerBorradorPendiente(
  almacen: AlmacenBorrador,
  ahora = Date.now()
) {
  const valor = almacen.getItem(BORRADOR_INVITADO_PENDIENTE);
  if (!valor) {
    return null;
  }
  try {
    const datos = JSON.parse(valor) as {
      texto?: unknown;
      guardadoEn?: unknown;
    };
    if (
      typeof datos.texto === "string" &&
      typeof datos.guardadoEn === "number" &&
      ahora - datos.guardadoEn <= VIGENCIA_BORRADOR_PENDIENTE_MS
    ) {
      return datos.texto;
    }
  } catch {
    // Las versiones anteriores no tenían una clave temporal estructurada.
  }
  almacen.removeItem(BORRADOR_INVITADO_PENDIENTE);
  return null;
}

export function restaurarBorradorInvitado({
  almacen,
  conversationId,
  ahora = Date.now(),
}: {
  almacen: AlmacenBorrador;
  conversationId: string | null;
  ahora?: number;
}) {
  if (!conversationId) {
    return leerBorradorPendiente(almacen, ahora);
  }
  const clave = claveBorradorInvitado(conversationId);
  const pendiente = leerBorradorPendiente(almacen, ahora);
  if (pendiente && !almacen.getItem(clave)) {
    almacen.setItem(clave, pendiente);
  }
  almacen.removeItem(BORRADOR_INVITADO_PENDIENTE);
  return almacen.getItem(clave);
}

export function limpiarBorradorInvitado(
  almacen: AlmacenBorrador,
  conversationId: string | null
) {
  almacen.removeItem(claveBorradorInvitado(conversationId));
  almacen.removeItem(BORRADOR_INVITADO_PENDIENTE);
}
