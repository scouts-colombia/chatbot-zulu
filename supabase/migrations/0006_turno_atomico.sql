-- ============================================================================
-- 0006_turno_atomico.sql — Revisión del PR #5 (Codex).
--
-- La verificación de cuota (vista) y la inserción del mensaje eran dos pasos
-- sin transacción: N requests concurrentes del mismo usuario podían pasar el
-- guard en 29/30 y disparar Gemini varias veces. La reserva del turno pasa a
-- una función atómica con advisory lock por usuario.
--
-- La función es SECURITY INVOKER a propósito: la RLS y los privilegios de
-- columna del rol authenticated siguen aplicando por dentro (solo inserta
-- sender='usuario' en conversaciones propias activas, sin created_at ni
-- response_json del cliente).
--
-- El límite operativo vive en app_settings (escritura solo servidor), no en
-- una variable de entorno duplicada.
-- ============================================================================

create table public.app_settings (
  clave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Lectura para autenticados (el límite no es sensible); escritura solo
-- servidor (sin políticas de insert/update/delete).
create policy "app_settings_select" on public.app_settings
  for select to authenticated
  using (true);

insert into public.app_settings (clave, valor)
values ('max_chat_turns_per_user_per_day', '30');

create function public.insertar_turno_usuario(
  p_conversation_id uuid,
  p_content text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_max int;
  v_turnos_hoy int;
  v_id uuid;
begin
  -- Serializa los turnos del mismo usuario dentro de la transacción:
  -- dos requests concurrentes se encolan y el segundo ve el conteo real.
  perform pg_advisory_xact_lock(
    hashtext('chat_turn:' || (select auth.uid())::text)
  );

  select coalesce(
    (
      select valor::int
      from public.app_settings
      where clave = 'max_chat_turns_per_user_per_day'
    ),
    30
  ) into v_max;

  select count(*) into v_turnos_hoy
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.user_id = (select auth.uid())
    and m.sender = 'usuario'
    and m.created_at >= date_trunc('day', now());

  if v_turnos_hoy >= v_max then
    raise exception 'limite_diario:%', v_max;
  end if;

  insert into public.messages (conversation_id, sender, content)
  values (p_conversation_id, 'usuario', p_content)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.insertar_turno_usuario(uuid, text)
  from public, anon;
grant execute on function public.insertar_turno_usuario(uuid, text)
  to authenticated;
