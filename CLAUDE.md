# CLAUDE.md — Chat con Documentos para Scouts (piloto)

Asistente de IA donde miembros de una organización Scout consultan manuales oficiales y reciben respuestas con citas. Hay usuarios menores de edad (desde 15 años). Trátese con el cuidado correspondiente.

## Estilo de escritura

Antes de entregar cualquier análisis, documento o respuesta larga, invoca el skill `stop-slop` (`/anthropic-skills:stop-slop`) y aplica sus instrucciones.

Específicamente:
- Sin frases condescendientes ("seamos honestos", "te explico por qué", "conviene que")
- Sin relleno verbal ("dicho de otro modo", "solo quiero subrayar", "vamos a eso")
- Sin repetir la misma idea en formatos distintos
- Estilo uniforme dentro de cada documento

## Stack

- Next.js (App Router) + TypeScript. Base: plantilla Next.js AI Chatbot de Vercel, podada.
- Supabase Auth + PostgreSQL. Fuente única de usuarios, conversaciones, mensajes, citas y auditoría. Se elimina NextAuth de la plantilla.
- Gemini File Search como RAG administrado, vía Gemini Developer API (NO Vertex AI; el `customMetadata` del grounding no está soportado en Vertex). Modelo de chat: `gemini-3.5-flash`, validado contra disponibilidad de cuenta/región y versión del SDK.
- Despliegue en Vercel.
- Idioma de UI y de respuestas: español.

## Documentos de referencia (autoridad)

- @docs/pilot-scope-v0.3.1.md → FUENTE DE VERDAD del alcance. Construir SOLO contra esto. Ver "Erratas y decisiones (2026-06-02)" al inicio del documento.
- @docs/srs-v0.2.md → Visión y norte de producto. NO es alcance de build. No implementar de aquí nada que el piloto no incluya. §22.3 (delimitadores de contexto) queda derogada por D-01/D-02.
- @supabase/migrations/0001_schema_rls.sql → modelo de datos y RLS vigentes. El SQL es dueño del esquema.
- `docs/archive/` → v0.3 y v0.1 solo como historia. Ignorarlas.

## Reglas no negociables (contrato de comportamiento)

Estas reglas vienen de decisiones tomadas a propósito. No reintroducir lo que se quitó.

### RAG / File Search
- El RAG es Gemini File Search administrado. NUNCA ensamblar chunks a mano, NUNCA montar pgvector, NUNCA envolver el contexto recuperado en delimitadores tipo `<documento>`. Se pasa pregunta + system prompt + schema + configuración de File Search, y Gemini recupera por dentro.

### Contrato de respuesta
- El modelo devuelve SOLO contenido semántico: `{ estado, respuesta, preguntaGuiada?, sugerencias?, advertencias? }`, con `estado` en `respondido | sin_fuente | necesita_aclaracion | bloqueado_por_seguridad`.
- NUNCA pedir al modelo tokens, costo, latencia, score, grounding ni confianza. Esa metadata la calcula el servidor con el usage de la API y un cronómetro. `groundingDisponible` se deriva de si hay `groundingChunks`.
- El backend compone la respuesta final al frontend uniendo `messages.response_json` + filas de `citations`.

### Citas
- Se derivan de `groundingMetadata.groundingChunks[*].retrievedContext`. El `customMetadata` vuelve como ARREGLO de pares `{ key, stringValue | numericValue }`, NO como objeto plano. Para leer el id:
  `chunk.retrievedContext.customMetadata?.find(m => m.key === "knowledge_document_id")?.stringValue`
- El cruce con `knowledge_documents` es por ese `knowledge_document_id`, NUNCA por título.
- Si falta ese id: guardar la cita con `knowledge_document_id = null`, emitir evento de calidad `missing_knowledge_document_id`, mostrar título y página si existen, y no prometer versión exacta.
- La tabla `citations` es la ÚNICA fuente de verdad persistida. `response_json` NO duplica el arreglo de citas.

### Streaming
- En el piloto NO hay streaming de tokens del proveedor. El servidor obtiene la respuesta estructurada completa, la valida y la confirma como final antes de enviarla.
- La UI revela esa respuesta final con efecto typewriter (máquina de escribir): animación local sobre texto YA completo, validado y confirmado. No se anima JSON parcial ni se muestra contenido antes de validar `estado` y citas.
- Mientras el servidor procesa, la UI muestra un indicador "escribiendo".

