> **Nota técnica de validación (2026-06-02).** Verificación de los dos spikes de File Search contra la documentación de Gemini. Sus conclusiones operativas están reflejadas en `ROADMAP.md` (Semana 1) y en la nota de erratas de `docs/pilot-scope-v0.3.1.md`. Se conserva aquí por los nombres de campo concretos y los criterios de "verde".

---

I’ll verify this against current primary Gemini/API documentation, focusing on exact field names, tool plus schema compatibility, grounding metadata behavior, and valid model support.

Thought for 3m 29s
Veredicto

El texto es sustancialmente correcto como criterio de gating, pero hoy lo matizaría así: no son “supuestos” en el mismo grado. Según la documentación actual de Gemini, la mayor parte ya está documentada como soportada; lo que sigue siendo un spike bloqueante es validar que tu combinación exacta de API/SDK/modelo/store/prompt devuelve los campos que tu servidor necesita, con el casing y la estructura reales.

1) File Search + JSON forzado + groundingMetadata

La compatibilidad File Search + structured output en una sola llamada está documentada como correcta para modelos Gemini 3. La página de File Search dice explícitamente que, desde Gemini 3, se puede combinar File Search con structured outputs, y muestra un ejemplo con model="gemini-3.5-flash", tools: file_search y response_format/schema en la misma llamada.

El matiz importante: la documentación de structured outputs con tools dice que esta capacidad está en Preview y disponible para modelos Gemini 3, específicamente gemini-3.1-pro-preview y gemini-3.5-flash; también lista File Search entre las tools combinables con structured outputs. Por tanto, el riesgo “Gemini no permite tool + schema simultáneamente” ya no parece un supuesto abierto para gemini-3.5-flash: está soportado oficialmente, aunque como feature Preview.

Lo que sí sigue siendo un spike real es la parte “y aun así obtener groundingMetadata en la misma respuesta”. File Search documenta que las citas se acceden mediante grounding_metadata / groundingMetadata cuando usas File Search, pero la presencia de metadata es tratada como algo que la respuesta “puede incluir”, no como garantía incondicional para toda llamada. Además, el ejemplo de structured output de File Search valida el JSON de response.text, pero no muestra en ese mismo bloque una aserción sobre groundingMetadata.

Conclusión para Spike #1:
No lo llamaría “supuesto de compatibilidad” sino contrato de integración a verificar. La llamada única con File Search + schema es correcta; lo que debes probar es que, en tu caso, la misma respuesta trae:

response.text  -> JSON válido según schema
response.candidates[0].groundingMetadata.groundingChunks -> presente y no vacío

Y, si dependes de trazabilidad por campo, también deberías verificar groundingSupports, no solo groundingChunks.

2) custom_metadata.knowledge_document_id en retrievedContext.customMetadata

Esto está más cerca de “correcto” que de “supuesto”, siempre que estés usando Gemini API File Search, no Vertex AI Search/RAG. La documentación de File Search dice que el custom metadata agregado al indexar archivos puede accederse desde el grounding metadata de la respuesta, y que cada grounding_chunk en retrieved_context contiene ese custom metadata.

El ejemplo JavaScript lo muestra como:

response.candidates[0].groundingMetadata
  .groundingChunks[*]
  .retrievedContext
  .customMetadata[*]

con cada metadata como { key, stringValue | numericValue }. El ejemplo REST también lo representa como una lista de pares key + string_value / numeric_value, no como un objeto plano.

Matiz crítico: la frase custom_metadata.knowledge_document_id es conceptualmente entendible, pero técnicamente imprecisa. No deberías esperar esto:

retrievedContext.customMetadata.knowledge_document_id

Sino algo como esto:

const docId = chunk.retrievedContext.customMetadata
  ?.find(m => m.key === "knowledge_document_id")
  ?.stringValue;

O en Python:

doc_id = next(
    (m.string_value for m in chunk.retrieved_context.custom_metadata
     if m.key == "knowledge_document_id"),
    None,
)

Conclusión para Spike #2:
La idea de D-07 —cruzar por knowledge_document_id y no por título— es correcta y está respaldada por la documentación de File Search. Pero el spike sigue siendo útil para verificar tres cosas concretas: que el metadata se persiste al indexar, que vuelve en el chunk recuperado y que vuelve con el tipo esperado (stringValue / string_value).

