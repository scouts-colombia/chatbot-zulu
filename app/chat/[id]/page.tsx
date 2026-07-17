import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Conversacion } from "@/components/chat/conversacion";
import type { MensajeUI } from "@/components/chat/tipos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Conversación" };

export default function PaginaConversacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      }
    >
      <ContenidoConversacion params={params} />
    </Suspense>
  );
}

async function ContenidoConversacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .single();
  if (perfil?.account_status !== "activo") {
    redirect("/");
  }

  // La RLS limita a conversaciones propias: ajena = no encontrada.
  const { data: conversacion } = await supabase
    .from("conversations")
    .select("id, title, archived")
    .eq("id", id)
    .single();
  if (!conversacion) {
    notFound();
  }

  const { data: filas } = await supabase
    .from("messages")
    .select("id, sender, content, response_json")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const mensajesBase = filas ?? [];
  const idsAsistente = mensajesBase
    .filter((m) => m.sender === "asistente")
    .map((m) => m.id);

  const [{ data: citas }, { data: preguntas }] = await Promise.all([
    idsAsistente.length > 0
      ? supabase
          .from("citations")
          .select("message_id, document_title_snapshot, page_number")
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[] }),
    idsAsistente.length > 0
      ? supabase
          .from("guided_questions")
          .select(
            "id, message_id, text, guided_question_options(label, order_index)"
          )
          .in("message_id", idsAsistente)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const mensajes: MensajeUI[] = mensajesBase.map((mensaje) => {
    const estado = (mensaje.response_json as { estado?: string } | null)
      ?.estado;
    const pregunta = (preguntas ?? []).find((p) => p.message_id === mensaje.id);
    return {
      id: mensaje.id,
      sender: mensaje.sender as MensajeUI["sender"],
      content: mensaje.content,
      estado: estado === "respondido" ? undefined : estado,
      citas: (citas ?? [])
        .filter((cita) => cita.message_id === mensaje.id)
        .map((cita) => ({
          titulo: cita.document_title_snapshot,
          pagina: cita.page_number,
        })),
      preguntaGuiada: pregunta
        ? {
            texto: pregunta.text,
            opciones: [...(pregunta.guided_question_options ?? [])]
              .sort((a, b) => a.order_index - b.order_index)
              .map((opcion) => opcion.label),
          }
        : undefined,
    };
  });

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Conversaciones
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-medium text-sm">
          {conversacion.title}
        </h1>
        {conversacion.archived && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
            Archivada
          </span>
        )}
      </header>
      <Conversacion
        conversationId={conversacion.id}
        mensajesIniciales={mensajes}
      />
    </div>
  );
}
