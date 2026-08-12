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

## Topología Git

```text
master
└── agent/zulu-chat-invitado    → PR #12
    └── agent/zulu-ui-aplicacion → PR #13
```

Estado local confirmado tras el último rebase:

- Base local/remota: `agent/zulu-chat-invitado` en `ecaccde` (`fix: aislar borradores y proteger identidades invitadas`).
- Visual local: `agent/zulu-ui-aplicacion`, rebasada sobre `ecaccde` y con worktree limpio antes de esta actualización documental.
- Visual remota: todavía en `efa8319`; la rama local diverge por el rebase y debe publicarse con `git push --force-with-lease origin agent/zulu-ui-aplicacion` después de validar.
- Commits visuales actuales, de más nuevo a más antiguo: `cc5f87b`, `25d3dd3`, `006ab93`, `16faf7b`, `c45404e`; encima está el commit documental de este handoff.
- El rebase tuvo conflictos únicamente en `app/page.tsx` y `app/chat/[id]/page.tsx`. Se conservaron el diseño crema y el token `borradorTransferenciaId` en la creación/apertura de conversación.

## PR #12 — implementación y última corrección

Además del chat público, preflight, consentimiento, cuota atómica, transferencia, limpieza y serialización ya implementados, `ecaccde` corrige los tres últimos comentarios de Codex:

1. **Carrera limpieza/conversión.** La migración `supabase/migrations/20260812101500_coordinar_conversion_y_limpieza_invitada.sql` bloquea la fila de limpieza durante la conversión. Si ya existe `deletion_claimed_at`, la conversión se revierte con `identidad_invitada_expirando`; si no, retira la fila antes de completar el cambio. El worker también vuelve a leer Auth y solo elimina cuando `is_anonymous === true`.
2. **Metadata de citas.** `app/api/chat/route.ts` comprueba el error de `knowledge_documents` y falla cerrado antes de construir/persistir citas degradadas.
3. **Privacidad del borrador.** Ya no existe una clave pendiente global. Se usa `zulu:borrador-invitado:pendiente:<uuid>` únicamente al iniciar explícitamente login/registro; el UUID opaco se propaga por ese flujo y solo el destino que lo presenta puede migrarlo. La portada pública no restaura borradores pendientes.

Archivos funcionales principales de esta corrección: acciones/formularios auth, home, creación y apertura de conversación, `components/chat/conversacion.tsx`, `lib/invitados/borrador.ts`, `lib/invitados/limpieza.ts`, sus pruebas, la ruta de chat y ROADMAP.

### Supabase confirmado

- La migración local anterior `20260811185056_expirar_identidades_y_fijar_destino_invitado.sql` está aplicada como versión remota `20260811185716`.
- La migración nueva de coordinación está aplicada como versión remota `20260812151221 coordinar_conversion_y_limpieza_invitada`.
- Prueba transaccional remota:
  - identidad anónima reclamada: la conversión se rechazó y permaneció anónima;
  - identidad anónima no reclamada: la conversión terminó, retiró la cola y actualizó perfil;
  - rollback final y cero residuos `@example.test` en Auth/perfiles.
- `handle_anonymous_user_converted()` es `SECURITY DEFINER`; `anon` y `authenticated` no pueden ejecutarla; su definición inspecciona `deletion_claimed_at`.
- Advisors sin hallazgos nuevos. Persisten solo avisos preexistentes/intencionales: RLS sin políticas en tablas server-only, protección de contraseñas filtradas desactivada por decisión del usuario, FKs antiguas sin índice e índice antiguo sin uso.

### Validación local de la base

- `pnpm typecheck`: pasa.
- `pnpm test`: 38/38 pasan.
- Biome dirigido sobre los 13 archivos TypeScript modificados: pasa.
- `git diff --check`: pasa.
- `pnpm build`: dos intentos fallaron únicamente porque Google Fonts no respondió al descargar Geist Mono; no hubo error de código. La misma base visual había compilado antes de esa caída de red.

## PR #13 — sistema visual

