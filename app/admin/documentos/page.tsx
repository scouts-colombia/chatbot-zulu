import { Suspense } from "react";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { FormularioDocumento } from "./formulario-documento";

export default function PaginaDocumentosAdmin() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}
    >
      <ListaDocumentos />
    </Suspense>
  );
}

async function ListaDocumentos() {
  await requerirAdmin();
  const admin = crearClienteAdmin();

  const { data: documentos } = await admin
    .from("knowledge_documents")
    .select(
      "id, display_name, version, active, indexed_at, metadata_synced_at, last_index_error"
    )
    .order("display_name");

  if (!documentos || documentos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay documentos indexados. Corre scripts/index-knowledge-documents.ts.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Un documento desactivado deja de fundamentar respuestas de inmediato
        (queda fuera del filtro de recuperación). Las citas históricas conservan
        su snapshot.
      </p>
      <ul className="space-y-2">
        {documentos.map((documento) => (
          <li
            className="flex items-center gap-3 rounded-lg border px-3 py-2"
            key={documento.id}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{documento.display_name}</p>
              <p className="text-muted-foreground text-xs">
                v{documento.version}
                {documento.indexed_at &&
                  ` · indexado ${new Date(documento.indexed_at as string).toLocaleDateString("es-CO")}`}
                {documento.last_index_error && " · con error de indexación"}
              </p>
            </div>
            <span
              className={
                documento.active
                  ? "rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs"
                  : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
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
