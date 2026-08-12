type ErrorAuthMinimo =
  | {
      code?: string;
      name?: string;
    }
  | null
  | undefined;

export function esSesionAusente(error: ErrorAuthMinimo) {
  return error?.name === "AuthSessionMissingError";
}

export function esSesionDeUsuarioEliminado(error: ErrorAuthMinimo) {
  return error?.code === "user_not_found";
}
