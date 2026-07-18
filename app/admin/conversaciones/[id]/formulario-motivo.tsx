"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EstadoAccion, registrarAccesoConversacion } from "../../acciones";
import { MOTIVOS_PREDEFINIDOS } from "../../motivos";

export function FormularioMotivo({
  conversationId,
}: {
  conversationId: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoAccion, FormData>(
    registrarAccesoConversacion,
    { error: null }
  );

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="space-y-1">
        <h2 className="font-medium">Motivo de acceso obligatorio</h2>
        <p className="text-muted-foreground text-sm">
          Vas a abrir la conversación de otra persona. El acceso queda
          registrado en la auditoría con tu usuario, la fecha y el motivo.
        </p>
      </div>

      <form action={enviar} className="space-y-4">
        <input name="conversationId" type="hidden" value={conversationId} />

        <fieldset className="space-y-2">
          <Label>Motivo</Label>
          {MOTIVOS_PREDEFINIDOS.map((motivo) => (
            <label className="flex items-center gap-2 text-sm" key={motivo}>
              <input name="categoria" required type="radio" value={motivo} />
              {motivo}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input name="categoria" required type="radio" value="Otro" />
            Otro
          </label>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="detalle">Detalle (obligatorio si es "Otro")</Label>
          <Input id="detalle" name="detalle" placeholder="Describe el motivo" />
        </div>

        {estado.error && (
          <p className="text-destructive text-sm" role="alert">
            {estado.error}
          </p>
        )}

        <Button disabled={pendiente} type="submit">
          {pendiente ? "Registrando..." : "Registrar motivo y abrir"}
        </Button>
      </form>
    </div>
  );
}
