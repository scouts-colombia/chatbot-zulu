import Link from "next/link";
import { Suspense } from "react";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export default function PaginaConversacionesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}
    >
      <ListaConversaciones searchParams={searchParams} />
    </Suspense>
  );
}

// Ventana corta para no duplicar el evento de listado en recargas seguidas
// de la misma sesión de revisión; cada sesión nueva vuelve a quedar auditada.
const VENTANA_LISTADO_MINUTOS = 5;
const TAMANO_PAGINA = 50;

async function ListaConversaciones({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { user } = await requerirAdmin();
  const admin = crearClienteAdmin();

  const parametros = await searchParams;
  const pagina = Math.max(
    1,
    Number.parseInt(parametros.pagina ?? "1", 10) || 1
  );

  // El listado también queda auditado (acción list_user_conversations, §8.8).
  // Sin auditoría confirmada no hay listado (fail-closed, como el detalle).
  const desde = new Date(
    Date.now() - VENTANA_LISTADO_MINUTOS * 60_000
  ).toISOString();
  const { data: listadoReciente, error: errorConsulta } = await admin
    .from("admin_audit_events")
    .select("id")
    .eq("admin_user_id", user.id)
    .eq("action", "list_user_conversations")
    .gte("created_at", desde)
    .limit(1)
    .maybeSingle();

  if (errorConsulta) {
    return <ErrorAuditoria />;
  }

  if (!listadoReciente) {
    const { error: errorAuditoria } = await admin
      .from("admin_audit_events")
      .insert({
        admin_user_id: user.id,
        action: "list_user_conversations",
        target_type: "conversation_list",
        reason: "Listado desde el panel admin",
      });
    if (errorAuditoria) {
      return <ErrorAuditoria />;
    }
  }

  const inicio = (pagina - 1) * TAMANO_PAGINA;
  const { data: conversaciones, count } = await admin
    .from("conversations")
    .select(
      "id, title, archived, created_at, updated_at, profiles(nombre, email)",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA - 1);

  if (!conversaciones || conversaciones.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {pagina > 1
          ? "No hay más conversaciones en esta página."
          : "No hay conversaciones todavía."}
      </p>
    );
  }

  const total = count ?? conversaciones.length;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {conversaciones.map((conversacion) => {
          const dueno = conversacion.profiles as unknown as {
            nombre: string | null;
            email: string;
          } | null;
          return (
            <li
              className="flex items-center gap-3 rounded-lg border px-3 py-2"
              key={conversacion.id}
            >
              <div className="min-w-0 flex-1">
                <Link
                  className="block truncate text-sm hover:underline"
                  href={`/admin/conversaciones/${conversacion.id}`}
                  prefetch={false}
                >
                  {conversacion.title}
                </Link>
                <p className="truncate text-muted-foreground text-xs">
                  {dueno?.nombre ?? dueno?.email ?? "—"}
                  {conversacion.archived && " · archivada"}
                </p>
              </div>
              <time className="shrink-0 text-muted-foreground text-xs">
                {new Date(conversacion.updated_at as string).toLocaleDateString(
                  "es-CO"
                )}
              </time>
            </li>
          );
        })}
      </ul>

      {totalPaginas > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {pagina > 1 ? (
            <Link
              className="hover:underline"
              href={`/admin/conversaciones?pagina=${pagina - 1}`}
              prefetch={false}
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-xs">
            Página {pagina} de {totalPaginas} · {total} conversaciones
          </span>
          {pagina < totalPaginas ? (
            <Link
              className="hover:underline"
              href={`/admin/conversaciones?pagina=${pagina + 1}`}
              prefetch={false}
            >
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function ErrorAuditoria() {
  return (
    <p className="text-destructive text-sm" role="alert">
      No se pudo registrar la auditoría del listado, así que las conversaciones
      no se muestran. Intenta de nuevo.
    </p>
  );
}
