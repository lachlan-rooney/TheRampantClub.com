-- TRC Operations Hub — PHASE 3 RECURRENCE PROBE
-- Run in the Supabase SQL editor AFTER ops_hub_phase1/2/3 migrations.
--
-- Proves the hard parts of recurrence, all by simulating the materialise call
-- directly with FIXED dates (so it's deterministic regardless of wall-clock):
--   • DECOUPLING (headline, Trap 3): edit a template → the already-materialised
--     instance is byte-identical; the NEXT instance reflects the edit.
--   • IDEMPOTENCY: running the materialiser twice for the same day → ONE instance
--     (enforced by the unique index, un-raceable).
--   • CARRY-OVER (c, Trap 2): a prior un-done instance auto-lapses with a 'lapsed'
--     event carrying the snapshotted title + due-date; today's fresh one appears.
--   • RECURRENCE SHAPE (B): a weekly template materialises only on its weekday.
--   • VN-date (Trap 1): ops_today_vn() drives "today" (the real day-boundary firing
--     is the separate live eyeball — a one-shot probe can't prove the schedule).
-- Self-asserting (throw on failure), ROLLS BACK — leaves nothing behind.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_project uuid; v_backlog uuid; v_tmpl uuid; v_wtmpl uuid; v_inst1 uuid; v_inst2 uuid;
  v_title text; v_priority text; v_status text; v_actor text;
  v_meta jsonb; v_summary jsonb; n int;
  d1 date := date '2025-06-02';   -- run-day 1
  d2 date := date '2025-06-03';   -- run-day 2 (next day)
begin
  v_project := ops_create_project('RECUR PROBE', 'temp');
  select id into v_backlog from board_columns where project_id = v_project and sort_order = 0;

  -- a DAILY template
  v_tmpl := ops_create_template(v_project, v_backlog, 'Weekly stock count', null, 'normal', null, '{"freq":"daily"}'::jsonb);

  -- ── materialise D1 → exactly one instance, snapshotting the template ──
  v_summary := ops_materialise_due(d1);
  if (v_summary->>'created')::int <> 1 then raise exception 'FAIL: expected 1 created on D1, got %', v_summary; end if;
  select id, title, priority into v_inst1, v_title, v_priority from tasks where template_id = v_tmpl and materialised_for = d1;
  if v_inst1 is null then raise exception 'FAIL: D1 instance not created'; end if;
  if v_title <> 'Weekly stock count' or v_priority <> 'normal' then raise exception 'FAIL: D1 snapshot wrong (%, %)', v_title, v_priority; end if;

  -- ── IDEMPOTENCY: re-run D1 → no second instance ──
  v_summary := ops_materialise_due(d1);
  if (v_summary->>'created')::int <> 0 then raise exception 'FAIL: idempotency — D1 re-run created %, expected 0', v_summary->>'created'; end if;
  select count(*) into n from tasks where template_id = v_tmpl and materialised_for = d1;
  if n <> 1 then raise exception 'FAIL: idempotency — % instances for D1, expected 1', n; end if;

  -- ── DECOUPLING (headline): edit the template, past instance must NOT change ──
  perform ops_update_template(v_tmpl, 'Stock count v2', null, 'high', null, '{"freq":"daily"}'::jsonb, true);
  select title, priority into v_title, v_priority from tasks where id = v_inst1;
  if v_title <> 'Weekly stock count' or v_priority <> 'normal' then
    raise exception 'FAIL: DECOUPLING BROKEN — D1 instance changed after template edit (title=%, priority=%)', v_title, v_priority;
  end if;

  -- a WEEKLY template due only on d2's weekday (proves recurrence-shape filtering)
  v_wtmpl := ops_create_template(v_project, v_backlog, 'Weekly only', null, 'normal', null,
    jsonb_build_object('freq', 'weekly', 'weekdays', jsonb_build_array(extract(isodow from d2)::int)));

  -- on D1 the weekly template is NOT due → no instance
  perform ops_materialise_due(d1);
  select count(*) into n from tasks where template_id = v_wtmpl and materialised_for = d1;
  if n <> 0 then raise exception 'FAIL: weekly template materialised on the wrong weekday (D1)'; end if;

  -- ── materialise D2: D1's daily instance LAPSES; D2 fresh appears (daily + weekly) ──
  v_summary := ops_materialise_due(d2);
  if (v_summary->>'lapsed')::int <> 1 then raise exception 'FAIL: carry-over — expected 1 lapse on D2, got %', v_summary; end if;
  if (v_summary->>'created')::int <> 2 then raise exception 'FAIL: expected 2 created on D2 (daily+weekly), got %', v_summary; end if;

  -- D1 instance is now lapsed
  select status into v_status from tasks where id = v_inst1;
  if v_status <> 'lapsed' then raise exception 'FAIL: D1 instance not lapsed (status=%)', v_status; end if;

  -- the lapsed event snapshots title + due-date (feed reads "…lapsed — was due …")
  select metadata into v_meta from activity_events where object_id = v_inst1 and verb = 'lapsed' order by created_at desc limit 1;
  if v_meta is null then raise exception 'FAIL: no lapsed event'; end if;
  if v_meta->>'title' <> 'Weekly stock count' or (v_meta->>'due_date')::date <> d1 then
    raise exception 'FAIL: lapsed event missing snapshot title/due_date: %', v_meta;
  end if;

  -- D2 daily instance reflects the EDIT (decoupling, forward side)
  select id, title, priority into v_inst2, v_title, v_priority from tasks where template_id = v_tmpl and materialised_for = d2;
  if v_inst2 is null then raise exception 'FAIL: D2 daily instance not created'; end if;
  if v_title <> 'Stock count v2' or v_priority <> 'high' then
    raise exception 'FAIL: D2 instance did not reflect the template edit (title=%, priority=%)', v_title, v_priority;
  end if;

  -- weekly template DID materialise on its weekday (D2)
  select count(*) into n from tasks where template_id = v_wtmpl and materialised_for = d2;
  if n <> 1 then raise exception 'FAIL: weekly template did not materialise on its weekday (D2)'; end if;

  -- materialised events are labelled 'Recurring' (system actor), never a person
  select metadata->>'actor_name' into v_actor from activity_events where object_id = v_inst2 and verb = 'created';
  if v_actor <> 'Recurring' then raise exception 'FAIL: materialised event actor_name = % (expected "Recurring")', v_actor; end if;

  -- VN "today" helper resolves (the materialiser keys off this; real boundary = live eyeball)
  if ops_today_vn() is null then raise exception 'FAIL: ops_today_vn() returned null'; end if;

  raise notice '✓ RECURRENCE OK — decoupling holds (past instance byte-identical after template edit; next instance reflects it); idempotent (re-run = 1 instance); carry-over (c) lapses the prior day with a snapshotted "was due" event; weekly fires only on its weekday; materialised events labelled "Recurring".';
end$$;

rollback;

-- Visible PASS row (the editor hides RAISE NOTICE). This line is only reached if
-- the DO block above raised NO exception — i.e. every assertion passed. A FAIL
-- aborts the script before here, so you see the red error instead.
select '✓ RECURRENCE OK — decoupling + idempotency + carry-over/lapse + weekly-weekday all passed (no exception raised). Non-destructive; re-run anytime.' as result;
