import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Conversacion } from "@/components/chat/conversacion";
import { cargarTramo } from "@/lib/chat/transcripcion";
import { esIdTraspasoBorradorValido } from "@/lib/invitados/borrador";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Conversación" };

export default function PaginaConversacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ borrador?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      }
    >
      <ContenidoConversacion params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoConversacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ borrador?: string }>;
}) {
  const [{ id }, { borrador }] = await Promise.all([params, searchParams]);
  const borradorTransferenciaId = esIdTraspasoBorradorValido(borrador)
    ? borrador
    : null;
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Un fallo al leer el perfil no significa "cuenta no habilitada": mandar al
  // usuario a la home con ese mensaje por una caída de un segundo es alarmante
  // y falso, sobre todo con usuarios de 15 años.
  const { data: perfil, error: errorPerfil } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (errorPerfil) {
    return (
      <AvisoPantalla>
        No pudimos verificar tu cuenta en este momento. Intenta de nuevo.
      </AvisoPantalla>
    );
  }
  if (perfil?.account_status !== "activo") {
    redirect("/");
  }

  // La RLS limita a conversaciones propias: ajena = no encontrada. Un error de
  // la consulta es otra cosa y no debe presentarse como "no existe".
  const { data: conversacion, error: errorConversacion } = await supabase
    .from("conversations")
    .select("id, title, archived")
    .eq("id", id)
    .maybeSingle();
  if (errorConversacion) {
    return (
      <AvisoPantalla>
        No pudimos abrir la conversación en este momento. Intenta de nuevo.
      </AvisoPantalla>
    );
  }
  if (!conversacion) {
    notFound();
  }

  const tramo = await cargarTramo(id);
  if (tramo.error) {
    return (
      <AvisoPantalla>
        No pudimos cargar los mensajes de esta conversación. Intenta de nuevo.
      </AvisoPantalla>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Conversaciones
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-medium text-sm">
          {conversacion.title}
        </h1>
        {conversacion.archived && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
            Archivada
          </span>
        )}
      </header>
      <Conversacion
        archivada={conversacion.archived}
        borradorTransferenciaId={borradorTransferenciaId}
        conversationId={conversacion.id}
        cursorInicial={tramo.cursor}
        hayMasAntiguos={tramo.hayMasAntiguos}
        mensajesIniciales={tramo.mensajes}
      />
    </div>
  );
}

function AvisoPantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-4">
      <p className="text-center text-destructive text-sm" role="alert">
        {children}
      </p>
      <Link
        className="text-muted-foreground text-sm hover:text-foreground"
        href="/"
      >
        ← Conversaciones
      </Link>
    </div>
  );
}
