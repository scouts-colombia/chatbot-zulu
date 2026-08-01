"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cargarMensajesAnteriores } from "@/app/chat/acciones";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETAS_ESTADO } from "@/lib/chat/contrato";
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
  const [visible, setVisible] = useState(animar ? 0 : texto.length);
  const terminadoRef = useRef(false);

  useEffect(() => {
    if (!animar) {
      return;
    }
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
  }, [animar, texto, onTerminado]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {/* Sin <img>: la respuesta del asistente puede incluir `![](url)` y
      cargar recursos de terceros al renderizar. */}
      <Markdown disallowedElements={["img"]} remarkPlugins={[remarkGfm]}>
        {texto.slice(0, visible)}
      </Markdown>
    </div>
  );
}

function Burbuja({
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
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground text-sm">
          {mensaje.content}
        </div>
      </div>
    );
  }

  const etiqueta = mensaje.estado ? ETIQUETAS_ESTADO[mensaje.estado] : null;
  const mostrarAdjuntos = !animar;

  return (
    <div className="message-fade-in flex justify-start">
      <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm shadow-[var(--shadow-card)]">
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
  );
}

function IndicadorEscribiendo() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
        <span className="thinking-dot size-1.5 rounded-full bg-muted-foreground" />
        <span className="thinking-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:0.2s]" />
        <span className="thinking-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:0.4s]" />
      </div>
    </div>
  );
}

