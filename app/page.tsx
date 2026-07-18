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

export default function PaginaPrincipal() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      }
    >
      <ContenidoPrincipal />
    </Suspense>
  );
}

async function ContenidoPrincipal() {
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

  const { data: conversaciones } = mensajeEstado
    ? { data: [] }
    : await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("archived", false)
        .order("updated_at", { ascending: false });

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
        <form action={cerrarSesion}>
          <Button size="sm" type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
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
              <p className="text-center text-muted-foreground text-sm">
                Aún no tienes conversaciones. Crea una y pregunta sobre los
                manuales oficiales.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
