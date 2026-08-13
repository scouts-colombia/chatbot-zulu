-- ============================================================================
-- 0016_endurecer_chat_invitado.sql
-- Preflight antes de crear auth.users, ventana diaria de red y cuota permanente
-- independiente del turno de prueba. Todo identificador sigue siendo HMAC.
-- ============================================================================

create table public.guest_turn_preflights (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique
    check (device_hash ~ '^[0-9a-f]{64}$'),
  environment_hash text not null
    check (environment_hash ~ '^[0-9a-f]{64}$'),
  network_hash text not null
    check (network_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

comment on table public.guest_turn_preflights is
  'Claims efimeros previos a crear un usuario anonimo. Solo UUID y HMAC; nunca IP, user-agent ni contenido.';

create index idx_guest_turn_preflights_network_created
  on public.guest_turn_preflights (network_hash, created_at);

create index idx_guest_turn_preflights_created
  on public.guest_turn_preflights (created_at);

create index idx_guest_turn_reservations_network_consumed
  on public.guest_turn_reservations (network_hash, consumed_at);

alter table public.guest_turn_preflights enable row level security;

-- El entorno es una señal auxiliar y no una identidad estable: dos personas en
-- una red compartida pueden coincidir en navegador e idioma. El dispositivo
-- conserva el límite permanente y la red se limita por día.
alter table public.guest_turn_reservations
  drop constraint if exists guest_turn_reservations_environment_hash_key;

alter table public.messages
  add column is_guest_trial boolean not null default false;

comment on column public.messages.is_guest_trial is
  'Marca durable del turno publico para excluirlo de la cuota de una cuenta permanente.';

update public.messages m
set is_guest_trial = true
from public.guest_turn_reservations r
where r.user_message_id = m.id;

create function public.marcar_mensaje_turno_invitado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages
  set is_guest_trial = true
  where id = new.user_message_id;
  return new;
end;
$$;

create trigger on_guest_turn_reservation_mark_message
  after insert on public.guest_turn_reservations
  for each row execute function public.marcar_mensaje_turno_invitado();

revoke execute on function public.marcar_mensaje_turno_invitado()
  from public, anon, authenticated;

insert into public.app_settings (clave, valor)
values ('guest_preflight_ttl_minutes', '10')
on conflict (clave) do nothing;

create function public.preparar_turno_invitado(
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

  perform pg_advisory_xact_lock(hashtextextended('guest-device:' || p_device_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('guest-network:' || p_network_hash, 0));

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

  if exists (
    select 1 from public.guest_turn_reservations r
    where r.device_hash = p_device_hash
  ) or exists (
    select 1 from public.guest_turn_preflights p
    where p.device_hash = p_device_hash
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

revoke execute on function public.preparar_turno_invitado(text, text, text)
  from public, anon, authenticated;
grant execute on function public.preparar_turno_invitado(text, text, text)
  to service_role;

create function public.liberar_preflight_turno_invitado(p_preflight_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.guest_turn_preflights where id = p_preflight_id;
$$;

revoke execute on function public.liberar_preflight_turno_invitado(uuid)
  from public, anon, authenticated;
grant execute on function public.liberar_preflight_turno_invitado(uuid)
  to service_role;

create function public.reservar_turno_invitado_v2(
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

  perform pg_advisory_xact_lock(hashtextextended('guest-device:' || p_device_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('guest-network:' || p_network_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('guest-user:' || p_user_id::text, 0));

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

-- Compatibilidad durante un despliegue escalonado: la ruta anterior conserva
-- su firma, pero adopta el preflight, la ventana diaria y el limite por
-- dispositivo de la implementacion v2.
create or replace function public.reservar_turno_invitado(
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
    p_policy_version,
    p_policy_url,
    p_user_agent_hash
  );
end;
$$;

revoke execute on function public.reservar_turno_invitado(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.reservar_turno_invitado(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;

-- El turno de prueba no reduce la cuota de una cuenta permanente después de
-- una conversión in-place o una transferencia a una cuenta existente.
create or replace function public.insertar_turno_usuario(
  p_conversation_id uuid,
  p_content text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_max int;
  v_zona text;
  v_inicio_dia timestamptz;
  v_turnos_hoy int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtext('chat_turn:' || (select auth.uid())::text)
  );

  select coalesce(
    (
      select valor::int
      from public.app_settings
      where clave = 'max_chat_turns_per_user_per_day'
    ),
    30
  ) into v_max;

  v_zona := public.zona_horaria_operativa();
  v_inicio_dia :=
    date_trunc('day', now() at time zone v_zona) at time zone v_zona;

  select count(*) into v_turnos_hoy
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.user_id = (select auth.uid())
    and m.sender = 'usuario'
    and m.created_at >= v_inicio_dia
    and m.is_guest_trial is false;

  if v_turnos_hoy >= v_max then
    raise exception 'limite_diario:%', v_max;
  end if;

  insert into public.messages (conversation_id, sender, content)
  values (p_conversation_id, 'usuario', p_content)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.insertar_turno_usuario(uuid, text)
  from public, anon;
grant execute on function public.insertar_turno_usuario(uuid, text)
  to authenticated;

create or replace view public.daily_chat_turns_by_user
  with (security_invoker = on) as
select
  c.user_id,
  (m.created_at at time zone public.zona_horaria_operativa())::date as usage_date,
  count(*) as chat_turns
from public.messages m
join public.conversations c on c.id = m.conversation_id
where m.sender = 'usuario'
  and m.is_guest_trial is false
group by c.user_id, (m.created_at at time zone public.zona_horaria_operativa())::date;