### Errores y seguridad del proveedor
- JSON inválido: validar contra schema, luego UN reintento con prompt correctivo corto, y si falla otra vez, `estado = "error"` con `error_code = 'invalid_model_json'`. El reintento NO consume cuota del usuario.
- Bloqueo del proveedor (`promptFeedback.blockReason`, `finishReason = SAFETY`, candidato vacío) se mapea a `estado = "bloqueado_por_seguridad"` con `safety_block_source = 'proveedor'`. NUNCA tratarlo como error genérico.

### Cuota
- Un solo contador: `chat_turns` por usuario por día (vista `daily_chat_turns_by_user`). Elegir una opción guiada cuenta como turno normal. Verificar la cuota ANTES de llamar al modelo.

### Privacidad, admin y RLS
- NO guardar raw provider response por defecto.
- Consentimiento append-only en `consent_acceptance_events`. `profiles` solo cachea la última versión aceptada, y esa caché la escribe el backend con la service role.
- RLS real: la lectura de lo propio y la inserción de mensajes del usuario (`sender = 'usuario'`) usan un cliente Supabase con el JWT del usuario. La secret key (service role) SALTA la RLS; resérvala para lo que el cliente no debe poder forjar: mensajes del asistente/sistema, `citations`, preguntas guiadas, `model_request_events`, auditoría admin, caché de consentimiento e indexación. Si el camino del usuario usa la secret key, la RLS no protege.
- El acceso del admin a conversaciones ajenas NO es por RLS. Va por páginas de servidor que verifican rol admin. Decisión 2026-07-17: el admin abre conversaciones a libre albedrío, SIN motivo obligatorio ni fricción; cada apertura se registra automáticamente en `admin_audit_events` (log silencioso, fail-closed: si el registro falla, no se muestra el contenido). NO reintroducir el formulario de motivo. NUNCA dar al admin lectura amplia por RLS.
- `role` y `account_status` no se cambian desde el cliente; un trigger los protege.
- Secretos (Gemini, Supabase service role) solo en servidor. Nunca exponer la service role al cliente.
- El chat verifica `account_status = 'activo'` y consentimiento aceptado antes de responder. Esto es lógica de API, no RLS.

## Fuera de alcance del piloto (NO construir)

Rover y generación de Word, pgvector o RAG manual, multiidioma, voz, moderación humana avanzada, escalamiento automático de situaciones sensibles, contabilidad de tokens o costo para bloqueo, y máquina completa de estados de documentos. Streaming de tokens del proveedor también queda fuera (P1). Todo eso es P1/P2.

## Menores y situaciones sensibles

Hay usuarios desde 15 años. NO improvisar flujos de salvaguarda ni escalamiento. Eso depende de política organizacional aún no definida. El piloto solo responde de forma segura y registra un evento técnico.

## Convenciones de Git

- Mensajes de commit en español, sin línea `Co-Authored-By`.
- Formato: `tipo: descripción` (`docs:`, `feat:`, `fix:`, `chore:`).
- No pushear sin confirmación del usuario.

## Estructura del repo

- `AGENTS.md` → puerta de entrada para agentes de código; apunta aquí.
- `app/`, `lib/` → Next.js (plantilla podada). Eliminar NextAuth, los artefactos (code/text/sheet/image), las tools de la plantilla y los streams reanudables.
- `supabase/migrations/` → SQL. Aplicar `0001_schema_rls.sql` primero. El SQL es dueño del esquema; Drizzle se elimina o queda solo como tipos read-only (`db:pull`), nunca como segunda fuente de esquema.
- `scripts/` → tareas operativas, como la indexación de documentos.
- `docs/` → especificaciones. `docs/notes/` → notas técnicas de validación. `docs/archive/` → versiones superadas.
- `ROADMAP.md` → tareas paso a paso.

## Comandos

- dev: `pnpm dev`
- build: `next build` (ajustar el script `build` actual de la plantilla, que invoca la migración de Drizzle, al podar)
- lint/format: `pnpm check` (ultracite/Biome) y `pnpm fix`
- typecheck: `pnpm exec tsc --noEmit`
- migraciones: aplicar `supabase/migrations` en orden (CLI de Supabase o MCP de Supabase)
