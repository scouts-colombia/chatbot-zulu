-- ============================================================================
-- 0012_allowlist_registro.sql — Control de acceso al piloto por correo.
--
-- PROBLEMA. El registro es abierto: cualquiera con un correo entregable obtiene
-- una cuenta `activo` y, con ella, MAX_CHAT_TURNS_PER_USER_PER_DAY llamadas a
-- Gemini por día. El piloto es cerrado (~80 personas invitadas) y no hay nada
-- que limite quién entra.
--
-- QUÉ DECIDE ESTA MIGRACIÓN Y QUÉ NO. Decide únicamente el `account_status`
-- INICIAL de una cuenta nueva, según si el correo fue invitado al piloto:
--   - en la allowlist  -> 'activo'
--   - fuera            -> 'pendiente_autorizacion'
--
-- NO reintroduce la autorización de adulto responsable. La decisión
-- organizacional del 2026-08-01 (ROADMAP) es que todos los usuarios, incluidos
-- los de 15 a 17, se rigen por la política de privacidad de la Asociación y no
-- se pide autorización parental. Esa decisión es sobre EDAD; esta migración es
-- sobre INVITACIÓN. Un menor invitado entra igual de directo que un adulto
-- invitado: si su correo está en la lista, su cuenta nace `activo`.
-- `guardian_authorization_status` sigue sin usarse.
--
-- La allowlist decide el estado INICIAL y nada más. Agregar un correo después
-- de que la persona se registró no la activa retroactivamente: para eso está el
-- cambio de estado desde /admin/usuarios, que además queda auditado. Se hizo
-- así a propósito, porque una activación implícita al escribir en una tabla no
-- dejaría fila en `admin_audit_events`.
-- ============================================================================

-- 1. Tabla de invitados.
create table public.allowed_emails (
  -- Se guarda normalizado (lower+trim) por el trigger 3; la PK sobre el texto
  -- ya normalizado evita dos filas que solo difieran en mayúsculas.
  email text primary key,
  nota text,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.allowed_emails is
  'Correos invitados al piloto. Decide el account_status inicial en handle_new_user. No otorga rol ni salta ninguna otra verificación.';

-- RLS habilitada SIN políticas: solo el servidor con la secret key la lee o
-- escribe (mismo criterio de 0001 §5.7). Un Scout no debe poder averiguar quién
-- más fue invitado, que es una lista de correos de menores.
alter table public.allowed_emails enable row level security;

-- 2. Normalización en un trigger, no en la aplicación: el correo entra por
-- seed SQL, por el panel admin y por el script de pruebas, y las tres rutas
-- tienen que producir la misma clave. `auth.users.email` ya viene en
-- minúsculas desde GoTrue, así que la comparación del paso 3 es directa.
create function public.normalizar_allowed_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  if new.email = '' or position('@' in new.email) = 0 then
    raise exception 'Correo inválido en allowed_emails: %', new.email;
  end if;
  return new;
end;
$$;

create trigger normalizar_allowed_email
  before insert or update on public.allowed_emails
  for each row execute function public.normalizar_allowed_email();

revoke execute on function public.normalizar_allowed_email() from public, anon, authenticated;

-- 3. handle_new_user consulta la allowlist.
--
-- Reemplaza la versión de 0001, que insertaba sin `account_status` y dejaba
-- actuar el default 'activo' de la columna.
--
-- Sigue siendo `security definer` con `search_path = ''`, así que las
-- referencias van calificadas. Si esta función lanza, el insert en auth.users
-- se revierte y el registro falla: es una lectura a una tabla local, pero el
-- modo de fallo es "nadie puede registrarse", no "todos entran activos".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitado boolean;
begin
  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(trim(new.email))
  ) into invitado;

  insert into public.profiles (id, email, nombre, account_status)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre',
    case when invitado then 'activo' else 'pendiente_autorizacion' end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. El default de la columna deja de ser 'activo'.
--
-- handle_new_user siempre pasa el valor explícito, así que esto no cambia el
-- registro; cubre cualquier otra ruta de inserción (seed, script, RPC futura)
-- para que el descuido sea "queda pendiente" y no "queda activo".
alter table public.profiles
  alter column account_status set default 'pendiente_autorizacion';

-- 5. Las cuentas que YA existen no se tocan.
--
-- Sin esto, nada les pasaría igual (el trigger es on insert), pero conviene
-- dejar constancia de que la migración es deliberadamente no retroactiva: al
-- aplicarla hay 2 perfiles activos y ambos deben seguir activos. Se agregan a
-- la allowlist para que la lista refleje la realidad y un eventual borrado y
-- re-registro no los deje fuera.
insert into public.allowed_emails (email, nota)
select p.email, 'Cuenta anterior a la allowlist (migración 0012)'
from public.profiles p
where p.account_status = 'activo'
on conflict (email) do nothing;
