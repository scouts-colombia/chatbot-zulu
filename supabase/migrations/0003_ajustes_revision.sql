-- ============================================================================
-- 0003_ajustes_revision.sql — Correcciones de la revisión del PR #1 (Codex).
--
-- 1) P1: protect_profile_fields fallaba FUERA de PostgREST (SQL Editor/psql):
--    current_setting(...) es NULL ahí, y coalesce(NULL,'')::jsonb lanza
--    "invalid input syntax for type json" antes de permitir el update.
--    Eso rompía el canal documentado de scripts/seed-admin.sql.
-- 2) P2: los mensajes del usuario deben llevar response_json = null (§8.3);
--    la política de insert no lo exigía.
-- 3) P2: la evidencia de consentimiento (append-only, con menores) no debe
--    ser forjable por el cliente: el insert pasa a ser solo del servidor,
--    que estampa versión, fecha e ip_hash confiables.
-- ============================================================================

-- 1) Guard robusto de claims: NULL o '' → '{}' antes del cast.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb ->> 'role';
begin
  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.account_status is distinct from old.account_status
     or new.guardian_authorization_status is distinct from old.guardian_authorization_status
     or new.privacy_policy_version_accepted is distinct from old.privacy_policy_version_accepted
     or new.privacy_policy_accepted_at is distinct from old.privacy_policy_accepted_at
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Campo protegido de profiles: solo el servidor puede modificarlo';
  end if;
  return new;
end;
$$;

-- 2) Mensajes del usuario sin response_json.
drop policy "messages_insert_own_user" on public.messages;

create policy "messages_insert_own_user" on public.messages
  for insert to authenticated
  with check (
    sender = 'usuario'
    and response_json is null
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
        and c.archived = false
    )
  );

-- 3) El consentimiento lo inserta solo el servidor (secret key). La lectura
-- propia se conserva.
drop policy "consent_insert_own" on public.consent_acceptance_events;
