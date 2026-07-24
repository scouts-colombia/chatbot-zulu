import { notFound } from "next/navigation";
import { Suspense } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requerirAdmin } from "@/lib/admin/guard";
import { ETIQUETAS_ESTADO } from "@/lib/chat/contrato";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Mensajes por página. PostgREST corta la respuesta en `db-max-rows` (1000 por
 * defecto en Supabase) SIN error, así que una consulta sin acotar se leería
 * como transcripción completa: con la cuota de 30 turnos/día un solo hilo cruza
 * ese tope en ~17 días. Se pagina para que nada quede truncado en silencio.
 * El tamaño es chico a propósito: las citas se piden por los mensajes de esta
 * página (una fila por chunk de grounding, ~5-10 por respuesta), así que 100
 * mensajes mantienen esa consulta lejos del mismo tope.
 */
const TAMANO_PAGINA_MENSAJES = 100;

export default function PaginaConversacionAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}
    >
      <DetalleConversacion params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DetalleConversacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { id } = await params;
  const { pagina: paginaParam } = await searchParams;
  // Página 1 = el tramo más reciente, que es el que importa en una revisión.
  const pagina = Math.max(1, Number.parseInt(paginaParam ?? "1", 10) || 1);
  const { user } = await requerirAdmin();
  const admin = crearClienteAdmin();

  const { data: conversacion, error: errorConversacion } = await admin
    .from("conversations")
    .select("id, title, archived, profiles(nombre, email)")
    .eq("id", id)
    .maybeSingle();

  // Un fallo de la consulta no es lo mismo que "no existe": no lo disfrazamos
  // de 404, porque el admin necesita distinguir un id inválido de una caída.
  // `maybeSingle` deja el "no hay fila" como data null sin error.
  if (errorConversacion) {
    return (
      <div className="space-y-6">
        <Volver />
        <Aviso>No se pudo cargar la conversación. Intenta de nuevo.</Aviso>
      </div>
    );
  }

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
        <Volver />
        <Aviso>
          No se pudo registrar el acceso, así que la conversación no se muestra.
          Intenta de nuevo.
        </Aviso>
      </div>
    );
  }

  // Se piden los más recientes primero para que la página 1 sea el tramo final
  // de la conversación; se invierten al renderizar para leerlos en orden.
  const inicio = (pagina - 1) * TAMANO_PAGINA_MENSAJES;
  const {
    data: mensajesDesc,
    count: totalMensajes,
    error: errorMensajes,
  } = await admin
    .from("messages")
    // `response_json` solo para leer el estado: la etiqueta que vio el Scout
    // (sin_fuente, bloqueado_por_seguridad...) es parte de lo que el revisor
    // necesita ver. Las citas NO salen de aquí, salen de `citations` (D-12).
    .select("id, sender, content, created_at, response_json", {
      count: "exact",
    })
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA_MENSAJES - 1);
  const mensajes = [...(mensajesDesc ?? [])].reverse();

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
        <Aviso>
          No se pudieron cargar los mensajes de la conversación. Intenta de
          nuevo.
        </Aviso>
      </div>
    );
  }

  // Las citas viven solo en `citations` (D-12) y las preguntas guiadas en
  // sus propias tablas: se componen aparte, igual que en el chat, para que
  // el admin vea la transcripción completa que vio el Scout.
  const idsAsistente = mensajes
    .filter((mensaje) => mensaje.sender === "asistente")
    .map((mensaje) => mensaje.id);
  const [
    { data: citas, count: totalCitas, error: errorCitas },
    { data: preguntas, count: totalPreguntas, error: errorPreguntas },
  ] = await Promise.all([
    idsAsistente.length > 0
      ? admin
          .from("citations")
          .select("id, message_id, document_title_snapshot, page_number", {
            count: "exact",
          })
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[], count: 0, error: null }),
    idsAsistente.length > 0
      ? admin
          .from("guided_questions")
          .select(
            "id, message_id, text, guided_question_options(id, label, order_index)",
            { count: "exact" }
          )
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[], count: 0, error: null }),
  ]);

  // `count` frente a las filas recibidas delata el corte por `db-max-rows`, que
  // llega sin error: sin esta comparación, una respuesta fundamentada se
  // pintaría sin sus chips y el revisor la contaría como respondida sin citas.
  const adjuntosTruncados =
    (totalCitas ?? 0) > (citas ?? []).length ||
    (totalPreguntas ?? 0) > (preguntas ?? []).length;

  // Citas y preguntas guiadas son parte de la transcripción que vio el Scout:
  // si su consulta falla o viene cortada, mostrarla sin ellas presentaría una
  // revisión incompleta como si fuera íntegra.
  if (errorCitas || errorPreguntas || adjuntosTruncados) {
    return (
      <div className="space-y-6">
        <Encabezado
          archivada={Boolean(conversacion.archived)}
          dueno={dueno}
          titulo={conversacion.title as string}
        />
        <Aviso>
          No se pudieron cargar las citas o las preguntas guiadas, así que la
          transcripción no se muestra: estaría incompleta. Intenta de nuevo.
        </Aviso>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Encabezado
        archivada={Boolean(conversacion.archived)}
        dueno={dueno}
        titulo={conversacion.title as string}
      />

      <PaginacionMensajes
        conversacionId={id}
        pagina={pagina}
        total={totalMensajes}
      />

      <div className="space-y-4">
        {mensajes.map((mensaje) => {
          const citasMensaje = (citas ?? []).filter(
            (cita) => cita.message_id === mensaje.id
          );
          const preguntaMensaje = (preguntas ?? []).find(
            (pregunta) => pregunta.message_id === mensaje.id
          );
          // Misma etiqueta que vio el Scout; `respondido` no lleva ninguna.
          const estado = (mensaje.response_json as { estado?: string } | null)
            ?.estado;
          const etiquetaEstado = estado ? ETIQUETAS_ESTADO[estado] : null;
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
                {etiquetaEstado && (
                  <span className="mb-1 inline-block rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                    {etiquetaEstado}
                  </span>
                )}
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

/**
 * Página 1 es el tramo más reciente, así que "más antiguos" avanza el número.
 * Si no viene `count` no se finge un total: se ofrece seguir hacia atrás
 * mientras la página venga llena, en vez de dar a entender que no hay más.
 */
function PaginacionMensajes({
  conversacionId,
  pagina,
  total,
}: {
  conversacionId: string;
  pagina: number;
  total: number | null;
}) {
  const totalPaginas =
    total == null
      ? null
      : Math.max(1, Math.ceil(total / TAMANO_PAGINA_MENSAJES));
  const hayMasAntiguos = totalPaginas === null ? true : pagina < totalPaginas;
  const hayMasRecientes = pagina > 1;

  if (!(hayMasAntiguos || hayMasRecientes)) {
    return null;
  }

  const url = (n: number) =>
    `/admin/conversaciones/${conversacionId}?pagina=${n}`;

  return (
    <nav className="flex items-center justify-between text-sm">
      {hayMasAntiguos ? (
        <a className="hover:underline" href={url(pagina + 1)}>
          ← Más antiguos
        </a>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground text-xs">
        {totalPaginas === null
          ? `Tramo ${pagina}`
          : `Tramo ${pagina} de ${totalPaginas} · ${total} mensajes`}
      </span>
      {hayMasRecientes ? (
        <a className="hover:underline" href={url(pagina - 1)}>
          Más recientes →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}

function Volver() {
  // <a>, no <Link>: ver la invariante en app/admin/layout.tsx. Una navegación
  // SPA dejaría esta transcripción en la caché de cliente y Atrás la revelaría
  // sin auditar la reapertura.
  return (
    <a
      className="block text-muted-foreground text-sm hover:text-foreground"
      href="/admin/conversaciones"
    >
      ← Volver
    </a>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-destructive text-sm" role="alert">
      {children}
    </p>
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
      <Volver />
      <h2 className="mt-2 font-medium">{titulo}</h2>
      <p className="text-muted-foreground text-sm">
        {dueno?.nombre ?? "—"} · {dueno?.email ?? "—"}
        {archivada && " · archivada"}
      </p>
    </div>
  );
}
