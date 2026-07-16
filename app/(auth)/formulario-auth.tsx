"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoFormulario } from "./acciones";

type Props = {
  modo: "login" | "registro";
  accion: (
    estadoPrevio: EstadoFormulario,
    formData: FormData
  ) => Promise<EstadoFormulario>;
};

export function FormularioAuth({ modo, accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, { error: null });
  const esRegistro = modo === "registro";

  return (
    <div className="auth-hero flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="auth-card-surface auth-card-enter w-full max-w-sm space-y-6 rounded-3xl p-8">
        <div className="space-y-1 text-center">
          <h1 className="font-jollygood text-4xl text-scouts-purple">
            Chat Scout
          </h1>
          <p className="text-muted-foreground text-sm">
            {esRegistro
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

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              autoComplete={esRegistro ? "new-password" : "current-password"}
              id="password"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </div>

          {estado.error && (
            <p className="text-destructive text-sm" role="alert">
              {estado.error}
            </p>
          )}

          {estado.mensaje && (
            <p className="text-muted-foreground text-sm" role="status">
              {estado.mensaje}
            </p>
          )}

          <Button className="w-full" disabled={pendiente} type="submit">
            {pendiente
              ? "Un momento..."
              : esRegistro
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </Button>
        </form>

        <p className="text-center text-muted-foreground text-sm">
          {esRegistro ? (
            <>
              ¿Ya tienes cuenta?{" "}
              <Link className="underline underline-offset-4" href="/login">
                Inicia sesión
              </Link>
            </>
          ) : (
            <>
              ¿No tienes cuenta?{" "}
              <Link className="underline underline-offset-4" href="/registro">
                Regístrate
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
