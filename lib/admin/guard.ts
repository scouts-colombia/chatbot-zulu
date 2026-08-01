import { redirect } from "next/navigation";
import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Verifica en servidor que la sesión es de un admin activo (§16.1: las rutas
 * admin verifican rol en servidor, no solo en frontend). El acceso a datos
 * ajenos que sigue a este guard usa la secret key y SIEMPRE deja auditoría.
 */
export async function requerirAdmin() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, account_status, nombre, email")
    .eq("id", user.id)
    .single();

  if (perfil?.role !== "admin" || perfil.account_status !== "activo") {
    redirect("/");
  }

  return { user, perfil };
}
