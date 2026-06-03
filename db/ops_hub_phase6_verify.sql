-- TRC Operations Hub — PHASE 6 LAYER 1 NOTIFY PROBE
-- Run AFTER ops_hub_phase1..6 migrations.
--
-- Headline = TARGETING (the distinction from the feed): events generate
-- notifications ONLY for the right recipient, never "everyone", and non-actionable
-- events generate nothing.
--   • assign to a NAME-ONLY member (no profile) → 0 notifications (undeliverable)
--   • assign to your OWN profile (actor == recipient) → 0 (don't-notify-yourself)
--   • a MOVED event → 0 (feed-only, not a notifying event)
--   • a notification created for a recipient ≠ actor → exactly 1, with correct
--     email_status from the editable per-type table (task_assigned=email→pending,
--     task_completed=in-app→in_app_only)
--   • mark-read works
-- (Full event→trigger→someone-else's-bell needs a 2nd login — that's the eyeball,
--  now possible with the staff admin account. Here we exercise the trigger's
--  targeting + its worker directly.) Self-asserting, ROLLS BACK, prints PASS row.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_admin uuid := '3e1583db-b881-42ec-aadb-6f69a22fad80';
  v_fake_actor uuid := gen_random_uuid();
  v_project uuid; v_backlog uuid; v_done uuid; v_task uuid;
  v_named uuid; v_self uuid; v_n int;
begin
  v_project := ops_create_project('NOTIFY PROBE', 'temp');
  select id into v_backlog from board_columns where project_id = v_project and sort_order = 0;
  select id into v_done    from board_columns where project_id = v_project and is_done_column;
  v_task := ops_create_task(v_project, v_backlog, 'Task A');   -- created unassigned → no notif

  -- (1) name-only assignee (no profile) → undeliverable → 0
  insert into team_members (display_name) values ('Name Only') returning id into v_named;
  perform ops_assign_task(v_task, v_named);
  select count(*) into v_n from notifications
    where event_id in (select id from activity_events where object_id = v_task);
  if v_n <> 0 then raise exception 'FAIL: name-only assignee generated % notifications (expected 0)', v_n; end if;

  -- (2) self-assignment (recipient == actor) → 0
  insert into team_members (display_name, profile_id) values ('Me', v_admin) returning id into v_self;
  perform ops_assign_task(v_task, v_self);
  select count(*) into v_n from notifications
    where recipient = v_admin and event_id in (select id from activity_events where object_id = v_task);
  if v_n <> 0 then raise exception 'FAIL: self-assignment generated a notification (expected 0)'; end if;

  -- (3) a moved event → 0 (feed-only)
  perform ops_move_task(v_task, v_done, 0);
  select count(*) into v_n from notifications
    where event_id in (select id from activity_events where object_id = v_task and verb = 'moved');
  if v_n <> 0 then raise exception 'FAIL: a moved event generated a notification (expected 0)'; end if;

  -- (4) positive: recipient ≠ actor → exactly 1; email-worthy → pending
  perform ops_make_notification(v_admin, v_fake_actor, 'task_assigned', null, jsonb_build_object('title', 'Task A'));
  select count(*) into v_n from notifications where recipient = v_admin and type = 'task_assigned';
  if v_n <> 1 then raise exception 'FAIL: expected exactly 1 task_assigned notification, got %', v_n; end if;
  if (select email_status from notifications where recipient = v_admin and type = 'task_assigned' limit 1) <> 'pending' then
    raise exception 'FAIL: email-worthy type not marked pending';
  end if;

  -- in-app-only type → in_app_only (not queued for email)
  perform ops_make_notification(v_admin, v_fake_actor, 'task_completed', null, jsonb_build_object('title', 'Task A'));
  if (select email_status from notifications where recipient = v_admin and type = 'task_completed' limit 1) <> 'in_app_only' then
    raise exception 'FAIL: in-app-only type was queued for email';
  end if;

  -- (5) mark-read
  perform ops_mark_notification_read((select id from notifications where recipient = v_admin and type = 'task_assigned' limit 1));
  if not (select read from notifications where recipient = v_admin and type = 'task_assigned' limit 1) then
    raise exception 'FAIL: mark-read did not set read';
  end if;

  raise notice '✓ NOTIFY OK';
end$$;

rollback;

select '✓ NOTIFY OK — targeting holds: name-only/self/moved events generated ZERO notifications (not everyone, not the actor, not feed-only events); a recipient≠actor notification created exactly one with correct email_status (email-worthy→pending, in-app→in_app_only); mark-read works. Non-destructive.' as result;
