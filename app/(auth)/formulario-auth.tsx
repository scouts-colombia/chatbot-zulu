"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoFormulario } from "./acciones";

type Props = {
  modo: "login" | "registro" | "finalizar";
  conversionInvitada?: boolean;
  accion: (
    estadoPrevio: EstadoFormulario,
    formData: FormData
  ) => Promise<EstadoFormulario>;
};

export function FormularioAuth({
  modo,
  accion,
  conversionInvitada = false,
}: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, { error: null });
  const esRegistro = modo === "registro";
  const esFinalizar = modo === "finalizar";

  return (
    <div
      className="auth-hero relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-20"
      data-design-direction="ruta-liquid-glass"
      data-design-mode="operate"
    >
      <div aria-hidden="true" className="brand-orb brand-orb-yellow" />
      <div aria-hidden="true" className="brand-orb brand-orb-blue" />
      <Link
        className="focus-ring absolute top-4 left-4 rounded-lg px-3 py-2 text-white/85 text-sm hover:text-white sm:top-6 sm:left-6"
        href="/"
      >
        ← Volver a Zulú
      </Link>
      <div className="auth-card-enter auth-card-surface relative z-10 w-full max-w-sm space-y-6 rounded-3xl p-6 sm:p-8">
        <div className="space-y-1 text-center">
          <h1 className="font-semibold text-2xl text-scouts-purple">Zulú</h1>
          <p className="text-muted-foreground text-sm">
            {esFinalizar
              ? "Crea una contraseña para terminar tu registro"
              : conversionInvitada
                ? "Verifica tu correo sin perder la conversación"
                : esRegistro
                  ? "Crea tu cuenta para consultar los manuales oficiales"
                  : "Inicia sesión para consultar los manuales oficiales"}
          </p>
        </div>

        <form action={enviar} className="space-y-4">
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

          {(!conversionInvitada || esFinalizar) && (
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

          {estado.error && (
            <p className="text-destructive text-sm" role="alert">
              {estado.error}
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
                  ? "Enviar enlace de verificación"
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
                  href="/login"
                >
                  Inicia sesión
                </Link>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{" "}
                <Link
                  className="font-medium text-scouts-purple underline underline-offset-4"
                  href="/registro"
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
