# ROADMAP — Piloto Chat con Documentos para Scouts

Plan por fases derivado del alcance v0.3.1. Las referencias entre corchetes apuntan a requisitos `P-RF`, secciones `§` y decisiones `D` de `docs/pilot-scope-v0.3.1.md`.

Regla de trabajo: las fases van en orden, pero la Fase 1 (spikes) y la Fase 2 (datos/auth) no dependen entre sí; pueden avanzar en paralelo. Nada de Fase 3 sin los spikes verdes.

---

## Estado actual (2026-07-15)

**Hecho:**
- Documentación colocada y con autoridad definida (`docs/pilot-scope-v0.3.1.md` manda; erratas del 2026-06-02 al inicio).
- Decisiones cerradas: Supabase Auth (fuera NextAuth), sin streaming del proveedor + typewriter local, SQL dueño del esquema, Gemini Developer API con `gemini-3.5-flash`, spikes con criterios de verde.
- `CLAUDE.md`, `AGENTS.md` y este ROADMAP en la raíz.
- Fase 0 cerrada salvo un secreto: Supabase creado (**ChatBot Zulú**, `ddimxdrggrrfcvzwwben`) y conectado por MCP; key de Gemini validada; `.env` ajustados; PDF de prueba en `data/pdfs/`.
- **Fase 1 cerrada: gate de spikes VERDE (7/7) el 2026-07-15.** Ver `docs/notes/spike-file-search-resultado.md`. La Fase 3 queda desbloqueada en cuanto cierre la Fase 2.

**Siguiente:** Fase 2 — escribir y aplicar `supabase/migrations/0001_schema_rls.sql` (no se recibió: hay que **escribirlo** desde el pilot-scope), podar la plantilla, Supabase Auth.

**Pendiente de decisión/gestión:** `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`, push de `master` a `origin`, obtención de los 8 PDFs oficiales, bloqueos organizacionales (abajo).

---

## Fase 0 — Cuentas y llaves (sin código)

- [x] Crear el proyecto en Supabase: **ChatBot Zulú** (`ddimxdrggrrfcvzwwben`, us-east-2, Postgres 17). Obtener anon key y service role key del dashboard para `.env.local`; la service role solo va en servidor.
- [x] Crear API key de Gemini (**Gemini Developer API**, no Vertex). Smoke test 2026-07-15: HTTP 200, `gemini-3.5-flash` disponible y generando. (Billing/créditos: verificar si el tier gratuito limita File Search durante el spike.)
- [x] Conseguir **1 PDF oficial de prueba**: `data/pdfs/reglamento-red-de-jovenes.pdf` (carpeta `data/` fuera de Git).
- [x] Configurar `.env.local` y `.env.example` con las variables del piloto (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `MAX_CHAT_TURNS_PER_USER_PER_DAY`); eliminadas las de la plantilla. `.gitignore` incluye `CLAUDE.local.md`.
- [ ] Completar en `.env.local` el secreto que falta: `SUPABASE_SERVICE_ROLE_KEY` (dashboard → Settings → API keys). `GEMINI_API_KEY` ya está. No se commitean.
- [x] Validar disponibilidad de `gemini-3.5-flash` en la cuenta/región: confirmado por API el 2026-07-15 (`models.list` + `generateContent`).
- [x] Conectar el MCP de Supabase en Claude Code para aplicar y revisar migraciones desde la sesión.

---

## Fase 1 — Gate de spikes (primer código; solo requiere Gemini + 1 PDF)

Capacidad documentada para Gemini 3 / `gemini-3.5-flash`; lo que se valida es que tu SDK + store + schema + metadata reales devuelven los campos esperados. **No iniciar Fase 3 hasta que ambos estén verdes.** Si alguno falla, cambia la arquitectura, no solo la implementación. Detalle en `docs/notes/gemini-file-search-validacion.md`. [D-01, D-07]

