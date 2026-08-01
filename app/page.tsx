import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cerrarSesion } from "./(auth)/acciones";
import { archivarConversacion, crearConversacion } from "./chat/acciones";

const MENSAJES_ESTADO: Record<string, string> = {
  pendiente_autorizacion:
    "Tu cuenta está pendiente de autorización. Un responsable de la organización debe habilitarla antes de que puedas usar el chat.",
  bloqueado:
    "Tu cuenta está bloqueada. Si crees que es un error, contacta a la organización.",
};

export default function PaginaPrincipal({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
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
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, email, role, account_status")
    .eq("id", user.id)
    .single();

  const mensajeEstado = perfil
    ? MENSAJES_ESTADO[perfil.account_status]
    : "No pudimos cargar tu perfil. Cierra sesión e inténtalo de nuevo; si persiste, contacta a la organización.";

  // Acotada: PostgREST corta en `db-max-rows` sin error, y un fallo de la
  // consulta no debe leerse como "aún no tienes conversaciones", que llevaría
  // al Scout a crear un hilo duplicado creyendo que perdió el anterior.
  const { data: conversaciones, error: errorConversaciones } = mensajeEstado
    ? { data: [], error: null }
    : await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .range(0, 199);

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
                      <input name="id" type="hidden" value={conversacion.id} />
                      <Button size="sm" type="submit" variant="ghost">
                        Archivar
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
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
