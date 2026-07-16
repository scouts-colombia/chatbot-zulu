# Resultado del gate de spikes — File Search (Fase 1)

**Fecha:** 2026-07-15
**Veredicto:** VERDE (7/7 criterios bloqueantes). La Fase 3 queda desbloqueada.
**Script:** `scripts/spike-file-search.ts` (repetible: `pnpm exec tsx scripts/spike-file-search.ts`)

## Configuración probada

| Elemento | Valor |
|---|---|
| SDK | `@google/genai` ^2.12.0 (JS/TS) |
| Modelo | `gemini-3.5-flash` |
| API | Gemini Developer API (`generativelanguage.googleapis.com`) |
| Documento | `data/pdfs/reglamento-red-de-jovenes.pdf` (275 KB) |
| Store | `fileSearchStores/spikescouts-fzvakiz2sajp` (displayName `spike-scouts`) |
| Tier | Funcionó sin billing confirmado en el proyecto GCP |

## Spike #1 — File Search + structured output + grounding en UNA llamada

Confirmado. `generateContent` con `tools: [{fileSearch}]` + `responseMimeType: "application/json"` + **`responseJsonSchema`** devolvió en la misma respuesta:

- `response.text` → JSON que parsea y valida contra el schema del piloto (zod). `estado = "respondido"`.
- `candidates[0].groundingMetadata` presente.
- `groundingChunks`: 3, todos con `retrievedContext`.
- `groundingSupports`: 5 (disponible para trazabilidad fina por segmento, P1).

Nota de SDK: el parámetro que funcionó en `@google/genai` es `config.responseJsonSchema` (JSON Schema estándar). No hizo falta `responseSchema` (formato OpenAPI) ni hubo conflicto tool+schema.

## Spike #2 — round-trip de `custom_metadata`

Confirmado. Indexado con:

```ts
customMetadata: [
  { key: "knowledge_document_id", stringValue: "11111111-1111-4111-8111-111111111111" },
  { key: "document_version", stringValue: "2026-prueba" },
]
```

Ambos pares volvieron intactos en `groundingChunks[*].retrievedContext.customMetadata`, como **arreglo** de `{ key, stringValue }`. El acceso correcto (ya documentado en las erratas del pilot-scope):

```ts
const docId = chunk.retrievedContext?.customMetadata
  ?.find((m) => m.key === "knowledge_document_id")?.stringValue;
```

## Forma real de `retrievedContext` (claves observadas)

```
title            → "Reglamento Red de Jóvenes" (displayName dado al indexar)
text             → fragmento recuperado
fileSearchStore  → nombre del store
customMetadata   → arreglo {key, stringValue}
pageNumber       → presente (1, 2, ...) — las citas del piloto tendrán página
```

`pageNumber` llegó en todos los chunks del PDF de prueba. El mapeo de citas de §7.1 del pilot-scope queda cubierto: título, página, fragmento, store y `knowledge_document_id`.

## Datos operativos

- Indexación del PDF de 275 KB: ~5 s (upload + procesamiento, polling cada 4 s).
- El volcado crudo de la última respuesta queda en `data/spike-last-response.json` (fuera de Git) para inspección.

## Implicaciones para la implementación

1. El contrato "modelo devuelve JSON + servidor lee grounding de la misma llamada" es viable tal como está diseñado. Sin rediseño a dos pasadas.
2. El cruce de citas por `knowledge_document_id` funciona; el fallback `missing_knowledge_document_id` queda como red de seguridad, no como camino esperado.
3. `scripts/spike-file-search.ts` evoluciona a `scripts/index-knowledge-documents.ts` en Fase 3: la parte de store + upload + customMetadata ya está probada.
4. Fijar `config.responseJsonSchema` como el parámetro de structured output para `@google/genai` 2.x (resuelve la errata 6 del pilot-scope).
