import { Suspense } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { finalizarRegistro, registrarse } from "../acciones";
import { FormularioAuth } from "../formulario-auth";

export const metadata = { title: "Crear cuenta" };

export default function PaginaRegistro({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="auth-hero flex min-h-dvh items-center justify-center px-4">
          <p className="auth-card-surface rounded-xl px-5 py-3 text-sm text-white/80">
            Preparando tu registro...
          </p>
        </main>
      }
    >
      <ContenidoRegistro searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoRegistro({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
    error: errorAutenticacion,
  } = await supabase.auth.getUser();
  const sesionAusente = errorAutenticacion?.name === "AuthSessionMissingError";
  if (errorAutenticacion && !sesionAusente) {
    console.error(
      "[registro] No se pudo verificar la sesión:",
      errorAutenticacion
    );
    return (
      <FormularioAuth
        accion={registrarse}
        errorInicial="No pudimos verificar tu sesión. Recarga la página e inténtalo de nuevo."
        modo="registro"
      />
    );
  }

  if (
    user &&
    user.is_anonymous !== true &&
    user.user_metadata?.registro_pendiente_password === true
  ) {
    return <FormularioAuth accion={finalizarRegistro} modo="finalizar" />;
  }

  return (
    <FormularioAuth
      accion={registrarse}
      conversionInvitada={user?.is_anonymous === true}
      errorInicial={
        error === "enlace_invalido"
          ? "El enlace de verificaci\u00f3n venci\u00f3 o ya fue usado. Solicita uno nuevo."
          : undefined
      }
      modo="registro"
    />
  );
}
