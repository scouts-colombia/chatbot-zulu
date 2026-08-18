import {
  Archive,
  LogOut,
  MessageCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatPublico } from "@/components/chat/chat-publico";
import { LimpiezaBorradoresPendientes } from "@/components/chat/limpieza-borradores-pendientes";
import { FondoMarca } from "@/components/marca/fondo-marca";
import { ZuluMascota } from "@/components/marca/zulu-mascota";
import { Button } from "@/components/ui/button";
import { esIdTraspasoBorradorValido } from "@/lib/invitados/borrador";
import {
  URL_POLITICA_PRIVACIDAD,
  VERSION_POLITICA_PRIVACIDAD,
} from "@/lib/privacidad";
import { crearClienteServidor } from "@/lib/supabase/server";
import { aceptarPoliticaPrivacidad, cerrarSesion } from "./(auth)/acciones";
import { archivarConversacion, crearConversacion } from "./chat/acciones";

const MENSAJES_ESTADO: Record<string, string> = {
  pendiente_autorizacion:
    "Tu cuenta está pendiente de autorización. Un responsable de la organización debe habilitarla antes de que puedas usar el chat.",
  bloqueado:
    "Tu cuenta está bloqueada. Si crees que es un error, contacta a la organización.",
};

const TAMANO_PAGINA = 50;

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
  const borradorTransferenciaId = esIdTraspasoBorradorValido(borrador)
    ? borrador
    : null;
  const conversationIdTransferencia = esIdTraspasoBorradorValido(conversacion)
    ? conversacion
    : null;
  const pagina = Math.max(1, Number.parseInt(paginaParam ?? "1", 10) || 1);
  const supabase = await crearClienteServidor();

  const {
    data: { user },
    error: errorAutenticacion,
  } = await supabase.auth.getUser();

  const sesionAusente = errorAutenticacion?.name === "AuthSessionMissingError";
  if (errorAutenticacion && !sesionAusente) {
    console.error("[home] No se pudo verificar la sesión:", errorAutenticacion);
    return <ErrorAutenticacion />;
  }

  if (!user || user.is_anonymous === true) {
    return <ChatPublico userId={user?.id ?? null} />;
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select(
      "nombre, email, role, account_status, privacy_policy_version_accepted"
    )
    .eq("id", user.id)
    .single();

  const mensajeEstado = perfil
    ? MENSAJES_ESTADO[perfil.account_status]
    : "No pudimos cargar tu perfil. Cierra sesión e inténtalo de nuevo; si persiste, contacta a la organización.";
  const requiereConsentimiento =
    !mensajeEstado &&
    perfil?.privacy_policy_version_accepted !== VERSION_POLITICA_PRIVACIDAD;

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
  const inicio = (pagina - 1) * TAMANO_PAGINA;
  const {
    data: conversaciones,
    count: totalConversaciones,
    error: errorConversaciones,
  } = mensajeEstado || requiereConsentimiento
    ? { data: [], count: 0, error: null }
    : await supabase
        .from("conversations")
        .select("id, title, updated_at", { count: "exact" })
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .range(inicio, inicio + TAMANO_PAGINA - 1);

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
                {perfil?.nombre ?? perfil?.email ?? user.email}
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
                  <ShieldCheck aria-hidden="true" className="size-4" />
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
                <LogOut aria-hidden="true" className="size-4" />
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
          ) : requiereConsentimiento ? (
            <section className="auth-card-surface w-full max-w-xl rounded-3xl p-6 sm:p-8">
              <h2 className="font-semibold text-2xl text-scouts-purple">
                Antes de continuar
              </h2>
              <p className="mt-2 text-foreground/70 text-sm">
                Lee la política de privacidad vigente de Scouts Colombia. Tu
                aceptación se conserva como un evento histórico y será necesaria
                de nuevo si la versión cambia.
              </p>
              <p className="mt-2 text-foreground/70 text-xs">
                Versión que registrarás: {VERSION_POLITICA_PRIVACIDAD}
              </p>
              {(aviso === "consentimiento" ||
                aviso === "politica_actualizada") && (
                <p className="mt-3 text-destructive text-sm" role="alert">
                  {aviso === "politica_actualizada"
                    ? "La política cambió desde que la viste. Revisa la versión vigente y vuelve a aceptarla."
                    : "No pudimos registrar tu aceptación. Intenta de nuevo."}
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
                  <input
                    name="versionPoliticaAceptada"
                    type="hidden"
                    value={VERSION_POLITICA_PRIVACIDAD}
                  />
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
          ) : (
            <div className="w-full max-w-4xl space-y-6">
              <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="brand-kicker">Tu espacio Scout</span>
                  <h2 className="mt-3 text-balance font-semibold text-3xl tracking-[-0.04em] text-pnpj-morado sm:text-4xl">
                    ¿Qué quieres descubrir hoy?
                  </h2>
                  <p className="mt-2 max-w-xl text-pretty text-sm text-pnpj-tinta/68 sm:text-base">
                    Continúa una conversación o inicia una nueva consulta sobre
                    los manuales oficiales.
                  </p>
                </div>
                <form action={crearConversacion} className="w-full sm:w-auto">
                  {borradorTransferenciaId && (
                    <input
                      name="borrador"
                      type="hidden"
                      value={borradorTransferenciaId}
                    />
                  )}
                  <Button
                    className="btn-press min-h-12 w-full bg-scouts-yellow px-5 text-scouts-purple shadow-lg hover:bg-scouts-yellow/90 sm:w-auto"
                    type="submit"
                  >
                    <Plus aria-hidden="true" className="size-5" />
                    Nueva conversación
                  </Button>
                </form>
              </section>

              {aviso === "archivar" && (
                <p className="brand-alert" role="alert">
                  No se pudo archivar la conversación. Intenta de nuevo.
                </p>
              )}

              <section className="auth-card-surface rounded-3xl p-3 sm:p-5">
                <div className="flex items-center justify-between gap-3 px-2 pb-3 sm:px-1">
                  <div>
                    <h2 className="font-semibold text-lg text-scouts-purple">
                      Tus conversaciones
                    </h2>
                    <p className="text-foreground/70 text-xs">
                      {totalConversaciones == null
                        ? "Historial reciente"
                        : `${totalConversaciones} en tu historial activo`}
                    </p>
                  </div>
                  <MessageCircle
                    aria-hidden="true"
                    className="size-5 text-scouts-orange"
                  />
                </div>

                {conversaciones && conversaciones.length > 0 ? (
                  <>
                    <ul className="space-y-2">
                      {conversaciones.map((conversacion) => (
                        <li
                          className="brand-list-item flex items-center gap-3 rounded-2xl px-3 py-3 sm:px-4"
                          key={conversacion.id}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-scouts-purple/8 text-scouts-purple">
                            <MessageCircle
                              aria-hidden="true"
                              className="size-4"
                            />
                          </span>
                          <Link
                            className="focus-ring-card min-w-0 flex-1 rounded-md"
                            href={`/chat/${conversacion.id}`}
                          >
                            <span className="block truncate font-medium text-foreground text-sm">
                              {conversacion.title}
                            </span>
                            <time className="text-foreground/70 text-xs">
                              Actualizada{" "}
                              {new Date(
                                conversacion.updated_at as string
                              ).toLocaleDateString("es-CO")}
                            </time>
                          </Link>
                          <form action={archivarConversacion}>
                            <input
                              name="id"
                              type="hidden"
                              value={conversacion.id}
                            />
                            <Button
                              aria-label="Archivar conversación"
                              className="min-h-11 min-w-11"
                              size="sm"
                              type="submit"
                              variant="ghost"
                            >
                              <Archive aria-hidden="true" className="size-4" />
                              <span className="hidden sm:inline">Archivar</span>
                            </Button>
                          </form>
                        </li>
                      ))}
                    </ul>
                    <PaginacionConversaciones
                      cantidadEnPagina={conversaciones.length}
                      pagina={pagina}
                      total={totalConversaciones}
                    />
                  </>
                ) : (
                  <p
                    className={
                      errorConversaciones
                        ? "rounded-2xl bg-scouts-red/8 px-5 py-8 text-center text-scouts-red text-sm"
                        : "rounded-2xl bg-scouts-purple/5 px-5 py-10 text-center text-foreground/70 text-sm"
                    }
                    role={errorConversaciones ? "alert" : undefined}
                  >
                    {errorConversaciones
                      ? "No pudimos cargar tus conversaciones. Recarga la página; si el problema sigue, vuelve en un momento."
                      : "Aún no tienes conversaciones. Crea una y pregunta sobre los manuales oficiales."}
                  </p>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
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
/**
 * Si no viene `count` no se finge un total: se ofrece "Siguiente" mientras la
 * página venga llena, en vez de ocultar la navegación y dar a entender que no
 * hay más conversaciones.
 */
function PaginacionConversaciones({
  pagina,
  total,
  cantidadEnPagina,
}: {
  pagina: number;
  total: number | null;
  cantidadEnPagina: number;
}) {
  const totalPaginas =
    total == null ? null : Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const haySiguiente =
    totalPaginas === null
      ? cantidadEnPagina === TAMANO_PAGINA
      : pagina < totalPaginas;
  const hayAnterior = pagina > 1;

  if (!(hayAnterior || haySiguiente)) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between px-2 pt-4 text-sm">
      {hayAnterior ? (
        <Link className="brand-page-link" href={`/?pagina=${pagina - 1}`}>
          ← Anteriores
        </Link>
      ) : (
        <span />
      )}
      <span className="text-foreground/70 text-xs">
        {totalPaginas === null
          ? `Página ${pagina}`
          : `Página ${pagina} de ${totalPaginas}`}
      </span>
      {haySiguiente ? (
        <Link className="brand-page-link" href={`/?pagina=${pagina + 1}`}>
          Más antiguas →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
