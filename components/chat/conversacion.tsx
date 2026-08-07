"use client";

import { ArrowUp, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cargarMensajesAnteriores } from "@/app/chat/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETAS_ESTADO } from "@/lib/chat/contrato";
import { URL_POLITICA_PRIVACIDAD } from "@/lib/privacidad";
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
  superficieMarca,
}: {
  mensaje: MensajeUI;
  animar: boolean;
  onTerminado: () => void;
  onOpcion: (opcion: string) => void;
  deshabilitado: boolean;
  superficieMarca: boolean;
}) {
  if (mensaje.sender === "usuario") {
    return (
      <div className="message-fade-in flex justify-end">
        <div
          className={[
            "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-4 py-2.5 text-sm shadow-md",
            superficieMarca
              ? "bg-scouts-yellow text-scouts-purple"
              : "bg-primary text-primary-foreground",
          ].join(" ")}
        >
          {mensaje.content}
        </div>
      </div>
    );
  }

  const etiqueta = mensaje.estado ? ETIQUETAS_ESTADO[mensaje.estado] : null;
  const mostrarAdjuntos = !animar;

  return (
    <div className="message-fade-in flex justify-start">
      <div
        className={[
          "max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border px-4 py-3 text-sm shadow-[var(--shadow-card)]",
          superficieMarca
            ? "border-white/70 bg-white/92 text-scouts-purple backdrop-blur-md"
            : "bg-card",
        ].join(" ")}
      >
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
  cursorInicial = null,
  esInvitado = false,
  limiteConsumido = false,
  requiereConsentimiento = false,
}: {
  conversationId?: string | null;
  mensajesIniciales: MensajeUI[];
  archivada?: boolean;
  hayMasAntiguos?: boolean;
  cursorInicial?: string | null;
  esInvitado?: boolean;
  limiteConsumido?: boolean;
  requiereConsentimiento?: boolean;
}) {
  const [conversationIdActual, setConversationIdActual] = useState(
    conversationId ?? null
  );
  const [mensajes, setMensajes] = useState<MensajeUI[]>(mensajesIniciales);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [animandoId, setAnimandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [masAntiguos, setMasAntiguos] = useState(hayMasAntiguos);
  const [cargandoAntiguos, setCargandoAntiguos] = useState(false);
  const [limiteInvitado, setLimiteInvitado] = useState(limiteConsumido);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const mensajesRef = useRef<HTMLDivElement>(null);
  // Cursor del mensaje más antiguo cargado. Un contador se desfasaría en cuanto
  // el usuario envía un turno: la conversación crece por el final y el tramo
  // siguiente repetiría mensajes ya visibles.
  const cursor = useRef<string | null>(cursorInicial);
  // Un ref y no `cargandoAntiguos`: React agrupa el setMensajes con el
  // setCargandoAntiguos(false) del finally, así que el render que ve los
  // mensajes nuevos ya tendría el estado en false y el scroll saltaría al
  // final, justo encima del tramo que el usuario quería leer.
  const acabaDePrepender = useRef(false);

  // El indicador y los mensajes nuevos siempre quedan a la vista, salvo cuando
  // se prependen mensajes viejos: ahí el usuario está mirando hacia arriba.
  // biome-ignore lint/correctness/useExhaustiveDependencies: el scroll depende del número de mensajes y del estado de envío
  useEffect(() => {
    if (acabaDePrepender.current) {
      acabaDePrepender.current = false;
      return;
    }
    const contenedor = mensajesRef.current;
    contenedor?.scrollTo({
      behavior: "smooth",
      top: contenedor.scrollHeight,
    });
  }, [mensajes.length, enviando]);

  async function verAnteriores() {
    if (cargandoAntiguos || !cursor.current || !conversationIdActual) {
      return;
    }
    setCargandoAntiguos(true);
    // Se limpia al empezar: si el intento anterior falló y este funciona, la
    // pantalla no puede seguir diciendo que no se pudieron cargar.
    setAviso(null);
    try {
      const tramo = await cargarMensajesAnteriores(
        conversationIdActual,
        cursor.current
      );
      if (tramo.error) {
        setAviso("No se pudieron cargar los mensajes anteriores.");
        return;
      }
      cursor.current = tramo.cursor;
      acabaDePrepender.current = true;
      setMensajes((previos) => [...tramo.mensajes, ...previos]);
      setMasAntiguos(tramo.hayMasAntiguos);
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
    if (esInvitado && limiteInvitado) {
      setBorrador(limpio);
      setMostrarRegistro(true);
      return;
    }
    if (esInvitado && requiereConsentimiento && !aceptaPolitica) {
      setAviso(
        "Confirma que leíste y aceptas la política de privacidad antes de enviar."
      );
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
        body: JSON.stringify({
          conversationId: conversationIdActual ?? undefined,
          mensaje: limpio,
          aceptaPolitica:
            esInvitado && requiereConsentimiento ? aceptaPolitica : undefined,
        }),
      });
      // El cuerpo se parsea con tolerancia y DESPUÉS de mirar el status: un
      // 500 sin cuerpo o un 504 del gateway devuelven HTML, y parsear primero
      // mandaba ese caso al catch, que dice "no hay conexión" cuando sí hubo
      // servidor y el turno ya se consumió.
      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        revertir();
        if (datos?.codigo === "registro_requerido") {
          setMostrarRegistro(true);
          return;
        }
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

      if (datos.conversationId) {
        setConversationIdActual(datos.conversationId);
      }
      if (esInvitado) {
        setLimiteInvitado(true);
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
    <div
      className={[
        "flex h-full min-h-0 flex-col",
        esInvitado ? "chat-invitado" : "",
      ].join(" ")}
    >
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6"
        ref={mensajesRef}
      >
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
        {mensajes.length === 0 && (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-10 text-center text-white">
            <h2 className="text-balance font-semibold text-2xl tracking-[-0.03em] sm:text-3xl">
              ¿Qué quieres descubrir hoy?
            </h2>
            <p className="mt-3 max-w-md text-pretty text-sm text-white/78 sm:text-base">
              Pregunta sobre los manuales oficiales de Scouts Colombia. Zulú te
              responderá con las fuentes que respaldan la respuesta.
            </p>
          </div>
        )}
        {mensajes.map((mensaje) => (
          <Burbuja
            animar={mensaje.id === animandoId}
            deshabilitado={enviando || archivada}
            key={mensaje.id}
            mensaje={mensaje}
            onOpcion={enviar}
            onTerminado={() => setAnimandoId(null)}
            superficieMarca={esInvitado}
          />
        ))}
        {enviando && <IndicadorEscribiendo />}
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
          className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6 sm:pb-6"
          onSubmit={(evento) => {
            evento.preventDefault();
            enviar(borrador);
          }}
        >
          <div className="chat-composer-surface">
            <Textarea
              aria-label="Pregunta para Zulú"
              className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none placeholder:text-scouts-purple/55 focus-visible:ring-0 dark:bg-transparent"
              maxLength={2000}
              onChange={(evento) => setBorrador(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" && !evento.shiftKey) {
                  evento.preventDefault();
                  enviar(borrador);
                }
              }}
              placeholder="Pregunta lo que quieras..."
              value={borrador}
            />
            <Button
              aria-label="Enviar pregunta"
              className="btn-press m-1 size-11 shrink-0 rounded-full bg-scouts-purple p-0 text-white shadow-md hover:bg-scouts-purple/90"
              disabled={enviando || !borrador.trim()}
              type="submit"
            >
              <ArrowUp
                aria-hidden="true"
                className="size-5"
                strokeWidth={2.5}
              />
            </Button>
          </div>
          {esInvitado && requiereConsentimiento && !limiteInvitado && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-white/86 text-xs leading-5">
              <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
                <input
                  checked={aceptaPolitica}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                  onChange={(evento) =>
                    setAceptaPolitica(evento.target.checked)
                  }
                  type="checkbox"
                />
                <span className="size-5 rounded-md border border-white/55 bg-white/12 shadow-inner transition peer-focus-visible:outline-2 peer-focus-visible:outline-white peer-focus-visible:outline-offset-2 peer-checked:border-scouts-yellow peer-checked:bg-scouts-yellow" />
                <Check
                  aria-hidden="true"
                  className="pointer-events-none absolute size-3.5 text-scouts-purple opacity-0 peer-checked:opacity-100"
                  strokeWidth={3}
                />
              </span>
              <span>
                Leí y acepto la{" "}
                <a
                  className="font-medium text-white underline decoration-white/55 underline-offset-4 hover:decoration-white"
                  href={URL_POLITICA_PRIVACIDAD}
                  rel="noreferrer"
                  target="_blank"
                >
                  política de privacidad
                </a>
                . Mi primera pregunta quedará asociada si creo una cuenta.
              </span>
            </label>
          )}
        </form>
      )}

      <Dialog onOpenChange={setMostrarRegistro} open={mostrarRegistro}>
        <DialogContent className="auth-card-surface max-w-md border-white/70">
          <DialogHeader>
            <DialogTitle className="text-scouts-purple text-xl">
              Tu pregunta de prueba ya fue usada
            </DialogTitle>
            <DialogDescription className="text-foreground/70">
              Tu conversación y el texto que acabas de escribir seguirán aquí.
              Crea una cuenta para continuar o inicia sesión si ya tienes una.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Button
              asChild
              className="btn-press min-h-11 bg-scouts-purple text-white hover:bg-scouts-purple/90"
            >
              <Link href="/registro">Crear cuenta</Link>
            </Button>
            <Button
              asChild
              className="btn-press min-h-11 border-scouts-purple/25 text-scouts-purple hover:bg-scouts-purple/8"
              variant="outline"
            >
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
