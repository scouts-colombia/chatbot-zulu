-- ============================================================================
-- Expira identidades anónimas que nunca reservan un turno y fija de manera
-- inmutable el único destino permitido para cada transferencia invitada.
-- ============================================================================

begin;

alter table public.guest_identity_cleanup_queue
  add column target_user_id uuid,
  add column deletion_claimed_at timestamptz;

alter table public.guest_identity_cleanup_queue
  add constraint guest_identity_cleanup_queue_distinct_target
  check (target_user_id is null or target_user_id <> guest_user_id);

comment on column public.guest_identity_cleanup_queue.target_user_id is

  'UUID permanente elegido bajo lock al transferir. Null identifica una sesión anónima que aún no consumió su turno.';
comment on column public.guest_identity_cleanup_queue.deletion_claimed_at is
  'Marca durable de que un worker ya recibió el UUID para borrarlo; una reserva posterior debe fallar cerrada.';

comment on table public.guest_identity_cleanup_queue is
  'Cola privada y mínima para expirar identidades anónimas sin turno y reintentar el borrado de identidades ya transferidas.';

-- Compatibilidad con filas creadas por la migración anterior: una reserva
-- transferida conserva el conversation_id, cuyo dueño actual revela el destino.
update public.guest_identity_cleanup_queue as cola
set target_user_id = (
  select conversacion.user_id
  from public.guest_turn_reservations as reserva
  join public.conversations as conversacion
    on conversacion.id = reserva.conversation_id
  where reserva.anonymous_user_id = cola.guest_user_id
    and conversacion.user_id <> cola.guest_user_id
  order by reserva.consumed_at desc, reserva.user_message_id desc
  limit 1
)
where cola.target_user_id is null
  and exists (
    select 1
    from public.guest_turn_reservations as reserva
    join public.conversations as conversacion
      on conversacion.id = reserva.conversation_id
    where reserva.anonymous_user_id = cola.guest_user_id
      and conversacion.user_id <> cola.guest_user_id
  );

-- El trigger de Auth encola dentro de la misma transacción toda identidad
-- anónima. Si la cola falla, tampoco se confirma auth.users ni profiles.
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

    insert into public.guest_identity_cleanup_queue (guest_user_id)
    values (new.id);
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

-- La reserva y esta eliminación pertenecen a la misma transacción: un fallo
-- posterior revierte ambas. Solo se retira una expiración aún no transferida.
create function public.retirar_limpieza_identidad_invitada_consumida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.guest_identity_cleanup_queue
  where guest_user_id = new.anonymous_user_id
    and target_user_id is null
    and deletion_claimed_at is null;

  if not found and exists (
    select 1
    from public.guest_identity_cleanup_queue
    where guest_user_id = new.anonymous_user_id
      and target_user_id is null
      and deletion_claimed_at is not null
  ) then
    raise exception 'identidad_invitada_expirando';
  end if;

  return new;
end;
$$;

create trigger on_guest_turn_reservation_cancel_idle_cleanup
  after insert on public.guest_turn_reservations
  for each row execute function public.retirar_limpieza_identidad_invitada_consumida();

revoke execute on function public.retirar_limpieza_identidad_invitada_consumida()
  from public, anon, authenticated;
-- El claim marca de forma durable que Auth Admin ya puede recibir el UUID. El
-- trigger de reserva toma el mismo row lock y rechaza si el claim ganó la carrera.
create or replace function public.tomar_limpiezas_identidad_invitada(
  p_limite integer default 3,
  p_preferida uuid default null
)
returns table (guest_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
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
        next_attempt_at = now() + interval '5 minutes',
        deletion_claimed_at = now()
    from candidatas
    where cola.guest_user_id = candidatas.guest_user_id
    returning cola.guest_user_id
  )
  select reclamadas.guest_user_id
  from reclamadas;
end;
$$;

revoke execute on function public.tomar_limpiezas_identidad_invitada(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.tomar_limpiezas_identidad_invitada(integer, uuid)
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
  v_destino_existente uuid;
begin
  if p_guest_user_id = p_target_user_id then
    raise exception 'transferencia_invitada_invalida';
  end if;

  -- La reserva y la creación usan exactamente esta misma clave.
  perform pg_advisory_xact_lock(
    hashtextextended('guest-user:' || p_guest_user_id::text, 0)
  );

  select cola.target_user_id
  into v_destino_existente
  from public.guest_identity_cleanup_queue as cola
  where cola.guest_user_id = p_guest_user_id;

  if v_destino_existente is not null
     and v_destino_existente <> p_target_user_id then
    raise exception 'transferencia_invitada_destino_distinto';
  end if;

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

  insert into public.guest_identity_cleanup_queue (
    guest_user_id,
    target_user_id
  ) values (
    p_guest_user_id,
    p_target_user_id
  )
  on conflict (guest_user_id) do update
  set target_user_id = excluded.target_user_id
  where guest_identity_cleanup_queue.target_user_id is null
     or guest_identity_cleanup_queue.target_user_id = excluded.target_user_id;

  return v_transferidas;
end;
$$;
comment on function public.transferir_conversaciones_invitadas(uuid, uuid) is
  'Transfiere una identidad invitada a un único destino durable bajo el lock compartido y encola su borrado reintentable.';

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;

comment on function public.tomar_limpiezas_identidad_invitada(integer, uuid) is
  'Reclama con SKIP LOCKED identidades anónimas sin turno o ya transferidas; solo service_role puede ejecutarla.';

commit;