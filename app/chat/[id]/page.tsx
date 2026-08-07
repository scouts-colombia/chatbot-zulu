import { Archive } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Conversacion } from "@/components/chat/conversacion";
import { FondoMarca } from "@/components/marca/fondo-marca";
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
        <FondoMarca className="flex items-center justify-center">
          <p className="text-sm text-pnpj-tinta/60">Cargando conversación...</p>
        </FondoMarca>
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
    <FondoMarca className="h-dvh overflow-hidden">
      <div className="mx-auto flex h-dvh w-full max-w-4xl flex-col px-3 sm:px-6">
        <header className="app-shell-header mt-3 flex min-h-16 items-center gap-3 rounded-2xl px-4 py-2.5 sm:mt-5">
          <Link
            className="focus-ring shrink-0 rounded-lg px-2 py-2 text-sm text-scouts-purple/75 hover:text-scouts-purple"
            href="/"
          >
            ← Conversaciones
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-medium text-sm text-pnpj-morado">
            {conversacion.title}
          </h1>
          {conversacion.archived && (
            <span className="flex items-center gap-1 rounded-full bg-scouts-yellow px-2.5 py-1 font-medium text-scouts-purple text-xs">
              <Archive aria-hidden="true" className="size-3" />
              Archivada
            </span>
          )}
        </header>
        <div className="min-h-0 flex-1">
          <Conversacion
            archivada={conversacion.archived}
            borradorTransferenciaId={borradorTransferenciaId}
            conversationId={conversacion.id}
            cursorInicial={tramo.cursor}
            hayMasAntiguos={tramo.hayMasAntiguos}
            mensajesIniciales={tramo.mensajes}
          />
        </div>
      </div>
    </FondoMarca>
  );
}

function AvisoPantalla({ children }: { children: React.ReactNode }) {
  return (
    <FondoMarca className="flex items-center justify-center px-4">
      <div className="auth-card-surface flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl p-8">
        <p className="text-center text-scouts-red text-sm" role="alert">
          {children}
        </p>
        <Link className="brand-page-link" href="/">
          ← Conversaciones
        </Link>
      </div>
    </FondoMarca>
  );
}
