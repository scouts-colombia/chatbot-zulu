import { registrarse } from "../acciones";
import { FormularioAuth } from "../formulario-auth";

export const metadata = { title: "Crear cuenta" };

export default function PaginaRegistro() {
  return <FormularioAuth accion={registrarse} modo="registro" />;
}
