# Handoff — PARCE, privacidad, admin y allowlist

- Fecha: 2026-08-06
- Rama: `feat/parce-y-allowlist`
- Proyecto Supabase: `ddimxdrggrrfcvzwwben`

## Estado confirmado

- PR #8 ya está en `master`.
- El corpus remoto tiene **6 documentos activos**; faltan **2** para los 8 del alcance.
- PARCE ya fue indexado correctamente:
  - Título: `PARCE - Proceso Autónomo del Rover en Competencias para su Evolución`.
  - Versión: `0.5`.
  - SHA-256: `0b5748d46a91a0856b587d116ff0f43f90c2930837e54f99ed81cd6fbf61dbe4`.
  - `knowledge_document_id`: `3db4a69a-d36b-447c-9675-76f52812aba4`.
  - Está activo y tiene `metadata_synced_at`.
  - También se comprobó en Gemini: existe exactamente una copia con el SHA y la metadata correctos.
- El PDF local está en `data/pdfs/PARCE - Proceso Autónomo del Rover en Competencias para su Evolución.pdf`. `data/pdfs/` está fuera de Git.
- `desarrollo.tecnologico@scout.org.co` ya fue promovido y verificado con `role = admin` y `account_status = activo`.
- Falta recorrer el panel con ese admin y comprobar los primeros `admin_audit_events`.
- La protección de contraseñas filtradas debe permanecer desactivada por decisión del usuario.
- `Max rows` ahora está en **Integrations → Data API → Settings → Max rows**. El valor real del proyecto todavía no se confirmó.

## Cambios locales pendientes

Al redactar este handoff había estos cambios sin commit:

```text
 M scripts/versiones-documentos.json
?? docs/politica-privacidad-asc-2020.md
?? scripts/seed-allowlist.sql
?? supabase/migrations/0012_allowlist_registro.sql
```

Además de este archivo de handoff.

### `scripts/versiones-documentos.json`

- Añade PARCE con versión `0.5`.
- Explica que una versión menor que `1.0` identifica un documento con contenido utilizable y diagramación todavía pendiente.

### `docs/politica-privacidad-asc-2020.md`

- Contiene un snapshot de la política publicada en <https://scout.org.co/politica-privacidad>.
- La versión sugerida para `consent_acceptance_events.policy_version` es `asc-2020-03-09`.
- Incluye una nota sobre aspectos del piloto que la política no describe expresamente.
- No se debe fijar `PRIVACY_POLICY_VERSION` en Vercel antes de construir la pantalla de consentimiento: el gate del chat ya existe y bloquearía a todos sin una salida para aceptar.

### `supabase/migrations/0012_allowlist_registro.sql`

- Crea `public.allowed_emails`.
- Habilita RLS sin políticas para que los Scouts no puedan leer la lista de correos.
- Normaliza correos con `lower(trim(...))`.
- Reemplaza `handle_new_user()` para decidir el estado inicial:
  - correo invitado → `activo`;
  - correo no invitado → `pendiente_autorizacion`.
- Cambia el default de `profiles.account_status` a `pendiente_autorizacion`.
- No modifica el estado de cuentas existentes.
- Agrega a la allowlist los perfiles que ya estén activos al aplicar la migración.
- No reintroduce autorización parental: la allowlist controla invitación al piloto, no edad.

### `scripts/seed-allowlist.sql`

- Contiene correos de reemplazo y **no debe ejecutarse así**.
- Requiere la lista real de invitados.
- Agregar un correo después del registro no activa retroactivamente la cuenta. Para eso se usa `/admin/usuarios`, que deja auditoría.

## Estado remoto de la allowlist

La migración `0012` **está aplicada** en el proyecto `ddimxdrggrrfcvzwwben` con la versión remota `20260806200703`.

Antes de aplicarla, el historial remoto contenía únicamente `0001`–`0011` y `public.allowed_emails` no existía. Una consulta `HEAD` había producido un falso positivo porque PostgREST respondió sin cuerpo; la comprobación real fue por catálogo e historial de migraciones.

Después de aplicar `0012` con el MCP de Supabase se verificó que la tabla existe, tiene RLS sin políticas, el default de `profiles.account_status` es `pendiente_autorizacion`, las funciones y triggers esperados están activos y sus permisos están revocados para `anon` y `authenticated`. Los 2 perfiles existentes conservaron su estado `activo` y ambos quedaron en la allowlist.

## Validaciones realizadas

- `pnpm exec tsc --noEmit`: pasa.
- `git diff --check`: pasa.
- `scripts/versiones-documentos.json`: parseo y formato dirigidos pasan.
- `pnpm check` global falla por aproximadamente 49 problemas de formato preexistentes, principalmente finales de línea CRLF en archivos no relacionados. No hacer un arreglo masivo como parte de esta tarea.
- Advisors posteriores a `0012`: seguridad sin hallazgos accionables nuevos; los 5 INFO `rls_enabled_no_policy` son deliberados y la protección de contraseñas filtradas permanece desactivada por decisión del usuario. Rendimiento añade un INFO por la FK `allowed_emails.added_by` sin índice, aceptado para la lista acotada del piloto.

## Trabajo completado en la continuación

1. Se leyeron `AGENTS.md`, `CLAUDE.md` y el skill de Supabase completo.
2. Se revisó el diff y se preservaron los cambios locales.
3. Se confirmó con el MCP que `0012` no estaba aplicada.
4. Se revisó y aplicó `supabase/migrations/0012_allowlist_registro.sql` al proyecto `ddimxdrggrrfcvzwwben`.
5. Se verificó después de aplicarla:
   - `allowed_emails` existe;
   - RLS está habilitada y no tiene políticas;
   - `profiles.account_status` tiene default `pendiente_autorizacion`;
   - `handle_new_user()` consulta la allowlist;
   - las cuentas existentes conservaron su estado;
   - los perfiles activos actuales quedaron en la allowlist.
6. Se ejecutaron y analizaron los advisors de seguridad y rendimiento.
7. No se ejecutó `scripts/seed-allowlist.sql`; sigue pendiente la lista real de correos.
8. Se actualizó `ROADMAP.md` con los hechos confirmados:
   - corpus de 6 documentos y 2 pendientes;
   - PARCE v0.5 indexado;
   - admin real promovido;
   - allowlist aplicada y verificada.

La siguiente tarea abierta de la fase más temprana sigue siendo el flujo de consentimiento. No inventar texto organizacional que no esté aprobado.

## Reglas de entrega

- No pushear sin confirmación del usuario.
- Si se crea un commit, el mensaje debe estar en español y no debe incluir `Co-Authored-By`.
- No ejecutar el seed con placeholders.
- No cambiar la decisión del usuario sobre protección de contraseñas filtradas.
- No marcar como aplicado o verificado nada que solo exista como archivo local.
