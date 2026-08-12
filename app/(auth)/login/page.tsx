import { esIdTraspasoBorradorValido } from "@/lib/invitados/borrador";
import { iniciarSesion } from "../acciones";
import { FormularioAuth } from "../formulario-auth";

export const metadata = { title: "Iniciar sesión" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ borrador?: string }>;
}) {
  const { borrador } = await searchParams;
  return (
    <FormularioAuth
      accion={iniciarSesion}
      borradorTransferenciaId={
        esIdTraspasoBorradorValido(borrador) ? borrador : null
      }
      modo="login"
    />
  );
}
