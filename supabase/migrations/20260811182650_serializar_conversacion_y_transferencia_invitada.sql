-- ============================================================================
-- Serializa la conversación, la reserva y la transferencia de un invitado.
-- Todas las operaciones comparten el lock `guest-user:<uuid>` antes de validar
-- estado mutable, para que ninguna pestaña transfiera mientras otra reserva.
-- ============================================================================

begin;

create function public.obtener_o_crear_conversacion_invitada(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
begin
  if p_user_id is null then
    raise exception 'usuario_invitado_invalido';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('guest-user:' || p_user_id::text, 0)
  );

  if not exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = p_user_id
      and u.is_anonymous is true
      and p.is_guest is true
      and p.account_status = 'activo'
  ) then
    raise exception 'usuario_no_es_invitado';
  end if;

  -- Si una versión anterior alcanzó a crear duplicados, prioriza la
  -- conversación que conserva mensajes para no ocultar el turno consumido.
  select c.id
  into v_conversation_id
  from public.conversations c
  where c.user_id = p_user_id
  order by
    exists (
      select 1
      from public.messages m
      where m.conversation_id = c.id
    ) desc,
    c.created_at asc,
    c.id asc
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations (user_id)
    values (p_user_id)
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

comment on function public.obtener_o_crear_conversacion_invitada(uuid) is
  'Obtiene o crea una sola conversación técnica por identidad invitada bajo el mismo lock usado por reserva y transferencia.';

revoke execute on function public.obtener_o_crear_conversacion_invitada(uuid)
  from public, anon, authenticated;
grant execute on function public.obtener_o_crear_conversacion_invitada(uuid)
  to service_role;

create or replace function public.reservar_turno_invitado_v2(
  p_preflight_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text,
  p_device_hash text,
  p_environment_hash text,
  p_network_hash text,
  p_policy_version text,
  p_policy_url text,
  p_user_agent_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_max_network int;
  v_network_count int;
  v_ttl_minutes int;
  v_inicio_dia timestamptz;
  v_zona text;
  v_preflight public.guest_turn_preflights%rowtype;
begin
  if p_content is null
     or length(trim(p_content)) = 0
     or length(p_content) > 2000 then
    raise exception 'contenido_invalido';
  end if;

  if not coalesce(p_device_hash ~ '^[0-9a-f]{64}$', false)
     or not coalesce(p_environment_hash ~ '^[0-9a-f]{64}$', false)
     or not coalesce(p_network_hash ~ '^[0-9a-f]{64}$', false)
     or not coalesce(p_user_agent_hash ~ '^[0-9a-f]{64}$', false) then
    raise exception 'identidad_invitada_invalida';
  end if;

  -- Debe preceder toda lectura de estado que la transferencia pueda cambiar.
  perform pg_advisory_xact_lock(
    hashtextextended('guest-user:' || p_user_id::text, 0)
  );

  select greatest(
    1,
    least(
      60,
      coalesce(
        (
          select valor::int from public.app_settings
          where clave = 'guest_preflight_ttl_minutes'
        ),
        10
      )
    )
  ) into v_ttl_minutes;

  select * into v_preflight
  from public.guest_turn_preflights
  where id = p_preflight_id
  for update;

  if not found
     or v_preflight.created_at < now() - make_interval(mins => v_ttl_minutes)
     or v_preflight.device_hash <> p_device_hash
     or v_preflight.environment_hash <> p_environment_hash
     or v_preflight.network_hash <> p_network_hash then
    raise exception 'preflight_invitado_invalido';
  end if;

  if not exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = p_user_id
      and u.is_anonymous is true
      and p.is_guest is true
      and p.account_status = 'activo'
  ) then
    raise exception 'usuario_no_es_invitado';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and c.user_id = p_user_id
      and c.archived is false
  ) then
    raise exception 'conversacion_invitada_invalida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('guest-device:' || p_device_hash, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('guest-network:' || p_network_hash, 0)
  );

  if exists (
    select 1 from public.guest_turn_reservations r
    where r.anonymous_user_id = p_user_id
       or r.device_hash = p_device_hash
  ) then
    raise exception 'limite_invitado';
  end if;

  select greatest(
    1,
    coalesce(
      (
        select valor::int from public.app_settings
        where clave = 'max_guest_turns_per_network'
      ),
      5
    )
  ) into v_max_network;

  v_zona := public.zona_horaria_operativa();
  v_inicio_dia :=
    date_trunc('day', now() at time zone v_zona) at time zone v_zona;

  select count(*) into v_network_count
  from public.guest_turn_reservations
  where network_hash = p_network_hash
    and consumed_at >= v_inicio_dia;

  if v_network_count >= v_max_network then
    raise exception 'limite_red_invitada';
  end if;

  perform public.registrar_consentimiento_servidor(
    p_user_id,
    p_policy_version,
    p_policy_url,
    p_network_hash,
    p_user_agent_hash
  );

  insert into public.messages (conversation_id, sender, content)
  values (p_conversation_id, 'usuario', p_content)
  returning id into v_id;

  insert into public.guest_turn_reservations (
    anonymous_user_id,
    conversation_id,
    user_message_id,
    device_hash,
    environment_hash,
    network_hash
  ) values (
    p_user_id,
    p_conversation_id,
    v_id,
    p_device_hash,
    p_environment_hash,
    p_network_hash
  );

  delete from public.guest_turn_preflights where id = p_preflight_id;
  return v_id;
end;
$$;

revoke execute on function public.reservar_turno_invitado_v2(
  uuid, uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.reservar_turno_invitado_v2(
  uuid, uuid, uuid, text, text, text, text, text, text, text
) to service_role;

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
  if p_guest_user_id = p_target_user_id then
    raise exception 'transferencia_invitada_invalida';
  end if;

  -- La reserva y la creación usan exactamente esta misma clave.
  perform pg_advisory_xact_lock(
    hashtextextended('guest-user:' || p_guest_user_id::text, 0)
  );

  if not exists (
       select 1 from auth.users
       where id = p_guest_user_id and is_anonymous is true
     )
     or not exists (
       select 1 from auth.users
       where id = p_target_user_id and is_anonymous is false
     ) then
    raise exception 'transferencia_invitada_invalida';
  end if;

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
  'Transfiere una identidad invitada completada bajo el lock compartido, conserva su auditoría y encola su borrado reintentable.';

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;

commit;