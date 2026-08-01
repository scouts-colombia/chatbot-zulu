-- ============================================================================
-- 0010_activar_retira_versiones.sql
-- Activar un documento retira las otras versiones del mismo manual.
-- Motivación (revisión PR #6): el script de indexación retira las versiones
-- anteriores poniendo active=false (mismo display_name, distinto sha256), pero
-- les deja metadata_synced_at y last_index_error intactos. La RPC solo exigía
-- esos dos campos para activar, así que el panel permitía reactivar una versión
-- ya retirada y dejar DOS versiones activas del mismo manual. El chat arma el
-- metadataFilter con todo lo que tenga active=true, así que ambas entrarían y
-- una respuesta podría fundamentarse en el manual obsoleto junto al vigente,
-- deshaciendo el paso de retiro del indexador.
--
-- Ahora la activación retira en la misma transacción las demás versiones
-- activas del mismo display_name, con el mismo criterio que usa el script. Cada
-- retiro deja su propio evento de auditoría: el admin pidió activar una
-- versión, pero el efecto sobre las otras también es un cambio auditable.
--
-- El versionado completo de documentos sigue siendo P1 (§13.2). Esto solo
-- mantiene la invariante que el piloto necesita: a lo sumo una versión activa
-- por manual, para que las citas apunten a la vigente.
--
-- Se conservan la firma, `security invoker` y `set search_path = ''` de 0008 y
-- 0009, y los nombres de error que ya mapea app/admin/acciones.ts.
-- ============================================================================

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
  v_display_name text;
begin
  -- Autorización dentro de la transacción (0009): un admin degradado a mitad
  -- de la petición no puede seguir tocando el catálogo.
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
      and last_index_error is null
    returning display_name into v_display_name;
    if not found then
      raise exception 'documento_no_listo';
    end if;

    -- Mismo criterio de "versión anterior del mismo manual" que
    -- scripts/index-knowledge-documents.ts: display_name igual, otra fila.
    with retiradas as (
      update public.knowledge_documents
      set active = false
      where display_name = v_display_name
        and active = true
        and id <> p_document_id
      returning id
    )
    insert into public.admin_audit_events (admin_user_id, action, target_type, target_id, reason)
    select
      p_admin_user_id,
      'change_document_active',
      'knowledge_document',
      id,
      'Retirada al activar otra versión de ' || v_display_name
    from retiradas;
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

revoke execute on function public.admin_cambiar_documento_activo(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.admin_cambiar_documento_activo(uuid, uuid, boolean, text)
  to service_role;
