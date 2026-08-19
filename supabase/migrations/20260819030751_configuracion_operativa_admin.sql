begin;

insert into public.app_settings (clave, valor)
values
  ('gemini_model', 'gemini-3.5-flash'),
  ('gemini_thinking_level', 'medium'),
  ('max_chat_turns_per_user_per_day', '30'),
  ('max_guest_turns_per_person_per_day', '1'),
  ('max_guest_turns_per_network', '5')
on conflict (clave) do nothing;

-- Una reserva representa un turno, no una identidad completa. Las restricciones
-- únicas anteriores imponían exactamente un turno de por vida; los conteos
-- atómicos de las funciones siguientes pasan a aplicar el límite diario.
alter table public.guest_turn_reservations
  drop constraint if exists guest_turn_reservations_pkey,
  drop constraint if exists guest_turn_reservations_conversation_id_key,
  drop constraint if exists guest_turn_reservations_user_message_id_key,
  drop constraint if exists guest_turn_reservations_device_hash_key,
  drop constraint if exists guest_turn_reservations_environment_hash_key,
  add constraint guest_turn_reservations_pkey primary key (user_message_id);

create index idx_guest_turn_reservations_user
  on public.guest_turn_reservations (anonymous_user_id, consumed_at desc);
create index idx_guest_turn_reservations_device
  on public.guest_turn_reservations (device_hash, consumed_at desc);
comment on table public.guest_turn_reservations is
  'Reservas atómicas de turnos públicos. Contiene solo UUID y HMAC no reversibles; no contiene IP, user-agent ni respuesta del proveedor.';

create or replace function public.preparar_turno_invitado(
  p_device_hash text,
  p_environment_hash text,
  p_network_hash text
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
begin
  if not coalesce(p_device_hash ~ '^[0-9a-f]{64}$', false)
     or not coalesce(p_environment_hash ~ '^[0-9a-f]{64}$', false)
     or not coalesce(p_network_hash ~ '^[0-9a-f]{64}$', false) then
    raise exception 'identidad_invitada_invalida';
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

  delete from public.guest_turn_preflights
  where created_at < now() - make_interval(mins => v_ttl_minutes);

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
  where device_hash = p_device_hash
    and consumed_at >= v_inicio_dia;

  if v_person_count >= v_max_person or exists (
    select 1 from public.guest_turn_preflights
    where device_hash = p_device_hash
  ) then
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

  select
    (select count(*) from public.guest_turn_reservations r
      where r.network_hash = p_network_hash
        and r.consumed_at >= v_inicio_dia)
    +
    (select count(*) from public.guest_turn_preflights p
      where p.network_hash = p_network_hash)
  into v_network_count;

  if v_network_count >= v_max_network then
    raise exception 'limite_red_invitada';
  end if;

  insert into public.guest_turn_preflights (
    device_hash,
    environment_hash,
    network_hash
  ) values (
    p_device_hash,
    p_environment_hash,
    p_network_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

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

create function public.admin_actualizar_configuracion_chat(
  p_admin_user_id uuid,
  p_gemini_model text,
  p_gemini_thinking_level text,
  p_max_registered_daily integer,
  p_max_guest_person_daily integer,
  p_max_guest_network_daily integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin_role text;
  v_admin_status text;
begin
  if p_gemini_model is null
     or length(p_gemini_model) > 80
     or p_gemini_model !~ '^gemini-[a-z0-9][a-z0-9.-]*$'
     or p_gemini_thinking_level not in ('minimal', 'low', 'medium', 'high')
     or p_max_registered_daily not between 1 and 500
     or p_max_guest_person_daily not between 1 and 10
     or p_max_guest_network_daily not between 1 and 500 then
    raise exception 'configuracion_invalida';
  end if;

  select role, account_status
  into v_admin_role, v_admin_status
  from public.profiles
  where id = p_admin_user_id
  for share;

  if not found
     or v_admin_role <> 'admin'
     or v_admin_status <> 'activo' then
    raise exception 'admin_no_autorizado';
  end if;

  insert into public.app_settings as configuracion (clave, valor, updated_at)
  values
    ('gemini_model', p_gemini_model, now()),
    ('gemini_thinking_level', p_gemini_thinking_level, now()),
    ('max_chat_turns_per_user_per_day', p_max_registered_daily::text, now()),
    ('max_guest_turns_per_person_per_day', p_max_guest_person_daily::text, now()),
    ('max_guest_turns_per_network', p_max_guest_network_daily::text, now())
  on conflict (clave) do update
  set valor = excluded.valor,
      updated_at = excluded.updated_at;

  insert into public.admin_audit_events (
    admin_user_id,
    action,
    target_type,
    target_id,
    reason
  ) values (
    p_admin_user_id,
    'update_chat_settings',
    'app_settings',
    null,
    format(
      'modelo=%s; thinking=%s; cuotas=%s/%s/%s',
      p_gemini_model,
      p_gemini_thinking_level,
      p_max_registered_daily,
      p_max_guest_person_daily,
      p_max_guest_network_daily
    )
  );
end;
$$;

revoke execute on function public.admin_actualizar_configuracion_chat(
  uuid, text, text, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.admin_actualizar_configuracion_chat(
  uuid, text, text, integer, integer, integer
) to service_role;

commit;
