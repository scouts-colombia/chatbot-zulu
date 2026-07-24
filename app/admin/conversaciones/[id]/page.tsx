import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";

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

  const dueno = conversacion.profiles as unknown as {
    nombre: string | null;
    email: string;
  } | null;

  // Acceso directo con log silencioso (decisión 2026-07-17): el admin no
  // registra motivo ni ve fricción, pero cada apertura deja su fila de
  // auditoría. Sin registro confirmado no se muestra el contenido.
  const { error: errorAuditoria } = await admin
    .from("admin_audit_events")
    .insert({
      admin_user_id: user.id,
      action: "view_user_conversation",
      target_type: "conversation",
      target_id: id,
      reason: "Acceso directo desde el panel",
    });

  if (errorAuditoria) {
    // Fail-closed: sin auditoría confirmada no se muestra NADA de la
    // conversación, ni siquiera el título (derivado del primer mensaje del
    // usuario) o el dueño. Solo el aviso y el enlace de vuelta.
    return (
      <div className="space-y-6">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/admin/conversaciones"
          prefetch={false}
        >
          ← Volver
        </Link>
        <p className="text-destructive text-sm" role="alert">
          No se pudo registrar el acceso, así que la conversación no se muestra.
          Intenta de nuevo.
        </p>
      </div>
    );
  }

  const { data: mensajes, error: errorMensajes } = await admin
    .from("messages")
    .select("id, sender, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Un fallo de la consulta (error transitorio o de permisos) dejaría
  // `mensajes` en null y pintaría la conversación como vacía; el requisito es
  // mostrar el historial completo, así que mostramos el error, no una
  // transcripción falsamente vacía. Una conversación sin mensajes sí devuelve
  // un arreglo vacío sin error y se renderiza normal.
  if (errorMensajes) {
    return (
      <div className="space-y-6">
        <Encabezado
          archivada={Boolean(conversacion.archived)}
          dueno={dueno}
          titulo={conversacion.title as string}
        />
        <p className="text-destructive text-sm" role="alert">
          No se pudieron cargar los mensajes de la conversación. Intenta de
          nuevo.
        </p>
      </div>
    );
  }

  // Las citas viven solo en `citations` (D-12) y las preguntas guiadas en
  // sus propias tablas: se componen aparte, igual que en el chat, para que
  // el admin vea la transcripción completa que vio el Scout.
  const idsAsistente = (mensajes ?? [])
    .filter((mensaje) => mensaje.sender === "asistente")
    .map((mensaje) => mensaje.id);
  const [{ data: citas }, { data: preguntas }] = await Promise.all([
    idsAsistente.length > 0
      ? admin
          .from("citations")
          .select("id, message_id, document_title_snapshot, page_number")
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[] }),
    idsAsistente.length > 0
      ? admin
          .from("guided_questions")
          .select(
            "id, message_id, text, guided_question_options(id, label, order_index)"
          )
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return (
    <div className="space-y-6">
      <Encabezado
        archivada={Boolean(conversacion.archived)}
        dueno={dueno}
        titulo={conversacion.title as string}
      />

      <div className="space-y-4">
        {(mensajes ?? []).map((mensaje) => {
          const citasMensaje = (citas ?? []).filter(
            (cita) => cita.message_id === mensaje.id
          );
          const preguntaMensaje = (preguntas ?? []).find(
            (pregunta) => pregunta.message_id === mensaje.id
          );
          return (
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
                  {new Date(mensaje.created_at as string).toLocaleString(
                    "es-CO"
                  )}
                </p>
                {mensaje.sender === "usuario" ? (
                  // Texto plano, como en el chat: el contenido del usuario no
                  // se interpreta como Markdown (evita cargas externas al
                  // revisar, p. ej. imágenes hacia terceros).
                  <p className="whitespace-pre-wrap">{mensaje.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {/* Sin <img>: un mensaje del asistente influido por el
                    Scout podría incluir `![](url)` y filtrar la IP/actividad
                    del revisor al abrir la transcripción. */}
                    <Markdown
                      disallowedElements={["img"]}
                      remarkPlugins={[remarkGfm]}
                    >
                      {mensaje.content}
                    </Markdown>
                  </div>
                )}
                {preguntaMensaje && (
                  <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs">
                    <p className="font-medium">{preguntaMensaje.text}</p>
                    <ul className="mt-1 list-inside list-disc text-muted-foreground">
                      {[...(preguntaMensaje.guided_question_options ?? [])]
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((opcion) => (
                          <li key={opcion.id}>{opcion.label}</li>
                        ))}
                    </ul>
                  </div>
                )}
                {citasMensaje.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {citasMensaje.map((cita) => (
                      <span
                        className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
                        key={cita.id}
                      >
                        {cita.document_title_snapshot}
                        {cita.page_number != null && `, p. ${cita.page_number}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
        prefetch={false}
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
