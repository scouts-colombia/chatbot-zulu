import Link from "next/link";
import { Suspense } from "react";
import { ChatPublico } from "@/components/chat/chat-publico";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<{ aviso?: string; pagina?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      }
    >
      <ContenidoPrincipal searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoPrincipal({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; pagina?: string }>;
}) {
  const { aviso, pagina: paginaParam } = await searchParams;
  const pagina = Math.max(1, Number.parseInt(paginaParam ?? "1", 10) || 1);
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between border-b py-4">
        <div>
          <h1 className="font-semibold text-xl">Chat Scout</h1>
          <p className="text-muted-foreground text-sm">
            {perfil?.nombre ?? perfil?.email ?? user.email}
            {perfil?.role === "admin" && " · admin"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {perfil?.role === "admin" && (
            <Button asChild size="sm" variant="ghost">
              {/* <a>, no <Link>: el panel admin audita al renderizar en
                  servidor y no debe entrar a la caché de cliente del router
                  (invariante en app/admin/layout.tsx). */}
              <a href="/admin">Panel admin</a>
            </Button>
          )}
          <form action={cerrarSesion}>
            <Button size="sm" type="submit" variant="outline">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 py-6">
        {mensajeEstado ? (
          <p className="mx-auto max-w-md text-center text-muted-foreground">
            {mensajeEstado}
          </p>
        ) : requiereConsentimiento ? (
          <section className="auth-card-surface mx-auto max-w-lg rounded-2xl p-6">
            <h2 className="font-semibold text-scouts-purple text-xl">
              Antes de continuar
            </h2>
            <p className="mt-2 text-foreground/70 text-sm">
              Lee la política de privacidad vigente de Scouts Colombia. Tu
              aceptación se conserva como un evento histórico y será necesaria
              de nuevo si la versión cambia.
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
          <div className="space-y-6">
            <form action={crearConversacion}>
              <Button className="w-full" type="submit">
                Nueva conversación
              </Button>
            </form>

            {aviso === "archivar" && (
              <p className="text-center text-destructive text-sm" role="alert">
                No se pudo archivar la conversación. Intenta de nuevo.
              </p>
            )}

            {conversaciones && conversaciones.length > 0 ? (
              <>
                <ul className="space-y-2">
                  {conversaciones.map((conversacion) => (
                    <li
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      key={conversacion.id}
                    >
                      <Link
                        className="min-w-0 flex-1 truncate text-sm hover:underline"
                        href={`/chat/${conversacion.id}`}
                      >
                        {conversacion.title}
                      </Link>
                      <form action={archivarConversacion}>
                        <input
                          name="id"
                          type="hidden"
                          value={conversacion.id}
                        />
                        <Button size="sm" type="submit" variant="ghost">
                          Archivar
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
                    ? "text-center text-destructive text-sm"
                    : "text-center text-muted-foreground text-sm"
                }
                role={errorConversaciones ? "alert" : undefined}
              >
                {errorConversaciones
                  ? "No pudimos cargar tus conversaciones. Recarga la página; si el problema sigue, vuelve en un momento."
                  : "Aún no tienes conversaciones. Crea una y pregunta sobre los manuales oficiales."}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
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
    <nav className="flex items-center justify-between pt-2 text-sm">
      {hayAnterior ? (
        <Link className="hover:underline" href={`/?pagina=${pagina - 1}`}>
          ← Anteriores
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground text-xs">
        {totalPaginas === null
          ? `Página ${pagina}`
          : `Página ${pagina} de ${totalPaginas}`}
      </span>
      {haySiguiente ? (
        <Link className="hover:underline" href={`/?pagina=${pagina + 1}`}>
          Más antiguas →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
