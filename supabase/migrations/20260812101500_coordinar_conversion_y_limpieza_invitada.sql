-- ============================================================================
-- Coordina la conversión in-place de Auth con el claim de limpieza invitada.
-- ============================================================================

begin;

create or replace function public.handle_anonymous_user_converted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitado boolean;
  v_claim timestamptz;
begin
  if not coalesce(old.is_anonymous, false)
     or coalesce(new.is_anonymous, false)
     or new.email is null then
    return new;
  end if;

  -- El claim y esta conversión se serializan sobre la misma fila. Si el worker
  -- ya recibió el UUID, se revierte la actualización de auth.users para impedir
  -- que Auth Admin borre después una cuenta que acaba de volverse permanente.
  select cola.deletion_claimed_at
  into v_claim
  from public.guest_identity_cleanup_queue as cola
  where cola.guest_user_id = new.id
  for update;

  if v_claim is not null then
    raise exception 'identidad_invitada_expirando';
  end if;

  delete from public.guest_identity_cleanup_queue
  where guest_user_id = new.id
    and target_user_id is null
    and deletion_claimed_at is null;

  select exists (
    select 1
    from public.allowed_emails as permitida
    where permitida.email = lower(trim(new.email))
  ) into invitado;

  update public.profiles
  set email = new.email,
      nombre = coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
        nombre
      ),
      account_status = case
        when invitado then 'activo'
        else 'pendiente_autorizacion'
      end,
      is_guest = false
  where id = new.id;

  return new;
end;
$$;

revoke execute on function public.handle_anonymous_user_converted()
  from public, anon, authenticated;

comment on function public.handle_anonymous_user_converted() is
  'Convierte una identidad anónima solo si aún no fue entregada a Auth Admin para borrado; retira atómicamente su expiración pendiente.';

commit;
