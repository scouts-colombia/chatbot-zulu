import type { GenerateContentResponse } from "@google/genai";
import type { CitaNormalizada } from "./contrato";

/**
 * Forma real de retrievedContext observada en el spike (docs/notes/
 * spike-file-search-resultado.md). customMetadata es un ARREGLO de pares
 * { key, stringValue | numericValue }, nunca un objeto plano.
 */
type ContextoRecuperado = {
  title?: string;
  text?: string;
  pageNumber?: number;
  fileSearchStore?: string;
  documentName?: string;
  mediaId?: string;
  customMetadata?: {
    key?: string;
    stringValue?: string;
    numericValue?: number;
  }[];
};

function leerMetadata(contexto: ContextoRecuperado, clave: string) {
  return contexto.customMetadata?.find((m) => m.key === clave)?.stringValue;
}

export function normalizarCitas(response: GenerateContentResponse): {
  citas: CitaNormalizada[];
  faltaKnowledgeDocumentId: boolean;
} {
  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

  const citas: CitaNormalizada[] = [];
  let faltaKnowledgeDocumentId = false;

  for (const chunk of chunks) {
    const contexto = chunk.retrievedContext as ContextoRecuperado | undefined;
    if (!contexto) {
      continue;
    }

    const knowledgeDocumentId = leerMetadata(contexto, "knowledge_document_id");
    if (!knowledgeDocumentId) {
      // No inferir por título (D-07): se registra evento de calidad y la
      // cita queda sin id.
      faltaKnowledgeDocumentId = true;
    }

    citas.push({
      knowledgeDocumentId,
      documentTitleSnapshot: contexto.title ?? "Documento sin título",
      documentVersionSnapshot: leerMetadata(contexto, "document_version"),
      pageNumber: contexto.pageNumber,
      fragment: contexto.text?.slice(0, 1000),
      fileSearchStoreName: contexto.fileSearchStore,
      fileSearchDocumentName: contexto.documentName,
      mediaId: contexto.mediaId,
    });
  }

  return { citas, faltaKnowledgeDocumentId };
}
