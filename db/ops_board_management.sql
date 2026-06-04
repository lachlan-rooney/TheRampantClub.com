-- ─────────────────────────────────────────────────────────────────────────
-- Ops Hub — board management: edit (name/description) + SOFT delete.
--
-- Soft delete adds a `deleted_at` state DISTINCT from status='archived':
--   deleted_at IS NULL  → live (active or archived)
--   deleted_at NOT NULL → soft-deleted: hidden from EVERY view, but the row,
--                         its tasks, and its activity_events all REMAIN.
-- Nothing is hard-deleted or cascaded — consistent with the immutable spine.
--
-- Both writes route through the /api/admin/ops gateway as allowlisted ops_*
-- RPCs (security invoker → RLS applies as the caller) and emit a spine event,
-- so board lifecycle is fully recorded: created · updated · archived · deleted.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Additive, nullable column — zero-risk (every existing board → null = live).
alter table projects add column if not exists deleted_at timestamptz;


-- 2. EDIT — update name + description, emit 'updated'. (Can edit active OR
--    archived boards; never a soft-deleted one.)
create or replace function ops_update_project(
  p_project_id uuid, p_name text, p_description text
) returns void language plpgsql security invoker set search_path = public as $$
begin
  update projects
     set name = p_name,
         description = p_description,
         updated_at = now()
   where id = p_project_id and deleted_at is null;
  if not found then raise exception 'update not permitted'; end if;
  perform ops_emit_event('updated', 'project', p_project_id, p_project_id,
    jsonb_build_object('name', p_name));
end$$;


-- 3. SOFT DELETE — set deleted_at, emit 'deleted'. Gated to ARCHIVED boards
--    only (archive is the precondition) and not-already-deleted. No row delete,
--    no cascade: tasks + activity_events are untouched and recoverable.
create or replace function ops_soft_delete_project(
  p_project_id uuid
) returns void language plpgsql security invoker set search_path = public as $$
declare v_name text;
begin
  update projects
     set deleted_at = now(), updated_at = now()
   where id = p_project_id and status = 'archived' and deleted_at is null
   returning name into v_name;
  if not found then
    raise exception 'delete not permitted: the board must be archived and not already deleted';
  end if;
  perform ops_emit_event('deleted', 'project', p_project_id, p_project_id,
    jsonb_build_object('name', v_name));
end$$;


grant execute on function ops_update_project(uuid, text, text) to authenticated;
grant execute on function ops_soft_delete_project(uuid)        to authenticated;
