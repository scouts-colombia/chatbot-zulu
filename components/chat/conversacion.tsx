"use client";

import { ArrowUp, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cargarMensajesAnteriores } from "@/app/chat/acciones";
import { ZuluMascota } from "@/components/marca/zulu-mascota";
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
import {
  crearIdTraspasoBorrador,
  eliminarClaveGlobalAnterior,
  guardarBorradorInvitado,
  limpiarBorradoresPendientesExpirados,
  limpiarBorradorInvitado,
  restaurarBorradorInvitado,
} from "@/lib/invitados/borrador";
import {
  coordinarPreparacionInvitada,
  ERROR_COORDINACION_INVITADA,
} from "@/lib/invitados/coordinacion";
import { marcarTurnoInvitadoEnCurso } from "@/lib/invitados/turno-en-curso";
import { URL_POLITICA_PRIVACIDAD } from "@/lib/privacidad";
import { esUuid } from "@/lib/uuid";
import {
  IndicadorEscribiendo,
  MascotaBienvenidaChat,
  poseParaMensaje,
  useMovimientoReducido,
} from "./personalidad-zulu";
import type { MensajeUI } from "./tipos";

/**
 * Revela texto ya completo y validado con efecto typewriter (D-04).
 * Lo visible se calcula por tiempo transcurrido (no por ticks): así el
 * throttling de pestañas en segundo plano no arrastra la animación y al
 * recuperar el foco el texto se pone al día de inmediato.
 */
const CARACTERES_POR_SEGUNDO = 220;

function rutaAuthConBorrador(
  ruta: "/login" | "/registro",
  traspasoId: string | null,
  conversationIdDestino: string | null
) {
  const parametros = new URLSearchParams();
  if (traspasoId) {
    parametros.set("borrador", traspasoId);
  }
  if (conversationIdDestino) {
    parametros.set("conversacion", conversationIdDestino);
  }
  const query = parametros.toString();
  return query ? `${ruta}?${query}` : ruta;
}

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

