import Link from "next/link";
import { cargarTramo } from "@/lib/chat/transcripcion";
import { VERSION_POLITICA_PRIVACIDAD } from "@/lib/privacidad";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Conversacion } from "./conversacion";
import { NavegacionCuentaPublica } from "./navegacion-cuenta-publica";
import type { MensajeUI } from "./tipos";

export async function ChatPublico({ userId }: { userId: string | null }) {
  const supabase = await crearClienteServidor();
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
    <MarcoChatPublico>
      <Conversacion
        conversationId={conversationId}
        cursorInicial={cursor}
        esInvitado
        hayMasAntiguos={hayMasAntiguos}
        limiteConsumido={mensajes.some(
          (mensaje) => mensaje.sender === "usuario"
        )}
        mensajesIniciales={mensajes}
        requiereConsentimiento={!consentimientoAceptado}
        sesionInvitadaEstablecida={Boolean(userId)}
        versionPolitica={VERSION_POLITICA_PRIVACIDAD}
      />
    </MarcoChatPublico>
  );
}

function ErrorChatPublico() {
  return (
    <MarcoChatPublico>
      <p
        className="auth-card-surface mx-auto max-w-md rounded-2xl p-6 text-center text-destructive text-sm"
        role="alert"
      >
        No pudimos recuperar tu conversación en este momento. Recarga la página
        o vuelve a intentarlo más tarde.
      </p>
    </MarcoChatPublico>
  );
}

function MarcoChatPublico({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="auth-hero relative flex h-dvh min-h-[34rem] flex-col overflow-hidden text-white"
      data-design-direction="ruta-liquid-glass"
      data-design-mode="operate"
    >
      <div aria-hidden="true" className="brand-orb brand-orb-yellow" />
      <div aria-hidden="true" className="brand-orb brand-orb-blue" />
      <header className="relative z-10 flex min-h-16 items-center justify-between gap-3 border-white/15 border-b px-4 sm:px-6">
        <Link
          className="focus-ring rounded-lg py-2 font-semibold text-xl tracking-[-0.03em] text-white"
          href="/"
        >
          Zulú
          <span className="ml-2 hidden font-normal text-sm text-white/72 sm:inline">
            Asistente Scout
          </span>
        </Link>
        <NavegacionCuentaPublica />
      </header>
      <main className="relative z-10 min-h-0 flex-1">{children}</main>
      <p className="relative z-10 px-4 pb-3 text-center text-white/65 text-xs">
        Una pregunta de prueba por dispositivo. Las respuestas citan documentos
        oficiales.
      </p>
    </div>
  );
}
