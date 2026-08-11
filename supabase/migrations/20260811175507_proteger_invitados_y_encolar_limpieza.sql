begin;

-- `is_guest` refleja el ciclo de vida de Auth y no es un atributo editable
-- por el usuario. Se conserva el canal privilegiado usado por migraciones,
-- SQL directo y service_role, igual que en la versión anterior del trigger.
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
     or new.is_guest is distinct from old.is_guest
     or new.id is distinct from old.id then
    raise exception 'Campo protegido de profiles: solo el servidor puede modificarlo';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_profile_fields()
  from public, anon, authenticated;

-- La transferencia deja una intención durable antes de cambiar las cookies
-- del navegador. El FK borra la fila automáticamente cuando Auth elimina la
-- identidad técnica; no se almacenan correo, IP, user-agent ni errores crudos.
create table public.guest_identity_cleanup_queue (
  guest_user_id uuid primary key
    references auth.users(id) on delete cascade,
  queued_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default (now() + interval '15 minutes'),
  attempts integer not null default 0 check (attempts >= 0)
);

comment on table public.guest_identity_cleanup_queue is
  'Cola privada y mínima para reintentar el borrado de identidades técnicas invitadas después de transferir sus datos.';

create index idx_guest_identity_cleanup_queue_next_attempt
  on public.guest_identity_cleanup_queue (next_attempt_at, queued_at);

alter table public.guest_identity_cleanup_queue enable row level security;

revoke all on table public.guest_identity_cleanup_queue
  from public, anon, authenticated;

-- Reclama un lote sin bloquear otros workers. La identidad preferida puede
-- adelantarse al periodo de gracia únicamente después de que el servidor haya
-- instalado la sesión permanente. Cada fallo queda diferido cinco minutos.
create function public.tomar_limpiezas_identidad_invitada(
  p_limite integer default 3,
  p_preferida uuid default null
)
returns table (guest_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Una conversión in-place vuelve permanente al mismo UUID; en ese caso la
  -- cola deja de ser aplicable y nunca debe borrar esa cuenta.
  delete from public.guest_identity_cleanup_queue as cola
  using auth.users as usuario
  where usuario.id = cola.guest_user_id
    and usuario.is_anonymous is false;

  return query
  with candidatas as (
    select cola.guest_user_id
    from public.guest_identity_cleanup_queue as cola
    join auth.users as usuario on usuario.id = cola.guest_user_id
    where usuario.is_anonymous is true
      and (
        cola.next_attempt_at <= now()
        or cola.guest_user_id = p_preferida
      )
    order by
      (cola.guest_user_id = p_preferida) desc,
      cola.next_attempt_at,
      cola.queued_at
    limit least(greatest(coalesce(p_limite, 3), 1), 10)
    for update of cola skip locked
  ), reclamadas as (
    update public.guest_identity_cleanup_queue as cola
    set attempts = cola.attempts + 1,
        next_attempt_at = now() + interval '5 minutes'
    from candidatas
    where cola.guest_user_id = candidatas.guest_user_id
    returning cola.guest_user_id
  )
  select reclamadas.guest_user_id
  from reclamadas;
end;
$$;

comment on function public.tomar_limpiezas_identidad_invitada(integer, uuid) is
  'Reclama con SKIP LOCKED identidades anónimas transferidas cuyo borrado debe reintentarse; solo service_role puede ejecutarla.';

revoke execute on function public.tomar_limpiezas_identidad_invitada(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.tomar_limpiezas_identidad_invitada(integer, uuid)
  to service_role;

-- La cola se crea en la misma transacción que mueve conversaciones, evidencia
-- y telemetría. Así nunca se pierde el UUID aunque Auth falle después.
create or replace function public.transferir_conversaciones_invitadas(
  p_guest_user_id uuid,
  p_target_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transferidas integer;
begin
  if p_guest_user_id = p_target_user_id
     or not exists (
       select 1 from auth.users
       where id = p_guest_user_id and is_anonymous is true
     )
     or not exists (
       select 1 from auth.users
       where id = p_target_user_id and is_anonymous is false
     ) then
    raise exception 'transferencia_invitada_invalida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('transferir-invitado:' || p_guest_user_id::text, 0)
  );

  if exists (
    select 1
    from public.guest_turn_reservations
    where anonymous_user_id = p_guest_user_id
      and completed_at is null
      and consumed_at >= now() - interval '2 minutes'
  ) then
    raise exception 'turno_invitado_en_curso';
  end if;

  update public.conversations
  set user_id = p_target_user_id
  where user_id = p_guest_user_id;

  get diagnostics v_transferidas = row_count;

  update public.consent_acceptance_events
  set
    subject_user_id = case
      when subject_user_id = p_guest_user_id then p_target_user_id
      else subject_user_id
    end,
    accepted_by_user_id = case
      when accepted_by_user_id = p_guest_user_id then p_target_user_id
      else accepted_by_user_id
    end
  where subject_user_id = p_guest_user_id
     or accepted_by_user_id = p_guest_user_id;

  update public.profiles
  set (
    privacy_policy_version_accepted,
    privacy_policy_accepted_at
  ) = (
    select
      evento.policy_version,
      evento.accepted_at
    from public.consent_acceptance_events as evento
    where evento.subject_user_id = p_target_user_id
      and evento.policy_type = 'privacy_policy'
    order by evento.accepted_at desc, evento.id desc
    limit 1
  )
  where id = p_target_user_id
    and exists (
      select 1
      from public.consent_acceptance_events as evento
      where evento.subject_user_id = p_target_user_id
        and evento.policy_type = 'privacy_policy'
    );

  update public.model_request_events
  set user_id = p_target_user_id
  where user_id = p_guest_user_id;

  insert into public.guest_identity_cleanup_queue (guest_user_id)
  values (p_guest_user_id)
  on conflict (guest_user_id) do nothing;

  return v_transferidas;
end;
$$;

comment on function public.transferir_conversaciones_invitadas(uuid, uuid) is
  'Transfiere una identidad invitada completada, conserva su auditoría y encola atómicamente el borrado reintentable de su usuario técnico.';

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;

commit;
