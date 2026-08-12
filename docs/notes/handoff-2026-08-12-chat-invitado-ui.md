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

- Base local/remota: `agent/zulu-chat-invitado` en `aaff17f` (`fix: purgar borradores en la portada`).
- Visual local: `agent/zulu-ui-aplicacion`, rebasada sobre `aaff17f`. Último SHA antes de este commit documental: `9939316`.
- Visual remota: todavía `3ce31fe`; publicar el SHA final con `git push --force-with-lease origin agent/zulu-ui-aplicacion`.
- Commits visuales actuales sobre la base: `35e3917`, `84f3169`, `209bce4`, `633618f`, `7c25dc1`, `66d11c9`, `559932b`, `55baef6`, `9939316`.
- En el último rebase se resolvió `app/page.tsx` conservando diseño crema, versión/token del consentimiento y los controles completos; `/login` conserva el fallback crema y su `Suspense`.
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

## Supabase confirmado

- `20260812151221 coordinar_conversion_y_limpieza_invitada`: conversión y limpieza mutuamente exclusivas, probadas sin residuos.
- `20260812164406 alinear_preflight_y_sesion_invitada`: corresponde a `supabase/migrations/20260812163500_alinear_preflight_y_sesion_invitada.sql`.
- La RPC `preparar_turno_invitado_v2(text,text,text)` es `SECURITY DEFINER`, solo `service_role` puede ejecutarla; `anon` y `authenticated` no.
- Prueba remota: devolvió `ttl_seconds = 600` con la configuración actual; cero filas sintéticas residuales.
- `handle_new_user()` lee `guest_preflight_ttl_minutes` y conserva una gracia mínima de 15 minutos.
- Advisors sin hallazgos nuevos. Persisten avisos preexistentes/intencionales: RLS sin políticas en tablas server-only, protección de contraseñas filtradas desactivada por decisión del usuario, FKs antiguas sin índice e índice antiguo sin uso.

## Validaciones finales

### Base `aaff17f`

- `pnpm install --offline --frozen-lockfile`: pasa.
- `pnpm typecheck`: pasa.
- `pnpm test`: 45/45 pasan.
- Biome dirigido en los 12 archivos TypeScript/TSX modificados: pasa.
- `git diff --check`: pasa.
- `pnpm build`: pasa; compila, TypeScript, genera 15 páginas y finaliza optimización.

### Visual rebasada (antes de este commit documental: `9939316`)

- Instalación offline/frozen: pasa y retira `next-themes`.
- Typecheck: pasa.
- Pruebas: 45/45 pasan.
- `biome lint` sobre 62 archivos de `app`, `components`, `lib` y `proxy.ts`: pasa sin hallazgos.
- `git diff --check`: pasa.
- Búsqueda mecánica: no hay `next-themes`, `ThemeProvider`, `dark:`, clase `dark`, `prefers-color-scheme` ni toggles de tema en código/dependencias.
- Build: pasa; las 15 páginas se generan y `/login` queda en Partial Prerender.
- El detector Impeccable ya había devuelto `[]` sobre la implementación visual. No repetir normalización masiva de CRLF.

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

- PR #12: los tres comentarios de la ronda sobre `eab632e` fueron corregidos en `7798f6d`; `1889eb6` añadió el cierre fail-closed para cuenta distinta y el comentario posterior sobre la home se corrigió en `aaff17f`. Todos los hilos están respondidos/resueltos. Codex fue reinvocado sobre el SHA exacto en https://github.com/scouts-colombia/chatbot-zulu/pull/12#issuecomment-5270463526; resultado pendiente al escribir este handoff.
- PR #13: los resultados previos quedaron obsoletos al cambiar la base. La visual está rebasada sobre `aaff17f`, validada, y falta publicar el SHA documental exacto y reinvocar.
- Criterio de cierre: ambas PR deben tener revisión limpia/👍 sobre su SHA exacto. Cada corrección en la base exige rebase, validación, force-push con lease y review nuevo de la visual.

## Trabajo inmediato

1. Publicar el commit documental de la visual con `git push --force-with-lease origin agent/zulu-ui-aplicacion`.
2. Verificar `head.sha` de PR #13 y reinvocar `@codex review` sobre el nuevo SHA.
3. Esperar PR #12 y PR #13. Corregir, responder, resolver y reinvocar hasta limpio/👍 en ambos SHA exactos.
4. Si cambia PR #12, volver a rebasar y validar PR #13.
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

Después lee AGENTS.md y CLAUDE.md completos. Preserva todos los cambios locales existentes.

Continúa desde “Trabajo inmediato”. Hay dos PR apiladas: #12 (agent/zulu-chat-invitado) y #13 (agent/zulu-ui-aplicacion). Verifica primero rama, worktree, SHA local/remoto y estado real de GitHub. La base aaff17f ya está publicada y en Codex review; la visual está rebasada, validada y debe quedar publicada/revisada sobre su SHA documental final.

La dirección visual aprobada es Ruta /diseno/componentes: fondo crema #fff8eb con lavados amarillo/durazno, Futura, colores vivos y liquid glass claro. El modo oscuro fue eliminado completamente. No reintroduzcas fondo morado, next-themes, clase dark ni variantes dark:.

Continúa el ciclo de Codex review de ambas PR. Responde y resuelve cada comentario, reinvoca @codex review después de cada corrección y no declares terminado hasta que ambas tengan revisión limpia/👍 sobre su SHA exacto. Si cambia la base, vuelve a rebasar y validar la visual.

Puedes hacer push; no hagas merge. Los commits deben estar en español y sin Co-Authored-By. No reindexes PARCE, no ejecutes scripts/seed-allowlist.sql y no alteres cambios ajenos.
```
