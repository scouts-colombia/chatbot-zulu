begin;

-- La evidencia append-only es la fuente de verdad. Tras reasignarla a la
-- cuenta permanente, recompone su caché con la aceptación de privacidad más
-- reciente para no pedir una segunda aceptación de la misma política.
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
  'Transfiere conversaciones, consentimiento y telemetría de una identidad anónima, y recompone la caché de consentimiento de la cuenta permanente.';

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;

commit;
