import { esUuid } from "@/lib/uuid";

/**
 * Tras archivar, solo se admite volver a `/` o a otro hilo propio. Archivar el
 * hilo actual, un destino externo o basura caen al inicio.
 */
export function rutaTrasArchivar(
  idArchivada: string,
  volverCrudo: FormDataEntryValue | null,
  fallo: boolean
) {
  const volver = typeof volverCrudo === "string" ? volverCrudo : "/";
  let destino = "/";
  if (volver.startsWith("/chat/")) {
    const idVolver = volver.slice("/chat/".length);
    if (esUuid(idVolver) && idVolver !== idArchivada) {
      destino = `/chat/${idVolver}`;
    }
  }
  if (fallo) {
    return destino === "/" ? "/?aviso=archivar" : `${destino}?aviso=archivar`;
  }
  return destino;
}
