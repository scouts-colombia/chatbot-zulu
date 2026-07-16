-- ============================================================================
-- 0005_columnas_update_perfiles.sql — Revisión del PR #1 (Codex, ronda 3).
--
-- La política de UPDATE de profiles permitía modificar toda la fila propia;
-- el trigger protege los campos sensibles pero no created_at (dato de
-- auditoría en el flujo de menores). Mismo patrón que 0004: privilegios de
-- columna. El cliente solo actualiza lo que legítimamente le pertenece:
--   - profiles: nombre
--   - conversations: title, archived
-- ============================================================================

revoke update on table public.profiles from authenticated;
grant update (nombre) on table public.profiles to authenticated;

revoke update on table public.conversations from authenticated;
grant update (title, archived) on table public.conversations to authenticated;
