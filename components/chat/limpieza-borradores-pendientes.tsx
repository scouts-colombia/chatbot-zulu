"use client";

import { useEffect } from "react";
import { limpiarBorradoresPendientesExpirados } from "@/lib/invitados/borrador";

export function LimpiezaBorradoresPendientes() {
  useEffect(() => {
    const purgar = () => limpiarBorradoresPendientesExpirados(localStorage);
    purgar();
    const intervalo = window.setInterval(purgar, 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  return null;
}
