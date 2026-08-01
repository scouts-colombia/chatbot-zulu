"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cambiarEstadoDocumento, type EstadoAccion } from "../acciones";

export function FormularioDocumento({
  id,
  activo,
  listoParaActivar,
}: {
  id: string;
  activo: boolean;
  listoParaActivar: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoAccion, FormData>(
    cambiarEstadoDocumento,
    { error: null }
  );

  const bloqueado = !(activo || listoParaActivar);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={enviar}>
        <input name="id" type="hidden" value={id} />
        <input name="activar" type="hidden" value={String(!activo)} />
        <Button
          disabled={pendiente || bloqueado}
          size="sm"
          title={
            bloqueado
              ? "No se puede activar: falta metadata sincronizada o tiene error de indexación"
              : undefined
          }
          type="submit"
          variant="outline"
        >
          {activo ? "Desactivar" : "Activar"}
        </Button>
      </form>
      {estado.error && (
        <p
          className="max-w-56 text-right text-destructive text-xs"
          role="alert"
        >
          {estado.error}
        </p>
      )}
    </div>
  );
}
