"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { type PoseZulu, ZuluMascota } from "@/components/marca/zulu-mascota";
import type { MensajeUI } from "./tipos";

const CONSULTA_MOVIMIENTO_REDUCIDO = "(prefers-reduced-motion: reduce)";
const INTERVALO_MENSAJES_ESPERA_MS = 2800;
const ESTADOS_ESPERA = [
  { mensaje: "Estoy explorando tu pregunta.", pose: "busca" },
  { mensaje: "Sigo trabajando en tu respuesta.", pose: "pensando" },
  { mensaje: "Busco respaldo en los manuales oficiales.", pose: "leyendo" },
  { mensaje: "Quiero dejarte una respuesta clara.", pose: "organizando" },
  { mensaje: "Gracias por esperar unos segundos.", pose: "citas" },
  { mensaje: "Sigo aquí contigo.", pose: "escribiendo" },
] as const;
const POSES_BIENVENIDA = [
  "curioso",
  "escuchando",
  "orienta",
  "ruta",
] as const satisfies readonly PoseZulu[];

function suscribirMovimientoReducido(onStoreChange: () => void) {
  const media = window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function obtenerMovimientoReducido() {
  return window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO).matches;
}

function obtenerMovimientoReducidoServidor() {
  return false;
}

export function useMovimientoReducido() {
  return useSyncExternalStore(
    suscribirMovimientoReducido,
    obtenerMovimientoReducido,
    obtenerMovimientoReducidoServidor
  );
}

export function poseParaMensaje(mensaje: MensajeUI): PoseZulu {
  switch (mensaje.estado) {
    case "sin_fuente":
      return "sinFuente";
    case "necesita_aclaracion":
      return "aclarar";
    case "bloqueado_por_seguridad":
      return "protege";
    case "error":
      return "error";
    default:
      if (mensaje.estado || mensaje.sender === "sistema") {
        return "calma";
      }
      return mensaje.citas.length > 0 ? "citas" : "hallazgo";
  }
}

export function IndicadorEscribiendo() {
  const [indiceMensaje, setIndiceMensaje] = useState(0);
  const estadoEspera = ESTADOS_ESPERA[indiceMensaje];
  const reducirMovimiento = useMovimientoReducido();

  useEffect(() => {
    if (reducirMovimiento) {
      return;
    }

    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIndiceMensaje(
          (indiceActual) => (indiceActual + 1) % ESTADOS_ESPERA.length
        );
      }
    }, INTERVALO_MENSAJES_ESPERA_MS);

    return () => window.clearInterval(intervalo);
  }, [reducirMovimiento]);

  return (
    <div className="flex justify-start">
      <div
        aria-hidden="true"
        className="flex max-w-[90%] items-center gap-3 rounded-2xl rounded-bl-sm border border-white/70 bg-white/92 py-2 pr-4 pl-2.5 shadow-[var(--shadow-card)] backdrop-blur-md sm:max-w-md"
      >
        <span
          className="zulu-pose-swap block h-[4.75rem] w-[4.5rem] shrink-0"
          key={estadoEspera.pose}
        >
          <ZuluMascota
            className="size-full"
            movimiento="piensa"
            pose={estadoEspera.pose}
            sizes="76px"
          />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-scouts-purple text-sm">
            Zulú está preparando tu respuesta
          </p>
          <p className="mt-0.5 text-pnpj-tinta/70 text-xs sm:text-sm">
            {estadoEspera.mensaje}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MascotaBienvenidaChat() {
  const reducirMovimiento = useMovimientoReducido();
  const [indicePose, setIndicePose] = useState(0);
  const pose = POSES_BIENVENIDA[indicePose];

  useEffect(() => {
    if (reducirMovimiento) {
      return;
    }

    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIndicePose(
          (indiceActual) => (indiceActual + 1) % POSES_BIENVENIDA.length
        );
      }
    }, 6000);

    return () => window.clearInterval(intervalo);
  }, [reducirMovimiento]);

  return (
    <span
      className="zulu-pose-swap mb-1 block size-24 [@media(max-height:44rem)]:size-20 sm:size-32"
      key={pose}
    >
      <ZuluMascota
        className="size-full"
        movimiento="explora"
        pose={pose}
        priority
        sizes="128px"
      />
    </span>
  );
}
