export const BLOQUEO_PREPARACION_INVITADA = "zulu:preparacion-invitada";
export const ERROR_COORDINACION_INVITADA =
  "coordinacion_invitada_no_disponible";

type GestorBloqueos = {
  request<T>(
    nombre: string,
    opciones: { mode: "exclusive" },
    operacion: () => Promise<T>
  ): Promise<T>;
};

export function coordinarPreparacionInvitada<T>(
  operacion: () => Promise<T>,
  gestor?: GestorBloqueos | null
) {
  const gestorDisponible =
    gestor === undefined
      ? typeof navigator !== "undefined" && "locks" in navigator
        ? (navigator.locks as unknown as GestorBloqueos)
        : null
      : gestor;

  if (!gestorDisponible) {
    return Promise.reject(new Error(ERROR_COORDINACION_INVITADA));
  }

  return gestorDisponible.request(
    BLOQUEO_PREPARACION_INVITADA,
    { mode: "exclusive" },
    operacion
  );
}
