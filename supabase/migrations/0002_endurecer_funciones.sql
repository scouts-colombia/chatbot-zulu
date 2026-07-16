-- ============================================================================
-- 0002_endurecer_funciones.sql
-- Respuesta a los advisors de seguridad de Supabase tras 0001:
-- las funciones de trigger no deben ser ejecutables vía RPC (/rest/v1/rpc/*)
-- por anon ni authenticated. Solo las invocan los triggers.
-- ============================================================================

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
