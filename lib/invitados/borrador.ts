const BORRADOR_INVITADO_PREFIJO = "zulu:borrador-invitado";
const BORRADOR_INVITADO_PENDIENTE_ANTERIOR = `${BORRADOR_INVITADO_PREFIJO}:pendiente`;
const VIGENCIA_BORRADOR_PENDIENTE_MS = 30 * 60 * 1000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AlmacenBorrador = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function esIdTraspasoBorradorValido(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export function crearIdTraspasoBorrador() {
  return crypto.randomUUID();
}

export function claveBorradorInvitado(conversationId: string) {
  return `${BORRADOR_INVITADO_PREFIJO}:${conversationId}`;
}

function claveBorradorPendiente(traspasoId: string) {
  return `${BORRADOR_INVITADO_PREFIJO}:pendiente:${traspasoId}`;
}

export function eliminarClaveGlobalAnterior(almacen: AlmacenBorrador) {
  almacen.removeItem(BORRADOR_INVITADO_PREFIJO);
  almacen.removeItem(BORRADOR_INVITADO_PENDIENTE_ANTERIOR);
}

export function guardarBorradorInvitado({
  almacen,
  almacenPendiente = almacen,
  conversationId,
  traspasoId,
  texto,
  ahora = Date.now(),
}: {
  almacen: AlmacenBorrador;
  almacenPendiente?: AlmacenBorrador;
  conversationId: string | null;
  traspasoId?: string | null;
  texto: string;
  ahora?: number;
}) {
  if (conversationId) {
    almacen.setItem(claveBorradorInvitado(conversationId), texto);
    return true;
  }
  if (!esIdTraspasoBorradorValido(traspasoId)) {
    return false;
  }
  almacenPendiente.setItem(
    claveBorradorPendiente(traspasoId),
    JSON.stringify({ texto, guardadoEn: ahora })
  );
  return true;
}

function leerBorradorPendiente(
  almacen: AlmacenBorrador,
  traspasoId: string,
  ahora: number
) {
  const clave = claveBorradorPendiente(traspasoId);
  const valor = almacen.getItem(clave);
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
    // Un valor inválido no se conserva ni se expone.
  }
  almacen.removeItem(clave);
  return null;
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
  if (esIdTraspasoBorradorValido(traspasoId)) {
    const pendiente = leerBorradorPendiente(
      almacenPendiente,
      traspasoId,
      ahora
    );
    if (pendiente && !almacen.getItem(clave)) {
      almacen.setItem(clave, pendiente);
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
  if (esIdTraspasoBorradorValido(traspasoId)) {
    almacenPendiente.removeItem(claveBorradorPendiente(traspasoId));
  }
}
