"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Las páginas admin registran su acceso al renderizar en servidor. En
 * navegación atrás/adelante el App Router puede restaurar la página desde su
 * caché de cliente sin re-ejecutar el server component, así que esa reapertura
 * mostraría el contenido de nuevo sin dejar fila en `admin_audit_events`,
 * contra el requisito de auditar cada apertura (P-RF-17).
 *
 * Vive en el layout admin (que persiste entre rutas /admin/*), así que su
 * listener sobrevive a las navegaciones internas y fuerza un `router.refresh()`
 * —re-ejecución del server component y, en el detalle, un nuevo evento de
 * auditoría— en cada restauración por historial (`popstate`) o por bfcache del
 * navegador (`pageshow` con `persisted`). `refresh()` no toca la URL ni el
 * historial, así que no genera bucles.
 */
export function ReauditarNavegacion() {
  const router = useRouter();

  useEffect(() => {
    const alNavegarHistorial = () => router.refresh();
    const alRestaurar = (evento: PageTransitionEvent) => {
      if (evento.persisted) {
        router.refresh();
      }
    };

    window.addEventListener("popstate", alNavegarHistorial);
    window.addEventListener("pageshow", alRestaurar);

    return () => {
      window.removeEventListener("popstate", alNavegarHistorial);
      window.removeEventListener("pageshow", alRestaurar);
    };
  }, [router]);

  return null;
}
