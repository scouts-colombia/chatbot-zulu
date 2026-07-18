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

- Fase 2 / Esquema y RLS cerrado: migraciones 0001–0005 aplicadas al proyecto, RLS verificada 23/23 (`scripts/verify-rls.mjs`), seed de admin documentado.
- Fase 2 / Poda y auth cerrados: plantilla podada (fuera NextAuth, Drizzle, artefactos, streams; ~40 dependencias menos), Supabase Auth con UI en español verificada en navegador contra el proyecto real. Despliegue en Vercel activo con previews por PR.

**Siguiente:** Fase 3 — chat con Gemini File Search (los spikes ya están verdes). El consentimiento (Fase 2) queda bloqueado por el texto de la política.

**Pendiente de decisión/gestión:** obtención de los 8 PDFs oficiales, ejecutar el seed del admin cuando se registre, eliminar `AUTH_SECRET` de Vercel (ya no se usa), bloqueos organizacionales (abajo).

---

## Fase 0 — Cuentas y llaves (sin código)

- [x] Crear el proyecto en Supabase: **ChatBot Zulú** (`ddimxdrggrrfcvzwwben`, us-east-2, Postgres 17). Obtener anon key y service role key del dashboard para `.env.local`; la service role solo va en servidor.
- [x] Crear API key de Gemini (**Gemini Developer API**, no Vertex). Smoke test 2026-07-15: HTTP 200, `gemini-3.5-flash` disponible y generando. (Billing/créditos: verificar si el tier gratuito limita File Search durante el spike.)
- [x] Conseguir **1 PDF oficial de prueba**: `data/pdfs/reglamento-red-de-jovenes.pdf` (carpeta `data/` fuera de Git).
- [x] Configurar `.env.local` y `.env.example` con las variables del piloto (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `MAX_CHAT_TURNS_PER_USER_PER_DAY`); eliminadas las de la plantilla. `.gitignore` incluye `CLAUDE.local.md`.
- [x] Secretos completos en `.env.local`: `SUPABASE_SECRET_KEY` (formato moderno `sb_secret_`, preferido sobre la legacy service_role por rotación individual) y `GEMINI_API_KEY`. No se commitean.
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
- [x] **Escribir** `supabase/migrations/0001_schema_rls.sql` desde el pilot-scope: 12 tablas de §8, vistas `daily_chat_turns_by_user` y `daily_model_requests_by_user` (con `security_invoker`), RLS de §16, trigger que crea `profiles` al registrarse, y trigger que protege `role`/`account_status`/caché de consentimiento.
- [x] Aplicar las migraciones en Supabase (0001 + 0002 de endurecimiento por advisors: revoke execute de funciones de trigger). Advisors de seguridad limpios salvo 4 INFO intencionales (tablas de solo-servidor sin políticas).
- [x] Documentar el **seed del primer admin** en `scripts/seed-admin.sql` (SQL Editor/psql; el rol nunca se autoasigna). Ejecutarlo cuando el admin real se registre. [P-RNF-05]
- [x] Verificar RLS con el JWT del usuario: `scripts/verify-rls.mjs` — **VERDE 16/16** el 2026-07-15 (aislamiento entre Scouts, no auto-escalamiento de rol, mensajes de asistente no forjables, archivadas no aceptan mensajes, tablas de servidor invisibles).

### Poda de la plantilla
- [x] Eliminados: NextAuth (`app/(auth)` de la plantilla, botid, `AUTH_SECRET`), artefactos, tools, streams reanudables (Redis/`resumable-stream`), votos, sugerencias, chat de la plantilla, tests e2e de la plantilla. Conservados: `components/ui`, `theme-provider`, layout base.
- [x] Eliminado Drizzle completo (`drizzle.config.ts`, `lib/db`, scripts `db:*`); el acceso a datos es supabase-js.
- [x] `package.json` limpio: de ~60 dependencias a ~20 (fuera ai-sdk, codemirror, prosemirror, katex, redis, postgres, etc.). Debería bajar varias alertas de Dependabot.
- [x] CI reducido a lint + typecheck: eliminado `playwright.yml` (probaba NextAuth/stack de la plantilla y fallaba por `MissingSecret`); typecheck añadido a `lint.yml`. Reescribir e2e propios (P1 de esta fase).

