import { FileText } from "lucide-react";
import { Suspense } from "react";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { FormularioDocumento } from "./formulario-documento";

export default function PaginaDocumentosAdmin() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-scouts-purple/65">Cargando documentos...</p>
      }
    >
      <ListaDocumentos />
    </Suspense>
  );
}

async function ListaDocumentos() {
  await requerirAdmin();
  const admin = crearClienteAdmin();

  const { data: documentos, error: errorDocumentos } = await admin
    .from("knowledge_documents")
    .select(
      "id, display_name, version, active, indexed_at, metadata_synced_at, last_index_error"
    )
    .order("display_name");

  // Un fallo de la consulta no se presenta como "no hay documentos": ese texto
  // sugiere correr el script de indexación, una acción con efectos sobre File
  // Search que nadie debería ejecutar por un error transitorio.
  if (errorDocumentos) {
    return (
      <p
        className="rounded-2xl bg-scouts-red/8 p-4 text-scouts-red text-sm"
        role="alert"
      >
        No se pudieron cargar los documentos. Intenta de nuevo.
      </p>
    );
  }

  if (!documentos || documentos.length === 0) {
    return (
      <p className="rounded-2xl bg-scouts-purple/5 p-5 text-foreground/70 text-sm">
        No hay documentos indexados. Corre scripts/index-knowledge-documents.ts.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="brand-kicker">Conocimiento</span>
          <h2 className="mt-3 font-semibold text-2xl text-scouts-purple">
            Documentos
          </h2>
          <p className="mt-1 text-foreground/70 text-sm">
            Controla qué fuentes pueden fundamentar las respuestas.
          </p>
        </div>
        <FileText
          aria-hidden="true"
          className="hidden size-7 text-scouts-blue sm:block"
        />
      </header>
      <p className="rounded-2xl border border-scouts-blue/10 bg-scouts-blue/5 p-4 text-foreground/65 text-sm">
        Un documento desactivado deja de fundamentar respuestas de inmediato
        (queda fuera del filtro de recuperación). Las citas históricas conservan
        su snapshot.
      </p>
      <ul className="space-y-2">
        {documentos.map((documento) => (
          <li
            className="brand-list-item flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 sm:flex-nowrap sm:px-4"
            key={documento.id}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm text-scouts-purple">
                {documento.display_name}
              </p>
              <p className="text-foreground/70 text-xs">
                v{documento.version}
                {documento.indexed_at &&
                  ` · indexado ${new Date(documento.indexed_at as string).toLocaleDateString("es-CO")}`}
                {documento.last_index_error && " · con error de indexación"}
              </p>
            </div>
            <span
              className={
                documento.active
                  ? "rounded-full bg-scouts-yellow px-2.5 py-1 font-medium text-scouts-purple text-xs"
                  : "rounded-full bg-scouts-purple/8 px-2.5 py-1 text-scouts-purple/65 text-xs"
              }
            >
              {documento.active ? "Activo" : "Inactivo"}
            </span>
            <FormularioDocumento
              activo={Boolean(documento.active)}
              id={documento.id as string}
              listoParaActivar={
                Boolean(documento.metadata_synced_at) &&
                !documento.last_index_error
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
