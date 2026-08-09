begin;

-- Conserva la evidencia append-only y la telemetría del turno de prueba al
-- asociar una sesión anónima con una cuenta permanente existente. La reserva
-- seudónima no tiene FK al perfil y permanece intacta para aplicar límites.
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

  update public.model_request_events
  set user_id = p_target_user_id
  where user_id = p_guest_user_id;

  return v_transferidas;
end;
$$;

comment on function public.transferir_conversaciones_invitadas(uuid, uuid) is
  'Transfiere conversaciones, consentimiento y telemetría de una identidad anónima a una cuenta permanente antes de eliminar el usuario técnico.';

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;

commit;
