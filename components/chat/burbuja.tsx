"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ZuluMascota } from "@/components/marca/zulu-mascota";
import { Button } from "@/components/ui/button";
import { ETIQUETAS_ESTADO } from "@/lib/chat/contrato";
import { poseParaMensaje, useMovimientoReducido } from "./personalidad-zulu";
import type { MensajeUI } from "./tipos";

/**
 * Revela texto ya completo y validado con efecto typewriter (D-04).
 * Lo visible se calcula por tiempo transcurrido (no por ticks): así el
 * throttling de pestañas en segundo plano no arrastra la animación y al
 * recuperar el foco el texto se pone al día de inmediato.
 */
const CARACTERES_POR_SEGUNDO = 220;

function TextoTypewriter({
  texto,
  animar,
  onTerminado,
}: {
  texto: string;
  animar: boolean;
  onTerminado: () => void;
}) {
  const reducirMovimiento = useMovimientoReducido();
  const debeAnimar = animar && !reducirMovimiento;
  const [visible, setVisible] = useState(debeAnimar ? 0 : texto.length);
  const terminadoRef = useRef(false);

  useEffect(() => {
    if (!debeAnimar) {
      setVisible(texto.length);
      if (animar && !terminadoRef.current) {
        terminadoRef.current = true;
        setTimeout(onTerminado, 0);
      }
      return;
    }

    terminadoRef.current = false;
    setVisible(0);
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      const transcurrido = (Date.now() - inicio) / 1000;
      const siguiente = Math.min(
        Math.round(transcurrido * CARACTERES_POR_SEGUNDO),
        texto.length
      );
      setVisible(siguiente);
      if (siguiente >= texto.length && !terminadoRef.current) {
        terminadoRef.current = true;
        clearInterval(intervalo);
        // Fuera del render: avisa que la animación terminó.
        setTimeout(onTerminado, 0);
      }
    }, 33);
    return () => clearInterval(intervalo);
  }, [animar, debeAnimar, texto, onTerminado]);

  return (
    <div className="prose prose-sm max-w-none">
      {debeAnimar && <span className="sr-only">{texto}</span>}
      {/* Sin imágenes Markdown: la respuesta del asistente puede incluir una
      URL de imagen y cargar recursos de terceros al renderizar. */}
      <div aria-hidden={debeAnimar}>
        <Markdown disallowedElements={["img"]} remarkPlugins={[remarkGfm]}>
          {texto.slice(0, visible)}
        </Markdown>
      </div>
    </div>
  );
}

export function Burbuja({
  mensaje,
  animar,
  onTerminado,
  onOpcion,
  deshabilitado,
}: {
  mensaje: MensajeUI;
  animar: boolean;
  onTerminado: () => void;
  onOpcion: (opcion: string) => void;
  deshabilitado: boolean;
}) {
  if (mensaje.sender === "usuario") {
    return (
      <div className="message-fade-in flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-scouts-yellow px-4 py-2.5 text-scouts-purple text-sm shadow-md">
          {mensaje.content}
        </div>
      </div>
    );
  }

  const etiqueta = mensaje.estado ? ETIQUETAS_ESTADO[mensaje.estado] : null;
  const mostrarAdjuntos = !animar;
  const poseZulu = poseParaMensaje(mensaje);

  return (
    <div className="message-fade-in flex justify-start">
      <div className="flex w-full items-end gap-2 sm:gap-3">
        <ZuluMascota
          className="size-12 sm:size-14"
          key={`${mensaje.id}-${poseZulu}`}
          movimiento={animar ? "explora" : "quieto"}
          pose={poseZulu}
          sizes="56px"
        />
        <div className="max-w-[calc(100%_-_3.5rem)] space-y-2 rounded-2xl rounded-bl-sm border border-white/70 bg-white/92 px-4 py-3 text-scouts-purple text-sm shadow-[var(--shadow-card)] backdrop-blur-md sm:max-w-[85%]">
          {etiqueta && (
            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              {etiqueta}
            </span>
          )}
          <TextoTypewriter
            animar={animar}
            onTerminado={onTerminado}
            texto={mensaje.content}
          />
          {mostrarAdjuntos && mensaje.citas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t pt-2">
              {mensaje.citas.map((cita) => (
                <span
                  className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs"
                  key={`${mensaje.id}-${cita.titulo}-${cita.pagina ?? "sp"}`}
                >
                  {cita.titulo}
                  {cita.pagina ? ` · p. ${cita.pagina}` : ""}
                </span>
              ))}
            </div>
          )}
          {mostrarAdjuntos && mensaje.preguntaGuiada && (
            <div className="space-y-2 border-t pt-2">
              <p className="font-medium">{mensaje.preguntaGuiada.texto}</p>
              <div className="flex flex-wrap gap-2">
                {mensaje.preguntaGuiada.opciones.map((opcion) => (
                  <Button
                    disabled={deshabilitado}
                    key={opcion}
                    onClick={() => onOpcion(opcion)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {opcion}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
