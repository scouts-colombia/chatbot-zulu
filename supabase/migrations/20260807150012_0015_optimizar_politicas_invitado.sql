-- Evita reevaluar auth.jwt() por cada fila en las politicas restrictivas
-- que impiden a las sesiones anonimas escribir fuera del RPC controlado.

drop policy if exists "conversations_insert_permanent_only"
  on public.conversations;

create policy "conversations_insert_permanent_only"
  on public.conversations as restrictive
  for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  );

drop policy if exists "conversations_update_permanent_only"
  on public.conversations;

create policy "conversations_update_permanent_only"
  on public.conversations as restrictive
  for update to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  )
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  );

drop policy if exists "messages_insert_permanent_only"
  on public.messages;

create policy "messages_insert_permanent_only"
  on public.messages as restrictive
  for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  );
