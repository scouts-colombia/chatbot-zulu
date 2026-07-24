-- ============================================================================
-- 0009_admin_rpc_valida_admin.sql
-- Revalida al administrador DENTRO de la transacción del cambio.
-- Motivación (revisión PR #6): 0008 hizo atómicos el cambio y su auditoría,
-- pero dejó la autorización fuera. El camino real es requerirAdmin() con el
-- JWT del admin y, tras un viaje de red, la RPC con la service role tomando
-- p_admin_user_id como palabra. Si otro admin bloquea o degrada esa cuenta en
-- ese intervalo, la petición ya iniciada seguía cambiando el estado de un
-- tercero o activando documentos con privilegios ya revocados.
--
-- Ahora ambas RPC releen el perfil del admin en la misma transacción y lo
-- mantienen bloqueado con `for share`: si la revocación ya está confirmada, la
-- función aborta sin escribir; si llega en paralelo, espera al commit. Misma
-- regla fail-closed del log de acceso: sin autorización verificable, sin
-- efecto. requerirAdmin() se conserva como barrera de UI, no de integridad.
--
-- `for share` y no `for update`: la RPC no modifica la fila del admin, solo
-- necesita que no cambie mientras opera. Un UPDATE de account_status toma FOR
-- NO KEY UPDATE, que sí choca con FOR SHARE, así que la garantía se mantiene
-- sin serializar entre sí dos acciones administrativas distintas. El SELECT con
-- cláusula de bloqueo no dispara triggers, así que no interactúa con
-- protect_profile_fields (BEFORE UPDATE).
--
-- Se mantiene SECURITY INVOKER como en 0008: solo service_role tiene EXECUTE y
-- ya salta la RLS, así que `definer` no aportaría nada y regalaría ese salto a
-- cualquier grant futuro. Con invoker, un EXECUTE concedido por error a
-- authenticated falla por RLS en vez de escalar.
--
-- ERROR NUEVO, mapeado en app/admin/acciones.ts: 'admin_no_autorizado'. Cubre
-- los tres casos (perfil inexistente, role != 'admin', account_status !=
-- 'activo') sin distinguirlos, para no filtrar el estado de cuentas ajenas.
--
-- create or replace conserva firma, dueño y ACL. Los revoke/grant de 0008 se
-- repiten para que el archivo sea autosuficiente; son idempotentes.
-- ============================================================================

-- 1. Cambio de estado de cuenta (P-RF-03, §8.8 change_user_status)
create or replace function public.admin_cambiar_estado_cuenta(
  p_admin_user_id uuid,
  p_user_id uuid,
  p_estado text,
  p_reason text
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_admin_role text;
  v_admin_status text;
begin
  if p_estado not in ('activo', 'pendiente_autorizacion', 'bloqueado') then
    raise exception 'estado_invalido';
  end if;
  if p_admin_user_id = p_user_id then
    raise exception 'auto_cambio_no_permitido';
  end if;

  -- Bloque idéntico en admin_cambiar_documento_activo: si cambia una regla
  -- aquí, cambiarla allá.
  select role, account_status
    into v_admin_role, v_admin_status
  from public.profiles
  where id = p_admin_user_id
  for share;
  if not found or v_admin_role <> 'admin' or v_admin_status <> 'activo' then
    raise exception 'admin_no_autorizado';
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
create or replace function public.admin_cambiar_documento_activo(
  p_admin_user_id uuid,
  p_document_id uuid,
  p_activar boolean,
  p_reason text
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_admin_role text;
  v_admin_status text;
begin
  -- Misma validación bloqueante: un admin degradado a mitad de la petición no
  -- puede seguir tocando el catálogo de documentos.
  select role, account_status
    into v_admin_role, v_admin_status
  from public.profiles
  where id = p_admin_user_id
  for share;
  if not found or v_admin_role <> 'admin' or v_admin_status <> 'activo' then
    raise exception 'admin_no_autorizado';
  end if;

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

grant execute on function public.admin_cambiar_estado_cuenta(uuid, uuid, text, text)
  to service_role;
grant execute on function public.admin_cambiar_documento_activo(uuid, uuid, boolean, text)
  to service_role;