- Tokens, Futura, radios, bordes, foco y superficies basados en Ruta.
- Fondo crema de `/diseno/componentes`, no fondo morado.
- Chat público/privado, auth, carga/error y admin adaptados.
- Responsive corregido para móvil y viewports de poca altura.
- Navegación admin móvil ordenada sin romper el invariante de `<a>`.
- Acceso móvil admin con nombre accesible.
- `next-themes` y todo el modo oscuro retirados.
- El layout raíz ya no monta el `TooltipProvider` global sin consumidores; `/login` tiene su propio `Suspense`, por lo que Next 16 puede hacer Partial Prerender sin bloquear la ruta.
- `DESIGN.md` y `.impeccable/surfaces/app-page-tsx.md` ya describen crema y ausencia de dark mode.
- Validación final después del rebase: `pnpm install --offline --frozen-lockfile` pasó y retiró `next-themes`; `pnpm typecheck` pasó; `pnpm test` pasó 38/38; `pnpm build` pasó y prerenderizó las 15 páginas; `git diff --check` pasó.
- Biome dirigido procesó 18 archivos y solo reportó formato CRLF conocido, sin hallazgos semánticos. No normalizar masivamente. El detector Impeccable ya había devuelto `[]` sobre la implementación visual.

## Estado de Codex review

- PR #12: `ecaccde` está publicado. Los tres hilos nuevos son `PRRT_kwDOSuVTrc6YWIeN`, `PRRT_kwDOSuVTrc6YWIeP` y `PRRT_kwDOSuVTrc6YWIeS`. Las respuestas se intentaron mediante el conector, pero GitHub quedó en timeout; verificar si aparecieron, responder las que falten, resolver los tres hilos y comentar `@codex review` sobre `ecaccde`.
- PR #13: la revisión limpia conocida corresponde al SHA remoto viejo `efa8319`, por lo que no sirve después del rebase. La validación local nueva está verde; falta publicar el nuevo SHA exacto y reinvocar `@codex review`.
- Criterio de cierre: ambas PR deben tener revisión limpia/👍 sobre su SHA exacto. Cada corrección en la base exige rebase, validación, force-push con lease y review nuevo de la visual.

## Trabajo inmediato

1. Commit en español, sin `Co-Authored-By`, de la corrección de prerender y este handoff.
2. Publicar la visual con `git push --force-with-lease origin agent/zulu-ui-aplicacion`.
3. En PR #12, comprobar respuestas, cerrar los tres hilos y reinvocar Codex sobre `ecaccde`.
4. En PR #13, verificar `headRefOid` y reinvocar Codex sobre el SHA recién publicado.
5. Esperar ambas revisiones. Corregir, responder, resolver y reinvocar hasta obtener limpio/👍 en los SHA exactos.
6. No hacer merge.

## Restricciones

- Preservar cambios ajenos; no hacer formateo masivo.
- No ejecutar `scripts/seed-allowlist.sql` con correos de ejemplo.
- No reindexar PARCE.
- No cambiar Gemini, RAG, cuotas, privacidad, citas, reglas para menores ni navegación admin.
- No reintroducir caché, streaming, pgvector, RAG manual, raw provider response, NextAuth, Drizzle como dueño del esquema ni dark mode.
- `apply_patch` falla en esta máquina con `CryptUnprotectData`; se usa escritura UTF-8 sin BOM como fallback.

## Prompt sugerido para la próxima sesión

```text
Continúa el trabajo en D:\dev\chatbot-zulu.

Lee primero y toma como handoff autoritativo:
docs/notes/handoff-2026-08-12-chat-invitado-ui.md

Después lee AGENTS.md y CLAUDE.md completos. Preserva todos los cambios locales existentes.

Continúa desde “Trabajo inmediato”. Hay dos PR apiladas: #12 (agent/zulu-chat-invitado) y #13 (agent/zulu-ui-aplicacion). Verifica primero rama, worktree, SHA local/remoto y estado real de GitHub. La base corregida ecaccde ya está publicada; la visual fue rebasada sobre ella y necesita validación, actualización final del handoff y force-push con lease.

La dirección visual aprobada es Ruta /diseno/componentes: fondo crema #fff8eb con lavados amarillo/durazno, Futura, colores vivos y liquid glass claro. El modo oscuro fue eliminado completamente. No reintroduzcas fondo morado, next-themes, clase dark ni variantes dark:.

Continúa el ciclo de Codex review de ambas PR. Responde y resuelve cada comentario, reinvoca @codex review después de cada corrección y no declares terminado hasta que ambas tengan revisión limpia/👍 sobre su SHA exacto. Si cambia la base, vuelve a rebasar y validar la visual.

Puedes hacer push; no hagas merge. Los commits deben estar en español y sin Co-Authored-By. No reindexes PARCE, no ejecutes scripts/seed-allowlist.sql y no alteres cambios ajenos.
```
