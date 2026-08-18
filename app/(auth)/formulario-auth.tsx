"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import {
  type MovimientoZulu,
  type PoseZulu,
  ZuluMascota,
} from "@/components/marca/zulu-mascota";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { limpiarBorradoresPendientesExpirados } from "@/lib/invitados/borrador";
import type { EstadoFormulario } from "./acciones";

type Props = {
  modo: "login" | "registro" | "finalizar";
  conversionInvitada?: boolean;
  errorInicial?: string;
  borradorTransferenciaId?: string | null;
  conversationIdTransferencia?: string | null;
  accion: (
    estadoPrevio: EstadoFormulario,
    formData: FormData
  ) => Promise<EstadoFormulario>;
};

export function FormularioAuth({
  modo,
  accion,
  errorInicial,
  borradorTransferenciaId = null,
  conversationIdTransferencia = null,
  conversionInvitada = false,
}: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, { error: null });
  useEffect(() => {
    const purgar = () => limpiarBorradoresPendientesExpirados(localStorage);
    purgar();
    const intervalo = window.setInterval(purgar, 60_000);
    return () => window.clearInterval(intervalo);
  }, []);
  const errorVisible = estado.mensaje ? null : (estado.error ?? errorInicial);
  const esRegistro = modo === "registro";
  const esFinalizar = modo === "finalizar";
  const poseZulu: PoseZulu = pendiente
    ? "pensando"
    : errorVisible
      ? "error"
      : estado.mensaje
        ? "listo"
        : "bienvenida";
  const movimientoZulu: MovimientoZulu = estado.mensaje
    ? "celebra"
    : pendiente
      ? "piensa"
      : "respira";

  return (
    <div
      className="pnpj-fondo relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-20"
      data-design-direction="ruta-editorial-glass"
      data-design-mode="operate"
    >
      <Link
        className="focus-ring absolute top-4 left-4 rounded-lg px-3 py-2 text-scouts-purple/80 text-sm hover:text-scouts-purple sm:top-6 sm:left-6"
        href="/"
      >
        ← Volver a Zulú
      </Link>
      <div className="auth-card-enter auth-card-surface relative z-10 w-full max-w-sm space-y-6 rounded-3xl p-6 sm:p-8">
        <div className="space-y-1 text-center">
          <ZuluMascota
            className="mx-auto -mt-16 mb-1 size-28 sm:size-32"
            key={poseZulu}
            movimiento={movimientoZulu}
            pose={poseZulu}
            priority
            sizes="128px"
          />
          <h1 className="font-semibold text-2xl text-scouts-purple">Zulú</h1>
          <p className="text-muted-foreground text-sm">
            {esFinalizar
              ? "Crea una contraseña para terminar tu registro"
              : conversionInvitada
                ? "Crea tu contraseña y verifica el correo sin perder la conversación"
                : esRegistro
                  ? "Crea tu cuenta para consultar los manuales oficiales"
                  : "Inicia sesión para consultar los manuales oficiales"}
          </p>
        </div>

        <form action={enviar} className="space-y-4">
          {borradorTransferenciaId && (
            <input
              name="borrador"
              type="hidden"
              value={borradorTransferenciaId}
            />
          )}
          {conversationIdTransferencia && (
            <input
              name="conversacion"
              type="hidden"
              value={conversationIdTransferencia}
            />
          )}
          {esRegistro && (
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                autoComplete="name"
                id="nombre"
                name="nombre"
                placeholder="Tu nombre"
                required
              />
            </div>
          )}

          {!esFinalizar && (
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                autoComplete="email"
                id="email"
                name="email"
                placeholder="tu@correo.com"
                required
                type="email"
              />
            </div>
          )}

          {(esRegistro || esFinalizar || !conversionInvitada) && (
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                autoComplete={
                  esRegistro || esFinalizar
                    ? "new-password"
                    : "current-password"
                }
                id="password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </div>
          )}

          {errorVisible && (
            <p className="text-destructive text-sm" role="alert">
              {errorVisible}
            </p>
          )}

          {estado.mensaje && (
            <output className="block text-muted-foreground text-sm">
              {estado.mensaje}
            </output>
          )}

          <Button
            className="btn-press min-h-11 w-full bg-scouts-purple text-white hover:bg-scouts-purple/90"
            disabled={pendiente}
            type="submit"
          >
            {pendiente
              ? "Un momento..."
              : esFinalizar
                ? "Guardar contraseña"
                : conversionInvitada
                  ? "Verificar y crear cuenta"
                  : esRegistro
                    ? "Crear cuenta"
                    : "Iniciar sesión"}
          </Button>
        </form>

        {!esFinalizar && (
          <p className="text-center text-muted-foreground text-sm">
            {esRegistro ? (
              <>
                ¿Ya tienes cuenta?{" "}
                <Link
                  className="font-medium text-scouts-purple underline underline-offset-4"
                  href={rutaAuthAlterna(
                    "/login",
                    borradorTransferenciaId,
                    conversationIdTransferencia
                  )}
                >
                  Inicia sesión
                </Link>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{" "}
                <Link
                  className="font-medium text-scouts-purple underline underline-offset-4"
                  href={rutaAuthAlterna(
                    "/registro",
                    borradorTransferenciaId,
                    conversationIdTransferencia
                  )}
                >
                  Regístrate
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
function rutaAuthAlterna(
  ruta: "/login" | "/registro",
  borradorId: string | null,
  conversationId: string | null
) {
  const parametros = new URLSearchParams();
  if (borradorId) {
    parametros.set("borrador", borradorId);
  }
  if (conversationId) {
    parametros.set("conversacion", conversationId);
  }
  const query = parametros.toString();
  return query ? `${ruta}?${query}` : ruta;
}
