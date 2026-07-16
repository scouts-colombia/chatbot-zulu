-- ============================================================================
-- 0004_columnas_insert_mensajes.sql — Revisión del PR #1 (Codex, ronda 2).
--
-- El cliente podía fijar created_at al insertar mensajes vía PostgREST.
-- daily_chat_turns_by_user agrupa la cuota por m.created_at (D-11) y el
-- timestamp de los mensajes tiene valor de auditoría (menores): debe
-- ponerlo siempre la base de datos.
--
-- Privilegios de columna: el insert de authenticated queda limitado a las
-- columnas que legítimamente aporta el cliente. id, created_at y
-- response_json los pone el servidor/DB (default/null).
-- ============================================================================

revoke insert on table public.messages from authenticated;
grant insert (conversation_id, sender, content) on table public.messages to authenticated;
