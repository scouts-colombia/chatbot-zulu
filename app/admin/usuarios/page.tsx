import { Users } from "lucide-react";
import { Suspense } from "react";
import {
  leerPagina,
  Paginacion,
  rangoDePagina,
} from "@/components/navegacion/paginacion";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { FormularioEstado } from "./formulario-estado";

export default function PaginaUsuariosAdmin({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-scouts-purple/65">Cargando usuarios...</p>
      }
    >
      <ListaUsuarios searchParams={searchParams} />
    </Suspense>
  );
}

async function ListaUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { user } = await requerirAdmin();
  const admin = crearClienteAdmin();

  const { pagina: paginaParam } = await searchParams;
  const pagina = leerPagina(paginaParam);
  const [desde, hasta] = rangoDePagina(pagina);

  const {
    data: perfiles,
    count,
    error: errorPerfiles,
  } = await admin
    .from("profiles")
    .select("id, nombre, email, role, account_status, created_at", {
      count: "exact",
    })
    .eq("is_guest", false)
    .order("created_at", { ascending: false })
    .range(desde, hasta);

  // Un fallo de la consulta dejaría la lista vacía como si no hubiera usuarios.
  if (errorPerfiles) {
    return (
      <p
        className="rounded-2xl bg-scouts-red/8 p-4 text-scouts-red text-sm"
        role="alert"
      >
        No se pudieron cargar los usuarios. Intenta de nuevo.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="brand-kicker">Acceso</span>
          <h2 className="mt-3 font-semibold text-2xl text-scouts-purple">
            Usuarios
          </h2>
          <p className="mt-1 text-foreground/70 text-sm">
            Gestiona el estado de las cuentas registradas.
          </p>
        </div>
        <Users
          aria-hidden="true"
          className="hidden size-7 text-scouts-red sm:block"
        />
      </header>
      <p className="rounded-2xl border border-scouts-orange/15 bg-scouts-orange/6 p-4 text-foreground/65 text-sm">
        El cambio de estado queda auditado con tu usuario y el motivo. El rol no
        se gestiona desde aquí (se asigna por procedimiento controlado).
      </p>
      <ul className="space-y-2">
        {(perfiles ?? []).map((perfil) => (
          <li
            className="brand-list-item space-y-3 rounded-2xl px-3 py-3 sm:px-4"
            key={perfil.id}
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm text-scouts-purple">
                  {perfil.nombre ?? "—"}
                  {perfil.role === "admin" && (
                    <span className="ml-2 rounded-full bg-scouts-yellow px-2 py-0.5 text-scouts-purple text-xs">
                      admin
                    </span>
                  )}
                </p>
                <p className="truncate text-foreground/70 text-xs">
                  {perfil.email}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-scouts-purple/8 px-2.5 py-1 text-scouts-purple/70 text-xs">
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

      <Paginacion
        cantidadEnPagina={(perfiles ?? []).length}
        enlaceDeDocumento
        etiquetas={{ anterior: "← Anterior", siguiente: "Siguiente →" }}
        etiquetaTotal="usuarios"
        href={(destino) => `/admin/usuarios?pagina=${destino}`}
        pagina={pagina}
        total={count}
      />
    </div>
  );
}
