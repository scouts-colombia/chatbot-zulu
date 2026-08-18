"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EVENTO_TURNO_INVITADO,
  hayTurnoInvitadoEnCurso,
} from "@/lib/invitados/turno-en-curso";
import { cn } from "@/lib/utils";

export function NavegacionCuentaPublica() {
  const [turnoEnCurso, setTurnoEnCurso] = useState(false);

  useEffect(() => {
    setTurnoEnCurso(hayTurnoInvitadoEnCurso());
    const actualizar = (evento: Event) => {
      setTurnoEnCurso((evento as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener(EVENTO_TURNO_INVITADO, actualizar);
    return () => window.removeEventListener(EVENTO_TURNO_INVITADO, actualizar);
  }, []);

  const bloquearMientrasResponde = (evento: MouseEvent<HTMLAnchorElement>) => {
    if (turnoEnCurso || hayTurnoInvitadoEnCurso()) {
      evento.preventDefault();
    }
  };

  const estadoEnlace = cn(
    "transition-opacity",
    turnoEnCurso && "cursor-wait opacity-55"
  );

  return (
    <nav aria-label="Cuenta" className="flex items-center gap-1.5 sm:gap-2">
      <span aria-live="polite" className="sr-only">
        {turnoEnCurso
          ? "Espera a que Zulú termine tu respuesta antes de cambiar de cuenta."
          : ""}
      </span>
      <Button
        asChild
        className="btn-press min-h-11 border-scouts-purple/20 bg-white/40 px-3 text-scouts-purple backdrop-blur-md hover:bg-white/70 sm:px-4"
        variant="outline"
      >
        <Link
          aria-disabled={turnoEnCurso}
          aria-label="Iniciar sesión"
          className={estadoEnlace}
          href="/login"
          onClick={bloquearMientrasResponde}
          tabIndex={turnoEnCurso ? -1 : undefined}
        >
          <span className="sm:hidden">Entrar</span>
          <span className="hidden sm:inline">Iniciar sesión</span>
        </Link>
      </Button>
      <Button
        asChild
        className="btn-press min-h-11 bg-scouts-yellow px-3 text-scouts-purple shadow-lg hover:bg-scouts-yellow/90 sm:px-4"
      >
        <Link
          aria-disabled={turnoEnCurso}
          aria-label="Crear cuenta"
          className={estadoEnlace}
          href="/registro"
          onClick={bloquearMientrasResponde}
          tabIndex={turnoEnCurso ? -1 : undefined}
        >
          <span className="sm:hidden">Registro</span>
          <span className="hidden sm:inline">Crear cuenta</span>
        </Link>
      </Button>
    </nav>
  );
}
