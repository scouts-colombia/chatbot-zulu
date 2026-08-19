begin;

-- La portada necesita estas cinco claves antes de crear la identidad anónima.
-- La RPC evita exponer toda app_settings; chat y admin siguen leyendo la tabla
-- directamente con el JWT del usuario y su RLS.
revoke select on table public.app_settings from anon;

create function public.leer_configuracion_chat_publica()
returns table (clave text, valor text)
language sql
stable
security definer
set search_path = ''
as $$
  select configuracion.clave, configuracion.valor
  from public.app_settings configuracion
  where configuracion.clave in (
    'gemini_model',
    'gemini_thinking_level',
    'max_chat_turns_per_user_per_day',
    'max_guest_turns_per_person_per_day',
    'max_guest_turns_per_network'
  );
$$;

revoke execute on function public.leer_configuracion_chat_publica()
  from public;
grant execute on function public.leer_configuracion_chat_publica()
  to anon, authenticated;

-- Dos días cubren holgadamente la ventana diaria de cuota y el bloqueo de dos
-- minutos para transferencias. Después, la reserva completada ya no participa
-- en ninguna decisión y conservar sus UUID/HMAC solo aumenta retención.
create index if not exists idx_guest_turn_reservations_completed
  on public.guest_turn_reservations (completed_at)
  where completed_at is not null;

create function public.depurar_reservas_invitadas_completadas()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.guest_turn_reservations
  where completed_at < now() - interval '2 days';
  return null;
end;
$$;

create trigger on_guest_turn_reservation_prune_completed
  after insert on public.guest_turn_reservations
  for each statement
  execute function public.depurar_reservas_invitadas_completadas();

revoke execute on function public.depurar_reservas_invitadas_completadas()
  from public, anon, authenticated;

comment on function public.depurar_reservas_invitadas_completadas() is
  'Elimina oportunísticamente reservas completadas que ya no intervienen en cuotas ni transferencias.';

commit;
