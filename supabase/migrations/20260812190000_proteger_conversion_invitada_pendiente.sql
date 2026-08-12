-- ============================================================================
-- Hace idempotente la transferencia aun después de borrar la identidad técnica
-- y protege identidades que están completando la verificación de correo.
-- ============================================================================

begin;

alter table public.guest_identity_cleanup_queue
  add column registration_pending_until timestamptz;

comment on column public.guest_identity_cleanup_queue.registration_pending_until is
  'Impide reclamar temporalmente una identidad anónima mientras confirma el correo; no contiene PII.';

create table public.guest_transfer_receipts (
  guest_user_id uuid primary key,
  target_user_id uuid not null
    references auth.users(id) on delete cascade,
  transferred_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  constraint guest_transfer_receipts_distinct_users
    check (guest_user_id <> target_user_id),
  constraint guest_transfer_receipts_valid_expiry
    check (expires_at > transferred_at)
);

comment on table public.guest_transfer_receipts is
  'Recibos temporales con UUID únicamente para repetir de forma idempotente un login mientras Auth elimina la identidad invitada.';

create index idx_guest_transfer_receipts_expires_at
  on public.guest_transfer_receipts (expires_at);

alter table public.guest_transfer_receipts enable row level security;

revoke all on table public.guest_transfer_receipts
  from public, anon, authenticated;

create function public.marcar_registro_invitado_pendiente(
  p_guest_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_guest_user_id is null then
    raise exception 'identidad_invitada_invalida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('guest-user:' || p_guest_user_id::text, 0)
  );

  update public.guest_identity_cleanup_queue
  set registration_pending_until = now() + interval '24 hours'
  where guest_user_id = p_guest_user_id
    and target_user_id is null
    and deletion_claimed_at is null;

  if found then
    return;
  end if;

  -- Una reserva consumida elimina la fila: esa identidad ya no es candidata
  -- a limpieza ociosa y no necesita una marca adicional.
  if exists (
    select 1
    from auth.users
    where id = p_guest_user_id
      and is_anonymous is true
  ) and not exists (
    select 1
    from public.guest_identity_cleanup_queue
    where guest_user_id = p_guest_user_id
  ) then
    return;
  end if;

  raise exception 'identidad_invitada_expirando';
end;
$$;

revoke execute on function public.marcar_registro_invitado_pendiente(uuid)
  from public, anon, authenticated;
grant execute on function public.marcar_registro_invitado_pendiente(uuid)
  to service_role;

create function public.cancelar_registro_invitado_pendiente(
  p_guest_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_guest_user_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('guest-user:' || p_guest_user_id::text, 0)
  );

  update public.guest_identity_cleanup_queue
  set registration_pending_until = null
  where guest_user_id = p_guest_user_id
    and target_user_id is null
    and deletion_claimed_at is null;
end;
$$;

revoke execute on function public.cancelar_registro_invitado_pendiente(uuid)
  from public, anon, authenticated;
grant execute on function public.cancelar_registro_invitado_pendiente(uuid)
  to service_role;

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
  delete from public.guest_transfer_receipts
  where expires_at <= now();

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
        cola.registration_pending_until is null
        or cola.registration_pending_until <= now()
      )
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

comment on function public.transferir_conversaciones_invitadas(uuid, uuid) is
  'Transfiere una identidad invitada una vez y acepta retries al mismo destino durante 1 hora, incluso después de eliminar el usuario técnico.';

revoke execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transferir_conversaciones_invitadas(uuid, uuid)
  to service_role;

comment on function public.tomar_limpiezas_identidad_invitada(integer, uuid) is
  'Reclama con SKIP LOCKED solo identidades anónimas sin registro por correo pendiente; purga recibos expirados y limita la ejecución a service_role.';

commit;
