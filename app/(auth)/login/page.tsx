import { iniciarSesion } from "../acciones";
import { FormularioAuth } from "../formulario-auth";

export const metadata = { title: "Iniciar sesión" };

export default function PaginaLogin() {
  return <FormularioAuth accion={iniciarSesion} modo="login" />;
}
