# Handoff — turno invitado y sistema visual de Zulú

- Fecha: 2026-08-12 (America/Bogota)
- Repositorio: `D:\dev\chatbot-zulu`
- Proyecto Supabase: `ddimxdrggrrfcvzwwben`
- PR base: [#12 — turno público y consentimiento](https://github.com/scouts-colombia/chatbot-zulu/pull/12)
- PR apilada: [#13 — sistema visual de la aplicación](https://github.com/scouts-colombia/chatbot-zulu/pull/13)

Este es el handoff autoritativo para continuar las dos PR. El handoff de PARCE/allowlist del 2026-08-06 es histórico: no volver a indexar PARCE.

## Actualización — revisión independiente y correcciones

Esta sección reemplaza los SHA y resultados anteriores cuando haya discrepancias.

- PR #12 publicada en 578116a (fix: conservar protección del registro invitado).
- La protección previa a auth.updateUser ahora es monotónica hasta expirar:
  un error ambiguo de Auth o un intento concurrente ya no puede retirar la
  marca de otro registro que sí avanzó.
- La migración pendiente ya no crea ni expone
  cancelar_registro_invitado_pendiente; sigue sin aplicarse remotamente.
- Se añadió lib/invitados/registro.test.ts como contrato de regresión.
- PR #13 fue rebasada sobre 578116a; el fix visual reescrito está en 74ab9db
  y la cabeza incluye este commit documental posterior
  (fix: cerrar hallazgos de accesibilidad visual).
- La visual sube textos secundarios a opacidad /70, mantiene objetivos
  táctiles de 44 px y elimina el mínimo artificial de 34 rem del chat público.
- Verificación local actual en ambas cabezas: typecheck y build pasan; 46/46
  pruebas pasan; Biome dirigido, git diff --check y detector Impeccable pasan.
- Verificación real de PR #13 en 667 × 375: documento y shell miden 375 px;
  header, composer, consentimiento y footer permanecen visibles. Con
  prefers-color-scheme: dark, el fondo sigue siendo crema rgb(255, 248, 235).
- Checks remotos posteriores: CI y Vercel verdes en PR #12 (578116a) y en
  la cabeza de código rebasada de PR #13; ambas PR quedaron CLEAN.
- Codex Review se reinvocó en ambas PR y volvió a rechazar por cuota; no
  produjo comentarios nuevos ni una aprobación sobre los SHA actuales.

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
- **Pendiente remoto:** `supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql` está revisada, incluye índices de expiración y de FK, y está publicada en la rama base, pero no se ha aplicado al proyecto `ddimxdrggrrfcvzwwben`.
- En la sesión actual no aparece el MCP de Supabase, no está instalada la CLI y la ejecución remota de una CLI descargada fue denegada. No volver a intentarlo sin autorización explícita o sin habilitar el MCP.
- Antes de mergear PR #12 hay que aplicar esa migración, comprobar columna/tabla/RLS/grants/funciones e idempotencia, y ejecutar advisors de seguridad y rendimiento.

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
- La migración pendiente ya no crea ni concede
  `cancelar_registro_invitado_pendiente`.
- `lib/invitados/registro.test.ts` protege ese contrato.
- Estado remoto de Supabase: la migración
  `20260812190000_proteger_conversion_invitada_pendiente.sql` todavía no fue
  aplicada ni verificada en esta sesión.

### PR #13 — sistema visual

- Rama: `agent/zulu-ui-aplicacion`.
- Base: `agent/zulu-chat-invitado`.
- Cabeza publicada antes de este commit exclusivamente documental:
  `9c9d4bc3c11d23460b0c0bfe31755aa4f010ba43`.
- GitHub: `CLEAN`; CI `build (20)` y Vercel verdes.
- La rama fue rebasada sobre `578116a`.
- Contraste secundario elevado a `/70`, objetivos táctiles relevantes de
  44 px y chat público corregido para viewports de poca altura.
- Verificación real en `667 × 375`: documento y shell miden 375 px; header,
  composer, consentimiento y footer permanecen visibles.
- Con `prefers-color-scheme: dark`, el fondo permanece crema
  `rgb(255, 248, 235)`. No existe modo oscuro funcional.

### Validaciones realizadas

- `pnpm typecheck`: pasa.
- `pnpm test -- --run`: 46/46 pasan.
- `pnpm build`: pasa y genera 15 páginas.
- Biome dirigido y `git diff --check`: pasan.
- Detector Impeccable sobre los cambios visuales: cero hallazgos mecánicos.
- Worktree limpio al entregar el trabajo.

## Estado de Codex Review

- Todos los hilos existentes de ambas PR están respondidos y resueltos.
- Se reinvocó `@codex review` en las cabezas corregidas:

  - PR #12: comentario `5273404738`.
  - PR #13: comentario `5273406466`.
- En ambos casos el conector respondió que se alcanzó el límite de uso de
  revisiones. No produjo comentarios nuevos ni una aprobación sobre las
  cabezas actuales.
- La revisión independiente encontró y ya corrigió:
  1. cancelación insegura de la protección del registro invitado;
  2. contraste insuficiente;
  3. targets táctiles pequeños;
  4. overflow en viewports bajos.
- Criterio de cierre solicitado: reinvocar cuando vuelva la cuota y obtener una
  revisión limpia o reacción de aprobación sobre el SHA exacto de cada PR.

## Trabajo inmediato

1. Con el conector de Supabase habilitado, leer primero su skill completo.
2. Confirmar en `ddimxdrggrrfcvzwwben` que
   `20260812190000_proteger_conversion_invitada_pendiente.sql` no está
   aplicada. Si aparece aplicada inesperadamente, no repetirla: comparar el
   estado remoto con el archivo y documentar la discrepancia.
3. Revisar y aplicar mediante el conector:
   `supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql`.
4. Verificar remotamente:
   - columna `guest_identity_cleanup_queue.registration_pending_until`;
   - tabla `guest_transfer_receipts`, índices, RLS y ausencia de acceso para
     `anon` y `authenticated`;
   - grants y definiciones de `marcar_registro_invitado_pendiente`,
     `tomar_limpiezas_identidad_invitada` y
     `transferir_conversaciones_invitadas`;
   - ausencia de `cancelar_registro_invitado_pendiente`;
   - preservación de cuentas y conversaciones existentes;
   - idempotencia de la transferencia, sin dejar datos sintéticos.
5. Ejecutar advisors de seguridad y rendimiento. Separar hallazgos nuevos de
   avisos preexistentes e intencionales.
6. Actualizar `ROADMAP.md` y este handoff únicamente con hechos confirmados.
   Si cambia código de PR #12, rebasar PR #13, validar y publicar con
   `--force-with-lease`.
7. Reinvocar Codex Review en ambas PR cuando haya cuota. Corregir, responder,
   resolver y reinvocar hasta revisión limpia/aprobación.
8. No hacer merge.

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
578116ad6cb1278fbcf6bc5e86eff7bd08057a71. La PR #13 estaba CLEAN y verde;
verifica su cabeza exacta porque el último cambio fue solo documental.

Tendrás acceso al conector de Supabase. Úsalo en el proyecto
ddimxdrggrrfcvzwwben. Confirma primero que
20260812190000_proteger_conversion_invitada_pendiente.sql no está aplicada;
luego revisa y aplica el archivo local
supabase/migrations/20260812190000_proteger_conversion_invitada_pendiente.sql.
No inventes resultados ni uses la CLI como sustituto si el conector funciona.

Verifica columna, tabla, índices, RLS, revokes/grants, definiciones de funciones,
ausencia de cancelar_registro_invitado_pendiente, preservación de datos
existentes e idempotencia sin residuos sintéticos. Ejecuta los advisors de
seguridad y rendimiento y distingue hallazgos nuevos de avisos preexistentes.
No ejecutes scripts/seed-allowlist.sql y no reindexes PARCE.

Si todo queda verde, actualiza ROADMAP.md y el handoff con hechos remotos
confirmados. Después reinvoca @codex review en ambas PR cuando haya cuota.
Resuelve cada comentario y reinvoca hasta obtener revisión limpia o aprobación
sobre los SHA exactos. Si modificas PR #12, rebasa PR #13, repite typecheck,
tests, lint/check, build y push --force-with-lease.

Puedes hacer push. No hagas merge. Los commits deben estar en español y sin
Co-Authored-By. No reintroduzcas dark mode: la dirección visual aprobada es
Ruta /diseno/componentes, fondo crema #fff8eb, Futura, colores vivos y liquid
glass claro. Dentro de /admin usa <a>, nunca next/link.
```