-- ============================================================================
-- 0001_schema_rls.sql — Piloto Chat con Documentos para Scouts
-- Fuente: docs/pilot-scope-v0.3.1.md §8 (modelo de datos), §16 (seguridad/RLS)
-- Este SQL es el dueño del esquema (CLAUDE.md).
--
-- Principios:
-- - El camino del chat usa el JWT del usuario: la RLS protege lectura de lo
--   propio e inserción de mensajes del usuario.
-- - Los mensajes del asistente, citas, preguntas guiadas y eventos técnicos
--   los escribe el servidor con la secret key (service role): RLS habilitada
--   SIN políticas de escritura para usuarios.
-- - El acceso admin a datos ajenos NO es por RLS: va por endpoint de servidor
--   con motivo obligatorio + admin_audit_events.
-- ============================================================================

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- 1.1 profiles (§8.1) — espejo de auth.users con rol y estado
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  role text not null default 'scout' check (role in ('scout', 'admin')),
  -- Default 'activo' provisional: la organización aún no define el flujo
  -- pendiente_autorizacion para menores (ver ROADMAP, bloqueos organizacionales).
  account_status text not null default 'activo'
    check (account_status in ('activo', 'pendiente_autorizacion', 'bloqueado')),
  privacy_policy_version_accepted text,
  privacy_policy_accepted_at timestamptz,
  guardian_authorization_status text
    check (guardian_authorization_status in ('no_aplica', 'pendiente', 'aprobada', 'rechazada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.2 consent_acceptance_events (§8.1.b) — fuente de verdad append-only
create table public.consent_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references public.profiles(id) on delete cascade,
  accepted_by_user_id uuid references public.profiles(id),
  policy_type text not null
    check (policy_type in ('privacy_policy', 'terms_of_use', 'guardian_authorization')),
  policy_version text not null,
  policy_url text,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent_hash text,
  notes text
);

-- 1.3 conversations (§8.2)
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nueva conversación',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.4 messages (§8.3)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('usuario', 'asistente', 'sistema')),
  content text not null,
  -- Respuesta normalizada SIN duplicar el arreglo de citas (D-12).
  response_json jsonb,
  created_at timestamptz not null default now()
);

-- 1.5 knowledge_documents (§8.6) — antes que citations por la FK
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  canonical_title text,
  version text not null,
  active boolean not null default true,
  file_search_store_name text not null,
  file_search_document_name text,
  sha256 text,
  metadata_synced_at timestamptz,
  indexed_at timestamptz,
  indexed_by uuid references public.profiles(id),
  last_index_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.6 citations (§8.4) — ÚNICA fuente de verdad persistida de citas (D-12)
create table public.citations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  knowledge_document_id uuid references public.knowledge_documents(id),
  document_title_snapshot text not null,
  document_version_snapshot text,
  page_number int,
  fragment text,
  file_search_store_name text,
  file_search_document_name text,
  media_id text,
  created_at timestamptz not null default now()
);

-- 1.7 guided_questions y guided_question_options (§8.5)
create table public.guided_questions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  type text not null check (type in ('aclaracion', 'modo_guiado', 'sugerencia')),
  text text not null,
  allows_free_input boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.guided_question_options (
  id uuid primary key default gen_random_uuid(),
  guided_question_id uuid not null references public.guided_questions(id) on delete cascade,
  order_index int not null,
  label text not null
);

-- 1.8 model_request_events (§8.7) — un chat_turn puede producir varios eventos
create table public.model_request_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  user_message_id uuid references public.messages(id) on delete set null,
  assistant_message_id uuid references public.messages(id) on delete set null,
  attempt_index int not null default 1,
  model_id text not null,
  provider text not null default 'gemini',
  status text not null check (status in ('ok', 'error', 'blocked')),
  latency_ms int,
  input_tokens int,
  output_tokens int,
  total_tokens int,
  grounding_disponible boolean,
  finish_reason text,
  safety_block_source text check (safety_block_source in ('modelo', 'proveedor', 'servidor')),
  error_code text,
  created_at timestamptz not null default now()
);

-- 1.9 admin_audit_events (§8.8) — append-only, no editable desde UI
create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

-- 1.10 rag_eval_cases y rag_eval_runs (§8.9, §14.3)
create table public.rag_eval_cases (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in ('frecuente', 'ambigua', 'fuera_de_alcance', 'conflicto', 'adversarial')),
  question text not null,
  expected_behavior text not null,
  expected_document_title text,
  expected_page_hint int,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.rag_eval_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  model_id text not null,
  file_search_store_name text not null,
  total_cases int not null,
  passed_cases int not null,
  failed_cases int not null,
  notes text
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================

create index idx_conversations_user on public.conversations (user_id, updated_at desc);
create index idx_messages_conversation on public.messages (conversation_id, created_at);
create index idx_messages_sender_created on public.messages (sender, created_at);
create index idx_citations_message on public.citations (message_id);
create index idx_guided_questions_message on public.guided_questions (message_id);
create index idx_gq_options_question on public.guided_question_options (guided_question_id, order_index);
create index idx_mre_user_created on public.model_request_events (user_id, created_at);
create index idx_consent_subject on public.consent_acceptance_events (subject_user_id, accepted_at desc);
create index idx_audit_admin_created on public.admin_audit_events (admin_user_id, created_at desc);

