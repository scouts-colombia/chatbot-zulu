"use client";

import { useEffect } from "react";

/**
 * Las páginas admin registran su acceso al renderizar en servidor, así que una
 * reapertura que no pase por el servidor no dejaría fila en
 * `admin_audit_events`. El panel evita ese camino navegando con `<a>` (ninguna
 * ruta admin entra a la caché de cliente del App Router) y respondiendo con
 * `no-store`, de modo que atrás/adelante vuelve a pedir el documento.
 *
 * Queda un camino que no pasa por el servidor: el bfcache del navegador, que
 * revive el documento congelado sin pedir nada (Chrome lo hace incluso con
 * `no-store`). Ahí forzamos una recarga completa en vez de `router.refresh()`:
 * `refresh()` es asíncrono, fusiona sobre el árbol visible y no se puede
 * esperar, así que puede quedar pendiente dejando el contenido anterior a la
 * vista sin fila para esa apertura. Una recarga siempre termina en render
 * nuevo, redirección (si el rol fue revocado) o error del navegador. No hay
 * bucle: la recarga entra con `persisted === false`.
 *
 * Limitación aceptada: el frame restaurado puede pintarse un instante antes de
 * que corra este handler; ninguna API del navegador corre antes de ese paint.
 * Ese frame es una transcripción que este mismo admin ya abrió en esta sesión
 * con su fila confirmada.
 */
export function ReauditarNavegacion() {
  useEffect(() => {
    const alRestaurar = (evento: PageTransitionEvent) => {
      if (evento.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener("pageshow", alRestaurar);

    return () => window.removeEventListener("pageshow", alRestaurar);
  }, []);

  return null;
}
