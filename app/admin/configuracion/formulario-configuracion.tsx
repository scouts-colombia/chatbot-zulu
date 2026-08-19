"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConfiguracionChat } from "@/lib/configuracion/chat";
import {
  type EstadoConfiguracion,
  guardarConfiguracionChat,
} from "../acciones";

const estadoInicial: EstadoConfiguracion = { error: null, guardado: false };

export function FormularioConfiguracion({
  configuracion,
}: {
  configuracion: ConfiguracionChat;
}) {
  const [estado, enviar, pendiente] = useActionState(
    guardarConfiguracionChat,
    estadoInicial
  );

  return (
    <form action={enviar} className="space-y-8">
      <fieldset className="space-y-5 border-scouts-purple/10 border-t pt-6">
        <legend className="pr-4 font-semibold text-lg text-scouts-purple">
          Generación de respuestas
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            descripcion={
              <>
                Identificador exacto aceptado por la{" "}
                <a
                  className="font-medium text-scouts-purple underline decoration-scouts-purple/30 underline-offset-4 hover:decoration-scouts-purple"
                  href="https://ai.google.dev/gemini-api/docs/models"
                  rel="noreferrer"
                  target="_blank"
                >
                  Gemini Developer API
                </a>
                .
              </>
            }
            etiqueta="Modelo"
            htmlFor="modelo"
          >
            <input
              className="min-h-11 w-full rounded-xl border border-scouts-purple/15 bg-white/75 px-3 text-sm text-scouts-purple outline-none focus:border-scouts-purple focus:ring-2 focus:ring-scouts-purple/15"
              defaultValue={configuracion.modelo}
              id="modelo"
              maxLength={80}
              name="modelo"
              pattern="gemini-[a-z0-9][a-z0-9.-]*"
              required
              spellCheck={false}
            />
          </Campo>
          <Campo
            descripcion="Más razonamiento puede aumentar latencia y consumo de tokens."
            etiqueta="Esfuerzo de razonamiento"
            htmlFor="nivelRazonamiento"
          >
            <Select
              defaultValue={configuracion.nivelRazonamiento}
              name="nivelRazonamiento"
            >
              <SelectTrigger
                className="min-h-11 w-full rounded-xl border-scouts-purple/15 bg-white/75 px-3 text-scouts-purple focus-visible:border-scouts-purple focus-visible:ring-2 focus-visible:ring-scouts-purple/15"
                id="nivelRazonamiento"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" position="popper">
                <SelectItem value="minimal">Mínimo</SelectItem>
                <SelectItem value="low">Bajo</SelectItem>
                <SelectItem value="medium">Medio</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-scouts-purple/10 border-t pt-6">
        <legend className="pr-4 font-semibold text-lg text-scouts-purple">
          Límites diarios
        </legend>
        <div className="grid gap-5 sm:grid-cols-3">
          <Campo
            descripcion="Preguntas por cuenta registrada. Se reinicia en la zona operativa."
            etiqueta="Por persona registrada"
            htmlFor="maxTurnosRegistradoPorDia"
          >
            <InputNumero
              defaultValue={configuracion.maxTurnosRegistradoPorDia}
              id="maxTurnosRegistradoPorDia"
              max={500}
              name="maxTurnosRegistradoPorDia"
            />
          </Campo>
          <Campo
            descripcion="Preguntas de prueba por dispositivo antes de pedir registro."
            etiqueta="Por persona invitada"
            htmlFor="maxTurnosInvitadoPorPersonaPorDia"
          >
            <InputNumero
              defaultValue={configuracion.maxTurnosInvitadoPorPersonaPorDia}
              id="maxTurnosInvitadoPorPersonaPorDia"
              max={10}
              name="maxTurnosInvitadoPorPersonaPorDia"
            />
          </Campo>
          <Campo
            descripcion="Tope compartido para proteger redes Scout y evitar abuso."
            etiqueta="Por red invitada"
            htmlFor="maxTurnosInvitadoPorRedPorDia"
          >
            <InputNumero
              defaultValue={configuracion.maxTurnosInvitadoPorRedPorDia}
              id="maxTurnosInvitadoPorRedPorDia"
              max={500}
              name="maxTurnosInvitadoPorRedPorDia"
            />
          </Campo>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3 border-scouts-purple/10 border-t pt-6">
        {estado.error && (
          <p className="mr-auto text-scouts-red text-sm" role="alert">
            {estado.error}
          </p>
        )}
        {estado.guardado && !estado.error && (
          <output className="mr-auto text-scouts-blue text-sm">
            Configuración guardada.
          </output>
        )}
        <Button
          className="btn-press min-h-11 bg-scouts-purple px-5 text-white hover:bg-scouts-purple/90"
          disabled={pendiente}
          type="submit"
        >
          {pendiente ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </form>
  );
}

function Campo({
  children,
  descripcion,
  etiqueta,
  htmlFor,
}: {
  children: React.ReactNode;
  descripcion: React.ReactNode;
  etiqueta: string;
  htmlFor: string;
}) {
  return (
    <div className="space-y-2">
      <label
        className="font-medium text-sm text-scouts-purple"
        htmlFor={htmlFor}
      >
        {etiqueta}
      </label>
      {children}
      <p className="text-foreground/65 text-xs leading-5">{descripcion}</p>
    </div>
  );
}

function InputNumero({
  defaultValue,
  id,
  max,
  name,
}: {
  defaultValue: number;
  id: string;
  max: number;
  name: string;
}) {
  return (
    <input
      className="min-h-11 w-full rounded-xl border border-scouts-purple/15 bg-white/75 px-3 text-sm text-scouts-purple outline-none focus:border-scouts-purple focus:ring-2 focus:ring-scouts-purple/15"
      defaultValue={defaultValue}
      id={id}
      inputMode="numeric"
      max={max}
      min={1}
      name={name}
      required
      type="number"
    />
  );
}
