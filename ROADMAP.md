# ROADMAP — Piloto Chat con Documentos para Scouts

Plan por fases derivado del alcance v0.3.1. Las referencias entre corchetes apuntan a requisitos `P-RF`, secciones `§` y decisiones `D` de `docs/pilot-scope-v0.3.1.md`.

Regla de trabajo: las fases van en orden (la regla original de paralelismo entre Fases 1 y 2 ya cumplió su propósito: ambas están cerradas y los spikes quedaron verdes).

---

## Estado actual (2026-07-31) — handoff

**Dónde está el proyecto:** Fases 0 a 4 cerradas y en master. Solo queda la Fase 5 (evaluación RAG) como trabajo de ingeniería del piloto; la Fase 6 (design system) va al final por decisión de producto. El camino crítico ya no es código: sin los 8 PDFs oficiales y sin el texto de la política, el piloto no puede lanzarse.

**Hecho:**
- Fases 0 y 1 cerradas: infra completa (Supabase **ChatBot Zulú** `ddimxdrggrrfcvzwwben`, Gemini Developer API con `gemini-3.5-flash`, Vercel con previews por PR) y gate de spikes VERDE 7/7 (`docs/notes/spike-file-search-resultado.md`).
- Fase 2 cerrada salvo consentimiento (bloqueado por el texto de la política): migraciones aplicadas, RLS verificada 23/23 (`scripts/verify-rls.mjs`), plantilla podada, Supabase Auth en español. El gate de consentimiento en el chat ya existe y se activa al fijar `PRIVACY_POLICY_VERSION`.
- **Fase 3 cerrada (PR #5, mergeado):** chat completo contra Gemini File Search — cuota atómica por RPC, citas por `knowledge_document_id` con `metadataFilter` de documentos activos, retry único de JSON, bloqueo del proveedor mapeado, typewriter, preguntas guiadas, `scripts/index-knowledge-documents.ts` idempotente. Verificado e2e contra servicios reales.
- **Fase 4 cerrada (PR #6, mergeado con squash el 2026-07-31, commit `2b53369`):** panel admin con guard de rol en servidor — listado paginado de conversaciones, **acceso directo al contenido con log silencioso** (sin motivo; cada apertura registra fila en `admin_audit_events`, fail-closed), transcripción paginada con citas, preguntas guiadas y estado de cada respuesta, documentos y estados de cuenta con RPCs atómicas. 8 rondas de revisión de Codex, 31 hilos resueltos, ninguno abierto.
- Migraciones aplicadas al proyecto: `0001`–`0010`.
- **Corpus indexado (2026-08-01):** los 5 manuales de la carpeta Clan de la Dirección Nacional de Programa de Jóvenes están en el store del piloto, activos y con metadata sincronizada — Equipo de Bolsillo - Rover (v2026), Guía para el Dirigente de Clan (v2026), Manual de Cargos y Funciones Red de Jóvenes (v2024), Reglamento para la Realización de Asambleas Rover (v2022) y Reglamento Red de Jóvenes (v2018). La versión de cada uno vive en `scripts/versiones-documentos.json`. Verificado contra Gemini real con la capa del chat: citas cruzadas por `knowledge_document_id` con versión y página correctas, y `sin_fuente` sin citas para una pregunta fuera de alcance.

**Decisiones e invariantes vigentes:**
- **Acceso admin sin motivo obligatorio** (2026-07-17): errata 7 de `docs/pilot-scope-v0.3.1.md` (deroga P-RF-16; P-RF-17 se mantiene vía log silencioso automático). **No reintroducir el formulario de motivo.**
- **Ningún `next/link` dentro de `/admin`** (2026-07-31), ni para entrar ni para salir: todo el panel navega con `<a>` y el proxy responde `no-store` para `/admin/*`. Las páginas admin auditan al renderizar en servidor, y una navegación SPA deja la ruta en la caché de cliente del App Router (con `cacheComponents`, hasta 3 árboles en un `<Activity>` oculto), así que volver con Atrás la revelaría sin re-ejecutar el server component: sin fila de auditoría y sin pasar por `requerirAdmin`. Verificado en el código de Next 16.2: en atrás/adelante el router sirve del bfcache con `needsDynamicRequest: false` y `staleTimes` excluye ese caso por diseño. `router.refresh()` no sirve como parche (es asíncrono, fusiona sobre el árbol visible y no se puede esperar); el guard de bfcache usa `location.reload()`.
- **Una sola versión activa por manual** (migración `0010`): activar un documento retira en la misma transacción las otras versiones activas del mismo `display_name` y audita cada retiro. Sin eso, dos versiones entraban al `metadataFilter` y una respuesta podía fundamentarse en el manual obsoleto.
- **Las RPC administrativas revalidan al admin** (migración `0009`) dentro de la transacción del cambio, con `select ... for share` sobre su perfil. `requerirAdmin()` es barrera de UI, no de integridad. Ambas siguen siendo `security invoker` a propósito: `service_role` ya salta la RLS, y `definer` convertiría cualquier grant futuro en escalamiento.
- **Un fallo de consulta nunca se presenta como ausencia de datos** en el panel: error de Supabase ⇒ aviso `role="alert"`, no lista vacía ni 404. Y las consultas que pueden crecer se paginan con `count` exacto, porque PostgREST corta en `db-max-rows` (1000 por defecto) sin devolver error.
- Design system al final (Fase 6); la rama `feat/design-system` se conserva sin borrar.

**Flujo de trabajo vigente** (detalle en `CONTRIBUTING.md`): rama → PR → CI verde → revisión de Codex (responder cada comentario, resolver hilos, reinvocar con `@codex review` hasta ronda limpia) → squash and merge, que hace el dueño del repo personalmente.

**Siguiente:** **Fase 5** — cargar los 30 casos en `rag_eval_cases` (12/6/6/4/2) y construir el runner que persista en `rag_eval_runs`. Con 1 solo PDF indexado la corrida es parcial: sirve para validar el runner y las categorías que no dependen del corpus (fuera de alcance, adversariales, ambiguas), no para los umbrales de §14.2.

**Deuda técnica conocida (en master).** Auditoría del 2026-07-31 contra código y base; el panel admin ya está corregido, el camino del Scout no.

Alta:
- **El chat del Scout trunca su historial en silencio.** `app/chat/[id]/page.tsx` consulta `messages`, `citations` y `guided_questions` sin `.range()`, sin `count` y sin revisar `error`: PostgREST corta en `db-max-rows` sin avisar. Con 30 turnos/día (2 filas por turno) un hilo cruza 1000 filas en ~17 días, y `citations` antes (una fila por chunk de grounding, ~7 días). El Scout vería sus mensajes antiguos con el input habilitado, repetiría la pregunta y gastaría otro turno. Necesita "cargar mensajes anteriores", que es decisión de UX. La misma pasada debe resolver que hoy se renderiza la conversación completa sin ventana ni virtualización, con un `react-markdown` por burbuja.
- **La ventana de cuota corre en UTC.** `0006_turno_atomico.sql:69` usa `date_trunc('day', now())`, así que el contador se reinicia a las 00:00 UTC, que en Bogotá son las 19:00: el usuario recibe una segunda tanda de 30 turnos por la tarde y el mensaje "vuelve mañana" es falso. Hay que anclar la ventana a la zona de la organización.
- **Un fallo de consulta se presenta como negación o como ausencia de datos** en el camino del Scout, el patrón que ya se corrigió en `/admin`. `app/chat/[id]/page.tsx` usa `.single()` y manda cualquier error a `notFound()` ("tu conversación no existe" por una caída de un segundo); `app/page.tsx` lee `conversations` sin revisar error y pinta "aún no tienes conversaciones"; las lecturas de perfil convierten un error en "tu cuenta no está habilitada", el mensaje más alarmante posible para alguien de 15 años.

Media:
- **Errores crudos de Postgres llegan a la UI del Scout**: `app/api/chat/route.ts` devuelve `errorTurno?.message` tal cual y el cliente lo pinta. El panel admin ya sanitiza con `MENSAJES_ERROR`; el chat no. Y `components/chat/conversacion.tsx` hace `respuesta.json()` antes de comprobar `respuesta.ok`, así que un 500 o 504 sin cuerpo JSON se muestra como "no hay conexión con el servidor" cuando el turno ya se gastó.
- **`/admin/documentos` y `/admin/usuarios` no auditan su apertura**, aunque el de usuarios muestra nombres y correos de todos los perfiles. P-RF-17 exige auditar el acceso a *conversaciones* (eso sí está), así que no es incumplimiento literal, pero es inconsistente con el criterio del propio panel, que sí audita el listado de conversaciones.
- **Nada asigna `pendiente_autorizacion`.** El estado existe, la home lo explica y el admin puede aplicarlo, pero toda cuenta nueva nace `activo`: cualquiera con un correo válido obtiene 30 llamadas a Gemini por día. La decisión de fondo es organizacional; la mitigación (default distinto o allowlist de correos) es de una línea.
- **El panel admin nunca se ha ejercitado con un admin real:** 0 perfiles con `role = 'admin'` y `admin_audit_events` vacía. Todo lo verificado hasta hoy fue con usuarios sintéticos y `rollback`.
- **Rutas implementadas pero nunca ejercitadas:** 0 filas con `status = 'blocked'` y 0 con `error_code = 'invalid_model_json'` en `model_request_events`. El bloqueo del proveedor y el retry de JSON están escritos y sin probar.

Baja:
- `app/page.tsx` lista las conversaciones del usuario sin `.range()` (crear conversación no consume cuota, pero 1000 conversaciones dejarían las antiguas inalcanzables).
- Archivar una conversación no revisa el error del `update` y siempre redirige, así que un fallo se lee como botón roto. Tampoco hay desarchivar desde la UI.
- Claves foráneas sin índice de cobertura en `citations.knowledge_document_id` y en los tres `*_message_id`/`conversation_id` de `model_request_events`, las tablas que más crecen. Con el `statement_timeout` de 8 s del rol `authenticated`, un scan secuencial no se vuelve lento: falla.
- Poda de la plantilla incompleta: 16 componentes de `components/ui` sin ningún consumidor, más `hooks/use-mobile.ts` y `lib/constants.ts`. La Fase 6 decide qué se queda. No hay ningún TODO/FIXME en el código.

**Pendiente de gestión:**
- Ejecutar `scripts/seed-admin.sql` cuando el admin real se registre (hoy la base tiene 0 admins activos) y recorrer el panel completo end-to-end.
- Activar **protección de contraseñas filtradas** en Supabase Auth (Dashboard → Auth → Password security). Hoy está desactivada y el piloto tiene menores.
- Confirmar el valor real de **Max rows** del proyecto (Dashboard → Settings → API). Todo el análisis de paginación asume el default de 1000; si estuviera más bajo, los truncamientos llegan antes.
- Eliminar `AUTH_SECRET` de Vercel (ya no se usa).
- **Dependabot: el conteo está inflado.** De las 48 alertas abiertas, 28 son de paquetes que ya no están en el lockfile (`next-auth`, `@auth/core`, `dompurify`, `undici`, `linkify-it`, `markdown-it`, `@opentelemetry/core`), eliminados al podar la plantilla. Lo realmente vivo son ~6 altas (`next`, `sharp`, `postcss`, `ws`), y subir `next` a >= 16.2.11 cierra la mayoría, incluida una de bypass de proxy. Descartar las obsoletas como "dependencia eliminada" para que el número signifique algo.
- Los 4 avisos `rls_enabled_no_policy` de los advisors son intencionales (0001 §5.7: RLS sin políticas = solo servidor). No "arreglarlos".
- Bloqueos organizacionales (sección al final): 8 PDFs oficiales, política de privacidad (`PRIVACY_POLICY_VERSION` + UI de aceptación), defaults para menores.

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
- [x] Ver conversación ajena: acceso directo sin motivo (decisión 2026-07-17, errata 7 del pilot-scope) con log silencioso automático en `admin_audit_events` por cada apertura, fail-closed. [P-RF-17; P-RF-16 derogado]
- [x] Página admin de documentos: listar (nombre, versión, indexación, error) y activar/desactivar con auditoría; la desactivación sale del `metadataFilter` de inmediato. Activar exige metadata sincronizada sin error de indexación y retira las otras versiones del mismo manual (`0010`). [P-RF-19, §13.2]
- [x] Cambios de estado de cuenta desde admin con motivo y auditoría (`change_user_status`); un admin no puede cambiarse a sí mismo. Listado de usuarios paginado.
- [x] Endurecimiento tras las 8 rondas de revisión: navegación por documento en todo `/admin` (invariante de `next/link`), `no-store` para `/admin/*`, transcripción paginada con detección de truncamiento por `count`, estado persistido de cada respuesta visible para el revisor, `<img>` bloqueado en el Markdown del asistente, revalidación del admin dentro de las RPC (`0009`) y errores de Supabase que ya no se presentan como ausencia de datos.

Verificado e2e (2026-07-17): acceso directo del admin con log silencioso registrado por apertura, toggle de documento reflejado en la base, bloqueo de cuenta efectivo end-to-end (RPC atómica update+auditoría), y un scout no accede a `/admin` (redirect).

Verificado en base (2026-07-31), con bloques SQL con `rollback` y sin residuo: reactivar una versión retira la hermana y deja los dos eventos de auditoría; un admin bloqueado recibe `admin_no_autorizado` en ambas RPC y un admin activo sí aplica el cambio.

---

## Fase 5 — Calidad y endurecimiento

Con 1 solo PDF indexado esta fase se puede empezar pero no cerrar: unos 13-16 de los 30 casos son escribibles y ejecutables hoy; los otros 14-17 esperan los manuales oficiales. Los 4 de conflicto son imposibles por definición con un documento (la categoría mide la selección entre documentos parecidos), y los ~8 frecuentes que faltan exigirían inventar `expected_document_title` y `expected_page_hint` de manuales que nadie ha leído.

- [ ] Fijar en `docs/notes/rag-eval-criterios.md` el criterio de veredicto por categoría y a qué umbral de §14.2 responde cada aserción. Es el artefacto que falta de verdad: `rag_eval_cases` guarda `expected_behavior` en prosa, así que el veredicto automático se deriva de `category`. Decidir ahí si hace falta una columna `expected_estado` o si `category` alcanza.
- [ ] Extraer a `lib/chat/` el núcleo que hoy vive en `app/api/chat/route.ts` (resolución de stores activos y `metadataFilter`, normalización de citas con snapshot, regla de vaciado de §7.2, marcas de calidad). Va **antes** del runner: sin esto el runner es una segunda implementación del producto y evalúa algo que el Scout no usa. Rama y PR propios porque toca código de producción.
- [ ] Cargar los casos ejecutables en `rag_eval_cases` (`scripts/seed-rag-eval-cases.sql`, mismo canal que `seed-admin.sql`). Dejar fuera los bloqueados en lugar de sembrarlos con expectativas inventadas. Requiere leer el Reglamento Red de Jóvenes. [P-RF-21, §14]
- [ ] Runner `scripts/run-rag-eval.ts` que llame la capa de Gemini **directo, no el endpoint HTTP**: el endpoint consume la cuota de 30 turnos (una corrida agota el día), escribe mensajes y citas reales que ensucian el panel y las métricas, y `model_request_events.user_id` es `not null` con FK a `profiles`. Una fila por corrida en `rag_eval_runs`; el detalle por caso a `data/rag-eval-<timestamp>.json`, fuera de Git (el detalle por caso en base es P1, §14.3). Guardar las citas **crudas del grounding** además de las visibles: si solo se miran las visibles, "fuera de alcance no inventa fuente" pasa por construcción, porque el servidor ya las vació. Prever un veredicto `revisar` y un modo `--revision` para registrar el juicio humano sin gastar otra corrida.
- [ ] Ajustar prompts según resultados; repetir hasta cumplir los umbrales de §14.2 (solo certificable con los 8 manuales).
- [ ] Pruebas del checklist que no son parte de los 30 casos y sí van contra el endpoint, patrón `verify-rls.mjs` (no hay framework de tests y no hace falta): límite diario bajando `max_chat_turns_per_user_per_day` a 2, opción guiada que consume el mismo contador, bloqueo del proveedor mapeado a `bloqueado_por_seguridad`, y JSON inválido con retry único (este no se puede provocar desde fuera con el schema puesto: hace falta un script que llame al SDK sin `responseJsonSchema`).
- [ ] Tests donde un error sale caro: `normalizarCitas` (función pura) e `insertar_turno_usuario`.
- [ ] Revisión de RLS y recorrido completo de la Definition of Done (§18, con la errata 7) y el checklist técnico (§19).

Notas de la auditoría útiles para las pruebas de citas: `retrievedContext` no trae `documentName` ni `mediaId`, así que `citations.file_search_document_name` y `media_id` quedan nulos y las pruebas no deben esperarlos. `knowledge_documents.file_search_document_name` también quedó nulo en la única fila (el proveedor no lo entregó en `operation.response.document.name`); no rompe las citas, pero revisar con los PDFs reales.
- [x] Despliegue en Vercel: activo desde la Fase 2 (previews por PR + producción en master). Queda solo verificar variables de producción en el recorrido del checklist.

---

## Fase 6 — UI y design system (al final, decisión 2026-07-17)

Primero toda la funcionalidad; la capa visual se aplica al final sobre pantallas ya estables.

- [ ] Retomar la rama **`feat/design-system`** (PR #4, cerrado sin merge; NO borrar la rama): tokens de marca de `ruta` (scouts-*, secciones, PNPJ, radius), tipografías locales Futura/JollyGood (`app/fuentes.ts` + `app/fonts/`), superficies `auth-hero`/`auth-card-surface` (glass) y `components/ui/card`. Todo quedó construido y verificado (preview desplegado en el PR #4); al retomar: rebase sobre master o re-aplicación por partes (los archivos de tokens/fuentes son aditivos; solo las pantallas tocadas necesitan ajuste manual).
- [ ] Aplicar el design system al chat y pantallas nuevas de las Fases 3-4.
- [ ] Traer de `ruta` los `components/ui` restantes y el `theme-toggle` (acoplado en ruta a su cookie de tema; adaptar).

---

## Bloqueos organizacionales (en paralelo, no son de ingeniería)

Estos no dependen de código, pero pueden frenar el lanzamiento si llegan tarde. **A 2026-07-31 son el camino crítico:** el código de las Fases 0-4 está en master y lo que impide lanzar ya no es ingeniería. Pedirlos por escrito con fecha de compromiso.

- [x] **Manuales oficiales entregados e indexados (2026-08-01).** Son los 5 de la carpeta Clan, no los 8 que estimaba el alcance. Pendiente de la Dirección: confirmar si el corpus del piloto se cierra en estos 5 o llegan más ramas.
- [ ] **Confirmar que la Guía para el Dirigente de Clan es versión final.** Se indexó por decisión del dueño (2026-08-01), pero conserva instrucciones editoriales sin resolver dentro del texto ("Nota para insertar como pie de página a manera de referencia...", pp. 32, 34 y 66), la numeración salta del capítulo 11 al 13 y la tabla de contenido termina en el 12. El bot puede citar esas notas como contenido normativo. Reemplazarla es barato: mismo nombre de archivo en `data/pdfs/` y volver a correr el script, que retira la versión anterior y deja las citas históricas con su snapshot.
- [ ] Texto y versión de la política de privacidad y los términos. **Encontrada (2026-08-01):** "Política y Procedimientos de Tratamiento de Información Personal", Acuerdo del Consejo Scout Nacional No. 369 (Resolución CSN No. 004-20), vigente desde el 9 de marzo de 2020, en https://scout.org.co/politica-privacidad. Hay versión citable para `consent_acceptance_events`, así que el consentimiento ya se puede construir. **Pero la política NO tiene sección sobre menores ni menciona autorización de adulto responsable**, así que no resuelve los dos puntos de abajo. **Al publicarla: construir la UI de aceptación PRIMERO y fijar `PRIVACY_POLICY_VERSION` en Vercel DESPUÉS.** El gate del chat ya funciona: fijar la variable sin la pantalla deja a todos los usuarios bloqueados sin salida.
- [ ] Decisión del default de `account_status` para menores: `activo` o `pendiente_autorizacion`.
- [ ] Política de autorización de adulto responsable para usuarios de 15 a 17.
- [ ] Política de situaciones sensibles, requisito previo a cualquier escalamiento (P2).

---

## Uso con Claude Code / agentes

- Trabaja una tarea a la vez y marca el checkbox al cerrarla. La primera tarea sin marcar de la fase más temprana disponible es la siguiente.
- Actualiza la sección "Estado actual" cuando cierres una fase o tomes una decisión de arquitectura.
- Si una sesión se ensucia, usa `/clear` entre tareas no relacionadas; `CLAUDE.md` se recarga solo.
- El alcance autoritativo es `docs/pilot-scope-v0.3.1.md` (con sus erratas), no la v0.2.
