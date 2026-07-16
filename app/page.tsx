import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cerrarSesion } from "./(auth)/acciones";

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

  // Sin perfil se cierra el paso (fail closed): un usuario de auth sin fila
  // en profiles es un estado anómalo, no una cuenta activa.
  const mensajeEstado = perfil
    ? MENSAJES_ESTADO[perfil.account_status]
    : "No pudimos cargar tu perfil. Cierra sesión e inténtalo de nuevo; si persiste, contacta a la organización.";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="font-semibold">Chat Scout</h1>
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

      <main className="flex flex-1 items-center justify-center px-4">
        {mensajeEstado ? (
          <p className="max-w-md text-center text-muted-foreground">
            {mensajeEstado}
          </p>
        ) : (
          <div className="max-w-md space-y-2 text-center">
            <h2 className="font-medium text-lg">El chat viene en camino</h2>
            <p className="text-muted-foreground text-sm">
              Pronto podrás consultar los manuales oficiales y recibir
              respuestas con citas. Tu cuenta ya quedó lista.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
