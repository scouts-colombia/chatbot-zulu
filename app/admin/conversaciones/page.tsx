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
  // La página entra en la clave de deduplicación porque cada una entrega 50
  // títulos distintos, y el título deriva del primer mensaje del Scout: pasar
  // a la página siguiente es acceso a contenido nuevo, no una recarga.
  const desde = new Date(
    Date.now() - VENTANA_LISTADO_MINUTOS * 60_000
  ).toISOString();
  const motivo = `Listado desde el panel admin · página ${pagina}`;
  const { data: listadoReciente, error: errorConsulta } = await admin
    .from("admin_audit_events")
    .select("id")
    .eq("admin_user_id", user.id)
    .eq("action", "list_user_conversations")
    .eq("reason", motivo)
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
        reason: motivo,
      });
    if (errorAuditoria) {
      return <ErrorAuditoria />;
    }
  }

  const inicio = (pagina - 1) * TAMANO_PAGINA;
  const {
    data: conversaciones,
    count,
    error: errorConversaciones,
  } = await admin
    .from("conversations")
    .select(
      "id, title, archived, created_at, updated_at, profiles(nombre, email)",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA - 1);

  // Un fallo de la consulta no se presenta como "no hay conversaciones": esta
  // es la vista de supervisión, y confundir una caída con vacío deja al admin
  // creyendo que no hay nada que revisar.
  if (errorConversaciones) {
    return (
      <p className="text-destructive text-sm" role="alert">
        No se pudieron cargar las conversaciones. Intenta de nuevo.
      </p>
    );
  }

  if (!conversaciones || conversaciones.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {pagina > 1
          ? "No hay más conversaciones en esta página."
          : "No hay conversaciones todavía."}
      </p>
    );
  }

  // Si el conteo no viene, no fingimos un total (caería a 1 página y ocultaría
  // la navegación, dando a entender que no hay más): se ofrece "Siguiente"
  // mientras la página venga llena.
  const totalPaginas =
    count == null ? null : Math.max(1, Math.ceil(count / TAMANO_PAGINA));
  const hayAnterior = pagina > 1;
  const haySiguiente =
    totalPaginas === null
      ? conversaciones.length === TAMANO_PAGINA
      : pagina < totalPaginas;

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
                {/* <a>, no <Link>: ver la invariante en app/admin/layout.tsx. */}
                <a
                  className="block truncate text-sm hover:underline"
                  href={`/admin/conversaciones/${conversacion.id}`}
                >
                  {conversacion.title}
                </a>
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

      {(hayAnterior || haySiguiente) && (
        <nav className="flex items-center justify-between text-sm">
          {hayAnterior ? (
            <a
              className="hover:underline"
              href={`/admin/conversaciones?pagina=${pagina - 1}`}
            >
              ← Anterior
            </a>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-xs">
            {totalPaginas === null
              ? `Página ${pagina} · total desconocido`
              : `Página ${pagina} de ${totalPaginas} · ${count} conversaciones`}
          </span>
          {haySiguiente ? (
            <a
              className="hover:underline"
              href={`/admin/conversaciones?pagina=${pagina + 1}`}
            >
              Siguiente →
            </a>
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
