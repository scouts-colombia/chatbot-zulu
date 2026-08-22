import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Conversacion } from "@/components/chat/conversacion";
import { LimpiezaBorradoresPendientes } from "@/components/chat/limpieza-borradores-pendientes";
import { MarcoChat } from "@/components/chat/marco-chat";
import { FondoMarca } from "@/components/marca/fondo-marca";
import { ZuluMascota } from "@/components/marca/zulu-mascota";
import { leerPagina } from "@/components/navegacion/paginacion";
import { listarConversacionesPropias } from "@/lib/chat/listado";
import { cargarTramo } from "@/lib/chat/transcripcion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Conversación",
  // Contenido privado del Scout: nunca indexable.
  robots: { index: false, follow: false, nocache: true },
};

export default function PaginaConversacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    borrador?: string;
    aviso?: string;
    pagina?: string;
  }>;
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
  searchParams: Promise<{
    borrador?: string;
    aviso?: string;
    pagina?: string;
  }>;
}) {
  const [{ id }, { borrador, aviso, pagina: paginaParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const borradorTransferenciaId = esUuid(borrador) ? borrador : null;
  const pagina = leerPagina(paginaParam);
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
    .select("nombre, email, role, account_status")
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

  const [tramo, listado] = await Promise.all([
    cargarTramo(id),
    listarConversacionesPropias(pagina),
  ]);
  if (tramo.error) {
    return (
      <AvisoPantalla>
        No pudimos cargar los mensajes de esta conversación. Intenta de nuevo.
      </AvisoPantalla>
    );
  }

  return (
    <FondoMarca className="h-dvh overflow-hidden">
      <MarcoChat
        archivada={conversacion.archived}
        avisoArchivar={aviso === "archivar"}
        borradorTransferenciaId={borradorTransferenciaId}
        conversacionActivaId={conversacion.id}
        conversaciones={listado.conversaciones}
        correo={perfil?.email ?? user.email ?? ""}
        errorConversaciones={listado.error}
        esAdmin={perfil?.role === "admin"}
        nombre={perfil?.nombre ?? perfil?.email ?? user.email ?? ""}
        pagina={pagina}
        titulo={conversacion.title}
        totalConversaciones={listado.total}
      >
        <LimpiezaBorradoresPendientes />
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
      </MarcoChat>
    </FondoMarca>
  );
}

function AvisoPantalla({ children }: { children: React.ReactNode }) {
  return (
    <FondoMarca className="flex items-center justify-center px-4">
      <div className="auth-card-surface flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl p-8">
        <ZuluMascota
          className="size-24"
          movimiento="respira"
          pose="error"
          priority
          sizes="96px"
        />
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
