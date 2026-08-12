# Handoff — turno invitado y sistema visual de Zulú

- Fecha: 2026-08-12 (America/Bogota)
- Repositorio: `D:\dev\chatbot-zulu`
- Proyecto Supabase: `ddimxdrggrrfcvzwwben`
- PR base: [#12 — turno público y consentimiento](https://github.com/scouts-colombia/chatbot-zulu/pull/12)
- PR apilada: [#13 — sistema visual de la aplicación](https://github.com/scouts-colombia/chatbot-zulu/pull/13)

Este es el handoff autoritativo para continuar las dos PR. El handoff de PARCE/allowlist del 2026-08-06 es histórico: no volver a indexar PARCE.

## Actualización — Codex limpio sobre los SHA exactos

Esta sección reemplaza los SHA y resultados anteriores cuando haya discrepancias.

- PR #12 permanece en `578116ad6cb1278fbcf6bc5e86eff7bd08057a71`.
- PR #13 permanece en `56ae08663461f6c495a41aa8f0ca4647912aab28`, apilada sobre
  `578116a`. No hubo rebase ni cambio de código de aplicación.
- Codex Review, con cuota, sobre esos SHA exactos:
  - PR #12 comentario `5274137318` → `5274171091`: "Didn't find any major issues."
    Reviewed commit `578116ad6c`.
  - PR #13 comentario `5274137422` → `5274167162`: "Didn't find any major issues."
    Reviewed commit `56ae086634`.
- Cero hilos de review sin resolver. No hay hallazgos nuevos que corregir.
- Worktree local: rama `agent/zulu-ui-aplicacion` al día con origin; solo
  quedan sin seguimiento `.cursor/mcp.json` y `mcp.json`.
- La migración local `20260812190000_proteger_conversion_invitada_pendiente.sql`
  no estaba aplicada. El conector la aplicó como versión remota
  `20260812234408` / `proteger_conversion_invitada_pendiente` en
  `ddimxdrggrrfcvzwwben`. El desfase de timestamp es el mismo patrón que
  `20260812163500` local → `20260812164406` remoto.
- Verificación remota posterior: columna, tabla, índices, RLS, revokes/grants,
  definiciones, ausencia de `cancelar_registro_invitado_pendiente`,
  preservación de las 3 cuentas y 7 conversaciones, e idempotencia de la
  transferencia. Cero residuos sintéticos.
- Advisors: el único aviso nuevo es el INFO intencional
  `rls_enabled_no_policy` de `guest_transfer_receipts`. Rendimiento sin
  hallazgos nuevos. El WARN de contraseñas filtradas sigue desactivado por
  decisión documentada en ROADMAP.

## Decisiones aprobadas

- `/` abre directamente el chat, no el login.
- Una persona no registrada dispone de exactamente un turno. El siguiente intento exige registro o login y conserva el borrador de manera aislada.
- El límite usa Supabase Anonymous Auth y señales seudónimas de servidor. No se guarda IP cruda ni fingerprint reversible.
- El producto es **Zulú**. El búho queda fuera de este alcance.
- La autoridad visual es `D:\dev\ruta-dnpj\ruta`, en particular `/diseno/componentes`.
- Fondo crema `#fff8eb`, lavados amarillo/durazno, Futura, colores vivos y liquid glass claro. No usar el fondo morado del login.
- El modo oscuro desapareció por completo: sin `next-themes`, proveedor, selector, clase `dark`, variantes `dark:` ni adaptación al esquema del sistema.
- Todas las interfaces —chat público/privado, auth, estados y admin— deben conservar el mismo lenguaje.
- Dentro de `/admin` se usan `<a>`, nunca `next/link`, porque la auditoría ocurre al renderizar en servidor.
- El usuario autorizó push de ambas ramas. No hacer merge; lo hará el dueño del repositorio.

## Topología y estado Git

```text
master
└── agent/zulu-chat-invitado     → PR #12
    └── agent/zulu-ui-aplicacion → PR #13
```

- Base local/remota: `agent/zulu-chat-invitado` en `4240843` (`fix: ordenar imports del chat invitado`).
- Visual local: `agent/zulu-ui-aplicacion` rebasada sobre `4240843`; el fix accesible reescrito está en `9065a66` y el formato de CI en `62f4837`. La historia rebasada fue publicada; antes de este commit documental el remoto apunta a `28bf124`.
- El fix visual `9065a66` contiene las correcciones de los dos hilos abiertos de PR #13: contraste AA en texto de 12 px y objetivo táctil móvil de 44 × 44 px para archivar. Los fixes y el handoff están publicados; el worktree queda limpio tras este commit.
- Los tres rebases visuales terminaron sin conflictos; el último reescribió 13 commits sobre `4240843`.
- Commits en español, sin `Co-Authored-By`. No hay cambios ajenos conocidos.

## PR #12 — estado funcional

Además del chat público, preflight, consentimiento, cuota atómica, transferencia, limpieza y serialización, los últimos commits corrigieron:

### `ecaccde`

1. Carrera entre limpieza y conversión: lock de fila en la migración y revalidación `is_anonymous` en el worker.
2. Error de metadata de citas: fallo cerrado antes de construir/persistir citas degradadas.
3. Borrador pendiente: clave ligada a UUID opaco explícito; la portada pública no restaura borradores de otra visita.

### `95e5287`

1. **Sesión de identidad eliminada:** el proxy reconoce el código oficial `user_not_found` de `@supabase/auth-js` 2.110.6 y hace `signOut({ scope: "local" })`; los errores transitorios siguen fail-closed.
2. **Borrador y consentimiento:** el UUID opaco atraviesa el formulario y todos los redirects del consentimiento, hasta crear/abrir la conversación.
3. **TTL único:** las rutas ya no tienen una constante de 10 minutos. La RPC v2 devuelve el TTL efectivo y la cookie usa ese valor; la limpieza espera al menos `max(15 minutos, TTL)`.
4. **Versión de política:** invitado y cuenta permanente envían la versión mostrada; el servidor rechaza un tab obsoleto, conserva pregunta/token y exige leer/aceptar la versión nueva.
5. **Reduced motion:** el typewriter usa `useSyncExternalStore` con `prefers-reduced-motion`; muestra la respuesta completa y libera citas/preguntas guiadas sin intervalo.
6. `/login` tiene un límite `Suspense` y PR #12 compila/prerenderiza por sí sola.

### `eab632e`

1. **Confirmación en otra pestaña:** el mapping UUID opaco → borrador pendiente usa `localStorage` con TTL de 30 minutos; los borradores ya ligados a conversaciones continúan aislados en `sessionStorage`.
2. **Traspaso explícito:** una pestaña nueva solo restaura el borrador si recibe el UUID v4 exacto; al migrarlo elimina el mapping compartido.
3. **Fallo del callback:** `/auth/callback` conserva únicamente el token `borrador` validado en el redirect de error, sin propagar texto ni parámetros arbitrarios.
4. La prueba simula dos almacenes de sesión separados y un almacén local compartido para cubrir el enlace de correo abierto en otra pestaña.

### `7798f6d`

1. **Expiración real:** chat y auth enumeran únicamente claves pendientes de Zulú al montar y cada minuto; eliminan valores vencidos/inválidos sin conocer el UUID abandonado.
2. **Hilo transferido exacto:** el error posterior a reservar devuelve `conversationId`; el token se liga a ese UUID y ambos atraviesan login, registro, callback y consentimiento.
3. **Validación doble:** la portada confirma por RLS que el hilo pertenece a la cuenta y el almacén local rechaza aplicar el texto a una conversación distinta.
4. **Carrera inicial:** el primer preflight se ejecuta bajo Web Lock exclusivo del origen; una segunda pestaña espera a que la cookie HttpOnly exista. Un navegador sin esa garantía falla cerrado hacia registro.

### `1889eb6`

- Si RLS no encuentra el hilo transferido en la cuenta actual, la portada ya no permite crear un hilo vacío duplicado: muestra recuperación fail-closed y orienta a usar la cuenta correcta.
- No requirió migración ni cambió cuota, privacidad del servidor o reglas de red.

### `aaff17f`

- La home monta `LimpiezaBorradoresPendientes` fuera del `Suspense`; consentimiento permanente, listado, chat público y fallbacks purgan al montar y cada minuto, y cancelan el intervalo al desmontar.

### `80977e1`

1. **Recuperación del hilo ante respuestas ilegibles o caída de red:** el preflight obtiene/crea y devuelve `conversationId` antes del request largo; el cliente valida y conserva ese UUID para restaurar exactamente el hilo ya persistido.
2. **Transferencia idempotente:** la nueva migración guarda un recibo técnico temporal `guest_user_id → target_user_id`; durante una hora permite reintentar al mismo destino aun después de eliminar la identidad invitada y rechaza destinos distintos.
3. **Registro pendiente de verificación:** antes de `updateUser`, el servidor posterga 24 horas la limpieza de la identidad invitada; un fallo explícito de Auth cancela la marca y la conversión confirmada conserva el trigger de limpieza existente.
4. **Gestos de navegación:** `abrirRegistro` persiste el mapping opaco antes de mostrar los enlaces, de modo que click medio, menú contextual y pulsación larga no pierden el borrador.
5. La migración nueva es `supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql`.

### `d9e39f8`

- Añade el índice `idx_guest_transfer_receipts_target_user_id` a la FK con `ON DELETE CASCADE`, evitando un scan completo al borrar una cuenta destino y previniendo un hallazgo nuevo del advisor.

## Supabase confirmado

- `20260812151221 coordinar_conversion_y_limpieza_invitada`: conversión y limpieza mutuamente exclusivas, probadas sin residuos.
- `20260812164406 alinear_preflight_y_sesion_invitada`: corresponde a `supabase/migrations/20260812163500_alinear_preflight_y_sesion_invitada.sql`.
- La RPC `preparar_turno_invitado_v2(text,text,text)` es `SECURITY DEFINER`, solo `service_role` puede ejecutarla; `anon` y `authenticated` no.
- Prueba remota previa: devolvió `ttl_seconds = 600`; cero filas sintéticas residuales. Advisors previos sin hallazgos nuevos, salvo avisos preexistentes/intencionales ya documentados.
- `20260812234408 proteger_conversion_invitada_pendiente`: corresponde a `supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql`. Aplicada y verificada el 2026-08-12 en `ddimxdrggrrfcvzwwben`.
  - `guest_identity_cleanup_queue.registration_pending_until timestamptz` nullable, comentario sin PII.
  - `guest_transfer_receipts`: PK `guest_user_id`, FK `target_user_id → auth.users(id) ON DELETE CASCADE`, checks de usuarios distintos y `expires_at > transferred_at`.
  - Índices: `guest_transfer_receipts_pkey`, `idx_guest_transfer_receipts_expires_at`, `idx_guest_transfer_receipts_target_user_id`.
  - RLS habilitado, 0 políticas. Grants de tabla solo para `postgres` y `service_role`. `anon`/`authenticated`: SELECT/INSERT/UPDATE/DELETE = false.
  - `marcar_registro_invitado_pendiente(uuid)`, `tomar_limpiezas_identidad_invitada(integer, uuid)` y `transferir_conversaciones_invitadas(uuid, uuid)`: `SECURITY DEFINER`, `search_path=""`, EXECUTE solo `service_role`; `anon`/`authenticated`/`public` = false.
  - `cancelar_registro_invitado_pendiente` no existe.
  - Preservación: 3 `auth.users` (0 anónimos), 3 perfiles, 7 conversaciones con los mismos UUID y dueños, 19 mensajes, 1 reserva, 6 documentos, 2 correos de allowlist.
  - Idempotencia: primera transferencia = 1; reintento al mismo destino = 0; destino distinto = `transferencia_invitada_destino_distinto`; reintento tras borrar la identidad invitada = 0. `marcar` dejó `registration_pending_until` > 23 h y `tomar` con `p_preferida` devolvió 0 filas. Limpieza posterior: 0 recibos, 0 cola, 0 perfiles/conversaciones sintéticos.
  - Advisors de seguridad: único aviso nuevo = INFO `rls_enabled_no_policy` de `guest_transfer_receipts` (intencional, tabla de solo servidor). WARN preexistente `auth_leaked_password_protection` (desactivado a propósito). Advisors de rendimiento: sin hallazgos nuevos; las FK sin índice y el índice sin uso de `guest_turn_reservations` son preexistentes.

## Validaciones finales

### Base `4240843`

- `pnpm install --offline --frozen-lockfile`: pasa.
- `pnpm typecheck`: pasa.
- `pnpm test -- --run`: 45/45 pasan.
- `pnpm exec biome lint app components lib proxy.ts`: 62 archivos pasan.
- `git diff --check`: pasa.
- `pnpm build`: pasa; genera 15 páginas y `/login` queda en Partial Prerender.

### Visual `62f4837` tras el rebase

- `pnpm install --offline --frozen-lockfile`: pasa y retira `next-themes`.
- `pnpm typecheck`: pasa.
- `pnpm test -- --run`: 45/45 pasan.
- `pnpm exec biome lint app components lib proxy.ts`: 62 archivos pasan.
- `git diff --check`: pasa.
- `pnpm build`: pasa; genera 15 páginas y `/login` queda en Partial Prerender.
- Búsqueda mecánica: cero referencias funcionales a `next-themes`, `ThemeProvider`, `dark:`, clase `dark`, `prefers-color-scheme` o toggles de tema. Solo aparecen las dos frases de `DESIGN.md` y `.impeccable` que documentan que no existe dark mode.
- Footer y contador de historial usan opacidad `/70`; el botón móvil de archivar tiene mínimo `44 × 44 px`.
- `62f4837` aplica el formato exacto de Biome al `<body>`; Biome dirigido, typecheck, 45/45 pruebas y build de 15 páginas pasan; `Lint / build (20)` remoto pasa en 22 s y Vercel está verde.

## PR #13 — sistema visual

- Tokens, Futura, radios, bordes, foco y superficies basados en Ruta.
- Fondo crema de `/diseno/componentes`, no fondo morado.
- Chat público/privado, auth, carga/error y admin adaptados.
- Responsive corregido para móvil y viewports de poca altura.
- Navegación admin móvil ordenada sin romper el invariante de `<a>`.
- Acceso móvil admin con nombre accesible.
- `next-themes` y todo el modo oscuro retirados.
- El layout raíz no monta un `TooltipProvider` global sin consumidores; `/login` tiene su propio `Suspense`.
- `DESIGN.md` y `.impeccable/surfaces/app-page-tsx.md` describen crema y ausencia de dark mode.

## Estado de entrega para la próxima sesión

Esta es la fotografía final y prevalece sobre cualquier SHA o conteo anterior
que permanezca en las notas históricas de este documento.

### PR #12 — chat invitado

- Rama: `agent/zulu-chat-invitado`.
- Base: `master`.
- Cabeza publicada: `578116ad6cb1278fbcf6bc5e86eff7bd08057a71`.
- GitHub: `CLEAN`; CI `build (20)` y Vercel verdes.
- La protección del registro invitado es monotónica hasta expirar. Un error
  ambiguo de Auth o un intento concurrente ya no puede retirar la protección
  de otra pestaña.
- La migración aplicada no crea ni concede
  `cancelar_registro_invitado_pendiente`.
- `lib/invitados/registro.test.ts` protege ese contrato.
- Estado remoto de Supabase: la migración
  `20260812190000_proteger_conversion_invitada_pendiente.sql` está aplicada
  como `20260812234408` y verificada (columna, tabla, índices, RLS, grants,
  funciones, ausencia de cancelación, preservación e idempotencia).

### PR #13 — sistema visual

- Rama: `agent/zulu-ui-aplicacion`.
- Base: `agent/zulu-chat-invitado`.
- Cabeza revisada por Codex, con CI `build (20)` y Vercel verdes en la
  cabeza documental previa: `56ae08663461f6c495a41aa8f0ca4647912aab28`.
  Este commit solo registra la revisión limpia.
- GitHub: OPEN y MERGEABLE. Codex: revisión limpia sobre `56ae086634`.
- La rama fue rebasada sobre `578116a`.
- Contraste secundario elevado a `/70`, objetivos táctiles relevantes de
  44 px y chat público corregido para viewports de poca altura.
- Verificación real en `667 × 375`: documento y shell miden 375 px; header,
  composer, consentimiento y footer permanecen visibles.
- Con `prefers-color-scheme: dark`, el fondo permanece crema
  `rgb(255, 248, 235)`. No existe modo oscuro funcional.

### Validaciones realizadas

- Esta sesión no cambió código de aplicación; no se reejecutaron typecheck,
  pruebas, lint ni build.
- Verificación remota de `20260812234408` en `ddimxdrggrrfcvzwwben`: columna,
  tabla, índices, RLS, grants, funciones, preservación e idempotencia verdes.
- Advisors: único aviso nuevo = INFO intencional de RLS sin políticas en
  `guest_transfer_receipts`. Rendimiento sin hallazgos nuevos.

## Estado de Codex Review

- Todos los hilos existentes de ambas PR están respondidos y resueltos.
  Cero hilos abiertos tras la ronda con cuota.
- Reinvocación con cuota el 2026-08-12:

  - PR #12 (`578116ad6cb1278fbcf6bc5e86eff7bd08057a71`): comentario
    `5274137318`. Respuesta `5274171091`: revisión limpia sobre
    `578116ad6c`.
  - PR #13 (`56ae08663461f6c495a41aa8f0ca4647912aab28`): comentario
    `5274137422`. Respuesta `5274167162`: revisión limpia sobre
    `56ae086634`.
- Criterio de cierre cumplido: revisión limpia sobre el SHA exacto de cada PR.
  No hace falta otra invocación salvo que cambie código.

## Trabajo inmediato

1. No hacer merge. Lo hace el dueño del repositorio.
2. No reinvocar Codex salvo que cambie código: ambas PR ya tienen revisión
   limpia sobre `578116a` y `56ae086`.
3. Si el dueño pide un cambio de código en PR #12, rebasar PR #13, repetir
   typecheck, las 46 pruebas, lint/check y build, y publicar la visual con
   `push --force-with-lease`.

## Restricciones

- Preservar cambios ajenos; no hacer formateo masivo.
- El usuario autorizó push de ambas ramas. No hacer merge.
- Commits en español y sin `Co-Authored-By`.
- No ejecutar `scripts/seed-allowlist.sql` con correos de ejemplo.
- No reindexar PARCE: ya está activo y verificado en Supabase y Gemini.
- No cambiar Gemini, RAG, cuotas, privacidad, citas ni reglas para menores.
- No reintroducir caché, streaming, pgvector, RAG manual, raw provider
  response, NextAuth, Drizzle como dueño del esquema ni dark mode.
- Dentro de `/admin` se usan elementos `<a>`, nunca `next/link`.
- Un error de consulta no equivale a ausencia de datos; mantener fail-closed.
- `apply_patch` ha fallado en esta máquina con `CryptUnprotectData`; el
  fallback documentado es escritura UTF-8 sin BOM con reemplazos acotados.

## Prompt sugerido para la próxima sesión

```text
Continúa el trabajo en D:\dev\chatbot-zulu.

Lee primero y toma como handoff autoritativo:
docs/notes/handoff-2026-08-12-chat-invitado-ui.md

Después lee AGENTS.md y CLAUDE.md completos y, antes de usar Supabase, lee
completo el skill de Supabase disponible en la sesión. Preserva todos los
cambios locales existentes.

Continúa exactamente desde “Trabajo inmediato”. Hay dos PR apiladas:
- PR #12: agent/zulu-chat-invitado → master.
- PR #13: agent/zulu-ui-aplicacion → agent/zulu-chat-invitado.

Empieza con comprobaciones de solo lectura: rama, worktree, SHA local/remoto,
bases de las PR, checks, hilos thread-aware y lista remota de migraciones. La
última cabeza funcional confirmada de PR #12 es
578116ad6cb1278fbcf6bc5e86eff7bd08057a71. Codex dejó revisión limpia sobre
ese SHA y sobre 56ae08663461f6c495a41aa8f0ca4647912aab28 en PR #13.

La migración 20260812190000_proteger_conversion_invitada_pendiente.sql ya está
aplicada en ddimxdrggrrfcvzwwben como 20260812234408 y verificada. No la
reapliques. No ejecutes scripts/seed-allowlist.sql y no reindexes PARCE.

Codex ya dejó revisión limpia sobre PR #12 (578116ad6c) y PR #13 (56ae086634).
No reinvocar salvo que cambie código. No hagas merge. Si modificas PR #12,
rebasa PR #13, repite typecheck, tests, lint/check, build y push
--force-with-lease.

Puedes hacer push. No hagas merge. Los commits deben estar en español y sin
Co-Authored-By. No reintroduzcas dark mode: la dirección visual aprobada es
Ruta /diseno/componentes, fondo crema #fff8eb, Futura, colores vivos y liquid
glass claro. Dentro de /admin usa <a>, nunca next/link.
```