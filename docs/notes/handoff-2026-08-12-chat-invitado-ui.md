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

- Base local/remota: `agent/zulu-chat-invitado` en `95e5287` (`fix: cerrar casos límite del flujo invitado`).
- Visual local: `agent/zulu-ui-aplicacion`, rebasada sobre `95e5287`. Último SHA antes de este commit documental: `1c9b7ee`.
- Visual remota: todavía `19fd87d`; publicar el SHA final con `git push --force-with-lease origin agent/zulu-ui-aplicacion`.
- Commits visuales actuales sobre la base: `1c3d960`, `01e05ac`, `654160c`, `5725926`, `7a22aeb`, `e759c8e`, `1c9b7ee`.
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

## Supabase confirmado

- `20260812151221 coordinar_conversion_y_limpieza_invitada`: conversión y limpieza mutuamente exclusivas, probadas sin residuos.
- `20260812164406 alinear_preflight_y_sesion_invitada`: corresponde a `supabase/migrations/20260812163500_alinear_preflight_y_sesion_invitada.sql`.
- La RPC `preparar_turno_invitado_v2(text,text,text)` es `SECURITY DEFINER`, solo `service_role` puede ejecutarla; `anon` y `authenticated` no.
- Prueba remota: devolvió `ttl_seconds = 600` con la configuración actual; cero filas sintéticas residuales.
- `handle_new_user()` lee `guest_preflight_ttl_minutes` y conserva una gracia mínima de 15 minutos.
- Advisors sin hallazgos nuevos. Persisten avisos preexistentes/intencionales: RLS sin políticas en tablas server-only, protección de contraseñas filtradas desactivada por decisión del usuario, FKs antiguas sin índice e índice antiguo sin uso.

## Validaciones finales

### Base `95e5287`

- `pnpm install --offline --frozen-lockfile`: pasa.
- `pnpm typecheck`: pasa.
- `pnpm test`: 41/41 pasan.
- Biome dirigido en 13 archivos de código: pasa.
- `git diff --check`: pasa.
- `pnpm build`: pasa; compila, TypeScript, genera 15 páginas y finaliza optimización.

### Visual rebasada (antes de este commit documental: `1c9b7ee`)

- Instalación offline/frozen: pasa y retira `next-themes`.
- Typecheck: pasa.
- Pruebas: 41/41 pasan.
- `biome lint` sobre 47 archivos TypeScript/TSX del stack: pasa sin hallazgos.
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

- PR #12: los cinco hilos de la ronda sobre `ecaccde` fueron corregidos en `95e5287`, respondidos y resueltos. Se reinvocó Codex en https://github.com/scouts-colombia/chatbot-zulu/pull/12#issuecomment-5269783332; resultado pendiente al escribir este handoff.
- PR #13: Codex declaró limpio `19fd87d` (“Didn't find any major issues”), pero ese resultado quedó obsoleto al cambiar la base. Falta publicar el nuevo SHA documental exacto y reinvocar.
- Criterio de cierre: ambas PR deben tener revisión limpia/👍 sobre su SHA exacto. Cada corrección en la base exige rebase, validación, force-push con lease y review nuevo de la visual.

## Trabajo inmediato

1. Commit de este handoff en español, sin `Co-Authored-By`.
2. Publicar la visual con `git push --force-with-lease origin agent/zulu-ui-aplicacion`.
3. Verificar `head.sha` de PR #13 y reinvocar `@codex review` sobre el nuevo SHA.
4. Esperar PR #12 y PR #13. Corregir, responder, resolver y reinvocar hasta limpio/👍 en ambos SHA exactos.
5. Si cambia PR #12, volver a rebasar y validar PR #13.
6. No hacer merge.

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

Continúa desde “Trabajo inmediato”. Hay dos PR apiladas: #12 (agent/zulu-chat-invitado) y #13 (agent/zulu-ui-aplicacion). Verifica primero rama, worktree, SHA local/remoto y estado real de GitHub. La base 95e5287 ya está publicada y en Codex review; la visual está rebasada, validada y debe quedar publicada/revisada sobre su SHA documental final.

La dirección visual aprobada es Ruta /diseno/componentes: fondo crema #fff8eb con lavados amarillo/durazno, Futura, colores vivos y liquid glass claro. El modo oscuro fue eliminado completamente. No reintroduzcas fondo morado, next-themes, clase dark ni variantes dark:.

Continúa el ciclo de Codex review de ambas PR. Responde y resuelve cada comentario, reinvoca @codex review después de cada corrección y no declares terminado hasta que ambas tengan revisión limpia/👍 sobre su SHA exacto. Si cambia la base, vuelve a rebasar y validar la visual.

Puedes hacer push; no hagas merge. Los commits deben estar en español y sin Co-Authored-By. No reindexes PARCE, no ejecutes scripts/seed-allowlist.sql y no alteres cambios ajenos.
```
