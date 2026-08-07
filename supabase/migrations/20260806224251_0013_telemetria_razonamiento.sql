-- ============================================================================
-- 0013_telemetria_razonamiento.sql — Desglose completo de usageMetadata.
--
-- `input_tokens` y `output_tokens` ya guardaban promptTokenCount y
-- candidatesTokenCount. Se conservan para compatibilidad y se agregan nombres
-- explícitos junto con los contadores que antes se descartaban. Los campos son
-- nullable porque Gemini puede omitir cualquier contador; null significa "no
-- informado" y nunca se reemplaza por cero en la fila de evento.
-- ============================================================================

alter table public.model_request_events
  add column prompt_tokens integer,
  add column tool_use_prompt_tokens integer,
  add column cached_content_tokens integer,
  add column candidates_tokens integer,
  add column thoughts_tokens integer,
  add column thinking_level text;

alter table public.model_request_events
  add constraint model_request_events_usage_tokens_nonnegative
    check (
      (prompt_tokens is null or prompt_tokens >= 0)
      and (tool_use_prompt_tokens is null or tool_use_prompt_tokens >= 0)
      and (cached_content_tokens is null or cached_content_tokens >= 0)
      and (candidates_tokens is null or candidates_tokens >= 0)
      and (thoughts_tokens is null or thoughts_tokens >= 0)
    ),
  add constraint model_request_events_thinking_level_check
    check (
      thinking_level is null
      or thinking_level in ('minimal', 'low', 'medium', 'high')
    );

-- Estos dos valores sí existen en las filas históricas bajo sus aliases. No se
-- infiere thinking_level ni se inventan los tres contadores antes descartados.
update public.model_request_events
set prompt_tokens = input_tokens,
    candidates_tokens = output_tokens
where prompt_tokens is null
  and candidates_tokens is null;

comment on column public.model_request_events.input_tokens is
  'Alias histórico de usageMetadata.promptTokenCount; usar prompt_tokens en consultas nuevas.';
comment on column public.model_request_events.output_tokens is
  'Alias histórico de usageMetadata.candidatesTokenCount; usar candidates_tokens en consultas nuevas.';
comment on column public.model_request_events.prompt_tokens is
  'usageMetadata.promptTokenCount. Incluye cachedContentTokenCount cuando existe caché explícita.';
comment on column public.model_request_events.tool_use_prompt_tokens is
  'usageMetadata.toolUsePromptTokenCount. Incluye resultados de herramientas como File Search.';
comment on column public.model_request_events.cached_content_tokens is
  'usageMetadata.cachedContentTokenCount; es un subconjunto de promptTokenCount, no se suma otra vez al total.';
comment on column public.model_request_events.candidates_tokens is
  'usageMetadata.candidatesTokenCount: salida visible de los candidatos.';
comment on column public.model_request_events.thoughts_tokens is
  'usageMetadata.thoughtsTokenCount: razonamiento interno facturable como salida.';
comment on column public.model_request_events.thinking_level is
  'Nivel enviado en thinkingConfig.thinkingLevel para este intento.';

-- Conserva las ocho columnas existentes en el mismo orden y agrega el desglose
-- al final para no romper consumidores de la vista.
create or replace view public.daily_model_requests_by_user
  with (security_invoker = on) as
select
  user_id,
  date_trunc('day', created_at)::date as usage_date,
  count(*) as provider_requests,
  count(*) filter (where status = 'blocked') as blocked_requests,
  count(*) filter (where error_code = 'invalid_model_json') as invalid_json_requests,
  coalesce(sum(input_tokens), 0) as input_tokens,
  coalesce(sum(output_tokens), 0) as output_tokens,
  coalesce(sum(total_tokens), 0) as total_tokens,
  coalesce(sum(prompt_tokens), 0) as prompt_tokens,
  coalesce(sum(tool_use_prompt_tokens), 0) as tool_use_prompt_tokens,
  coalesce(sum(cached_content_tokens), 0) as cached_content_tokens,
  coalesce(sum(candidates_tokens), 0) as candidates_tokens,
  coalesce(sum(thoughts_tokens), 0) as thoughts_tokens
from public.model_request_events
group by user_id, date_trunc('day', created_at)::date;

-- La vista diaria histórica mezcla configuraciones. Esta vista separada evita
-- comparar low/medium/minimal sobre agregados combinados y mantiene el modelo
-- y el nivel como dimensiones explícitas.
create view public.daily_model_usage_by_thinking_level
  with (security_invoker = on) as
select
  user_id,
  date_trunc('day', created_at)::date as usage_date,
  model_id,
  thinking_level,
  count(*) as provider_requests,
  count(*) filter (where status = 'ok') as ok_requests,
  count(*) filter (where status = 'blocked') as blocked_requests,
  count(*) filter (where error_code = 'invalid_model_json') as invalid_json_requests,
  count(*) filter (where grounding_disponible) as grounded_requests,
  round(avg(latency_ms), 2) as average_latency_ms,
  coalesce(sum(prompt_tokens), 0) as prompt_tokens,
  coalesce(sum(tool_use_prompt_tokens), 0) as tool_use_prompt_tokens,
  coalesce(sum(cached_content_tokens), 0) as cached_content_tokens,
  coalesce(sum(candidates_tokens), 0) as candidates_tokens,
  coalesce(sum(thoughts_tokens), 0) as thoughts_tokens,
  coalesce(sum(total_tokens), 0) as total_tokens
from public.model_request_events
group by
  user_id,
  date_trunc('day', created_at)::date,
  model_id,
  thinking_level;

-- model_request_events es server-only (RLS sin políticas). La vista de
-- comparación mantiene el mismo perímetro y solo la consume el backend.
revoke all on public.daily_model_usage_by_thinking_level
  from public, anon, authenticated;
grant select on public.daily_model_usage_by_thinking_level to service_role;