- [x] Implementar `scripts/spike-file-search.ts`: crea store, indexa el PDF de prueba con `custom_metadata`, consulta con structured output y aserta los criterios de verde. Este script evoluciona luego a `scripts/index-knowledge-documents.ts`. [P-RF-20]
- [x] **Spike #1 — File Search + structured output + grounding en una sola llamada.** Verde cuando una llamada única a `generateContent` con File Search y structured output (schema real del piloto) devuelve:
  - `response.text` parsea y valida contra schema;
  - `candidates[0].groundingMetadata` existe;
  - `groundingChunks` trae al menos un `retrievedContext` del store esperado.
  Si el JSON llega pero el grounding no, rediseñar a dos pasadas. Usar el parámetro de structured output del SDK concreto (`response_format` / `responseFormat`), no asumir `responseSchema`.
- [x] **Spike #2 — round-trip de `custom_metadata`.** Verde cuando, indexado un doc con `key="knowledge_document_id"`, `value="<ID interno>"`, la consulta recupera ese doc y en `groundingChunks[*].retrievedContext.customMetadata` aparece un item con `key == "knowledge_document_id"` y `stringValue == "<ID interno>"`, y el servidor mapea ese ID sin usar título. Recordar: `customMetadata` es un ARREGLO de `{ key, stringValue }`, no un objeto plano.
- [x] Registrar en `docs/notes/` el resultado de los spikes: `docs/notes/spike-file-search-resultado.md` (VERDE 7/7 el 2026-07-15; `responseJsonSchema` es el parámetro correcto en `@google/genai` 2.x; `pageNumber` disponible en `retrievedContext`).

---

## Fase 2 — Fundación: datos, auth y poda (paralelo a Fase 1)

### Esquema y RLS
- [ ] **Escribir** `supabase/migrations/0001_schema_rls.sql` desde el pilot-scope: tablas de §8 (`profiles`, `consent_acceptance_events`, `conversations`, `messages`, `citations`, `guided_questions`, `guided_question_options`, `knowledge_documents`, `model_request_events`, `admin_audit_events`, `rag_eval_cases`, `rag_eval_runs`), vistas `daily_chat_turns_by_user` y `daily_model_requests_by_user`, RLS de §16, trigger que crea `profiles` al registrarse un usuario en `auth.users`, y trigger que impide cambiar `role`/`account_status` desde el cliente.
- [ ] Aplicar la migración en Supabase.
- [ ] Documentar y ejecutar el **seed del primer admin** (UPDATE manual con service role o SQL en el dashboard; el rol nunca se autoasigna). [P-RNF-05]
- [ ] Verificar RLS con un cliente Supabase **con el JWT del usuario** (no service role): un Scout no lee conversaciones ajenas y no puede cambiar su `role`.

### Poda de la plantilla
- [ ] Eliminar NextAuth (`app/(auth)`), artefactos (`artifacts/*` y sus componentes), tools de la plantilla (`getWeather`, `createDocument`, `editDocument`, `updateDocument`, `requestSuggestions`), streams reanudables (Redis/`resumable-stream`, ruta `api/chat/[id]/stream`), votos y sugerencias. Conservar shell de chat, `components/ui`, hooks SWR.
- [ ] Eliminar Drizzle como dueño de esquema: quitar `drizzle.config.ts`, `lib/db/migrations`, scripts `db:*`; el acceso a datos pasa a supabase-js. Ajustar el script `build` (hoy corre la migración de Drizzle).
- [ ] Limpiar `package.json` (dependencias muertas tras la poda) y CI (`.github/workflows/playwright.yml` va a romper con la poda: reducir a lint + typecheck hasta reescribir e2e).

### Auth y cuenta
- [ ] Supabase Auth: registro/login por correo, **UI en español** (la plantilla está en inglés). [P-RF-01..03]
- [ ] Middleware/protección de rutas con la sesión de Supabase.
- [ ] Estados de cuenta: bloquear el chat si `account_status != 'activo'`.
- [ ] Flujo de consentimiento: insertar `consent_acceptance_events` y actualizar la caché en `profiles` (backend con service role). Bloquea el chat hasta aceptar. [P-RF-04, D-10]

---

## Fase 3 — Chat usable (requiere spikes verdes + Fase 2)