export function Conversacion({
  conversationId,
  mensajesIniciales,
  archivada = false,
  hayMasAntiguos = false,
  adjuntosIncompletos = false,
}: {
  conversationId: string;
  mensajesIniciales: MensajeUI[];
  archivada?: boolean;
  hayMasAntiguos?: boolean;
  adjuntosIncompletos?: boolean;
}) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>(mensajesIniciales);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [animandoId, setAnimandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [masAntiguos, setMasAntiguos] = useState(hayMasAntiguos);
  const [cargandoAntiguos, setCargandoAntiguos] = useState(false);
  const [fuentesIncompletas, setFuentesIncompletas] =
    useState(adjuntosIncompletos);
  const finalRef = useRef<HTMLDivElement>(null);
  // Cuántos mensajes se han traído del servidor. Los optimistas locales no
  // cuentan: el desplazamiento del siguiente tramo se mide contra la base.
  const cargadosDelServidor = useRef(mensajesIniciales.length);

  // El indicador y los mensajes nuevos siempre quedan a la vista, salvo cuando
  // se prependen mensajes viejos: ahí el usuario está mirando hacia arriba.
  // biome-ignore lint/correctness/useExhaustiveDependencies: el scroll depende del número de mensajes y del estado de envío
  useEffect(() => {
    if (cargandoAntiguos) {
      return;
    }
    finalRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length, enviando]);

  async function verAnteriores() {
    if (cargandoAntiguos) {
      return;
    }
    setCargandoAntiguos(true);
    try {
      const tramo = await cargarMensajesAnteriores(
        conversationId,
        cargadosDelServidor.current
      );
      if (tramo.error) {
        setAviso("No se pudieron cargar los mensajes anteriores.");
        return;
      }
      cargadosDelServidor.current += tramo.mensajes.length;
      setMensajes((previos) => [...tramo.mensajes, ...previos]);
      setMasAntiguos(tramo.hayMasAntiguos);
      if (tramo.adjuntosIncompletos) {
        setFuentesIncompletas(true);
      }
    } catch {
      setAviso("No se pudieron cargar los mensajes anteriores.");
    } finally {
      setCargandoAntiguos(false);
    }
  }

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || enviando) {
      return;
    }
    setAviso(null);
    setEnviando(true);
    setBorrador("");
    const idLocal = `local-${Date.now()}`;
    setMensajes((previos) => [
      ...previos,
      { id: idLocal, sender: "usuario", content: limpio, citas: [] },
    ]);

    // Si el servidor rechaza el turno, la burbuja optimista se retira y el
    // texto vuelve al composer para no fingir un mensaje que no existe.
    const revertir = () => {
      setMensajes((previos) => previos.filter((m) => m.id !== idLocal));
      setBorrador(limpio);
    };

    try {
      const respuesta = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, mensaje: limpio }),
      });
      // El cuerpo se parsea con tolerancia y DESPUÉS de mirar el status: un
      // 500 sin cuerpo o un 504 del gateway devuelven HTML, y parsear primero
      // mandaba ese caso al catch, que dice "no hay conexión" cuando sí hubo
      // servidor y el turno ya se consumió.
      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        revertir();
        setAviso(
          datos?.mensaje ??
            "No se pudo enviar el mensaje. Inténtalo de nuevo en un momento."
        );
        return;
      }

      if (!datos) {
        revertir();
        setAviso("No se pudo leer la respuesta. Inténtalo de nuevo.");
        return;
      }

      const mensajeAsistente: MensajeUI = {
        id: datos.mensajeId ?? `asistente-${Date.now()}`,
        sender: "asistente",
        content: datos.respuesta,
        estado: datos.estado === "respondido" ? undefined : datos.estado,
        citas: (datos.citas ?? []).map(
          (cita: { documentTitleSnapshot: string; pageNumber?: number }) => ({
            titulo: cita.documentTitleSnapshot,
            pagina: cita.pageNumber,
          })
        ),
        preguntaGuiada: datos.preguntaGuiada
          ? {
              texto: datos.preguntaGuiada.texto,
              opciones: datos.preguntaGuiada.opciones,
            }
          : undefined,
      };
      setMensajes((previos) => [...previos, mensajeAsistente]);
      setAnimandoId(mensajeAsistente.id);
    } catch {
      revertir();
      setAviso("No hay conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {masAntiguos && (
          <div className="flex justify-center">
            <Button
              disabled={cargandoAntiguos}
              onClick={verAnteriores}
              size="sm"
              type="button"
              variant="ghost"
            >
              {cargandoAntiguos ? "Cargando..." : "Ver mensajes anteriores"}
            </Button>
          </div>
        )}
        {fuentesIncompletas && (
          <p className="text-center text-muted-foreground text-xs">
            No pudimos cargar todas las fuentes de esta conversación. Algunas
            respuestas pueden verse sin sus citas.
          </p>
        )}
        {mensajes.length === 0 && (
          <p className="pt-12 text-center text-muted-foreground text-sm">
            Pregunta sobre los manuales oficiales: recibirás la respuesta con
            sus citas.
          </p>
        )}
        {mensajes.map((mensaje) => (
          <Burbuja
            animar={mensaje.id === animandoId}
            deshabilitado={enviando || archivada}
            key={mensaje.id}
            mensaje={mensaje}
            onOpcion={enviar}
            onTerminado={() => setAnimandoId(null)}
          />
        ))}
        {enviando && <IndicadorEscribiendo />}
        <div ref={finalRef} />
      </div>

      {aviso && (
        <p className="px-4 pb-2 text-destructive text-sm" role="alert">
          {aviso}
        </p>
      )}

      {archivada ? (
        <p className="border-t px-4 py-4 text-center text-muted-foreground text-sm">
          Esta conversación está archivada: es de solo lectura.
        </p>
      ) : (
        <form
          className="flex items-end gap-2 border-t px-4 py-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            enviar(borrador);
          }}
        >
          <Textarea
            className="max-h-40 min-h-11 flex-1 resize-none"
            maxLength={2000}
            onChange={(evento) => setBorrador(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter" && !evento.shiftKey) {
                evento.preventDefault();
                enviar(borrador);
              }
            }}
            placeholder="Escribe tu pregunta..."
            value={borrador}
          />
          <Button disabled={enviando || !borrador.trim()} type="submit">
            Enviar
          </Button>
        </form>
      )}
    </div>
  );
}
