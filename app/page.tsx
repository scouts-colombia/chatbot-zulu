import {
  CheckmarkBadge01Icon,
  Logout01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatPublico } from "@/components/chat/chat-publico";
import { LimpiezaBorradoresPendientes } from "@/components/chat/limpieza-borradores-pendientes";
import { MarcoChat } from "@/components/chat/marco-chat";
import { MascotaBienvenidaChat } from "@/components/chat/personalidad-zulu";
import { FondoMarca } from "@/components/marca/fondo-marca";
import { ZuluMascota } from "@/components/marca/zulu-mascota";
import { leerPagina } from "@/components/navegacion/paginacion";
import { Button } from "@/components/ui/button";
import { esFalloDeVerificacionDeSesion } from "@/lib/auth/sesion";
import { listarConversacionesPropias } from "@/lib/chat/listado";
import { URL_POLITICA_PRIVACIDAD } from "@/lib/privacidad";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esUuid } from "@/lib/uuid";
import { aceptarPoliticaPrivacidad, cerrarSesion } from "./(auth)/acciones";
import { crearConversacion } from "./chat/acciones";

const MENSAJES_ESTADO: Record<string, string> = {
  pendiente_autorizacion:
    "Tu cuenta está pendiente de autorización. Un responsable de la organización debe habilitarla antes de que puedas usar el chat.",
  bloqueado:
    "Tu cuenta está bloqueada. Si crees que es un error, contacta a la organización.",
};