- [ ] Conversaciones: crear, listar, abrir, archivar. [P-RF-05, P-RF-06]
- [ ] Endpoint `POST /chat` que verifica usuario, rol, estado, consentimiento y cuota antes de llamar al modelo. [P-RF-07, P-RF-14]
- [ ] Guard de cuota diaria usando `daily_chat_turns_by_user` antes de llamar al modelo. [D-11]
- [ ] Llamada a Gemini con File Search + schema de salida. Historial: últimos 6-10 mensajes, sin resumen en v1. [P-RF-08, §10]
- [ ] Validación de JSON + reintento único + fallback `error`. [P-RF-09, D-09]
- [ ] Normalización de citas por `knowledge_document_id` (búsqueda por `key` en el arreglo `customMetadata`) y persistencia en `citations`. Evento de calidad `missing_knowledge_document_id` si falta. [P-RF-10, D-07, D-12]
- [ ] Manejo del bloqueo del proveedor mapeado a `bloqueado_por_seguridad`. [D-08]
- [ ] Registrar `model_request_events` por request, incluyendo `attempt_index`. [P-RF-18, D-03]
- [ ] Render markdown + chips de citas con documento y página. Respuesta final con efecto **typewriter** sobre texto ya validado (sin streaming del proveedor); indicador "escribiendo" mientras el servidor procesa. [P-RF-11, D-04]
- [ ] Estado `sin_fuente` sin inventar citas; evento de calidad si `respondido` llega sin citas. [P-RF-12, §7.2]
- [ ] Preguntas guiadas: opciones 2-4 + input libre; elegir una opción genera un turno nuevo por el mismo endpoint. [P-RF-13]
- [ ] Completar `scripts/index-knowledge-documents.ts` e indexar los 8 manuales (requiere los PDFs — ver bloqueos). [P-RF-19, P-RF-20]

---

## Fase 4 — Administración y control

- [ ] Panel admin: listar conversaciones de usuarios. [P-RF-15]
- [ ] Ver conversación ajena: exigir motivo + escribir `admin_audit_events`, vía service role en servidor. [P-RF-16, P-RF-17]
- [ ] Página admin de documentos: listar (nombre, versión, fecha de indexación, activo) y activar/desactivar. [P-RF-19, §13.2]
- [ ] Cambios de estado de cuenta desde admin, con auditoría (`change_user_status`).

---

## Fase 5 — Calidad y endurecimiento

- [ ] Cargar 30 casos en `rag_eval_cases` con la distribución 12/6/6/4/2. [P-RF-21, §14]
- [ ] Runner de evaluación que ejecute contra la API real y guarde resultados en `rag_eval_runs`.
- [ ] Ajustar prompts según resultados; repetir hasta cumplir los umbrales de §14.2.
- [ ] Pruebas: citas reales, preguntas fuera de alcance sin inventar fuente, adversariales e inyección, bloqueo de seguridad, JSON inválido con retry.
- [ ] Revisión de RLS y recorrido completo de la Definition of Done (§18) y el checklist técnico (§19).
- [ ] Despliegue en Vercel.

---

## Bloqueos organizacionales (en paralelo, no son de ingeniería)

Estos no dependen de código, pero pueden frenar el lanzamiento si llegan tarde.

- [ ] **Obtener los 8 PDFs oficiales aprobados, con versión definida.** Bloquea la indexación de Fase 3. (1 PDF de prueba basta para la Fase 1.)
- [ ] Texto y versión de la política de privacidad y los términos. Bloquea el flujo de consentimiento de Fase 2.
- [ ] Decisión del default de `account_status` para menores: `activo` o `pendiente_autorizacion`.
- [ ] Política de autorización de adulto responsable para usuarios de 15 a 17.
- [ ] Política de situaciones sensibles, requisito previo a cualquier escalamiento (P2).

---

## Uso con Claude Code / agentes

- Trabaja una tarea a la vez y marca el checkbox al cerrarla. La primera tarea sin marcar de la fase más temprana disponible es la siguiente.
- Actualiza la sección "Estado actual" cuando cierres una fase o tomes una decisión de arquitectura.
- Si una sesión se ensucia, usa `/clear` entre tareas no relacionadas; `CLAUDE.md` se recarga solo.
- El alcance autoritativo es `docs/pilot-scope-v0.3.1.md` (con sus erratas), no la v0.2.
