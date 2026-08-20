import { MessagesSquare } from "lucide-react";
import { Suspense } from "react";
import {
  leerPagina,
  Paginacion,
  rangoDePagina,
} from "@/components/navegacion/paginacion";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export default function PaginaConversacionesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-scouts-purple/65">
          Cargando conversaciones...
        </p>
      }
    >
      <ListaConversaciones searchParams={searchParams} />
    </Suspense>
  );
}

async function ListaConversaciones({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { user } = await requerirAdmin();
  const admin = crearClienteAdmin();

  const parametros = await searchParams;
  const pagina = leerPagina(parametros.pagina);

  // Cada carga del listado deja su fila (acción list_user_conversations, §8.8):
  // los títulos derivan del primer mensaje del Scout, así que esto es acceso a
  // contenido y P-RF-17 pide auditarlo sin excepciones. Antes se deduplicaba en
  // una ventana de 5 minutos para no repetir filas en recargas seguidas, pero
  // esa clave no distinguía sesiones: un segundo navegador del mismo admin no
  // dejaba rastro. Una fila por carga es más ruidosa y no promete de menos.
  // Sin auditoría confirmada no hay listado (fail-closed, como el detalle).
  const { error: errorAuditoria } = await admin
    .from("admin_audit_events")
    .insert({
      admin_user_id: user.id,
      action: "list_user_conversations",
      target_type: "conversation_list",
      reason: `Listado desde el panel admin · página ${pagina}`,
    });

  if (errorAuditoria) {
    return <ErrorAuditoria />;
  }

  const [desde, hasta] = rangoDePagina(pagina);
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
    .range(desde, hasta);

  // Un fallo de la consulta no se presenta como "no hay conversaciones": esta
  // es la vista de supervisión, y confundir una caída con vacío deja al admin
  // creyendo que no hay nada que revisar.
  if (errorConversaciones) {
    return (
      <p
        className="rounded-2xl bg-scouts-red/8 p-4 text-scouts-red text-sm"
        role="alert"
      >
        No se pudieron cargar las conversaciones. Intenta de nuevo.
      </p>
    );
  }

  if (!conversaciones || conversaciones.length === 0) {
    return (
      <p className="rounded-2xl bg-scouts-purple/5 p-5 text-foreground/70 text-sm">
        {pagina > 1
          ? "No hay más conversaciones en esta página."
          : "No hay conversaciones todavía."}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="brand-kicker">Supervisión</span>
          <h2 className="mt-3 font-semibold text-2xl text-scouts-purple">
            Conversaciones
          </h2>
          <p className="mt-1 text-foreground/70 text-sm">
            Revisa el historial visible para los Scouts.
          </p>
        </div>
        <MessagesSquare
          aria-hidden="true"
          className="hidden size-7 text-scouts-orange sm:block"
        />
      </header>
      <ul className="space-y-2">
        {conversaciones.map((conversacion) => {
          const dueno = conversacion.profiles as unknown as {
            nombre: string | null;
            email: string;
          } | null;
          return (
            <li
              className="brand-list-item flex items-center gap-3 rounded-2xl px-3 py-3 sm:px-4"
              key={conversacion.id}
            >
              <div className="min-w-0 flex-1">
                {/* <a>, no <Link>: ver la invariante en app/admin/layout.tsx. */}
                <a
                  className="focus-ring-card block truncate rounded-md font-medium text-sm text-scouts-purple hover:underline"
                  href={`/admin/conversaciones/${conversacion.id}`}
                >
                  {conversacion.title}
                </a>
                <p className="truncate text-foreground/70 text-xs">
                  {dueno?.nombre ?? dueno?.email ?? "—"}
                  {conversacion.archived && " · archivada"}
                </p>
              </div>
              <time className="shrink-0 text-foreground/70 text-xs">
                {new Date(conversacion.updated_at as string).toLocaleDateString(
                  "es-CO"
                )}
              </time>
            </li>
          );
        })}
      </ul>

      <Paginacion
        cantidadEnPagina={conversaciones.length}
        enlaceDeDocumento
        etiquetas={{ anterior: "← Anterior", siguiente: "Siguiente →" }}
        etiquetaTotal="conversaciones"
        href={(destino) => `/admin/conversaciones?pagina=${destino}`}
        pagina={pagina}
        total={count}
      />
    </div>
  );
}

function ErrorAuditoria() {
  return (
    <p
      className="rounded-2xl bg-scouts-red/8 p-4 text-scouts-red text-sm"
      role="alert"
    >
      No se pudo registrar la auditoría del listado, así que las conversaciones
      no se muestran. Intenta de nuevo.
    </p>
  );
}
