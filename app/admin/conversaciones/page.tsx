import Link from "next/link";
import { Suspense } from "react";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export default function PaginaConversacionesAdmin() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}
    >
      <ListaConversaciones />
    </Suspense>
  );
}

async function ListaConversaciones() {
  const { user } = await requerirAdmin();
  const admin = crearClienteAdmin();

  // El listado también queda auditado (acción list_user_conversations, §8.8).
  await admin.from("admin_audit_events").insert({
    admin_user_id: user.id,
    action: "list_user_conversations",
    target_type: "conversation_list",
    reason: "Listado desde el panel admin",
  });

  const { data: conversaciones } = await admin
    .from("conversations")
    .select("id, title, archived, updated_at, profiles(nombre, email)")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!conversaciones || conversaciones.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay conversaciones todavía.
      </p>
    );
  }

  return (
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
  );
}