### Auth y cuenta
- [x] Supabase Auth: registro/login por correo con UI en español (`app/(auth)`, server actions, errores traducidos). Verificado en navegador contra el proyecto real: login → home con perfil vía RLS → logout. Nota: GoTrue valida entregabilidad del dominio del correo en signUp (dominios inventados fallan; correos reales pasan).
- [x] Protección de rutas en `proxy.ts` con la sesión de Supabase (`@supabase/ssr`): sin sesión → `/login`; con sesión, `/login`/`/registro` → `/`.
- [x] Estados de cuenta en la home: mensaje de bloqueo si `account_status != 'activo'`. El gate de API se implementa con el endpoint de chat (Fase 3).
- [ ] Flujo de consentimiento: insertar `consent_acceptance_events` y actualizar la caché en `profiles` (backend con secret key). Bloquea el chat hasta aceptar. **Bloqueado por el texto/versión de la política (organizacional).** [P-RF-04, D-10]

---

## Fase 3 — Chat usable (requiere spikes verdes + Fase 2)

- [x] Conversaciones: crear, listar, abrir, archivar (server actions con el JWT del usuario; título automático con la primera pregunta). [P-RF-05, P-RF-06]
- [x] Endpoint `POST /api/chat` que verifica usuario, estado de cuenta y cuota antes de llamar al modelo. El check de consentimiento se añade cuando exista la política (bloqueo organizacional). [P-RF-07, P-RF-14]
- [x] Guard de cuota diaria usando `daily_chat_turns_by_user` antes de guardar el mensaje y de llamar al modelo. [D-11]
- [x] Llamada a Gemini con File Search + `responseJsonSchema`. Historial: últimos 8 mensajes, sin resumen. Store(s) desde `knowledge_documents.active`. [P-RF-08, §10]
- [x] Validación de JSON (zod) + reintento único con prompt correctivo + fallback `error` con `invalid_model_json`. [P-RF-09, D-09]
- [x] Normalización de citas por `knowledge_document_id` (búsqueda por `key` en el arreglo `customMetadata`) y persistencia en `citations`. Marcas de calidad `missing_knowledge_document_id` y `respondido_sin_citas` en el evento. [P-RF-10, D-07, D-12]
- [x] Bloqueo del proveedor (`promptFeedback.blockReason`, `finishReason=SAFETY`, candidato vacío) mapeado a `bloqueado_por_seguridad` con mensaje seguro. [D-08]
- [x] `model_request_events` por intento con `attempt_index`, latencia, tokens, grounding y `safety_block_source`. [P-RF-18, D-03]
- [x] Render markdown (react-markdown) + chips de citas con documento y página. Typewriter local sobre texto ya validado (por tiempo transcurrido, inmune al throttling de pestañas); indicador "escribiendo". [P-RF-11, D-04]
- [x] `sin_fuente` con citas vacías forzadas en servidor (§7.2) y badge en UI. [P-RF-12]
- [x] Preguntas guiadas: persistidas en `guided_questions`/`options`, botones 2-4 + input libre; elegir una opción envía un turno normal por el mismo endpoint. [P-RF-13]
- [x] `scripts/index-knowledge-documents.ts` completo (reserva fila → upload con custom_metadata → confirma sincronización; idempotente por sha256, FORCE=1 para reindexar). Store del piloto creado e indexado el PDF de prueba. Indexar los 8 manuales reales cuando lleguen los PDFs (bloqueo organizacional). [P-RF-19, P-RF-20]

Verificado e2e en navegador contra Gemini y Supabase reales (2026-07-17): pregunta sobre el Reglamento → respondido con 3 citas con página y `knowledge_document_id` (3/3 con versión coincidente); pregunta fuera de alcance → `sin_fuente` sin citas; eventos y cuota correctos en la base.

---

## Fase 4 — Administración y control

