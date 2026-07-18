import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { requerirAdmin } from "@/lib/admin/guard";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { cambiarEstadoDocumento } from "../acciones";

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
    .select("id, display_name, version, active, indexed_at, last_index_error")
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
            <form action={cambiarEstadoDocumento}>
              <input name="id" type="hidden" value={documento.id} />
              <input
                name="activar"
                type="hidden"
                value={String(!documento.active)}
              />
              <Button size="sm" type="submit" variant="outline">
                {documento.active ? "Desactivar" : "Activar"}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