export function Conversacion({
  conversationId,
  mensajesIniciales,
  archivada = false,
  hayMasAntiguos = false,
  cursorInicial = null,
  esInvitado = false,
  requiereConsentimiento = false,
  sesionInvitadaEstablecida = false,
  borradorTransferenciaId = null,
  versionPolitica,
}: {
  conversationId?: string | null;
  mensajesIniciales: MensajeUI[];
  archivada?: boolean;
  hayMasAntiguos?: boolean;
  cursorInicial?: string | null;
  esInvitado?: boolean;
  requiereConsentimiento?: boolean;
  sesionInvitadaEstablecida?: boolean;
  borradorTransferenciaId?: string | null;
  versionPolitica?: string;
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
  const [sesionInvitadaLista, setSesionInvitadaLista] = useState(
    sesionInvitadaEstablecida
  );
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [motivoRegistro, setMotivoRegistro] = useState<string | null>(null);
  const [traspasoBorradorId, setTraspasoBorradorId] = useState<string | null>(
    borradorTransferenciaId
  );
  const [conversationIdTransferencia, setConversationIdTransferencia] =
    useState<string | null>(conversationId ?? null);
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const [versionPoliticaActual, setVersionPoliticaActual] =
    useState(versionPolitica);
  const reducirMovimiento = useMovimientoReducido();
  useEffect(() => {
    const purgar = () => limpiarBorradoresPendientesExpirados(localStorage);
    purgar();
    const intervalo = window.setInterval(purgar, 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    // Elimina la clave global de versiones anteriores para que un borrador
    // no pueda reaparecer al cambiar de identidad en una pestaña compartida.
    eliminarClaveGlobalAnterior(sessionStorage);
    eliminarClaveGlobalAnterior(localStorage);
    const guardado = restaurarBorradorInvitado({
      almacen: sessionStorage,
      almacenPendiente: localStorage,
      conversationId: conversationIdActual,
      traspasoId: borradorTransferenciaId,
    });
    if (guardado) {
      setBorrador((actual) => actual || guardado);
    }
  }, [borradorTransferenciaId, conversationIdActual]);

  const abrirRegistro = (
    mensaje: string,
    texto = borrador,
    conversationIdDestino = conversationIdActual
  ) => {
    const limpio = texto.trim();
    const traspasoId = traspasoBorradorId ?? crearIdTraspasoBorrador();

    // Se persiste antes de renderizar enlaces: abrirlos con menú contextual,
    // click medio o pulsación larga no depende de un onClick posterior.
    if (esInvitado && limpio) {
      guardarBorradorInvitado({
        almacen: sessionStorage,
        almacenPendiente: localStorage,
        conversationId: null,
        conversationIdDestino,
        traspasoId,
        texto: limpio,
      });
    }

    setBorrador(texto);
    setConversationIdTransferencia(conversationIdDestino);
    setTraspasoBorradorId(traspasoId);
    setMotivoRegistro(mensaje);
    setMostrarRegistro(true);
  };
  const actualizarPoliticaSiCambio = (
    datos: {
      codigo?: string;
      mensaje?: string;
      versionPolitica?: unknown;
    } | null
  ) => {
    if (datos?.codigo !== "politica_actualizada") {
      return false;
    }
    if (typeof datos.versionPolitica === "string") {
      setVersionPoliticaActual(datos.versionPolitica);
    }
    setAceptaPolitica(false);
    setAviso(
      datos.mensaje ??
        "La política de privacidad cambió. Revísala y vuelve a aceptarla."
    );
    return true;
  };
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
      behavior: reducirMovimiento ? "auto" : "smooth",
      top: contenedor.scrollHeight,
    });
  }, [mensajes.length, enviando, reducirMovimiento]);

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
    if (esInvitado && requiereConsentimiento && !aceptaPolitica) {
      setAviso(
        "Confirma que leíste y aceptas la política de privacidad antes de enviar."
      );
      return;
    }
    setAviso(null);
    setEnviando(true);
    if (esInvitado) {
      marcarTurnoInvitadoEnCurso(true);
    }
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
    let conversationIdSolicitud = conversationIdActual;
    const exigirRegistroTrasEnvio = (
      mensaje: string,
      conversationIdDestino?: string
    ) => {
      abrirRegistro(
        mensaje,
        limpio,
        conversationIdDestino ?? conversationIdSolicitud
      );
    };

    let solicitudPrincipalIniciada = false;
    try {
      if (esInvitado && !sesionInvitadaLista) {
        const preparacion = await coordinarPreparacionInvitada(() =>
          fetch("/api/chat/invitado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aceptaPolitica,
              versionPoliticaAceptada: versionPoliticaActual,
            }),
          })
        );
        const datosPreparacion = await preparacion.json().catch(() => null);
        if (!preparacion.ok || !datosPreparacion) {
          revertir();
          if (actualizarPoliticaSiCambio(datosPreparacion)) {
            return;
          }
          if (datosPreparacion?.codigo === "registro_requerido") {
            exigirRegistroTrasEnvio(datosPreparacion.mensaje);
            return;
          }
          setAviso(
            datosPreparacion?.mensaje ??
              "No pudimos preparar tu sesión de prueba. Inténtalo de nuevo."
          );
          return;
        }
        if (!esUuid(datosPreparacion.conversationId)) {
          revertir();
          setAviso(
            "No pudimos preparar tu conversación de prueba. Inténtalo de nuevo."
          );
          return;
        }
        conversationIdSolicitud = datosPreparacion.conversationId;
        setConversationIdActual(conversationIdSolicitud);
        setConversationIdTransferencia(conversationIdSolicitud);
        setSesionInvitadaLista(true);
      }

      solicitudPrincipalIniciada = true;
      const respuesta = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationIdSolicitud ?? undefined,
          mensaje: limpio,
          aceptaPolitica:
            esInvitado && requiereConsentimiento ? aceptaPolitica : undefined,
          versionPoliticaAceptada:
            esInvitado && requiereConsentimiento
              ? versionPoliticaActual
              : undefined,
        }),
      });
      // El cuerpo se parsea con tolerancia y DESPUÉS de mirar el status: un
      // 500 sin cuerpo o un 504 del gateway devuelven HTML, y parsear primero
      // mandaba ese caso al catch, que dice "no hay conexión" cuando sí hubo
      // servidor y el turno ya se consumió.
      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        if (esInvitado && datos?.codigo === "turno_invitado_consumido") {
          setAviso(datos.mensaje);
          return;
        }
        revertir();
        if (actualizarPoliticaSiCambio(datos)) {
          return;
        }
        if (datos?.codigo === "registro_requerido") {
          exigirRegistroTrasEnvio(
            datos.mensaje ??
              "Crea una cuenta o inicia sesión para continuar usando el chat.",
            typeof datos.conversationId === "string"
              ? datos.conversationId
              : undefined
          );
          return;
        }
        if (esInvitado && datos?.codigo === "sesion_invitada_requerida") {
          setSesionInvitadaLista(false);
          setAviso(
            "No pudimos establecer tu sesión de prueba. Inténtalo de nuevo."
          );
          return;
        }
        if (esInvitado && !datos) {
          exigirRegistroTrasEnvio(
            "No pudimos confirmar la respuesta de prueba. Crea una cuenta o inicia sesión para continuar sin perder tu pregunta."
          );
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
        if (esInvitado) {
          exigirRegistroTrasEnvio(
            "No pudimos confirmar la respuesta de prueba. Crea una cuenta o inicia sesión para continuar sin perder tu pregunta."
          );
          return;
        }
        setAviso("No se pudo leer la respuesta. Inténtalo de nuevo.");
        return;
      }

      const idConversacionRespuesta =
        datos.conversationId ?? conversationIdActual;
      if (datos.conversationId) {
        setConversationIdActual(datos.conversationId);
      }
      limpiarBorradorInvitado(
        sessionStorage,
        idConversacionRespuesta,
        borradorTransferenciaId,
        localStorage
      );
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
    } catch (error) {
      revertir();
      if (
        error instanceof Error &&
        error.message === ERROR_COORDINACION_INVITADA
      ) {
        exigirRegistroTrasEnvio(
          "Tu navegador no permite coordinar de forma segura la prueba entre pestañas. Crea una cuenta o inicia sesión para continuar sin perder tu pregunta."
        );
        return;
      }
      if (esInvitado && solicitudPrincipalIniciada) {
        exigirRegistroTrasEnvio(
          "Se perdió la conexión mientras procesábamos tu pregunta de prueba. Crea una cuenta o inicia sesión para continuar sin perderla."
        );
        return;
      }
      setAviso("No hay conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      if (esInvitado) {
        marcarTurnoInvitadoEnCurso(false);
      }
      setEnviando(false);
    }
  }

  const sinMensajes = mensajes.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <output aria-atomic="true" aria-live="polite" className="sr-only">
        {enviando
          ? "Zulú está preparando tu respuesta."
          : animandoId
            ? "La respuesta de Zulú está lista."
            : ""}
      </output>
      <div
        className={
          sinMensajes
            ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-[clamp(1rem,4vh,2.5rem)] sm:px-6"
            : "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6"
        }
        ref={mensajesRef}
      >
        {masAntiguos && (
          <div className="flex justify-center">
            <Button
              className="text-scouts-purple hover:bg-white/50 hover:text-scouts-purple"
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
        {sinMensajes && (
          <div className="mx-auto flex max-w-xl flex-col items-center text-center text-pnpj-morado">
            <MascotaBienvenidaChat />
            <h2 className="text-balance font-semibold text-2xl tracking-[-0.03em] sm:text-3xl">
              ¿Qué quieres descubrir hoy?
            </h2>
            <p className="mt-3 max-w-md text-pretty text-sm text-pnpj-tinta/68 sm:text-base">
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
          />
        ))}
        {enviando && <IndicadorEscribiendo />}
      </div>

      {aviso && (
        <div
          className="brand-alert mx-4 mb-2 flex items-center gap-3"
          role="alert"
        >
          <ZuluMascota
            className="size-14 shrink-0"
            movimiento="respira"
            pose="error"
            sizes="56px"
          />
          <p>{aviso}</p>
        </div>
      )}

      {archivada ? (
        <div className="flex items-center justify-center gap-3 border-scouts-purple/10 border-t px-4 py-3 text-center text-pnpj-tinta/65 text-sm">
          <ZuluMascota
            className="size-14 shrink-0"
            movimiento="respira"
            pose="archivado"
            sizes="56px"
          />
          <p>Esta conversación está archivada: es de solo lectura.</p>
        </div>
      ) : (
        <form
          className={
            sinMensajes
              ? "mx-auto w-full max-w-3xl shrink-0 px-4 pt-4 [@media(max-height:30rem)]:pt-1 sm:px-6"
              : "mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6 sm:pb-6"
          }
          onSubmit={(evento) => {
            evento.preventDefault();
            enviar(borrador);
          }}
        >
          <div className="chat-composer-surface">
            <Textarea
              aria-label="Pregunta para Zulú"
              className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none placeholder:text-scouts-purple/55 focus-visible:ring-0"
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
          {esInvitado && requiereConsentimiento && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-pnpj-tinta/75 text-xs leading-5 [@media(max-height:30rem)]:mt-2 [@media(max-height:30rem)]:leading-[1.125rem]">
              <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
                <input
                  aria-label={`Acepto la política de privacidad, versión ${versionPoliticaActual ?? "vigente"}`}
                  checked={aceptaPolitica}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                  onChange={(evento) =>
                    setAceptaPolitica(evento.target.checked)
                  }
                  type="checkbox"
                />
                <span className="size-5 rounded-md border border-scouts-purple/35 bg-white/55 shadow-inner transition peer-focus-visible:outline-2 peer-focus-visible:outline-scouts-purple peer-focus-visible:outline-offset-2 peer-checked:border-scouts-purple peer-checked:bg-scouts-yellow" />
                <Check
                  aria-hidden="true"
                  className="pointer-events-none absolute size-3.5 text-scouts-purple opacity-0 peer-checked:opacity-100"
                  strokeWidth={3}
                />
              </span>
              <span>
                Leí y acepto la{" "}
                <a
                  className="font-medium text-scouts-purple underline decoration-scouts-purple/35 underline-offset-4 hover:decoration-scouts-purple"
                  href={URL_POLITICA_PRIVACIDAD}
                  rel="noreferrer"
                  target="_blank"
                >
                  política de privacidad
                </a>
                {versionPoliticaActual
                  ? ` (versión ${versionPoliticaActual})`
                  : ""}
                . Mis preguntas de prueba quedarán asociadas si creo una cuenta.
              </span>
            </label>
          )}
        </form>
      )}

      {sinMensajes && <div aria-hidden="true" className="min-h-6 flex-1" />}

      <Dialog onOpenChange={setMostrarRegistro} open={mostrarRegistro}>
        <DialogContent className="auth-card-surface max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto border-white/70">
          <DialogHeader>
            <ZuluMascota
              className="mx-auto mb-1 size-24"
              movimiento="respira"
              pose="bienvenida"
              sizes="96px"
            />
            <DialogTitle className="text-scouts-purple text-xl">
              Continúa con una cuenta
            </DialogTitle>
            <DialogDescription className="text-foreground/70">
              {motivoRegistro ??
                "Tu pregunta de prueba ya fue usada. Crea una cuenta o inicia sesión para continuar."}{" "}
              El texto que acabas de escribir seguirá aquí.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Button
              asChild
              className="btn-press min-h-11 bg-scouts-purple text-white hover:bg-scouts-purple/90"
            >
              <Link
                href={rutaAuthConBorrador(
                  "/registro",
                  traspasoBorradorId,
                  conversationIdTransferencia
                )}
              >
                Crear cuenta
              </Link>
            </Button>
            <Button
              asChild
              className="btn-press min-h-11 border-scouts-purple/25 text-scouts-purple hover:bg-scouts-purple/8"
              variant="outline"
            >
              <Link
                href={rutaAuthConBorrador(
                  "/login",
                  traspasoBorradorId,
                  conversationIdTransferencia
                )}
              >
                Iniciar sesión
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
