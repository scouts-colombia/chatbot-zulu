-- ============================================================================
-- Alinea la cookie de preflight con el TTL efectivo de PostgreSQL y evita que
-- la limpieza de Auth elimine una identidad mientras su preflight sigue vivo.
-- ============================================================================

begin;

create function public.preparar_turno_invitado_v2(
  p_device_hash text,
  p_environment_hash text,
  p_network_hash text
)
returns table (preflight_id uuid, ttl_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preflight_id uuid;
  v_ttl_minutes integer;
begin
  v_preflight_id := public.preparar_turno_invitado(
    p_device_hash,
    p_environment_hash,
    p_network_hash
  );

  select greatest(
    1,
    least(
      60,
      coalesce(
        (
          select valor::integer
          from public.app_settings
          where clave = 'guest_preflight_ttl_minutes'
        ),
        10
      )
    )
  ) into v_ttl_minutes;

  return query select v_preflight_id, v_ttl_minutes * 60;
end;
$$;

revoke execute on function public.preparar_turno_invitado_v2(text, text, text)
  from public, anon, authenticated;
grant execute on function public.preparar_turno_invitado_v2(text, text, text)
  to service_role;

comment on function public.preparar_turno_invitado_v2(text, text, text) is
  'Prepara el turno y devuelve el TTL efectivo que el servidor debe usar en la cookie HttpOnly.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitado boolean;
  v_gracia_invitada_minutos integer;
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

    select greatest(
      15,
      least(
        60,
        coalesce(
          (
            select valor::integer
            from public.app_settings
            where clave = 'guest_preflight_ttl_minutes'
          ),
          10
        )
      )
    ) into v_gracia_invitada_minutos;

    insert into public.guest_identity_cleanup_queue (
      guest_user_id,
      next_attempt_at
    ) values (
      new.id,
      now() + make_interval(mins => v_gracia_invitada_minutos)
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

commit;
