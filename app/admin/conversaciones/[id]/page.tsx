import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { FormularioMotivo } from "./formulario-motivo";

// Ventana de acceso: un motivo registrado cubre los reingresos de la misma
// sesión de revisión. Pasada la ventana, el acceso exige motivo nuevo.
const VENTANA_ACCESO_MINUTOS = 30;

export default function PaginaConversacionAdmin({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}
    >
      <DetalleConversacion params={params} />
    </Suspense>
  );
}

async function DetalleConversacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requerirAdmin();
  const admin = crearClienteAdmin();

  const { data: conversacion } = await admin
    .from("conversations")
    .select("id, title, archived, profiles(nombre, email)")
    .eq("id", id)
    .single();

  if (!conversacion) {
    notFound();
  }

  // Sin motivo registrado (reciente) no hay acceso al contenido (P-RF-16).
  const desde = new Date(
    Date.now() - VENTANA_ACCESO_MINUTOS * 60_000
  ).toISOString();
  const { data: acceso } = await admin
    .from("admin_audit_events")
    .select("id, reason, created_at")
    .eq("admin_user_id", user.id)
    .eq("action", "view_user_conversation")
    .eq("target_id", id)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dueno = conversacion.profiles as unknown as {
    nombre: string | null;
    email: string;
  } | null;

  if (!acceso) {
    return (
      <div className="space-y-6">
        <Encabezado
          archivada={Boolean(conversacion.archived)}
          dueno={dueno}
          titulo={conversacion.title as string}
        />
        <FormularioMotivo conversationId={id} />
      </div>
    );
  }

  const { data: mensajes } = await admin
    .from("messages")
    .select("id, sender, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <Encabezado
        archivada={Boolean(conversacion.archived)}
        dueno={dueno}
        titulo={conversacion.title as string}
      />
      <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-xs">
        Acceso auditado: {acceso.reason} ·{" "}
        {new Date(acceso.created_at as string).toLocaleString("es-CO")}
      </p>

      <div className="space-y-4">
        {(mensajes ?? []).map((mensaje) => (
          <div
            className={
              mensaje.sender === "usuario"
                ? "flex justify-end"
                : "flex justify-start"
            }
            key={mensaje.id}
          >
            <div className="max-w-[85%] rounded-2xl border bg-card px-4 py-2.5 text-sm">
              <p className="mb-1 text-muted-foreground text-xs">
                {mensaje.sender} ·{" "}
                {new Date(mensaje.created_at as string).toLocaleString("es-CO")}
              </p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {mensaje.content}
                </Markdown>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Encabezado({
  titulo,
  dueno,
  archivada,
}: {
  titulo: string;
  dueno: { nombre: string | null; email: string } | null;
  archivada: boolean;
}) {
  return (
    <div>
      <Link
        className="text-muted-foreground text-sm hover:text-foreground"
        href="/admin/conversaciones"
      >
        ← Volver
      </Link>
      <h2 className="mt-2 font-medium">{titulo}</h2>
      <p className="text-muted-foreground text-sm">
        {dueno?.nombre ?? "—"} · {dueno?.email ?? "—"}
        {archivada && " · archivada"}
      </p>
    </div>
  );
}
