"use client";

import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ZuluMascota } from "@/components/marca/zulu-mascota";
import { Button } from "@/components/ui/button";

const CLAVE_DESCARTADA = "zulu:pwa:instalacion-descartada";

interface EventoInstalacionPwa extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstalarPwa() {
  const [eventoInstalacion, setEventoInstalacion] =
    useState<EventoInstalacionPwa | null>(null);
  const [tipoAyuda, setTipoAyuda] = useState<"ios" | "manual" | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("[pwa] No se pudo registrar el service worker:", error);
      });
    }

    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (instalada || localStorage.getItem(CLAVE_DESCARTADA)) {
      return;
    }

    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setTipoAyuda(esIos ? "ios" : "manual");

    const prepararInstalacion = (evento: Event) => {
      evento.preventDefault();
      setEventoInstalacion(evento as EventoInstalacionPwa);
      setTipoAyuda(null);
    };
    const ocultarAlInstalar = () => {
      setEventoInstalacion(null);
      setTipoAyuda(null);
    };

    window.addEventListener("beforeinstallprompt", prepararInstalacion);
    window.addEventListener("appinstalled", ocultarAlInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", prepararInstalacion);
      window.removeEventListener("appinstalled", ocultarAlInstalar);
    };
  }, []);

  const ocultar = () => {
    localStorage.setItem(CLAVE_DESCARTADA, "1");
    setEventoInstalacion(null);
    setTipoAyuda(null);
  };

  const instalar = async () => {
    if (!eventoInstalacion) {
      return;
    }
    await eventoInstalacion.prompt();
    const eleccion = await eventoInstalacion.userChoice;
    if (eleccion.outcome === "dismissed") {
      localStorage.setItem(CLAVE_DESCARTADA, "1");
    }
    setEventoInstalacion(null);
  };

  if (!(eventoInstalacion || tipoAyuda)) {
    return null;
  }

  return (
    <aside
      aria-label="Instalar Zulú"
      aria-live="polite"
      className="auth-card-surface fixed inset-x-4 top-20 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl p-3 shadow-[var(--shadow-float)] sm:inset-x-auto sm:right-5 sm:mx-0 sm:p-4"
    >
      <ZuluMascota
        className="size-16 shrink-0"
        movimiento="respira"
        pose="ruta"
        sizes="64px"
      />
      <div className="min-w-0 flex-1 pt-1">
        <p className="font-semibold text-scouts-purple">Lleva Zulú contigo</p>
        <p className="mt-1 text-pnpj-tinta/70 text-sm">
          {tipoAyuda === "ios"
            ? "En iPhone o iPad, usa Compartir y luego Añadir a pantalla de inicio."
            : tipoAyuda === "manual"
              ? "Puedes instalarlo desde el menú de tu navegador para abrirlo como una app."
              : "Instálalo en este dispositivo para abrirlo como una app."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {eventoInstalacion && (
            <Button
              className="btn-press min-h-11 bg-scouts-purple text-white hover:bg-scouts-purple/90"
              onClick={instalar}
              type="button"
            >
              <Download aria-hidden="true" className="size-4" />
              Instalar
            </Button>
          )}
          {tipoAyuda === "ios" && (
            <span className="flex min-h-11 items-center gap-2 text-scouts-purple text-sm">
              <Share2 aria-hidden="true" className="size-4" />
              Compartir
            </span>
          )}
          {tipoAyuda === "manual" && (
            <span className="flex min-h-11 items-center gap-2 text-scouts-purple text-sm">
              <Download aria-hidden="true" className="size-4" />
              Menú · Instalar Zulú
            </span>
          )}
        </div>
      </div>
      <Button
        aria-label="No volver a mostrar la invitación de instalación"
        className="min-h-11 min-w-11 shrink-0 text-pnpj-tinta/60"
        onClick={ocultar}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </aside>
  );
}
