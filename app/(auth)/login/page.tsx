import type { Metadata } from "next";
import { Suspense } from "react";
import { esUuid } from "@/lib/uuid";
import { iniciarSesion } from "../acciones";
import { FormularioAuth } from "../formulario-auth";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description:
    "Entra a Zulú con tu cuenta de Scouts de Colombia para retomar tus conversaciones sobre los manuales oficiales.",
  alternates: { canonical: "/login" },
  // Página utilitaria detrás de la sesión: sin valor en buscadores.
  robots: { index: false, follow: false },
};

export default function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ borrador?: string; conversacion?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="pnpj-fondo flex min-h-dvh items-center justify-center px-4">
          <p className="auth-card-surface rounded-2xl px-5 py-3 text-sm text-scouts-purple/70">
            Preparando el inicio de sesión...
          </p>
        </main>
      }
    >
      <ContenidoLogin searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoLogin({
  searchParams,
}: {
  searchParams: Promise<{ borrador?: string; conversacion?: string }>;
}) {
  const { borrador, conversacion } = await searchParams;
  return (
    <FormularioAuth
      accion={iniciarSesion}
      borradorTransferenciaId={esUuid(borrador) ? borrador : null}
      conversationIdTransferencia={esUuid(conversacion) ? conversacion : null}
      modo="login"
    />
  );
}
