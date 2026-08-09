begin;

-- Evita eliminar la identidad técnica mientras el proveedor o la persistencia
-- del turno todavía pueden necesitar sus FK. Las reservas anteriores a esta
-- migración ya terminaron, por lo que se rellenan con su hora de consumo.
alter table public.guest_turn_reservations
  add column completed_at timestamptz;

update public.guest_turn_reservations
set completed_at = consumed_at
where completed_at is null;

comment on column public.guest_turn_reservations.completed_at is
  'Momento en que finalizó el procesamiento del turno, incluido su intento de telemetría.';

create function public.finalizar_turno_invitado(
  p_user_message_id uuid,
  p_anonymous_user_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with actualizada as (
    update public.guest_turn_reservations
    set completed_at = coalesce(completed_at, now())
    where user_message_id = p_user_message_id
      and anonymous_user_id = p_anonymous_user_id
    returning 1
  )
  select exists(select 1 from actualizada);
$$;

comment on function public.finalizar_turno_invitado(uuid, uuid) is
  'Marca el fin del procesamiento de un turno invitado antes de permitir transferir y borrar su identidad técnica.';

revoke execute on function public.finalizar_turno_invitado(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalizar_turno_invitado(uuid, uuid)
  to service_role;

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

  return v_transferidas;
end;
$$;

comment on function public.transferir_conversaciones_invitadas(uuid, uuid) is
  'Transfiere una identidad invitada completada, conserva su auditoría y recompone la caché de consentimiento de la cuenta permanente.';

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;

commit;
