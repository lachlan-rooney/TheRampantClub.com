-- TRC Operations Hub — PHASE 4 ROTA PROBE
-- Run in the Supabase SQL editor AFTER ops_hub_phase1/2/3 + ops_hub_phase4_rota.sql.
--
-- Proves the rota's write+emit path and the enrich-at-write snapshot:
--   • create a shift → 'assigned' event snapshots member name + shift label + date
--   • SNAPSHOT HONESTY: rename the member after → the old event keeps the OLD name
--   • reassign (update) → 'updated' event reflects the new member
--   • remove (delete) → 'removed' event still names the member (snapshot survives row)
-- Self-asserting (throw on failure), ROLLS BACK. Visible PASS row at the end.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_m1 uuid; v_m2 uuid; v_shift uuid; v_name text; v_date date := date '2025-06-06';
begin
  -- two team members (name-only is fine)
  insert into team_members (display_name) values ('Ha')  returning id into v_m1;
  insert into team_members (display_name) values ('Lan') returning id into v_m2;

  -- ── create a shift → 'assigned' event with snapshotted labels ──
  v_shift := ops_create_shift(v_m1, v_date, 'Close', null, null, 'Bar', null);
  select metadata->>'member_name' into v_name from activity_events where object_id = v_shift and verb = 'assigned';
  if v_name <> 'Ha' then raise exception 'FAIL: assigned event member_name = % (expected Ha)', v_name; end if;
  select metadata->>'shift_name' into v_name from activity_events where object_id = v_shift and verb = 'assigned';
  if v_name <> 'Close' then raise exception 'FAIL: assigned event shift_name = % (expected Close)', v_name; end if;
  if (select (metadata->>'shift_date')::date from activity_events where object_id = v_shift and verb = 'assigned') <> v_date then
    raise exception 'FAIL: assigned event shift_date wrong';
  end if;

  -- ── SNAPSHOT HONESTY: rename the member; the OLD event must keep the OLD name ──
  update team_members set display_name = 'Hana' where id = v_m1;
  select metadata->>'member_name' into v_name from activity_events where object_id = v_shift and verb = 'assigned';
  if v_name <> 'Ha' then
    raise exception 'FAIL: HISTORY REWRITTEN — assigned event now reads "%" after member rename (enrich-at-write not holding)', v_name;
  end if;

  -- ── SHIFT-TYPE rename/remove must NOT rewrite the shift's snapshotted name ──
  -- (rename = remove + re-add, since the type name is the key). The shift row
  -- snapshotted 'Close' as plain text — removing the 'Close' type must leave it.
  delete from rota_shift_types where name = 'Close';
  if (select shift_name from rota_shifts where id = v_shift) <> 'Close' then
    raise exception 'FAIL: SHIFT-TYPE SNAPSHOT BROKEN — shift name changed after the type was removed/renamed';
  end if;

  -- ── reassign (update) → 'updated' event reflects the new member ──
  perform ops_update_shift(v_shift, v_m2, 'Close', null, null, 'Bar', null);
  select metadata->>'member_name' into v_name from activity_events where object_id = v_shift and verb = 'updated' order by created_at desc limit 1;
  if v_name <> 'Lan' then raise exception 'FAIL: updated event member_name = % (expected Lan)', v_name; end if;
  if (select member from rota_shifts where id = v_shift) <> v_m2 then raise exception 'FAIL: reassign did not change the row'; end if;

  -- ── remove (delete) → 'removed' event still names the member; row gone ──
  perform ops_delete_shift(v_shift);
  if exists (select 1 from rota_shifts where id = v_shift) then raise exception 'FAIL: shift not deleted'; end if;
  select metadata->>'member_name' into v_name from activity_events where object_id = v_shift and verb = 'removed';
  if v_name <> 'Lan' then raise exception 'FAIL: removed event member_name = % (expected Lan)', v_name; end if;

  raise notice '✓ ROTA OK';
end$$;

rollback;

-- Visible PASS row (the editor hides RAISE NOTICE). Only reached if the DO block
-- raised no exception — a FAIL aborts before here.
select '✓ ROTA OK — create/reassign/remove emitted correct events with snapshotted labels; a member rename did NOT rewrite the old event AND removing a shift type did NOT rewrite an existing shift name (both snapshots hold). Non-destructive; re-run anytime.' as result;
