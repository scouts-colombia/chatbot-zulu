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
    <form
      action={enviar}
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1.5fr)_auto] sm:items-center"
    >
      <input name="userId" type="hidden" value={userId} />
      <select
        aria-label="Nuevo estado de la cuenta"
        className="min-h-11 rounded-xl border border-scouts-purple/15 bg-white/70 px-3 text-sm text-scouts-purple outline-none focus:border-scouts-purple"
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
        aria-label="Motivo del cambio"
        className="min-h-11 w-full rounded-xl border-scouts-purple/15 bg-white/70"
        name="motivo"
        placeholder="Motivo del cambio"
        required
      />
      <Button
        className="btn-press min-h-11 border-scouts-purple/20 text-scouts-purple hover:bg-scouts-purple/8"
        disabled={pendiente || sinCambio}
        size="sm"
        type="submit"
        variant="outline"
      >
        {pendiente ? "..." : "Cambiar"}
      </Button>
      {estado.error && (
        <p className="text-scouts-red text-xs sm:col-span-3" role="alert">
          {estado.error}
        </p>
      )}
    </form>
  );
}
