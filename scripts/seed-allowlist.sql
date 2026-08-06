-- ============================================================================
-- seed-allowlist.sql — Invitar correos al piloto.
--
-- Requiere la migración 0012. La allowlist decide el `account_status` INICIAL
-- de una cuenta nueva: un correo aquí nace 'activo', uno que no está nace
-- 'pendiente_autorizacion' y la persona ve, en la home, que un responsable debe
-- habilitarla.
--
-- Se ejecuta por el mismo canal que scripts/seed-admin.sql: SQL Editor del
-- dashboard de Supabase, psql o CLI. La tabla tiene RLS sin políticas, así que
-- desde el cliente no se lee ni se escribe.
--
-- El trigger normaliza a minúsculas y recorta espacios, y rechaza cualquier
-- cosa sin '@'. Pegar una lista con mayúsculas o espacios sobrantes es seguro.
-- ============================================================================

-- 1. Invitar. El bloque falla completo mientras quede un placeholder, para que
-- ejecutar este archivo por accidente no agregue correos de ejemplo.
-- `on conflict do nothing` lo hace repetible con la lista real.
do $$
declare
  invitado record;
begin
  for invitado in
    select *
    from (values
      ('REEMPLAZAR-1@ejemplo.com', 'Clan de prueba — piloto'),
      ('REEMPLAZAR-2@ejemplo.com', 'Clan de prueba — piloto')
    ) as invitados(email, nota)
  loop
    if invitado.email like 'REEMPLAZAR-%@ejemplo.com' then
      raise exception 'Reemplaza todos los correos de ejemplo antes de ejecutar seed-allowlist.sql';
    end if;

    insert into public.allowed_emails (email, nota)
    values (invitado.email, invitado.nota)
    on conflict (email) do nothing;
  end loop;
end;
$$;

-- 2. Quién ya se registró antes de ser invitado y sigue esperando.
-- Estas cuentas NO se activan solas: agregarlas a la lista no es retroactivo.
-- Actívalas desde /admin/usuarios, que además deja fila en admin_audit_events.
select p.email, p.account_status, p.created_at,
       (a.email is not null) as esta_en_allowlist
from public.profiles p
left join public.allowed_emails a on a.email = p.email
where p.account_status = 'pendiente_autorizacion'
order by p.created_at;

-- 3. Invitados que todavía no se registran.
select a.email, a.nota, a.created_at
from public.allowed_emails a
left join public.profiles p on p.email = a.email
where p.id is null
order by a.created_at;
