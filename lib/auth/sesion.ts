type ErrorAuthMinimo =
  | {
      code?: string;
      name?: string;
    }
  | null
  | undefined;

/**
 * `getUser()` sin cookies de sesión devuelve `AuthSessionMissingError`: es el
 * visitante anónimo del turno público, no una falla. Cualquier otro error sí lo
 * es, y ahí quien llama no puede seguir como si simplemente no hubiera usuario:
 * mandaría a modo invitado (o a /login) a alguien que sí tiene cuenta.
 */
export function esFalloDeVerificacionDeSesion(error: ErrorAuthMinimo) {
  return Boolean(error) && error?.name !== "AuthSessionMissingError";
}

export function esSesionDeUsuarioEliminado(error: ErrorAuthMinimo) {
  return error?.code === "user_not_found";
}
