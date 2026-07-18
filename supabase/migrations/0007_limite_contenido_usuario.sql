-- ============================================================================
-- 0007_limite_contenido_usuario.sql — Revisión del PR #5 (Codex, ronda 3).
--
-- La validación de 2000 caracteres vivía solo en el endpoint: un usuario
-- autenticado podía insertar mensajes arbitrariamente grandes directo por
-- PostgREST (la política messages_insert_own_user lo permite) y el historial
-- los reenviaba a Gemini sin acotar (abuso de costo / prompt gigante).
--
-- El límite pasa a la base: aplica a la política RLS, a la función
-- insertar_turno_usuario y a cualquier camino futuro. Los mensajes del
-- asistente/sistema (servidor) no se limitan.
-- ============================================================================

alter table public.messages
  add constraint messages_contenido_usuario_max
  check (sender <> 'usuario' or char_length(content) <= 2000);
