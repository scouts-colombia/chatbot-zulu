import { Suspense } from "react";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { FormularioEstado } from "./formulario-estado";

// Paginado y no un tope fijo: con un `.limit()` a secas, pasar de ese número
// deja los perfiles más antiguos inalcanzables desde el panel y sin señal de
// que se recortó la lista, así que un admin no podría bloquear una cuenta que
// no ve.
const TAMANO_PAGINA = 50;

export default function PaginaUsuariosAdmin({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}
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
  const pagina = Math.max(1, Number.parseInt(paginaParam ?? "1", 10) || 1);
  const inicio = (pagina - 1) * TAMANO_PAGINA;

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
    .range(inicio, inicio + TAMANO_PAGINA - 1);

  // Un fallo de la consulta dejaría la lista vacía como si no hubiera usuarios.
  if (errorPerfiles) {
    return (
      <p className="text-destructive text-sm" role="alert">
        No se pudieron cargar los usuarios. Intenta de nuevo.
      </p>
    );
  }

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

      <Paginacion
        cantidadEnPagina={(perfiles ?? []).length}
        pagina={pagina}
        total={count}
      />
    </div>
  );
}

/**
 * Si no viene `count` no se finge un total: se ofrece "Siguiente" mientras la
 * página venga llena, en vez de ocultar la navegación y dar a entender que no
 * hay más perfiles.
 */
function Paginacion({
  pagina,
  total,
  cantidadEnPagina,
}: {
  pagina: number;
  total: number | null;
  cantidadEnPagina: number;
}) {
  const totalPaginas =
    total == null ? null : Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const haySiguiente =
    totalPaginas === null
      ? cantidadEnPagina === TAMANO_PAGINA
      : pagina < totalPaginas;
  const hayAnterior = pagina > 1;

  if (!(hayAnterior || haySiguiente)) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between text-sm">
      {hayAnterior ? (
        <a
          className="hover:underline"
          href={`/admin/usuarios?pagina=${pagina - 1}`}
        >
          ← Anterior
        </a>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground text-xs">
        {totalPaginas === null
          ? `Página ${pagina}`
          : `Página ${pagina} de ${totalPaginas} · ${total} usuarios`}
      </span>
      {haySiguiente ? (
        <a
          className="hover:underline"
          href={`/admin/usuarios?pagina=${pagina + 1}`}
        >
          Siguiente →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
