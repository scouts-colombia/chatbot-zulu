import { Suspense } from "react";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { FormularioEstado } from "./formulario-estado";

export default function PaginaUsuariosAdmin() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}
    >
      <ListaUsuarios />
    </Suspense>
  );
}

async function ListaUsuarios() {
  const { user } = await requerirAdmin();
  const admin = crearClienteAdmin();

  const { data: perfiles } = await admin
    .from("profiles")
    .select("id, nombre, email, role, account_status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        El cambio de estado queda auditado con tu usuario y el motivo. El rol no
        se gestiona desde aquí (se asigna por procedimiento controlado).
      </p>
      <ul className="space-y-2">
        {(perfiles ?? []).map((perfil) => (
          <li className="space-y-2 rounded-lg border px-3 py-2" key={perfil.id}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {perfil.nombre ?? "—"}
                  {perfil.role === "admin" && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs">
                      admin
                    </span>
                  )}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {perfil.email}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                {perfil.account_status}
              </span>
            </div>
            {perfil.id !== user.id && (
              <FormularioEstado
                estadoActual={perfil.account_status as string}
                userId={perfil.id as string}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
