begin;

-- El consentimiento deja de versionarse: basta con haber aceptado una vez.
-- Las firmas cambian, así que hay que recrear las funciones (CREATE OR REPLACE
-- no altera la lista de argumentos). El wrapper v1 se mantiene alineado.

drop function public.reservar_turno_invitado(
  uuid, uuid, text, text, text, text, text, text, text
);
drop function public.reservar_turno_invitado_v2(
  uuid, uuid, uuid, text, text, text, text, text, text, text
);
drop function public.registrar_consentimiento_servidor(
  uuid, text, text, text, text
);

create function public.registrar_consentimiento_servidor(
  p_user_id uuid,
  p_policy_url text,
  p_ip_hash text,
  p_user_agent_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aceptado_en timestamptz;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('consentimiento:' || p_user_id::text, 0)
  );

  select privacy_policy_accepted_at
  into v_aceptado_en
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'perfil_no_encontrado';
  end if;

  if v_aceptado_en is not null then
    return;
  end if;

  insert into public.consent_acceptance_events (
    subject_user_id,
    accepted_by_user_id,
    policy_type,
    policy_url,
    ip_hash,
    user_agent_hash
  ) values (
    p_user_id,
    p_user_id,
    'privacy_policy',
    p_policy_url,
    p_ip_hash,
    p_user_agent_hash
  );

  update public.profiles
  set privacy_policy_accepted_at = now()
  where id = p_user_id;
end;
$$;

revoke execute on function public.registrar_consentimiento_servidor(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.registrar_consentimiento_servidor(
  uuid, text, text, text
) to service_role;

create function public.reservar_turno_invitado_v2(
  p_preflight_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text,
  p_device_hash text,
  p_environment_hash text,
  p_network_hash text,
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
  v_max_person int;
  v_person_count int;
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

  select greatest(
    1,
    least(
      10,
      coalesce(
        (
          select valor::int from public.app_settings
          where clave = 'max_guest_turns_per_person_per_day'
        ),
        1
      )
    )
  ) into v_max_person;

  v_zona := public.zona_horaria_operativa();
  v_inicio_dia :=
    date_trunc('day', now() at time zone v_zona) at time zone v_zona;

  select count(*) into v_person_count
  from public.guest_turn_reservations
  where (anonymous_user_id = p_user_id or device_hash = p_device_hash)
    and consumed_at >= v_inicio_dia;

  if v_person_count >= v_max_person then
    raise exception 'limite_invitado';
  end if;

  select greatest(
    1,
    least(
      500,
      coalesce(
        (
          select valor::int from public.app_settings
          where clave = 'max_guest_turns_per_network'
        ),
        5
      )
    )
  ) into v_max_network;

  select count(*) into v_network_count
  from public.guest_turn_reservations
  where network_hash = p_network_hash
    and consumed_at >= v_inicio_dia;

  if v_network_count >= v_max_network then
    raise exception 'limite_red_invitada';
  end if;

  perform public.registrar_consentimiento_servidor(
    p_user_id,
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
  uuid, uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.reservar_turno_invitado_v2(
  uuid, uuid, uuid, text, text, text, text, text, text
) to service_role;

create function public.reservar_turno_invitado(
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text,
  p_device_hash text,
  p_environment_hash text,
  p_network_hash text,
  p_policy_url text,
  p_user_agent_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preflight_id uuid;
begin
  v_preflight_id := public.preparar_turno_invitado(
    p_device_hash,
    p_environment_hash,
    p_network_hash
  );

  return public.reservar_turno_invitado_v2(
    v_preflight_id,
    p_user_id,
    p_conversation_id,
    p_content,
    p_device_hash,
    p_environment_hash,
    p_network_hash,
    p_policy_url,
    p_user_agent_hash
  );
end;
$$;

revoke execute on function public.reservar_turno_invitado(
  uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.reservar_turno_invitado(
  uuid, uuid, text, text, text, text, text, text
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
  v_destino_existente uuid;
  v_claim timestamptz;
begin
  if p_guest_user_id is null
     or p_target_user_id is null
     or p_guest_user_id = p_target_user_id
     or not exists (
       select 1
       from auth.users
       where id = p_target_user_id
         and is_anonymous is false
     ) then
    raise exception 'transferencia_invitada_invalida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('guest-user:' || p_guest_user_id::text, 0)
  );

  delete from public.guest_transfer_receipts
  where guest_user_id = p_guest_user_id
    and expires_at <= now();

  select recibo.target_user_id
  into v_destino_existente
  from public.guest_transfer_receipts as recibo
  where recibo.guest_user_id = p_guest_user_id;

  if found then
    if v_destino_existente <> p_target_user_id then
      raise exception 'transferencia_invitada_destino_distinto';
    end if;
    return 0;
  end if;

  select cola.target_user_id, cola.deletion_claimed_at
  into v_destino_existente, v_claim
  from public.guest_identity_cleanup_queue as cola
  where cola.guest_user_id = p_guest_user_id
  for update;

  if v_destino_existente is not null
     and v_destino_existente <> p_target_user_id then
    raise exception 'transferencia_invitada_destino_distinto';
  end if;
  if v_claim is not null then
    raise exception 'identidad_invitada_expirando';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_guest_user_id
      and is_anonymous is true
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
  set privacy_policy_accepted_at = (
    select evento.accepted_at
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

  insert into public.guest_transfer_receipts (
    guest_user_id,
    target_user_id
  ) values (
    p_guest_user_id,
    p_target_user_id
  );

  insert into public.guest_identity_cleanup_queue (
    guest_user_id,
    target_user_id,
    next_attempt_at,
    registration_pending_until
  ) values (
    p_guest_user_id,
    p_target_user_id,
    now() + interval '15 minutes',
    null
  )
  on conflict (guest_user_id) do update
  set target_user_id = excluded.target_user_id,
      next_attempt_at = excluded.next_attempt_at,
      registration_pending_until = null
  where (
      guest_identity_cleanup_queue.target_user_id is null
      or guest_identity_cleanup_queue.target_user_id = excluded.target_user_id
    )
    and guest_identity_cleanup_queue.deletion_claimed_at is null;

  if not found then
    raise exception 'identidad_invitada_expirando';
  end if;

  return v_transferidas;
end;
$$;

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
     or new.privacy_policy_accepted_at is distinct from old.privacy_policy_accepted_at
     or new.email is distinct from old.email
     or new.is_guest is distinct from old.is_guest
     or new.id is distinct from old.id then
    raise exception 'Campo protegido de profiles: solo el servidor puede modificarlo';
  end if;

  return new;
end;
$$;

alter table public.profiles
  drop column privacy_policy_version_accepted;

alter table public.consent_acceptance_events
  drop column policy_version;

commit;
