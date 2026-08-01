-- ============================================================================
-- 0011_cuota_zona_local.sql
-- La ventana diaria de cuota se ancla a la zona de la organización.
-- Motivación (auditoría 2026-07-31): `insertar_turno_usuario` comparaba contra
-- `date_trunc('day', now())`, que en Supabase se evalúa en UTC. En Bogotá
-- (UTC-5) eso reinicia el contador a las 19:00: el usuario recibe una segunda
-- tanda de 30 turnos por la tarde y el mensaje "Vuelve mañana" es falso, porque
-- en realidad vuelve a las 7 de la noche.
--
-- La zona vive en `app_settings` como el límite (§9.1), no en el código ni en
-- una variable de entorno duplicada. Colombia no aplica horario de verano, pero
-- el cálculo usa `at time zone` en vez de un desfase fijo para que siga siendo
-- correcto si la organización cambia de zona.
--
-- La vista `daily_chat_turns_by_user` (§8.7) se recalcula con la misma zona: si
-- la vista contara días UTC y la RPC días locales, las métricas de uso no
-- coincidirían con la cuota que el usuario percibe.
-- ============================================================================

insert into public.app_settings (clave, valor)
values ('zona_horaria', 'America/Bogota')
on conflict (clave) do nothing;

-- Una sola fuente para la zona, usada por la RPC y por la vista.
create function public.zona_horaria_operativa()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select valor from public.app_settings where clave = 'zona_horaria'),
    'America/Bogota'
  );
$$;

revoke execute on function public.zona_horaria_operativa() from public, anon;
grant execute on function public.zona_horaria_operativa() to authenticated, service_role;

create or replace function public.insertar_turno_usuario(
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
  v_zona text;
  v_inicio_dia timestamptz;
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

  -- Medianoche de la zona de la organización, expresada como instante.
  v_zona := public.zona_horaria_operativa();
  v_inicio_dia := date_trunc('day', now() at time zone v_zona) at time zone v_zona;

  select count(*) into v_turnos_hoy
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.user_id = (select auth.uid())
    and m.sender = 'usuario'
    and m.created_at >= v_inicio_dia;

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

-- Misma zona que la cuota, para que la métrica y el límite cuenten el mismo día.
create or replace view public.daily_chat_turns_by_user
  with (security_invoker = on) as
select
  c.user_id,
  (m.created_at at time zone public.zona_horaria_operativa())::date as usage_date,
  count(*) as chat_turns
from public.messages m
join public.conversations c on c.id = m.conversation_id
where m.sender = 'usuario'
group by c.user_id, (m.created_at at time zone public.zona_horaria_operativa())::date;