3) Cuidado con Gemini API vs Vertex AI

Aquí hay una trampa importante. La documentación generada del SDK @google/genai marca customMetadata en GroundingChunkRetrievedContext como metadata de usuario del contexto recuperado, pero también indica que ese campo no está soportado en Vertex AI.

Así que el texto es correcto si “Gemini File Search” significa Gemini Developer API File Search. Si el piloto realmente está montado sobre Vertex AI Search, Vertex AI RAG Engine o Agent Platform, entonces el supuesto #2 puede ser falso o requerir otro campo, por ejemplo documentName, uri o un mapeo propio. No mezclaría esas superficies en el diseño.

4) Modelo exacto: gemini-3.5-flash

La parte “confirma el ID exacto del modelo” es buena disciplina, pero en la documentación actual gemini-3.5-flash sí existe y aparece como código estable del modelo. La página del modelo lista explícitamente el model code gemini-3.5-flash, con File Search y Structured outputs como capacidades soportadas.

Además, la página general de modelos lo lista dentro de Gemini 3 como modelo estable. Por tanto, la frase “salvo impedimento” puede actualizarse a algo más firme: usar gemini-3.5-flash por defecto, validando disponibilidad en la cuenta/región y SDK concretos.

5) Ojo con el nombre responseSchema

En Gemini Developer API actual, la documentación de structured outputs usa response_format en Python, responseFormat en JavaScript y generationConfig.responseFormat.text.schema en REST. En Vertex AI sí aparecen patrones antiguos como ResponseMimeType + ResponseSchema.

Así que en el documento técnico yo evitaría fijar el término responseSchema salvo que el repo use exactamente ese SDK. Mejor escribir:

Structured output / JSON schema forzado mediante el parámetro correspondiente del SDK: response_format, responseFormat o ResponseSchema, según cliente.

6) La frase “No empieces Semana 2 hasta que los spikes estén verdes”

Eso es correcto como decisión de proyecto. No porque todo sea incierto, sino porque esas dos pruebas validan contratos de arquitectura. Si falla #1, cambia el contrato “modelo devuelve JSON + servidor lee grounding de la misma llamada”. Si falla #2, cambia el contrato “cruce robusto por ID”. En ambos casos, no es un bug menor: obliga a rediseñar.

Yo definiría “verde” así:

Spike #1 verde:
- Una sola llamada a generateContent.
- Tool File Search activada.
- Structured output activado con schema real del piloto.
- response.text parsea y valida contra schema.
- candidates[0].groundingMetadata existe.
- groundingChunks contiene al menos un retrievedContext del File Search store esperado.

Spike #2 verde:
- Documento indexado con custom metadata:
  key = "knowledge_document_id"
  value = "<ID interno>"
- La consulta recupera ese documento.
- En groundingChunks[*].retrievedContext.customMetadata aparece un item con:
  key == "knowledge_document_id"
  stringValue/string_value == "<ID interno>"
- El servidor puede mapear ese ID a la entidad KnowledgeDocument sin usar título.
Cómo reescribiría el bloque

El piloto depende de dos contratos de integración de Gemini File Search que deben validarse en Semana 1 antes de construir la UX de chat encima. La compatibilidad general está documentada para Gemini 3 / gemini-3.5-flash, pero necesitamos probarla con nuestro SDK, store, schema y metadata reales.

Spike #1: confirmar que una llamada única con File Search + structured output devuelve simultáneamente JSON válido según schema y groundingMetadata utilizable en candidates[0]. Si el JSON llega pero el grounding no, rediseñar a dos pasadas o separar extracción estructurada de trazabilidad.

Spike #2: confirmar que el custom_metadata indexado con knowledge_document_id vuelve en groundingChunks[*].retrievedContext.customMetadata como par key/value. Si no vuelve, no usar título como fallback silencioso; rediseñar el vínculo documental.

No iniciar Semana 2 hasta que ambos contratos estén verdes. Si alguno falla, cambia la arquitectura, no solo la implementación.

Modelo inicial: gemini-3.5-flash, validado contra disponibilidad de cuenta/región y versión del SDK antes de fijarlo en .env.

Mi lectura final: el texto es correcto en intención y prudencia, pero hoy debe actualizarse para reflejar que Google ya documenta buena parte de esas capacidades. Los spikes siguen siendo necesarios, pero como pruebas de contrato, no como exploración a ciegas.