export default function PaginaPrincipal({
  searchParams,
}: {
  searchParams: Promise<{
    aviso?: string;
    borrador?: string;
    conversacion?: string;
    pagina?: string;
  }>;
}) {
  return (
    <>
      <LimpiezaBorradoresPendientes />
      <Suspense
        fallback={
          <FondoMarca className="flex items-center justify-center">
            <p className="text-sm text-pnpj-tinta/60">Cargando Zulú...</p>
          </FondoMarca>
        }
      >
        <ContenidoPrincipal searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ContenidoPrincipal({
  searchParams,
}: {
  searchParams: Promise<{
    aviso?: string;
    borrador?: string;
    conversacion?: string;
    pagina?: string;
  }>;
}) {
  const {
    aviso,
    borrador,
    conversacion,
    pagina: paginaParam,
  } = await searchParams;
  const borradorTransferenciaId = esUuid(borrador) ? borrador : null;
  const conversationIdTransferencia = esUuid(conversacion)
    ? conversacion
    : null;
  const pagina = leerPagina(paginaParam);
  const supabase = await crearClienteServidor();

  const {
    data: { user },
    error: errorAutenticacion,
  } = await supabase.auth.getUser();

  if (esFalloDeVerificacionDeSesion(errorAutenticacion)) {
    console.error("[home] No se pudo verificar la sesión:", errorAutenticacion);
    return <ErrorAutenticacion />;
  }

  if (!user || user.is_anonymous === true) {
    return <ChatPublico userId={user?.id ?? null} />;
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, email, role, account_status, privacy_policy_accepted_at")
    .eq("id", user.id)
    .single();

  const mensajeEstado = perfil
    ? MENSAJES_ESTADO[perfil.account_status]
    : "No pudimos cargar tu perfil. Cierra sesión e inténtalo de nuevo; si persiste, contacta a la organización.";
  const requiereConsentimiento =
    !mensajeEstado && perfil?.privacy_policy_accepted_at == null;

  if (
    !mensajeEstado &&
    !requiereConsentimiento &&
    borradorTransferenciaId &&
    conversationIdTransferencia
  ) {
    const { data: conversacionTransferida, error: errorTransferencia } =
      await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationIdTransferencia)
        .maybeSingle();
    if (errorTransferencia) {
      console.error(
        "[home] No se pudo verificar la conversación transferida:",
        errorTransferencia
      );
      return (
        <ErrorRecuperacionBorrador
          borradorId={borradorTransferenciaId}
          conversationId={conversationIdTransferencia}
          motivo="consulta"
        />
      );
    }
    if (conversacionTransferida) {
      redirect(
        `/chat/${conversationIdTransferencia}?borrador=${encodeURIComponent(borradorTransferenciaId)}`
      );
    }
    return (
      <ErrorRecuperacionBorrador
        borradorId={borradorTransferenciaId}
        conversationId={conversationIdTransferencia}
        motivo="no_encontrada"
      />
    );
  }
  // Paginada: PostgREST corta en `db-max-rows` sin error, y un tope fijo sin
  // navegación dejaría las conversaciones antiguas inalcanzables, que el Scout
  // leería como que se perdieron. Un fallo tampoco debe leerse como "aún no
  // tienes conversaciones", que llevaría a crear un hilo duplicado.
  const listado =
    mensajeEstado || requiereConsentimiento
      ? { conversaciones: [], total: 0, error: false }
      : await listarConversacionesPropias(pagina);

  const nombreVisible = perfil?.nombre ?? perfil?.email ?? user.email ?? "";

  if (mensajeEstado || requiereConsentimiento) {
    return (
      <FondoMarca>
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
          <header className="app-shell-header mt-3 flex min-h-16 items-center justify-between gap-3 rounded-2xl px-4 py-2.5 sm:mt-5 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <ZuluMascota
                className="size-12"
                movimiento="quieto"
                pose="marca"
                priority
                sizes="48px"
              />
              <div className="min-w-0">
                <h1 className="font-semibold text-xl tracking-[-0.03em] text-scouts-purple">
                  Zulú
                </h1>
                <p className="truncate text-sm text-pnpj-tinta/60">
                  {nombreVisible}
                  {perfil?.role === "admin" && " · admin"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {perfil?.role === "admin" && (
                <Button
                  asChild
                  className="btn-press min-h-11 border-scouts-purple/20 bg-white/40 px-3 text-scouts-purple hover:bg-white/70"
                  variant="outline"
                >
                  {/* <a>, no <Link>: el panel admin audita al renderizar en
                    servidor y no debe entrar a la caché de cliente del router
                    (invariante en app/admin/layout.tsx). */}
                  <a aria-label="Panel de administración" href="/admin">
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-4"
                      icon={CheckmarkBadge01Icon}
                      strokeWidth={1.8}
                    />
                    <span className="hidden sm:inline">Panel admin</span>
                  </a>
                </Button>
              )}
              <form action={cerrarSesion}>
                <Button
                  aria-label="Cerrar sesión"
                  className="btn-press min-h-11 border-scouts-purple/20 bg-white/40 px-3 text-scouts-purple hover:bg-white/70"
                  type="submit"
                  variant="outline"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-4"
                    icon={Logout01Icon}
                    strokeWidth={1.8}
                  />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </Button>
              </form>
            </div>
          </header>

          <main className="flex flex-1 items-start justify-center py-8 sm:py-12">
            {mensajeEstado ? (
              <p className="auth-card-surface w-full max-w-xl rounded-3xl p-8 text-center text-foreground/70">
                {mensajeEstado}
              </p>
            ) : (
              <section className="auth-card-surface w-full max-w-xl rounded-3xl p-6 sm:p-8">
                <h2 className="font-semibold text-2xl text-scouts-purple">
                  Antes de continuar
                </h2>
                <p className="mt-2 text-foreground/70 text-sm">
                  Lee la política de privacidad de Scouts Colombia. Tu
                  aceptación se registra una sola vez.
                </p>
                {aviso === "consentimiento" && (
                  <p className="mt-3 text-destructive text-sm" role="alert">
                    No pudimos registrar tu aceptación. Intenta de nuevo.
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    className="min-h-11 border-scouts-purple/25 text-scouts-purple"
                    variant="outline"
                  >
                    <a
                      href={URL_POLITICA_PRIVACIDAD}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Leer política
                    </a>
                  </Button>
                  <form action={aceptarPoliticaPrivacidad} className="flex-1">
                    {borradorTransferenciaId && (
                      <input
                        name="borrador"
                        type="hidden"
                        value={borradorTransferenciaId}
                      />
                    )}
                    {conversationIdTransferencia && (
                      <input
                        name="conversacion"
                        type="hidden"
                        value={conversationIdTransferencia}
                      />
                    )}
                    <Button
                      className="btn-press min-h-11 w-full bg-scouts-purple text-white hover:bg-scouts-purple/90"
                      type="submit"
                    >
                      Acepto y quiero continuar
                    </Button>
                  </form>
                </div>
              </section>
            )}
          </main>
        </div>
      </FondoMarca>
    );
  }

  return (
    <FondoMarca className="h-dvh overflow-hidden">
      <MarcoChat
        avisoArchivar={aviso === "archivar"}
        borradorTransferenciaId={borradorTransferenciaId}
        conversaciones={listado.conversaciones}
        correo={perfil?.email ?? user.email ?? ""}
        errorConversaciones={listado.error}
        esAdmin={perfil?.role === "admin"}
        nombre={nombreVisible}
        pagina={pagina}
        titulo="Zulú"
        totalConversaciones={listado.total}
      >
        <div className="flex h-full flex-1 flex-col items-center justify-center px-4 text-center">
          <MascotaBienvenidaChat />
          <h2 className="text-balance font-semibold text-2xl tracking-[-0.03em] text-pnpj-morado sm:text-3xl">
            ¿Qué quieres descubrir hoy?
          </h2>
          <p className="mt-3 max-w-md text-pretty text-sm text-pnpj-tinta/68 sm:text-base">
            Pregunta sobre los manuales oficiales de Scouts Colombia. Zulú te
            responderá con las fuentes que respaldan la respuesta.
          </p>
          <form action={crearConversacion} className="mt-6">
            {borradorTransferenciaId && (
              <input
                name="borrador"
                type="hidden"
                value={borradorTransferenciaId}
              />
            )}
            <Button
              className="btn-press min-h-12 bg-scouts-yellow px-5 text-scouts-purple shadow-lg hover:bg-scouts-yellow/90"
              type="submit"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-5"
                icon={PlusSignIcon}
                strokeWidth={1.8}
              />
              Nueva conversación
            </Button>
          </form>
        </div>
      </MarcoChat>
    </FondoMarca>
  );
}

function ErrorRecuperacionBorrador({
  borradorId,
  conversationId,
  motivo,
}: {
  borradorId: string;
  conversationId: string;
  motivo: "consulta" | "no_encontrada";
}) {
  const parametros = new URLSearchParams({
    borrador: borradorId,
    conversacion: conversationId,
  });
  return (
    <FondoMarca className="flex items-center justify-center px-4">
      <section className="auth-card-surface w-full max-w-md rounded-3xl p-8 text-center">
        <h1 className="font-semibold text-scouts-purple text-xl">
          No pudimos recuperar tu conversación
        </h1>
        <p className="mt-2 text-foreground/65 text-sm" role="alert">
          {motivo === "consulta"
            ? "La conversación ya fue asociada, pero no pudimos verificarla en este momento. Reintenta para conservar el contexto de tu pregunta."
            : "Ese hilo no pertenece a esta cuenta. Vuelve al inicio e inicia sesión con la cuenta correcta para no crear una conversación duplicada."}
        </p>
        <Button
          asChild
          className="btn-press mt-5 min-h-11 bg-scouts-purple text-white hover:bg-scouts-purple/90"
        >
          <a href={motivo === "consulta" ? `/?${parametros.toString()}` : "/"}>
            {motivo === "consulta" ? "Reintentar" : "Volver al inicio"}
          </a>
        </Button>
      </section>
    </FondoMarca>
  );
}
function ErrorAutenticacion() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <section
        className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-[var(--shadow-float)]"
        role="alert"
      >
        <h1 className="font-semibold text-scouts-purple text-xl">
          No pudimos verificar tu sesión
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          No entraremos al modo invitado mientras exista esta duda. Reintenta
          para conservar tu cuenta y tus conversaciones.
        </p>
        <Button asChild className="mt-5 min-h-11 bg-scouts-purple text-white">
          <a href="/">Reintentar</a>
        </Button>
      </section>
    </main>
  );
}
