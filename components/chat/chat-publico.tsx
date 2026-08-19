import Link from "next/link";
import { ZuluMascota } from "@/components/marca/zulu-mascota";
import { cargarTramo } from "@/lib/chat/transcripcion";
import { cargarConfiguracionChat } from "@/lib/configuracion/servidor";
import { VERSION_POLITICA_PRIVACIDAD } from "@/lib/privacidad";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Conversacion } from "./conversacion";
import { NavegacionCuentaPublica } from "./navegacion-cuenta-publica";
import type { MensajeUI } from "./tipos";

export async function ChatPublico({ userId }: { userId: string | null }) {
  const supabase = await crearClienteServidor();
  const { configuracion, error: errorConfiguracion } =
    await cargarConfiguracionChat();
  if (errorConfiguracion || !configuracion) {
    return <ErrorChatPublico />;
  }
  let conversationId: string | null = null;
  let mensajes: MensajeUI[] = [];
  let hayMasAntiguos = false;
  let cursor: string | null = null;
  let consentimientoAceptado = false;

  if (userId) {
    const [resultadoPerfil, resultadoConversacion] = await Promise.all([
      supabase
        .from("profiles")
        .select("privacy_policy_version_accepted")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (resultadoPerfil.error || resultadoConversacion.error) {
      console.error("[home] No se pudo cargar el chat invitado:", {
        perfil: resultadoPerfil.error,
        conversacion: resultadoConversacion.error,
      });
      return <ErrorChatPublico />;
    }

    consentimientoAceptado =
      resultadoPerfil.data?.privacy_policy_version_accepted ===
      VERSION_POLITICA_PRIVACIDAD;
    conversationId = (resultadoConversacion.data?.id as string) ?? null;

    if (conversationId) {
      const tramo = await cargarTramo(conversationId);
      if (tramo.error) {
        return <ErrorChatPublico />;
      }
      mensajes = tramo.mensajes;
      hayMasAntiguos = tramo.hayMasAntiguos;
      cursor = tramo.cursor;
    }
  }

  return (
    <MarcoChatPublico
      maxTurnosInvitado={configuracion.maxTurnosInvitadoPorPersonaPorDia}
    >
      <Conversacion
        conversationId={conversationId}
        cursorInicial={cursor}
        esInvitado
        hayMasAntiguos={hayMasAntiguos}
        mensajesIniciales={mensajes}
        requiereConsentimiento={!consentimientoAceptado}
        sesionInvitadaEstablecida={Boolean(userId && conversationId)}
        versionPolitica={VERSION_POLITICA_PRIVACIDAD}
      />
    </MarcoChatPublico>
  );
}

function ErrorChatPublico() {
  return (
    <MarcoChatPublico>
      <div
        className="auth-card-surface mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl p-6 text-center text-destructive text-sm"
        role="alert"
      >
        <ZuluMascota
          className="size-24"
          movimiento="respira"
          pose="error"
          priority
          sizes="96px"
        />
        <p>
          No pudimos recuperar tu conversación en este momento. Recarga la
          página o vuelve a intentarlo más tarde.
        </p>
      </div>
    </MarcoChatPublico>
  );
}

function MarcoChatPublico({
  children,
  maxTurnosInvitado = 1,
}: {
  children: React.ReactNode;
  maxTurnosInvitado?: number;
}) {
  return (
    <div
      className="pnpj-fondo relative flex h-dvh flex-col overflow-hidden text-pnpj-tinta"
      data-design-direction="ruta-editorial-glass"
      data-design-mode="operate"
    >
      <header className="relative z-10 flex min-h-16 items-center justify-between gap-3 border-scouts-purple/10 border-b px-4 sm:px-6">
        <Link
          className="focus-ring flex min-w-0 items-center gap-2 rounded-lg py-1 text-scouts-purple"
          href="/"
        >
          <ZuluMascota
            className="size-12"
            movimiento="quieto"
            pose="marca"
            priority
            sizes="48px"
          />
          <span className="min-w-0">
            <span className="block font-semibold text-xl tracking-[-0.03em]">
              Zulú
            </span>
            <span className="hidden font-normal text-pnpj-tinta/65 text-xs sm:block">
              Asistente Scout
            </span>
          </span>
        </Link>
        <NavegacionCuentaPublica />
      </header>
      <main className="relative z-10 min-h-0 flex-1">{children}</main>
      <p className="relative z-10 px-4 pb-3 text-center text-pnpj-tinta/70 text-xs">
        {maxTurnosInvitado === 1
          ? "Una pregunta de prueba por dispositivo."
          : `${maxTurnosInvitado} preguntas de prueba por dispositivo y día.`}{" "}
        Las respuestas citan documentos oficiales.
      </p>
    </div>
  );
}