-- ============================================================
-- 3. VISTAS (§8.7) — security_invoker: respetan la RLS del consultante
-- ============================================================

create view public.daily_chat_turns_by_user
  with (security_invoker = on) as
select
  c.user_id,
  date_trunc('day', m.created_at)::date as usage_date,
  count(*) as chat_turns
from public.messages m
join public.conversations c on c.id = m.conversation_id
where m.sender = 'usuario'
group by c.user_id, date_trunc('day', m.created_at)::date;

create view public.daily_model_requests_by_user
  with (security_invoker = on) as
select
  user_id,
  date_trunc('day', created_at)::date as usage_date,
  count(*) as provider_requests,
  count(*) filter (where status = 'blocked') as blocked_requests,
  count(*) filter (where error_code = 'invalid_model_json') as invalid_json_requests,
  coalesce(sum(input_tokens), 0) as input_tokens,
  coalesce(sum(output_tokens), 0) as output_tokens,
  coalesce(sum(total_tokens), 0) as total_tokens
from public.model_request_events
group by user_id, date_trunc('day', created_at)::date;

-- ============================================================
-- 4. FUNCIONES Y TRIGGERS
-- ============================================================

-- 4.1 Crear profile al registrarse un usuario en auth.users
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nombre)
  values (new.id, new.email, new.raw_user_meta_data ->> 'nombre');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.2 Proteger campos que solo el servidor puede cambiar (§16.1, D-10).
-- Se permite cuando no hay claims JWT (conexión directa/SQL editor/migraciones)
-- o cuando el rol del JWT es service_role. El cliente (anon/authenticated)
-- nunca pasa.
create function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.account_status is distinct from old.account_status
     or new.guardian_authorization_status is distinct from old.guardian_authorization_status
     or new.privacy_policy_version_accepted is distinct from old.privacy_policy_version_accepted
     or new.privacy_policy_accepted_at is distinct from old.privacy_policy_accepted_at
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Campo protegido de profiles: solo el servidor puede modificarlo';
  end if;
  return new;
end;
$$;

create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- 4.3 updated_at automático
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. ROW LEVEL SECURITY (§16)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.consent_acceptance_events enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.citations enable row level security;
alter table public.guided_questions enable row level security;
alter table public.guided_question_options enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.model_request_events enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.rag_eval_cases enable row level security;
alter table public.rag_eval_runs enable row level security;

-- 5.1 profiles: cada usuario ve y edita SU fila (el trigger 4.2 protege
-- los campos sensibles; desde el cliente solo cambia 'nombre').
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 5.2 consent_acceptance_events: insert-only del propio usuario; lectura propia.
create policy "consent_insert_own" on public.consent_acceptance_events
  for insert to authenticated
  with check (
    subject_user_id = (select auth.uid())
    and (accepted_by_user_id is null or accepted_by_user_id = (select auth.uid()))
  );

create policy "consent_select_own" on public.consent_acceptance_events
  for select to authenticated
  using (subject_user_id = (select auth.uid()));

-- 5.3 conversations: CRUD propio sin delete (archivado lógico).
create policy "conversations_select_own" on public.conversations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "conversations_insert_own" on public.conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "conversations_update_own" on public.conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 5.4 messages: lectura de lo propio; el usuario solo inserta SUS mensajes
-- (sender='usuario') en conversaciones propias no archivadas. Los mensajes
-- del asistente/sistema los escribe el servidor con la secret key.
create policy "messages_select_own" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create policy "messages_insert_own_user" on public.messages
  for insert to authenticated
  with check (
    sender = 'usuario'
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
        and c.archived = false
    )
  );

-- 5.5 citations / guided_questions / options: lectura vía propiedad del
-- mensaje; escritura solo servidor.
create policy "citations_select_own" on public.citations
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and c.user_id = (select auth.uid())
    )
  );

create policy "guided_questions_select_own" on public.guided_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and c.user_id = (select auth.uid())
    )
  );

create policy "gq_options_select_own" on public.guided_question_options
  for select to authenticated
  using (
    exists (
      select 1
      from public.guided_questions gq
      join public.messages m on m.id = gq.message_id
      join public.conversations c on c.id = m.conversation_id
      where gq.id = guided_question_id and c.user_id = (select auth.uid())
    )
  );

-- 5.6 knowledge_documents: lectura para autenticados (listado y render de
-- citas históricas, incluso de documentos desactivados); escritura solo
-- servidor (§16.1: un Scout no puede modificarlos).
create policy "knowledge_documents_select" on public.knowledge_documents
  for select to authenticated
  using (true);

-- 5.7 Sin políticas (solo servidor con secret key):
-- model_request_events, admin_audit_events, rag_eval_cases, rag_eval_runs.
-- RLS habilitada sin policies = ningún acceso para anon/authenticated.