- [x] Panel admin (`/admin`, guard de rol en servidor): listar conversaciones de usuarios, con el listado también auditado (`list_user_conversations`). [P-RF-15]
- [x] Ver conversación ajena: motivo obligatorio (predefinidos del SRS §16 + "Otro" con detalle) → `admin_audit_events` → contenido visible dentro de una ventana de acceso de 30 min por motivo registrado. [P-RF-16, P-RF-17]
- [x] Página admin de documentos: listar (nombre, versión, indexación, error) y activar/desactivar con auditoría; la desactivación sale del `metadataFilter` de inmediato. [P-RF-19, §13.2]
- [x] Cambios de estado de cuenta desde admin con motivo y auditoría (`change_user_status`); un admin no puede cambiarse a sí mismo.

Verificado e2e en navegador (2026-07-17): motivo-gate sin fugas de contenido, auditoría completa (5 acciones con motivos), toggle de documento reflejado en la base, bloqueo de cuenta efectivo end-to-end, y un scout no accede a `/admin` (redirect).

---

## Fase 5 — Calidad y endurecimiento

- [ ] Cargar 30 casos en `rag_eval_cases` con la distribución 12/6/6/4/2. [P-RF-21, §14]
- [ ] Runner de evaluación que ejecute contra la API real y guarde resultados en `rag_eval_runs`.
- [ ] Ajustar prompts según resultados; repetir hasta cumplir los umbrales de §14.2.
- [ ] Pruebas: citas reales, preguntas fuera de alcance sin inventar fuente, adversariales e inyección, bloqueo de seguridad, JSON inválido con retry.
- [ ] Revisión de RLS y recorrido completo de la Definition of Done (§18) y el checklist técnico (§19).
- [ ] Despliegue en Vercel.

---

## Fase 6 — UI y design system (al final, decisión 2026-07-17)

Primero toda la funcionalidad; la capa visual se aplica al final sobre pantallas ya estables.

- [ ] Retomar la rama **`feat/design-system`** (PR #4, cerrado sin merge; NO borrar la rama): tokens de marca de `ruta` (scouts-*, secciones, PNPJ, radius), tipografías locales Futura/JollyGood (`app/fuentes.ts` + `app/fonts/`), superficies `auth-hero`/`auth-card-surface` (glass) y `components/ui/card`. Todo quedó construido y verificado (preview desplegado en el PR #4); al retomar: rebase sobre master o re-aplicación por partes (los archivos de tokens/fuentes son aditivos; solo las pantallas tocadas necesitan ajuste manual).
- [ ] Aplicar el design system al chat y pantallas nuevas de las Fases 3-4.
- [ ] Traer de `ruta` los `components/ui` restantes y el `theme-toggle` (acoplado en ruta a su cookie de tema; adaptar).

---

## Bloqueos organizacionales (en paralelo, no son de ingeniería)

Estos no dependen de código, pero pueden frenar el lanzamiento si llegan tarde.

- [ ] **Obtener los 8 PDFs oficiales aprobados, con versión definida.** Bloquea la indexación de Fase 3. (1 PDF de prueba basta para la Fase 1.)
- [ ] Texto y versión de la política de privacidad y los términos. Bloquea el flujo de consentimiento de Fase 2. **Al publicarla: fijar `PRIVACY_POLICY_VERSION` en Vercel (sin esa variable el gate del chat queda abierto a propósito durante la construcción — es requisito del checklist de lanzamiento, §19) y construir la UI de aceptación.**
- [ ] Decisión del default de `account_status` para menores: `activo` o `pendiente_autorizacion`.
- [ ] Política de autorización de adulto responsable para usuarios de 15 a 17.
- [ ] Política de situaciones sensibles, requisito previo a cualquier escalamiento (P2).

---

## Uso con Claude Code / agentes

- Trabaja una tarea a la vez y marca el checkbox al cerrarla. La primera tarea sin marcar de la fase más temprana disponible es la siguiente.
- Actualiza la sección "Estado actual" cuando cierres una fase o tomes una decisión de arquitectura.
- Si una sesión se ensucia, usa `/clear` entre tareas no relacionadas; `CLAUDE.md` se recarga solo.
- El alcance autoritativo es `docs/pilot-scope-v0.3.1.md` (con sus erratas), no la v0.2.
