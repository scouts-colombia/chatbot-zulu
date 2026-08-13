export const EVENTO_TURNO_INVITADO = "zulu:turno-invitado";

export function marcarTurnoInvitadoEnCurso(enCurso: boolean) {
  if (typeof document === "undefined") {
    return;
  }
  if (enCurso) {
    document.documentElement.dataset.turnoInvitadoEnCurso = "true";
  } else {
    delete document.documentElement.dataset.turnoInvitadoEnCurso;
  }
  window.dispatchEvent(
    new CustomEvent<boolean>(EVENTO_TURNO_INVITADO, { detail: enCurso })
  );
}

export function hayTurnoInvitadoEnCurso() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.turnoInvitadoEnCurso === "true"
  );
}
