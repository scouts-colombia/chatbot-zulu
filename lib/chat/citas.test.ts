import assert from "node:assert/strict";
import { test } from "node:test";
import type { GenerateContentResponse } from "@google/genai";
import { normalizarCitas } from "./citas";

type ChunkPrueba = {
  id?: string;
  titulo: string;
  pagina?: number;
  texto?: string;
};

function respuestaConGrounding(
  chunks: ChunkPrueba[],
  soportes?: number[][]
): GenerateContentResponse {
  return {
    candidates: [
      {
        groundingMetadata: {
          groundingChunks: chunks.map((chunk) => ({
            retrievedContext: {
              title: chunk.titulo,
              pageNumber: chunk.pagina,
              text: chunk.texto,
              customMetadata: chunk.id
                ? [{ key: "knowledge_document_id", stringValue: chunk.id }]
                : [],
            },
          })),
          ...(soportes === undefined
            ? {}
            : {
                groundingSupports: soportes.map((indices) => ({
                  groundingChunkIndices: indices,
                })),
              }),
        },
      },
    ],
  } as GenerateContentResponse;
}

test("conserva solo los chunks que respaldan afirmaciones de la respuesta", () => {
  const resultado = normalizarCitas(
    respuestaConGrounding(
      [
        { id: "doc-a", titulo: "Documento A", pagina: 1 },
        { id: "doc-b", titulo: "Documento B", pagina: 2 },
        { id: "doc-c", titulo: "Documento C", pagina: 3 },
      ],
      [[2], [1]]
    )
  );

  assert.deepEqual(
    resultado.citas.map((cita) => cita.knowledgeDocumentId),
    ["doc-b", "doc-c"]
  );
});

test("elimina duplicados exactos por documento y pagina", () => {
  const resultado = normalizarCitas(
    respuestaConGrounding(
      [
        { id: "doc-a", titulo: "Documento A", pagina: 4, texto: "Uno" },
        { id: "doc-a", titulo: "Documento A", pagina: 4, texto: "Dos" },
        { id: "doc-a", titulo: "Documento A", pagina: 5, texto: "Tres" },
      ],
      [[0, 1, 2], [1]]
    )
  );

  assert.deepEqual(
    resultado.citas.map((cita) => [cita.pageNumber, cita.fragment]),
    [
      [4, "Uno"],
      [5, "Tres"],
    ]
  );
});

test("usa todos los chunks cuando Gemini omite groundingSupports", () => {
  const resultado = normalizarCitas(
    respuestaConGrounding([
      { id: "doc-a", titulo: "Documento A", pagina: 1 },
      { id: "doc-b", titulo: "Documento B", pagina: 2 },
    ])
  );

  assert.equal(resultado.citas.length, 2);
});

test("usa todos los chunks cuando los soportes no traen indices validos", () => {
  const resultado = normalizarCitas(
    respuestaConGrounding(
      [
        { id: "doc-a", titulo: "Documento A", pagina: 1 },
        { titulo: "Documento sin id", pagina: 2 },
      ],
      [[], [-1, 99]]
    )
  );

  assert.equal(resultado.citas.length, 2);
  assert.equal(resultado.faltaKnowledgeDocumentId, true);
});

test("no evalua metadata faltante de chunks que no respaldan la respuesta", () => {
  const resultado = normalizarCitas(
    respuestaConGrounding(
      [
        { titulo: "Documento sin id", pagina: 1 },
        { id: "doc-b", titulo: "Documento B", pagina: 2 },
      ],
      [[1]]
    )
  );

  assert.equal(resultado.citas.length, 1);
  assert.equal(resultado.faltaKnowledgeDocumentId, false);
});
