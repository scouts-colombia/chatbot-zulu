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
--   1. La persona se registra normalmente en la app (queda como scout).
--   2. Reemplaza el correo de abajo y ejecuta.
--   3. Verifica con el SELECT final.
-- ============================================================================

update public.profiles
set role = 'admin'
where email = 'REEMPLAZAR@scout.org.co';

select id, email, role, account_status
from public.profiles
where role = 'admin';
