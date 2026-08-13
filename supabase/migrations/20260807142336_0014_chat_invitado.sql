-- ============================================================================
-- 0014_chat_invitado.sql — Un turno público, conversión de cuenta y RLS.
--
-- Los usuarios anónimos de Supabase usan el rol `authenticated`. Por eso no
-- basta con ocultar botones: esta migración les impide escribir directamente
-- con las políticas existentes y concentra su único turno en una RPC atómica,
-- accesible exclusivamente con service_role.
--
-- Los identificadores de dispositivo/red llegan como HMAC-SHA-256 calculados
-- en el servidor. Nunca se guarda IP, user-agent ni fingerprint reversible.
-- ============================================================================

-- 1. El perfil distingue invitados sin depender de un correo sintético.
alter table public.profiles
  add column is_guest boolean not null default false;

comment on column public.profiles.is_guest is
  'Es true únicamente mientras auth.users.is_anonymous sea true. La conversión conserva el mismo id y sus conversaciones.';

-- Los invitados de Auth no tienen email. Se usa un identificador interno no
-- entregable para mantener compatible la columna NOT NULL y los consumidores
-- existentes; la UI administrativa filtra `is_guest`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitado boolean;
begin
  if coalesce(new.is_anonymous, false) then
    insert into public.profiles (
      id,
      email,
      nombre,
      account_status,
      is_guest
    ) values (
      new.id,
      'invitado-' || new.id::text || '@anonymous.invalid',
      'Invitado',
      'activo',
      true
    );
    return new;
  end if;

  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(trim(new.email))
  ) into invitado;

  insert into public.profiles (
    id,
    email,
    nombre,
    account_status,
    is_guest
  ) values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre',
    case when invitado then 'activo' else 'pendiente_autorizacion' end,
    false
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- Al verificar el correo, Supabase convierte la identidad anónima sin cambiar
-- el UUID. El perfil adopta el correo/nombre reales y vuelve a pasar por la
-- allowlist: haber usado el turno público no concede acceso al piloto.
create function public.handle_anonymous_user_converted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitado boolean;
begin
  if not coalesce(old.is_anonymous, false)
     or coalesce(new.is_anonymous, false)
     or new.email is null then
    return new;
  end if;

  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(trim(new.email))
  ) into invitado;

  update public.profiles
  set email = new.email,
      nombre = coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), nombre),
      account_status = case
        when invitado then 'activo'
        else 'pendiente_autorizacion'
      end,
      is_guest = false
  where id = new.id;

  return new;
end;
$$;

create trigger on_anonymous_user_converted
  after update of email, is_anonymous on auth.users
  for each row execute function public.handle_anonymous_user_converted();

revoke execute on function public.handle_anonymous_user_converted()
  from public, anon, authenticated;

-- 2. Reserva durable del turno invitado. RLS sin policies: solo servidor.
create table public.guest_turn_reservations (
  anonymous_user_id uuid primary key,
  conversation_id uuid not null unique,
  user_message_id uuid not null unique,
  device_hash text not null unique
    check (device_hash ~ '^[0-9a-f]{64}$'),
  environment_hash text not null unique
    check (environment_hash ~ '^[0-9a-f]{64}$'),
  network_hash text not null
    check (network_hash ~ '^[0-9a-f]{64}$'),
  consumed_at timestamptz not null default now()
);

comment on table public.guest_turn_reservations is
  'Reserva atómica del único turno público. Contiene solo UUID y HMAC no reversibles; no contiene IP, user-agent ni respuesta del proveedor.';

create index idx_guest_turn_reservations_network
  on public.guest_turn_reservations (network_hash);

alter table public.guest_turn_reservations enable row level security;

insert into public.app_settings (clave, valor)
values ('max_guest_turns_per_network', '5')
on conflict (clave) do nothing;

-- 3. Los anónimos conservan lectura propia, pero no pueden usar directamente
-- las políticas permisivas de escritura creadas para cuentas permanentes.
create policy "conversations_insert_permanent_only"
  on public.conversations as restrictive
  for insert to authenticated
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
  );

create policy "conversations_update_permanent_only"
  on public.conversations as restrictive
  for update to authenticated
  using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
  )
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
  );

create policy "messages_insert_permanent_only"
  on public.messages as restrictive
  for insert to authenticated
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
  );

-- 4. Consentimiento server-side, append-only y con caché actualizada en la
-- misma transacción. Reintentar la misma versión es idempotente.
create function public.registrar_consentimiento_servidor(
  p_user_id uuid,
  p_policy_version text,
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
  v_version_actual text;
begin
  if nullif(trim(p_policy_version), '') is null then
    raise exception 'version_politica_invalida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('consentimiento:' || p_user_id::text, 0)
  );

  select privacy_policy_version_accepted
  into v_version_actual
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'perfil_no_encontrado';
  end if;

  if v_version_actual is not distinct from p_policy_version then
    return;
  end if;

  insert into public.consent_acceptance_events (
    subject_user_id,
    accepted_by_user_id,
    policy_type,
    policy_version,
    policy_url,
    ip_hash,
    user_agent_hash
  ) values (
    p_user_id,
    p_user_id,
    'privacy_policy',
    p_policy_version,
    p_policy_url,
    p_ip_hash,
    p_user_agent_hash
  );

  update public.profiles
  set privacy_policy_version_accepted = p_policy_version,
      privacy_policy_accepted_at = now()
  where id = p_user_id;
end;
$$;

revoke execute on function public.registrar_consentimiento_servidor(
  uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.registrar_consentimiento_servidor(
  uuid, text, text, text, text
) to service_role;

-- 5. Reserva el turno y el consentimiento en una sola transacción. Los locks
-- tienen orden fijo para evitar carreras entre pestañas y dispositivos.
create function public.reservar_turno_invitado(
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
  perform pg_advisory_xact_lock(hashtextextended('guest-environment:' || p_environment_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('guest-network:' || p_network_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('guest-user:' || p_user_id::text, 0));

  if exists (
    select 1 from public.guest_turn_reservations r
    where r.anonymous_user_id = p_user_id
       or r.device_hash = p_device_hash
       or r.environment_hash = p_environment_hash
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

  select count(*) into v_network_count
  from public.guest_turn_reservations
  where network_hash = p_network_hash;

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

  return v_id;
end;
$$;

revoke execute on function public.reservar_turno_invitado(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.reservar_turno_invitado(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;

-- 6. Si el visitante ya tenía cuenta, el login prueba la identidad permanente
-- antes de invocar esta transferencia. La RPC sigue siendo solo-servidor y
-- valida ambos extremos para que nunca se convierta en una reasignación libre.
create function public.transferir_conversaciones_invitadas(
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
  return v_transferidas;
end;
$$;

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;
