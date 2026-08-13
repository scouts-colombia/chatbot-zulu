import { Suspense } from "react";
import { esIdTraspasoBorradorValido } from "@/lib/invitados/borrador";
import { iniciarSesion } from "../acciones";
import { FormularioAuth } from "../formulario-auth";

export const metadata = { title: "Iniciar sesión" };

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
      borradorTransferenciaId={
        esIdTraspasoBorradorValido(borrador) ? borrador : null
      }
      conversationIdTransferencia={
        esIdTraspasoBorradorValido(conversacion) ? conversacion : null
      }
      modo="login"
    />
  );
}
