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
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const chunks = groundingMetadata?.groundingChunks ?? [];
  const supports = groundingMetadata?.groundingSupports;
  const indicesRespaldados = new Set(
    (supports ?? [])
      .flatMap((support) => support.groundingChunkIndices ?? [])
      .filter(
        (index) =>
          Number.isInteger(index) && index >= 0 && index < chunks.length
      )
  );

  // File Search puede omitir groundingSupports. Solo en ese caso conservamos
  // el comportamiento anterior. Si Gemini envia el campo pero no asocia
  // chunks validos, respetamos que la respuesta no tiene citas respaldadas.
  const chunksRespaldados =
    supports === undefined
      ? chunks
      : chunks.filter((_, index) => indicesRespaldados.has(index));

  const citas: CitaNormalizada[] = [];
  const citasVistas = new Set<string>();
  let faltaKnowledgeDocumentId = false;

  for (const chunk of chunksRespaldados) {
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

    if (knowledgeDocumentId) {
      const claveCita = `${knowledgeDocumentId}\u0000${contexto.pageNumber ?? "sin-pagina"}`;
      if (citasVistas.has(claveCita)) {
        continue;
      }
      citasVistas.add(claveCita);
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
