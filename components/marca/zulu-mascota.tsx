"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const RUTAS_ZULU = {
  aclarar: "/images/zulu/estados/zulu-aclarar.png",
  archivado: "/images/zulu/estados/zulu-archivado.png",
  bienvenida: "/images/zulu/estados/zulu-bienvenida.png",
  busca: "/images/zulu/estados/zulu-busca.png",
  calma: "/images/zulu/estados/zulu-calma.png",
  celebra: "/images/zulu/estados/zulu-celebra.png",
  citas: "/images/zulu/estados/zulu-citas.png",
  curioso: "/images/zulu/estados/zulu-curioso.png",
  despedida: "/images/zulu/estados/zulu-despedida.png",
  error: "/images/zulu/estados/zulu-error.png",
  escribiendo: "/images/zulu/estados/zulu-escribiendo.png",
  escuchando: "/images/zulu/estados/zulu-escuchando.png",
  hallazgo: "/images/zulu/estados/zulu-hallazgo.png",
  leyendo: "/images/zulu/estados/zulu-leyendo.png",
  listo: "/images/zulu/estados/zulu-listo.png",
  marca: "/images/zulu/zulu-marca.png",
  organizando: "/images/zulu/estados/zulu-organizando.png",
  orienta: "/images/zulu/estados/zulu-orienta.png",
  pensando: "/images/zulu/estados/zulu-pensando.png",
  protege: "/images/zulu/estados/zulu-protege.png",
  ruta: "/images/zulu/estados/zulu-ruta.png",
  saludando: "/images/zulu/zulu-saludando.png",
  sinFuente: "/images/zulu/estados/zulu-sin-fuente.png",
} as const;

export type PoseZulu = keyof typeof RUTAS_ZULU;
export type MovimientoZulu =
  | "quieto"
  | "respira"
  | "explora"
  | "piensa"
  | "celebra";

export function ZuluMascota({
  pose,
  className,
  movimiento = "respira",
  priority = false,
  sizes = "128px",
}: {
  pose: PoseZulu;
  className?: string;
  movimiento?: MovimientoZulu;
  priority?: boolean;
  sizes?: string;
}) {
  const referencia = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (movimiento === "quieto") {
      return;
    }

    const elemento = referencia.current;
    if (!elemento) {
      return;
    }

    let enPantalla = true;
    const actualizar = () =>
      setVisible(enPantalla && document.visibilityState === "visible");
    if (!("IntersectionObserver" in window)) {
      document.addEventListener("visibilitychange", actualizar);
      return () => document.removeEventListener("visibilitychange", actualizar);
    }

    const observador = new IntersectionObserver(([entrada]) => {
      enPantalla = entrada?.isIntersecting ?? false;
      actualizar();
    });

    observador.observe(elemento);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      observador.disconnect();
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [movimiento]);

  return (
    <span
      aria-hidden="true"
      className={cn("zulu-mascota relative block shrink-0", className)}
      data-en-pantalla={visible ? "true" : "false"}
      data-movimiento={movimiento}
      ref={referencia}
    >
      <Image
        alt=""
        className="object-contain"
        fill
        priority={priority}
        sizes={sizes}
        src={RUTAS_ZULU[pose]}
      />
    </span>
  );
}
