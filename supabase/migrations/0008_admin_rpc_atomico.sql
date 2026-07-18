-- ============================================================================
-- 0008_admin_rpc_atomico.sql
-- Cambios de estado administrativos atómicos con su evento de auditoría.
-- Motivación (revisión PR #6): si el update se confirma y el insert de
-- auditoría falla después, queda un cambio sensible sin rastro. Cada función
-- ejecuta update + auditoría en una sola transacción: o pasan ambos o ninguno.
-- Se llaman solo desde el servidor con la service role (revoke para el resto).
-- ============================================================================

-- 1. Cambio de estado de cuenta (P-RF-03, §8.8 change_user_status)
create function public.admin_cambiar_estado_cuenta(
  p_admin_user_id uuid,
  p_user_id uuid,
  p_estado text,
  p_reason text
) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_estado not in ('activo', 'pendiente_autorizacion', 'bloqueado') then
    raise exception 'estado_invalido';
  end if;
  if p_admin_user_id = p_user_id then
    raise exception 'auto_cambio_no_permitido';
  end if;

  update public.profiles
  set account_status = p_estado
  where id = p_user_id;
  if not found then
    raise exception 'perfil_no_encontrado';
  end if;

  insert into public.admin_audit_events (admin_user_id, action, target_type, target_id, reason)
  values (p_admin_user_id, 'change_user_status', 'profile', p_user_id, p_reason);
end;
$$;

-- 2. Activar/desactivar documento (§8.8 change_document_active).
-- Activar exige que el documento esté realmente listo: metadata confirmada
-- con el proveedor y sin error de indexación. Desactivar siempre se permite.
create function public.admin_cambiar_documento_activo(
  p_admin_user_id uuid,
  p_document_id uuid,
  p_activar boolean,
  p_reason text
) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_activar then
    update public.knowledge_documents
    set active = true
    where id = p_document_id
      and metadata_synced_at is not null
      and last_index_error is null;
    if not found then
      raise exception 'documento_no_listo';
    end if;
  else
    update public.knowledge_documents
    set active = false
    where id = p_document_id;
    if not found then
      raise exception 'documento_no_encontrado';
    end if;
  end if;

  insert into public.admin_audit_events (admin_user_id, action, target_type, target_id, reason)
  values (p_admin_user_id, 'change_document_active', 'knowledge_document', p_document_id, p_reason);
end;
$$;

revoke execute on function public.admin_cambiar_estado_cuenta(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.admin_cambiar_documento_activo(uuid, uuid, boolean, text)
  from public, anon, authenticated;

-- Grant explícito: sin él, en proyectos con default privileges restringidos
-- la service role quedaría sin EXECUTE tras el revoke de public.
grant execute on function public.admin_cambiar_estado_cuenta(uuid, uuid, text, text)
  to service_role;
grant execute on function public.admin_cambiar_documento_activo(uuid, uuid, boolean, text)
  to service_role;
