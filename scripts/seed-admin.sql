-- ============================================================================
-- seed-admin.sql — Promover el PRIMER administrador del piloto.
--
-- El rol NUNCA se autoasigna (P-RNF-05): el trigger protect_profile_fields
-- bloquea cambios de role desde el cliente. Este script se ejecuta por un
-- canal confiable, donde el trigger sí permite el cambio:
--   - SQL Editor del dashboard de Supabase (conexión directa, sin JWT), o
--   - psql / CLI de Supabase.
--
-- Pasos:
--   1. La persona se registra normalmente en la app (puede quedar pendiente).
--   2. Reemplaza el único correo de abajo y ejecuta.
--   3. El bloque activa, promueve y agrega el correo a la allowlist de forma
--      atómica. Si el perfil no existe, no aplica ningún cambio.
--   4. Verifica con el SELECT final.
--
-- Este bootstrap se ejecuta antes de que exista un administrador activo, por
-- lo que no genera un evento de auditoría de administrador.
-- ============================================================================

do $$
declare
  v_email text := lower(trim('REEMPLAZAR@scout.org.co'));
  v_admin_id uuid;
begin
  if v_email = 'reemplazar@scout.org.co' then
    raise exception 'Reemplaza el correo de ejemplo antes de ejecutar el script';
  end if;

  update public.profiles
  set role = 'admin',
      account_status = 'activo'
  where lower(trim(email)) = v_email
  returning id into v_admin_id;

  if not found then
    raise exception 'No existe un perfil registrado para %', v_email;
  end if;

  insert into public.allowed_emails (email, nota, added_by)
  values (
    v_email,
    'Primer administrador del piloto (seed-admin.sql)',
    v_admin_id
  )
  on conflict (email) do update
  set added_by = excluded.added_by;
end;
$$;

select id, email, role, account_status
from public.profiles
where role = 'admin'
order by created_at;
