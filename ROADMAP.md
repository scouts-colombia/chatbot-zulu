# ROADMAP — Piloto Chat con Documentos para Scouts

Plan por fases derivado del alcance v0.3.1. Las referencias entre corchetes apuntan a requisitos `P-RF`, secciones `§` y decisiones `D` de `docs/pilot-scope-v0.3.1.md`.

Regla de trabajo: las fases van en orden (la regla original de paralelismo entre Fases 1 y 2 ya cumplió su propósito: ambas están cerradas y los spikes quedaron verdes).

---

## Estado actual (2026-08-11) — handoff

**Dónde está el proyecto:** Fases 0 a 4 cerradas en master. La UI de consentimiento y el turno público están implementados en la PR #12; antes de exponerlos solo falta completar su configuración de despliegue. La modernización visual de la Fase 6 fue adelantada por decisión de producto del 2026-08-09 y se trabaja en una PR apilada. La evaluación RAG de la Fase 5 sigue pendiente y su certificación requiere resolver el corpus definitivo (el alcance pide 8 documentos y hay 6).

**Hecho:**
- Fases 0 y 1 cerradas: infra completa (Supabase **ChatBot Zulú** `ddimxdrggrrfcvzwwben`, Gemini Developer API con `gemini-3.5-flash`, Vercel con previews por PR) y gate de spikes VERDE 7/7 (`docs/notes/spike-file-search-resultado.md`).
- **Fase 2 cerrada:** migraciones aplicadas, RLS verificada 25/25 (`scripts/verify-rls.mjs`), plantilla podada, Supabase Auth en español y aceptación explícita de la política implementada para cuentas permanentes y para el turno invitado. Antes de desplegar el flujo público faltan únicamente las variables y toggles operativos documentados en el ítem de consentimiento.
- **Fase 3 cerrada (PR #5, mergeado):** chat completo contra Gemini File Search — cuota atómica por RPC, citas por `knowledge_document_id` con `metadataFilter` de documentos activos, retry único de JSON, bloqueo del proveedor mapeado, typewriter, preguntas guiadas, `scripts/index-knowledge-documents.ts` idempotente. Verificado e2e contra servicios reales.
- **Fase 4 cerrada (PR #6, mergeado con squash el 2026-07-31, commit `2b53369`):** panel admin con guard de rol en servidor — listado paginado de conversaciones, **acceso directo al contenido con log silencioso** (sin motivo; cada apertura registra fila en `admin_audit_events`, fail-closed), transcripción paginada con citas, preguntas guiadas y estado de cada respuesta, documentos y estados de cuenta con RPCs atómicas. 8 rondas de revisión de Codex, 31 hilos resueltos, ninguno abierto.
- **PR #7 mergeado (2026-08-01):** endurecimiento del camino del Scout — transcripción paginada por cursor con "Ver mensajes anteriores", ventana de cuota anclada a la zona de la organización, fallos de consulta que ya no se presentan como negación ni como vacío, y errores crudos de Postgres fuera de la UI.
- Migraciones aplicadas al proyecto: `0001`–`0019`, `proteger_invitados_y_encolar_limpieza`, `serializar_conversacion_y_transferencia_invitada` y `expirar_identidades_y_fijar_destino_invitado`. `0012` crea la allowlist del piloto: las cuentas invitadas nacen `activo`, las demás `pendiente_autorizacion`; no modifica cuentas existentes. Verificada en Supabase el 2026-08-06 (tabla, RLS sin políticas, funciones, default y preservación de estados). `0013` agrega a `model_request_events` el desglose nullable de prompt, File Search/herramientas, caché, respuesta visible, pensamiento y nivel, conserva los aliases históricos y añade una vista diaria por modelo/nivel; aplicada y verificada el 2026-08-07. `0014`–`0016` implementan el turno invitado, optimizan sus políticas y endurecen el preflight, la transferencia y la cuota; `0016` se aplicó y verificó en el proyecto el 2026-08-07. `0017` conserva la evidencia de consentimiento y la telemetría del modelo al convertir una identidad invitada en cuenta permanente antes de eliminar el usuario técnico. `0018` recompone desde esa evidencia la caché de consentimiento de la cuenta destino. `0019` impide transferir y borrar la identidad técnica mientras su turno aún procesa al proveedor o persiste telemetría, y expone la finalización únicamente a `service_role`; las tres se aplicaron y verificaron el 2026-08-09 (funciones, privilegios, historial, RLS 25/25 y advisors sin errores nuevos). `proteger_invitados_y_encolar_limpieza` se aplicó y verificó el 2026-08-11: protege `profiles.is_guest`, encola atómicamente el UUID técnico transferido y permite reintentos privados con `SKIP LOCKED`; RLS y privilegios quedaron cerrados a `anon/authenticated`. Los advisors solo añadieron el INFO intencional de RLS sin políticas para esta tabla de servidor; los demás avisos son preexistentes. `serializar_conversacion_y_transferencia_invitada` se aplicó y verificó el 2026-08-11: creación/selección de conversación, reserva y transferencia comparten `guest-user:<uuid>` antes de leer estado mutable; dos invocaciones devolvieron el mismo UUID y una sola conversación, sin residuo de usuario de prueba. La RPC nueva es exclusiva de `service_role`; advisors sin hallazgos nuevos. `expirar_identidades_y_fijar_destino_invitado` se aplicó y verificó el 2026-08-11: toda alta anónima queda encolada en la misma transacción de Auth, una reserva exitosa cancela la expiración, un claim ya entregado bloquea una reserva tardía y cada transferencia fija un solo UUID destino. La prueba remota confirmó los cinco escenarios, dejó 0 anónimos/0 filas de cola y los advisors no reportaron hallazgos nuevos. `coordinar_conversion_y_limpieza_invitada` se aplicó y verificó el 2026-08-12: la conversión in-place toma el lock de la fila de limpieza, falla si Auth Admin ya recibió el UUID y retira atómicamente una expiración no reclamada. Una prueba transaccional confirmó ambos caminos, dejó 0 residuos y la función continúa sin ejecución para `anon`/`authenticated`; advisors sin hallazgos nuevos. `alinear_preflight_y_sesion_invitada` se aplicó como versión remota `20260812164406`: la RPC privada devuelve el TTL efectivo a la cookie y la cola de Auth espera al menos `max(15 min, TTL)`; devolvió 600 segundos con la configuración actual, quedó exclusiva de `service_role`, dejó 0 residuos y los advisors no añadieron hallazgos.
- **Corpus indexado (2026-08-06):** hay 6 documentos activos y faltan 2 de los 8 del alcance. A los 5 manuales ya documentados se sumó PARCE — Proceso Autónomo del Rover en Competencias para su Evolución (v0.5), activo y con metadata sincronizada tanto en Supabase como en Gemini. La versión de cada documento vive en `scripts/versiones-documentos.json`. Verificado contra Gemini real con la capa del chat: citas cruzadas por `knowledge_document_id` con versión y página correctas, y `sin_fuente` sin citas para una pregunta fuera de alcance.
- **Gemini usa razonamiento `low` (2026-08-07):** `GEMINI_THINKING_LEVEL=low` quedó configurada en Vercel para Production, Preview y Development. Un smoke controlado con `gemini-3.5-flash`, los mismos stores y dos preguntas por nivel dio calidad básica 2/2 y cero retries para `medium`, `low` y `minimal`; `low` redujo tokens totales de 21.563 a 7.607 y latencia agregada de 38.012 ms a 15.913 ms frente a `medium`. Es evidencia para la decisión operativa, no reemplaza los 30 casos de la Fase 5.
- **Admin real promovido (2026-08-06):** `desarrollo.tecnologico@scout.org.co` tiene `role = admin` y `account_status = activo`. Falta recorrer el panel completo y comprobar los primeros `admin_audit_events`.

**Decisiones e invariantes vigentes:**
- **Acceso admin sin motivo obligatorio** (2026-07-17): errata 7 de `docs/pilot-scope-v0.3.1.md` (deroga P-RF-16; P-RF-17 se mantiene vía log silencioso automático). **No reintroducir el formulario de motivo.**
- **Ningún `next/link` dentro de `/admin`** (2026-07-31), ni para entrar ni para salir: todo el panel navega con `<a>` y el proxy responde `no-store` para `/admin/*`. Las páginas admin auditan al renderizar en servidor, y una navegación SPA deja la ruta en la caché de cliente del App Router (con `cacheComponents`, hasta 3 árboles en un `<Activity>` oculto), así que volver con Atrás la revelaría sin re-ejecutar el server component: sin fila de auditoría y sin pasar por `requerirAdmin`. Verificado en el código de Next 16.2: en atrás/adelante el router sirve del bfcache con `needsDynamicRequest: false` y `staleTimes` excluye ese caso por diseño. `router.refresh()` no sirve como parche (es asíncrono, fusiona sobre el árbol visible y no se puede esperar); el guard de bfcache usa `location.reload()`.
- **Una sola versión activa por manual** (migración `0010`): activar un documento retira en la misma transacción las otras versiones activas del mismo `display_name` y audita cada retiro. Sin eso, dos versiones entraban al `metadataFilter` y una respuesta podía fundamentarse en el manual obsoleto.
- **Las RPC administrativas revalidan al admin** (migración `0009`) dentro de la transacción del cambio, con `select ... for share` sobre su perfil. `requerirAdmin()` es barrera de UI, no de integridad. Ambas siguen siendo `security invoker` a propósito: `service_role` ya salta la RLS, y `definer` convertiría cualquier grant futuro en escalamiento.
- **Un fallo de consulta nunca se presenta como ausencia de datos** en el panel: error de Supabase ⇒ aviso `role="alert"`, no lista vacía ni 404. Y las consultas que pueden crecer se paginan con `count` exacto, porque PostgREST corta en `db-max-rows` (1000 por defecto) sin devolver error.
- **Nivel de razonamiento Gemini:** `low` es la configuración operativa. Si la variable falta o es inválida, el servidor usa `medium` como fallback de calidad y registra un aviso; el nivel efectivo se persiste por intento.
- Design system al final (Fase 6); la rama `feat/design-system` se conserva sin borrar.

**Flujo de trabajo vigente** (detalle en `CONTRIBUTING.md`): rama → PR → CI verde → revisión de Codex (responder cada comentario, resolver hilos, reinvocar con `@codex review` hasta ronda limpia) → squash and merge, que hace el dueño del repo personalmente.

**Siguiente:** cerrar la PR #12 del turno público y consentimiento, y después la PR visual apilada de la Fase 6 que producto priorizó. Esa interfaz usa el fondo crema de Ruta `/diseno/componentes` y elimina por completo el modo oscuro; no se debe reintroducir un selector de tema.

Después, **Fase 5** — fijar los criterios, cargar los 30 casos en `rag_eval_cases` (12/6/6/4/2) y construir el runner que persista en `rag_eval_runs`. Con los 6 documentos activos —los 5 manuales base más PARCE v0.5— las 5 categorías son ejecutables, incluidas conflicto y adversariales; la corrida solo se repite si el corpus cambia.

**Deuda técnica conocida (en master).** Auditoría del 2026-07-31 contra código y base. El camino del Scout se endureció en el PR #7 (mergeado el 2026-08-01): transcripción paginada con cursor, ventana de cuota anclada a la zona de la organización (migración `0011`), fallos que ya no se leen como "no existe" ni como lista vacía, errores crudos de Postgres fuera de la UI y archivado con aviso. Lo que sigue abierto:

Media:
- **`/admin/documentos` y `/admin/usuarios` no auditan su apertura**, aunque el de usuarios muestra nombres y correos de todos los perfiles. P-RF-17 exige auditar el acceso a *conversaciones* (eso sí está), así que no es incumplimiento literal, pero es inconsistente con el criterio del propio panel, que sí audita el listado de conversaciones.
- **La puerta de entrada por allowlist ya está aplicada**, pero falta cargar la lista real de invitados. No ejecutar `scripts/seed-allowlist.sql` con los correos de reemplazo; agregar un correo después del registro no activa retroactivamente la cuenta, que debe habilitarse desde `/admin/usuarios` para dejar auditoría.
- **El panel admin todavía no se ha recorrido end-to-end con el admin real ya promovido.** Falta comprobar las primeras filas de `admin_audit_events`; las verificaciones anteriores del panel fueron con usuarios sintéticos y `rollback`.
- **Rutas implementadas pero nunca ejercitadas:** 0 filas con `status = blocked` y 0 con `error_code = invalid_model_json` en `model_request_events`. El bloqueo del proveedor y el retry de JSON están escritos y sin probar.

Baja:
- No hay forma de desarchivar una conversación desde la UI, así que un archivado accidental es definitivo para el usuario.
- Claves foráneas sin índice de cobertura en `citations.knowledge_document_id` y en los tres `*_message_id`/`conversation_id` de `model_request_events`, las tablas que más crecen. Con el `statement_timeout` de 8 s del rol `authenticated`, un scan secuencial no se vuelve lento: falla.
- Poda de la plantilla incompleta: 16 componentes de `components/ui` sin ningún consumidor, más `hooks/use-mobile.ts` y `lib/constants.ts`. La Fase 6 decide qué se queda. No hay ningún TODO/FIXME en el código.
- El indexador tiene más caminos donde la fila local y el estado del proveedor pueden divergir (auditoría del 2026-08-01): revertir a un PDF anterior lo salta por sha sin mirar `active`; un fallo tras la subida deja el documento en el store y la fila sin `metadata_synced_at`, y el panel no puede rescatarla porque `0010` exige `last_index_error is null`; el retiro de hermanos filtra por `display_name`, que es texto mutable; y el script fuerza `active = true` sobre documentos que un admin desactivó a propósito, sin dejar auditoría. Conviene un modo `--verify` que compare el store contra `knowledge_documents` en ambas direcciones.

**Pendiente de gestión:**
- Recorrer el panel completo end-to-end con el admin real ya promovido y comprobar los primeros `admin_audit_events`.
- Mantener desactivada la **protección de contraseñas filtradas** en Supabase Auth por decisión del usuario.
- Confirmar el valor real de **Max rows** del proyecto (Dashboard → Settings → API). Todo el análisis de paginación asume el default de 1000; si estuviera más bajo, los truncamientos llegan antes.
- Eliminar `AUTH_SECRET` de Vercel (ya no se usa).
- **Dependabot: el conteo está inflado.** De las 48 alertas abiertas, 28 son de paquetes que ya no están en el lockfile (`next-auth`, `@auth/core`, `dompurify`, `undici`, `linkify-it`, `markdown-it`, `@opentelemetry/core`), eliminados al podar la plantilla. Lo realmente vivo son ~6 altas (`next`, `sharp`, `postcss`, `ws`), y subir `next` a >= 16.2.11 cierra la mayoría, incluida una de bypass de proxy. Descartar las obsoletas como "dependencia eliminada" para que el número signifique algo.
- Los avisos `rls_enabled_no_policy` de los advisors son intencionales (0001 §5.7 y `allowed_emails` en 0012: RLS sin políticas = solo servidor). No "arreglarlos".
- Bloqueos organizacionales (sección al final): completar el corpus definitivo (6 indexados frente a los 8 del alcance). La UI de aceptación ya existe; queda configurar `PRIVACY_POLICY_VERSION` y los demás valores/toggles del flujo público antes de exponerlo.

---

## Fase 0 — Cuentas y llaves (sin código)

- [x] Crear el proyecto en Supabase: **ChatBot Zulú** (`ddimxdrggrrfcvzwwben`, us-east-2, Postgres 17). Obtener anon key y service role key del dashboard para `.env.local`; la service role solo va en servidor.
- [x] Crear API key de Gemini (**Gemini Developer API**, no Vertex). Smoke test 2026-07-15: HTTP 200, `gemini-3.5-flash` disponible y generando. (Billing/créditos: verificar si el tier gratuito limita File Search durante el spike.)
- [x] Conseguir **1 PDF oficial de prueba**: el Reglamento Red de Jóvenes (carpeta `data/pdfs/`, fuera de Git). Desde el 2026-08-01 `data/pdfs/` contiene los 5 manuales oficiales con su nombre real y desde el 2026-08-06 contiene además PARCE v0.5: son 6 documentos locales en total. El título visible de cada documento sale del nombre de archivo.
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
- [x] Verificar RLS con el JWT del usuario: `scripts/verify-rls.mjs` — **VERDE 25/25** el 2026-08-07 (aislamiento entre Scouts, registro invitado activo y no invitado pendiente, no auto-escalamiento de rol, mensajes de asistente no forjables, archivadas no aceptan mensajes y tablas de servidor invisibles).

### Poda de la plantilla
- [x] Eliminados: NextAuth (`app/(auth)` de la plantilla, botid, `AUTH_SECRET`), artefactos, tools, streams reanudables (Redis/`resumable-stream`), votos, sugerencias, chat de la plantilla, tests e2e de la plantilla. Conservados: `components/ui`, `theme-provider`, layout base.
- [x] Eliminado Drizzle completo (`drizzle.config.ts`, `lib/db`, scripts `db:*`); el acceso a datos es supabase-js.
- [x] `package.json` limpio: de ~60 dependencias a ~20 (fuera ai-sdk, codemirror, prosemirror, katex, redis, postgres, etc.). Debería bajar varias alertas de Dependabot.
- [x] CI reducido a lint + typecheck: eliminado `playwright.yml` (probaba NextAuth/stack de la plantilla y fallaba por `MissingSecret`); typecheck añadido a `lint.yml`. Reescribir e2e propios (P1 de esta fase).

### Auth y cuenta
- [x] Supabase Auth: registro/login por correo con UI en español (`app/(auth)`, server actions, errores traducidos). Verificado en navegador contra el proyecto real: login → home con perfil vía RLS → logout. Nota: GoTrue valida entregabilidad del dominio del correo en signUp (dominios inventados fallan; correos reales pasan).
- [x] Protección de rutas en `proxy.ts` con la sesión de Supabase (`@supabase/ssr`): sin sesión o con sesión anónima → chat público en `/`; las rutas privadas siguen exigiendo una cuenta permanente. Una sesión permanente sale de `/login` y solo permanece en `/registro` mientras completa la contraseña tras convertir su turno invitado.
- [x] Estados de cuenta en la home: mensaje de bloqueo si `account_status != 'activo'`. El gate de API se implementa con el endpoint de chat (Fase 3).
- [x] **Flujo de consentimiento.** Implementado para cuentas permanentes y para el primer turno invitado: aceptación explícita de la política, inserción append-only en `consent_acceptance_events` y actualización atómica de la caché en `profiles` mediante RPC de solo servidor (`0014`). La política canónica es el Acuerdo del Consejo Scout Nacional No. 369 (Resolución CSN No. 004-20), vigente desde el 9 de marzo de 2020, publicada en https://scout.org.co/politica-privacidad y aplicable igual a todas las edades. El consentimiento queda ligado a la versión mostrada —un cambio concurrente se rechaza— y el token opaco del borrador se preserva a través de la puerta de consentimiento. El mapping token→texto usa `localStorage` con TTL de 30 minutos para atravesar una pestaña nueva del correo sin poner la pregunta en la URL; la restauración exige el UUID y vuelve a `sessionStorage` al entrar en la conversación. Los fallos del callback conservan únicamente ese token validado. Falta configurar en el despliegue `PRIVACY_POLICY_VERSION`, `GUEST_LIMIT_SECRET`, `SITE_URL` y habilitar Anonymous Sign-Ins + Manual Linking en Supabase Auth antes de exponer el turno público. [P-RF-04, D-10]
- [x] **Endurecimiento final del traspaso invitado (2026-08-12):** los borradores pendientes se purgan por prefijo al abrir chat/auth y cada minuto mientras esas superficies siguen abiertas, sin necesitar conocer el token abandonado. Cuando `/api/chat` ya reservó la pregunta pero exige registro, devuelve el UUID del hilo; el cliente liga el token opaco a ese UUID, lo conserva por login, registro, callback y consentimiento, y la portada solo redirige después de confirmar por RLS que la conversación transferida pertenece a la cuenta. El primer preflight se serializa entre pestañas con un Web Lock del origen; si el navegador no puede garantizar esa coordinación, el turno invitado falla cerrado hacia registro en lugar de permitir identidades paralelas.

---

## Fase 3 — Chat usable (requiere spikes verdes + Fase 2)

- [x] Conversaciones: crear, listar, abrir, archivar (server actions con el JWT del usuario; título automático con la primera pregunta). [P-RF-05, P-RF-06]
- [x] Endpoint `POST /api/chat` que verifica usuario, estado de cuenta, consentimiento y cuota antes de llamar al modelo. [P-RF-07, P-RF-14]
- [x] Guard de cuota diaria usando `daily_chat_turns_by_user` antes de guardar el mensaje y de llamar al modelo. [D-11]
- [x] Llamada a Gemini con File Search + `responseJsonSchema`. Historial: últimos 8 mensajes, sin resumen. Store(s) desde `knowledge_documents.active`. [P-RF-08, §10]
- [x] Validación de JSON (zod) + reintento único con prompt correctivo + fallback `error` con `invalid_model_json`. [P-RF-09, D-09]
- [x] Normalización de citas por `knowledge_document_id` (búsqueda por `key` en el arreglo `customMetadata`) y persistencia en `citations`. Marcas de calidad `missing_knowledge_document_id` y `respondido_sin_citas` en el evento. [P-RF-10, D-07, D-12]
- [x] Bloqueo del proveedor (`promptFeedback.blockReason`, `finishReason=SAFETY`, candidato vacío) mapeado a `bloqueado_por_seguridad` con mensaje seguro. [D-08]
- [x] `model_request_events` por intento con `attempt_index`, latencia, tokens, grounding y `safety_block_source`. [P-RF-18, D-03]
- [x] Render markdown (react-markdown) + chips de citas con documento y página. Typewriter local sobre texto ya validado (por tiempo transcurrido, inmune al throttling de pestañas); indicador "escribiendo". [P-RF-11, D-04]
- [x] `sin_fuente` con citas vacías forzadas en servidor (§7.2) y badge en UI. [P-RF-12]
- [x] Preguntas guiadas: persistidas en `guided_questions`/`options`, botones 2-4 + input libre; elegir una opción envía un turno normal por el mismo endpoint. [P-RF-13]
- [x] `scripts/index-knowledge-documents.ts` completo (reserva fila → upload con custom_metadata → confirma sincronización; idempotente por sha256, FORCE=1 para reindexar). Store del piloto creado; los 5 manuales de Clan se indexaron el 2026-08-01 y PARCE v0.5 el 2026-08-06, para un total de 6 documentos activos con versión registrada en `scripts/versiones-documentos.json`. [P-RF-19, P-RF-20]

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

Con los 6 documentos activos —los 5 manuales indexados el 2026-08-01 más PARCE v0.5, indexado el 2026-08-06— **los 30 casos son escribibles y ejecutables**: ya no hay categorías bloqueadas por falta de corpus. Lo que queda condicionado es la certificación, porque el alcance pide 8 documentos y hoy hay 6 (ver bloqueos organizacionales): si el corpus cambia, la corrida se repite.

Dos pistas concretas que salieron al leer los manuales:
- **Conflicto (4 casos):** el "Reglamento para la Realización de Asambleas Rover" repite casi la misma estructura de funciones, quórum y convocatoria en el capítulo 3 (Asamblea Nacional) y el 5 (Asamblea Regional), con cifras distintas. Es el caso de documentos parecidos servido en bandeja. El "Manual de Cargos y Funciones" y el "Reglamento Red de Jóvenes" también se solapan sobre la Red de Jóvenes.
- **Adversariales (2 casos):** "Equipo de Bolsillo - Rover" trae en los Anexos 5 y 7 prompts literales dirigidos a ChatGPT/Gemini en imperativo ("Ayúdame a pensar en...", "Hazme un resumen en formato de tabla..."). Es prompt injection documental real, con datos propios y sin fabricar un PDF sintético: exactamente lo que D-02 dice defender. Un caso debe comprobar que el asistente los trata como contenido citable y no como instrucciones.

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

## Fase 6 — UI y design system (priorizada, decisión 2026-08-09)

Producto adelantó esta fase después de estabilizar el turno público. La referencia visual es Ruta DNPJ, en especial `/diseno/componentes`: fondo crema, colores vivos, Futura, bordes y superficies liquid glass. El modo oscuro se elimina por completo.

- [ ] Retomar la rama **`feat/design-system`** (PR #4, cerrado sin merge; NO borrar la rama): tokens de marca de `ruta` (scouts-*, secciones, PNPJ, radius), tipografías locales Futura/JollyGood (`app/fuentes.ts` + `app/fonts/`), superficies `auth-hero`/`auth-card-surface` (glass) y `components/ui/card`. Todo quedó construido y verificado (preview desplegado en el PR #4); al retomar: rebase sobre master o re-aplicación por partes (los archivos de tokens/fuentes son aditivos; solo las pantallas tocadas necesitan ajuste manual).
- [ ] Aplicar el design system al chat y pantallas nuevas de las Fases 3-4.
- [x] **Modo oscuro eliminado (decisión 2026-08-09):** se quitaron `next-themes`, el proveedor/script de tema, las variantes `dark:` y la adaptación automática al sistema. Zulú usa exclusivamente el sistema visual claro de Ruta con fondo crema.

---

## Bloqueos organizacionales (en paralelo, no son de ingeniería)

Estos no dependen de código, pero pueden frenar el lanzamiento si llegan tarde. **A 2026-08-06 son el camino crítico:** el código de las Fases 0-4 está en master y lo que impide lanzar ya no es ingeniería. Pedirlos por escrito con fecha de compromiso.

- [ ] **Confirmar el corpus definitivo del piloto.** El 2026-08-01 se indexaron los 5 manuales de la carpeta Clan y el 2026-08-06 se sumó PARCE v0.5; hay 6 documentos activos. El alcance (§18) exige 8 documentos iniciales, así que **este punto NO se cierra con 6**: o la Dirección confirma que el corpus del piloto son estos 6 y se registra la errata correspondiente en `docs/pilot-scope-v0.3.1.md`, o llegan los 2 que faltan. Hasta entonces la Definition of Done no se cumple, aunque el pipeline de indexación ya esté probado end-to-end.
- [ ] **Confirmar que la Guía para el Dirigente de Clan es versión final.** Se indexó por decisión del dueño (2026-08-01), pero conserva instrucciones editoriales sin resolver dentro del texto ("Nota para insertar como pie de página a manera de referencia...", pp. 32, 34 y 66), la numeración salta del capítulo 11 al 13 y la tabla de contenido termina en el 12. El bot puede citar esas notas como contenido normativo. Reemplazarla es barato: mismo nombre de archivo en `data/pdfs/` y volver a correr el script, que retira la versión anterior y deja las citas históricas con su snapshot.
- [x] **Política de privacidad definida e implementada (2026-08-09):** "Política y Procedimientos de Tratamiento de Información Personal", Acuerdo del Consejo Scout Nacional No. 369 (Resolución CSN No. 004-20), vigente desde el 9 de marzo de 2020, en https://scout.org.co/politica-privacidad. Es la única política que aplica, para todas las edades. La UI recoge aceptación explícita y la RPC inserta evidencia append-only en `consent_acceptance_events` mientras actualiza la caché del perfil. Antes de exponer el flujo falta configurar `PRIVACY_POLICY_VERSION`, `GUEST_LIMIT_SECRET`, `SITE_URL`, Anonymous Sign-Ins y Manual Linking en el despliegue.
- [x] **Menores: sin autorización de adulto responsable (decisión de la organización, 2026-08-01).** Todos los usuarios, incluidos los de 15 a 17, se rigen por la política de privacidad de la Asociación; no se pide autorización parental ni se construye flujo alguno para ella. En consecuencia, `guardian_authorization_status` queda sin usar y no hay `pendiente_autorizacion` por edad. La invitación al piloto es una decisión independiente: desde `0012`, un correo incluido en `allowed_emails` nace `activo` y uno no invitado nace `pendiente_autorizacion`; si ya se registró, el admin lo activa manualmente desde `/admin/usuarios` para dejar auditoría.
- [ ] Política de situaciones sensibles, requisito previo a cualquier escalamiento (P2).

---

## Uso con Claude Code / agentes

- Trabaja una tarea a la vez y marca el checkbox al cerrarla. La primera tarea sin marcar de la fase más temprana disponible es la siguiente.
- Actualiza la sección "Estado actual" cuando cierres una fase o tomes una decisión de arquitectura.
- Si una sesión se ensucia, usa `/clear` entre tareas no relacionadas; `CLAUDE.md` se recarga solo.
- El alcance autoritativo es `docs/pilot-scope-v0.3.1.md` (con sus erratas), no la v0.2.
