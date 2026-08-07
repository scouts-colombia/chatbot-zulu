import { Suspense } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { finalizarRegistro, registrarse } from "../acciones";
import { FormularioAuth } from "../formulario-auth";

export const metadata = { title: "Crear cuenta" };

export default function PaginaRegistro() {
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
      <ContenidoRegistro />
    </Suspense>
  );
}

async function ContenidoRegistro() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      modo="registro"
    />
  );
}
