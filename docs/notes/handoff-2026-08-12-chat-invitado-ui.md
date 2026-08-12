# Handoff — turno invitado y sistema visual de Zulú

- Fecha: 2026-08-12 (America/Bogota)
- Repositorio: `D:\dev\chatbot-zulu`
- Proyecto Supabase: `ddimxdrggrrfcvzwwben`
- PR base: [#12 — turno público y consentimiento](https://github.com/scouts-colombia/chatbot-zulu/pull/12)
- PR apilada: [#13 — sistema visual de la aplicación](https://github.com/scouts-colombia/chatbot-zulu/pull/13)

Este documento es el handoff autoritativo para continuar las dos PR abiertas. El handoff de PARCE y allowlist del 2026-08-06 sigue siendo histórico; no volver a indexar PARCE.

## Objetivo y decisiones aprobadas

- La ruta `/` muestra el chat inmediatamente, no el login.
- Una persona no registrada puede consumir exactamente un turno. El segundo envío exige crear cuenta o iniciar sesión y conserva el borrador.
- El límite usa una identidad anónima de Supabase y una identidad seudónima derivada en servidor. No se guarda IP cruda ni fingerprint reversible.
- El producto se llama **Zulú**. El búho queda fuera de este alcance.
- La autoridad visual es `D:\dev\ruta-dnpj\ruta`, especialmente `/diseno/componentes`.
- El fondo correcto es crema `#fff8eb`, con lavados radiales amarillo y durazno y textura sutil. **No usar el fondo morado del login de Ruta.**
- El modo oscuro desaparece por completo: no hay `next-themes`, proveedor, selector, clase `dark`, variantes `dark:` ni adaptación al esquema del sistema.
- Deben mantenerse Futura, los colores vivos de Scouts Colombia, radios, bordes, foco visible y superficies liquid glass claras.
- Todas las interfaces —chat público/privado, auth, estados y admin— deben conservar el mismo lenguaje.
- En `/admin` se usan elementos `<a>`, nunca `next/link`, por la auditoría al renderizar en servidor.

## Topología y estado Git

Las PR están apiladas:

```text
master
└── agent/zulu-chat-invitado  → PR #12
    └── agent/zulu-ui-aplicacion → PR #13
```

Estado confirmado al preparar este handoff:

- Rama base local y remota: `agent/zulu-chat-invitado` en `e756351` (`fix: expirar identidades invitadas sin turno`).
- Rama visual local: `agent/zulu-ui-aplicacion`; el último commit de implementación es `1e4b25e` (`fix: nombrar el acceso móvil al panel`), rebajado sobre `e756351`, y encima está el commit documental que contiene este handoff.
- El último SHA remoto visual conocido antes del rebase era `efa8319`; hace falta publicar el commit documental actual con `git push --force-with-lease origin agent/zulu-ui-aplicacion`. Dos intentos el 2026-08-12 fallaron por DNS/conectividad hacia GitHub, no por conflicto de lease.
- El worktree estaba limpio antes de crear estos cambios documentales.
- El usuario autorizó push de estas ramas. No hacer merge: el dueño del repositorio hace el squash and merge personalmente.
- Commits en español y sin `Co-Authored-By`.

Commits visuales encima de la base después del último rebase:

```text
1e4b25e fix: nombrar el acceso móvil al panel
1771ec5 fix: adaptar controles invitados al diseño crema
68e8282 fix: ordenar la navegación admin en móvil
640c37c fix: adaptar la interfaz a viewports cortos
b560a02 feat: llevar Zulú al sistema visual de Ruta
e756351 fix: expirar identidades invitadas sin turno
```

## Trabajo implementado en la PR #12

- Chat público visible sin autenticación.
- Preflight invitado con cookie segura y sesión anónima establecida antes de llamar al modelo.
- Un turno invitado con cuota atómica, consentimiento y transferencia a una cuenta permanente.
- Preservación de conversación, mensajes, citas, preguntas guiadas, consentimiento y telemetría durante la conversión.
- Limpieza reintentable de identidades técnicas.
- Serialización de creación, reserva y transferencia con advisory lock compartido `guest-user:<uuid>`.
- Alta anónima encolada en la misma transacción de Auth, cancelación al reservar, bloqueo de reservas tardías reclamadas y destino permanente fijado de forma durable.
- Mensaje específico si otra cuenta ya recibió la conversación.
- No se guarda respuesta cruda del proveedor.

Migraciones locales recientes y versiones aplicadas remotamente:

- `supabase/migrations/20260811182650_serializar_conversacion_y_transferencia_invitada.sql`: remota `20260811183216 serializar_conversacion_y_transferencia_invitada`.
- `supabase/migrations/20260811185056_expirar_identidades_y_fijar_destino_invitado.sql`: remota `20260811185716 expirar_identidades_y_fijar_destino_invitado`.

Verificación remota confirmada:

- La RPC de creación devuelve la misma conversación en dos invocaciones y deja exactamente una conversación.
- `anon` y `authenticated` no ejecutan las RPC privadas nuevas; `service_role` sí.
- Toda alta anónima queda encolada; una reserva retira la cola; un claim impide una reserva tardía.
- La primera transferencia fija el destino; otro destino recibe `transferencia_invitada_destino_distinto`; el mismo destino es idempotente.
- Las pruebas remotas dejaron 0 usuarios anónimos y 0 filas residuales de cola.
- Advisors sin hallazgos nuevos. Permanecen avisos preexistentes/intencionales: tablas server-only con RLS sin políticas, protección de contraseñas filtradas desactivada por decisión del usuario, FKs antiguas sin índice e índice antiguo sin uso.

## Trabajo implementado en la PR #13

- Tokens de marca y Futura tomados de Ruta.
- Fondo crema de `/diseno/componentes`, no fondo morado.
- Superficies liquid glass claras y controles con colores vivos.
- Chat público y privado, auth, carga/error y panel admin adaptados al sistema.
- Layouts corregidos para viewports móviles y pantallas de poca altura.
- Navegación admin móvil ordenada sin romper el invariante de `<a>`.
- Acceso móvil al admin con `aria-label="Panel de administración"`.
- Modo oscuro retirado completamente, incluida la dependencia `next-themes`.

La documentación visual anterior todavía describía morado; este handoff corrige `DESIGN.md` y `.impeccable/surfaces/app-page-tsx.md` para evitar una regresión.

## Validaciones ya realizadas

Antes del último rebase visual:

- `pnpm exec tsc --noEmit`: pasa.
- Pruebas dirigidas: 35/35 pasan.
- `pnpm build`: pasa.
- Las validaciones de la migración y `git show --check` pasaron en la rama base.
- QA responsive y visual se recorrió anteriormente en escritorio y móvil.

Después de rebajar la rama visual sobre `e756351`, se repitió la validación el 2026-08-12: `pnpm install --offline --frozen-lockfile` pasó, `pnpm typecheck` pasó, las 35 pruebas pasaron, `pnpm build` pasó y el detector Impeccable devolvió `[]`. `pnpm check` global sigue fallando por 45 diagnósticos de formato CRLF preexistentes, incluidos archivos de configuración y código fuera del cambio; no se hizo una normalización masiva.

## Estado de revisión de Codex

- Todos los comentarios conocidos de ambas PR fueron contestados y sus hilos resueltos.
- PR #12: se reinvocó Codex sobre `e756351` en https://github.com/scouts-colombia/chatbot-zulu/pull/12#issuecomment-5257564532. Su resultado exacto seguía pendiente al redactar este archivo.
- PR #13: el último comentario conocido —nombre accesible del enlace móvil al admin— quedó corregido en `1e4b25e`. Cualquier revisión sobre `efa8319` es obsoleta después del rebase.
- La consulta más reciente a GitHub falló por timeout de red; volver a consultar antes de afirmar que una PR está limpia.
- Criterio de cierre: cada PR debe recibir revisión limpia/👍 sobre su SHA exacto. Si cambia la base, rebajar la visual, validar, forzar push con lease y reinvocar la revisión visual.

## Trabajo inmediato

1. Revisar este diff documental y crear un commit en español, sin `Co-Authored-By`.
2. Publicar con `git push --force-with-lease origin agent/zulu-ui-aplicacion`.
3. Consultar PR #12 y PR #13 y verificar `headRefOid`.
4. Reinvocar `@codex review` en PR #13 sobre el SHA nuevo. No reutilizar el resultado del SHA anterior.
5. Esperar ambas revisiones. Responder cada comentario, resolver cada hilo y reinvocar hasta que las dos queden limpias/👍.
6. Si Codex exige otro cambio en PR #12: corregir y validar la base, pushearla, rebajar la visual, repetir validación, force-push con lease y review visual.
7. No hacer merge.

## Restricciones operativas

- Preservar cambios locales ajenos.
- No ejecutar `scripts/seed-allowlist.sql` con correos de ejemplo.
- No volver a indexar PARCE: ya está activo y verificado en Supabase y Gemini.
- No cambiar RAG, Gemini, cuotas, privacidad, citas, reglas de menores ni navegación admin.
- No reintroducir caché, streaming, pgvector, RAG manual, raw provider response, NextAuth ni Drizzle como dueño de esquema.
- Mantener desactivada la protección de contraseñas filtradas por decisión del usuario.
- Las variables/toggles pendientes para exponer el turno público siguen siendo `PRIVACY_POLICY_VERSION`, `GUEST_LIMIT_SECRET`, `SITE_URL`, Anonymous Sign-Ins y Manual Linking.
- `apply_patch` puede fallar en Windows con `CryptUnprotectData`; se usó escritura atómica UTF-8 como fallback.
- Los finales CRLF pueden producir ruido en Biome; no hacer formateo masivo de archivos no relacionados.

## Prompt sugerido para la próxima sesión

```text
Continúa el trabajo en D:\dev\chatbot-zulu.

Lee primero y toma como handoff autoritativo:
docs/notes/handoff-2026-08-12-chat-invitado-ui.md

Después lee AGENTS.md y CLAUDE.md completos. Preserva todos los cambios locales existentes.

Continúa desde “Trabajo inmediato”. Hay dos PR apiladas: #12 (agent/zulu-chat-invitado) y #13 (agent/zulu-ui-aplicacion). Verifica primero rama, worktree, SHA local/remoto y estado real de GitHub. La rama visual local fue rebajada sobre e756351, validada y debe publicarse con --force-with-lease si el handoff sigue vigente.

La dirección visual aprobada es la de Ruta /diseno/componentes: fondo crema #fff8eb con lavados amarillo/durazno, Futura, colores vivos y liquid glass claro. No reintroduzcas el fondo morado ni ningún modo oscuro.

Confirma las validaciones registradas, actualiza/commitea el handoff si corresponde y continúa el ciclo de Codex review de ambas PR. Responde y resuelve cada comentario, reinvoca @codex review después de cada corrección y no declares terminado hasta que cada PR tenga revisión limpia/👍 sobre su SHA exacto.

Puedes hacer push; no hagas merge. Los commits deben estar en español y sin Co-Authored-By. No vuelvas a indexar PARCE, no ejecutes scripts/seed-allowlist.sql y no alteres cambios ajenos.
```
