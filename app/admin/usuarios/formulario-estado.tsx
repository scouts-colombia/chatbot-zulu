"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cambiarEstadoCuenta, type EstadoAccion } from "../acciones";

const ESTADOS = ["activo", "pendiente_autorizacion", "bloqueado"] as const;

export function FormularioEstado({
  userId,
  estadoActual,
}: {
  userId: string;
  estadoActual: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoAccion, FormData>(
    cambiarEstadoCuenta,
    { error: null }
  );
  const [seleccion, setSeleccion] = useState(estadoActual);
  const sinCambio = seleccion === estadoActual;

  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2">
      <input name="userId" type="hidden" value={userId} />
      <select
        className="h-8 rounded-md border bg-background px-2 text-sm"
        name="estado"
        onChange={(evento) => setSeleccion(evento.target.value)}
        value={seleccion}
      >
        {ESTADOS.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
      <Input
        className="h-8 w-44"
        name="motivo"
        placeholder="Motivo del cambio"
        required
      />
      <Button
        disabled={pendiente || sinCambio}
        size="sm"
        type="submit"
        variant="outline"
      >
        {pendiente ? "..." : "Cambiar"}
      </Button>
      {estado.error && (
        <p className="w-full text-destructive text-xs" role="alert">
          {estado.error}
        </p>
      )}
    </form>
  );
}
