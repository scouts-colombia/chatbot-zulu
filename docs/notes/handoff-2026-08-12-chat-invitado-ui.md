# Handoff — turno invitado y sistema visual de Zulú

- Fecha: 2026-08-12 (America/Bogota)
- Repositorio: `D:\dev\chatbot-zulu`
- Proyecto Supabase: `ddimxdrggrrfcvzwwben`
- PR base: [#12 — turno público y consentimiento](https://github.com/scouts-colombia/chatbot-zulu/pull/12)
- PR apilada: [#13 — sistema visual de la aplicación](https://github.com/scouts-colombia/chatbot-zulu/pull/13)

Este es el handoff autoritativo para continuar las dos PR. El handoff de PARCE/allowlist del 2026-08-06 es histórico: no volver a indexar PARCE.

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

- Base local/remota: `agent/zulu-chat-invitado` en `d9e39f8` (`fix: indexar recibos de transferencia invitada`).
- Visual local: `agent/zulu-ui-aplicacion` rebasada sobre `d9e39f8`; el fix accesible reescrito está en `932072f`. El remoto todavía apunta a `644c805`, por lo que el push final deberá usar `--force-with-lease`.
- El fix visual `932072f` contiene las correcciones de los dos hilos abiertos de PR #13: contraste AA en texto de 12 px y objetivo táctil móvil de 44 × 44 px para archivar. El worktree solo contiene este handoff pendiente de commit.
- Los dos rebases visuales terminaron sin conflictos; el último reescribió 13 commits sobre `d9e39f8`.
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
- **Pendiente remoto:** `supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql` está revisada, incluye índices de expiración y de FK, y está publicada en la rama base, pero no se ha aplicado al proyecto `ddimxdrggrrfcvzwwben`.
- En la sesión actual no aparece el MCP de Supabase, no está instalada la CLI y la ejecución remota de una CLI descargada fue denegada. No volver a intentarlo sin autorización explícita o sin habilitar el MCP.
- Antes de mergear PR #12 hay que aplicar esa migración, comprobar columna/tabla/RLS/grants/funciones e idempotencia, y ejecutar advisors de seguridad y rendimiento.

## Validaciones finales

### Base `d9e39f8`

- `pnpm install --offline --frozen-lockfile`: pasa.
- `pnpm typecheck`: pasa.
- `pnpm test -- --run`: 45/45 pasan.
- `pnpm exec biome lint app components lib proxy.ts`: 62 archivos pasan.
- `git diff --check`: pasa.
- `pnpm build`: pasa; genera 15 páginas y `/login` queda en Partial Prerender.

### Visual `932072f` tras el rebase

- `pnpm install --offline --frozen-lockfile`: pasa y retira `next-themes`.
- `pnpm typecheck`: pasa.
- `pnpm test -- --run`: 45/45 pasan.
- `pnpm exec biome lint app components lib proxy.ts`: 62 archivos pasan.
- `git diff --check`: pasa.
- `pnpm build`: pasa; genera 15 páginas y `/login` queda en Partial Prerender.
- Búsqueda mecánica: cero referencias funcionales a `next-themes`, `ThemeProvider`, `dark:`, clase `dark`, `prefers-color-scheme` o toggles de tema. Solo aparecen las dos frases de `DESIGN.md` y `.impeccable` que documentan que no existe dark mode.
- Footer y contador de historial usan opacidad `/70`; el botón móvil de archivar tiene mínimo `44 × 44 px`.

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

## Estado de Codex review

- PR #12: todos los hilos de revisión están respondidos y resueltos; el SHA base actual es `d9e39f8`. Se reinvocó Codex el 2026-08-12 en los comentarios `5271605204` y `5271668505`; ambos intentos respondieron `You have reached your Codex usage limits for code reviews`. No hubo hallazgos nuevos ni revisión limpia del SHA actual.
- PR #13: en `e56c1ad` quedaron dos hilos accionables: texto normal de 12 px por debajo de AA (`3769089838`) y botón móvil de archivar por debajo de 44 px (`3769089849`). Los hilos fueron respondidos y resueltos sobre el push anterior; el fix persiste reescrito en `932072f`, todavía sin publicar tras el último rebase ni reinvocar review sobre ese SHA.
- Criterio de cierre: ambas PR deben tener revisión limpia/👍 sobre su SHA exacto. Cada corrección en la base exige rebase, validación, `push --force-with-lease` y review nuevo de la visual.

## Trabajo inmediato

1. Hacer commit de este handoff y push de PR #13 con `--force-with-lease`.
2. Los hilos `3769089838` y `3769089849` ya están respondidos/resueltos; reinvocar `@codex review` sobre el SHA publicado.
3. Reintentar Codex Review de PR #12 cuando vuelva la cuota. Corregir/reinvocar hasta limpio/👍 en ambas PR.
4. Habilitar el MCP de Supabase o conseguir autorización explícita para una CLI fijada; aplicar y verificar `20260812190000_proteger_conversion_invitada_pendiente.sql` y correr advisors.
5. No hacer merge.

## Restricciones

- Preservar cambios ajenos; no hacer formateo masivo.
- No ejecutar `scripts/seed-allowlist.sql` con correos de ejemplo.
- No reindexar PARCE.
- No cambiar Gemini, RAG, cuotas, privacidad, citas, reglas para menores ni navegación admin fuera de los fixes ya documentados.
- No reintroducir caché, streaming, pgvector, RAG manual, raw provider response, NextAuth, Drizzle como dueño del esquema ni dark mode.
- `apply_patch` falla en esta máquina con `CryptUnprotectData`; se usa escritura UTF-8 sin BOM como fallback.

## Prompt sugerido para la próxima sesión

```text
Continúa el trabajo en D:\dev\chatbot-zulu.

Lee primero y toma como handoff autoritativo:
docs/notes/handoff-2026-08-12-chat-invitado-ui.md

Después lee AGENTS.md y CLAUDE.md completos. Preserva todos los cambios locales existentes. Usa el skill de GitHub para comentarios de PR y el skill de Supabase cuando corresponda.

Continúa desde “Trabajo inmediato”. Hay dos PR apiladas: #12 (`agent/zulu-chat-invitado`) y #13 (`agent/zulu-ui-aplicacion`). Verifica rama, worktree, SHA local/remoto, estado thread-aware de GitHub y estado remoto de migraciones antes de actuar.

La base está en `d9e39f8`; todos sus hilos están resueltos, pero los últimos intentos de Codex Review fueron rechazados por límite de uso. La visual fue rebasada sobre esa base; revisa el handoff para saber si sus dos correcciones de accesibilidad ya fueron validadas/publicadas.

Queda pendiente aplicar en Supabase `ddimxdrggrrfcvzwwben` la migración `supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql`. En la sesión anterior no estaba expuesto el MCP y se denegó descargar la CLI. No inventes verificación remota: habilita/usa MCP o pide autorización explícita, aplica la migración, verifica tabla/columna/RLS/grants/funciones e idempotencia y corre advisors.

La dirección visual aprobada es Ruta `/diseno/componentes`: fondo crema `#fff8eb` con lavados amarillo/durazno, Futura, colores vivos y liquid glass claro. El modo oscuro fue eliminado completamente. No reintroduzcas fondo morado, `next-themes`, clase `dark` ni variantes `dark:`.

Continúa el ciclo de Codex Review de ambas PR. Responde y resuelve cada comentario, reinvoca `@codex review` después de cada corrección y no declares terminado hasta que ambas tengan revisión limpia/👍 sobre su SHA exacto. Si cambia la base, vuelve a rebasar y validar la visual.

Puedes hacer push; no hagas merge. Los commits deben estar en español y sin `Co-Authored-By`. No reindexes PARCE, no ejecutes `scripts/seed-allowlist.sql` y no alteres cambios ajenos.
```
