-- ═══════════════════════════════════════════════════════════════════════════
-- WEEKLY SHIFT TASKS — templates, weekly instances, and the revert trail.
-- REVIEW, then run. Idempotent, transactional, re-runnable.
-- ───────────────────────────────────────────────────────────────────────────
-- Five people, one day-shift each, a standing task list that repeats weekly.
--
-- ═══ WHY ROWS, WHEN shift_checklists USES A JSONB BLOB ═════════════════════
-- READ THIS BEFORE "TIDYING" THE TWO INTO ONE SHAPE. They are deliberately
-- different and both are right for what they hold.
--
-- shift_checklists stores its items as a JSONB array on the run. That suits an
-- opening/closing list: a flat set of ticks, sealed once, never revisited, and
-- its value is the sealed snapshot.
--
-- These tasks are NOT that. Each one carries a status through a week, an
-- evidence value that is refused if missing, a blocked reason, a free note, a
-- carry-over count that must survive into next week's row, and an audit trail of
-- who reverted what. Every one of those is a per-task fact that must be queried,
-- constrained and joined — a Monday review asks "everything blocked, with
-- reason, across five people". In a blob that is application code picking
-- through JSON with no constraint able to help; in rows it is a WHERE clause and
-- a CHECK.
--
-- So: a blob where the unit of truth is the sealed list, rows where the unit of
-- truth is the task. Neither is a mistake.
--
-- ═══ WHO MAY TICK WHAT ═════════════════════════════════════════════════════
-- Identity here is the PIN-verified team member (kiosk_verify_pin + the
-- trc_admin_staff acting cookie), NOT the Supabase auth user — team_members has
-- no profile_id for any of the five, and the floor signs in on a shared staff
-- login. The database cannot see a cookie, so ownership is enforced in ONE
-- SECURITY DEFINER function (shift_task_update) which takes the acting team
-- member and refuses a mismatch. RLS admin-gates the tables underneath; the
-- function is the rule. One place, not two.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
declare v_missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='team_members')
    then v_missing := v_missing || 'team_members'; end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='prospects')
    then v_missing := v_missing || 'prospects'; end if;
  if to_regprocedure('public.kiosk_verify_pin(uuid,text)') is null
     and to_regprocedure('public.kiosk_verify_pin(text,text)') is null
    then v_missing := v_missing || 'kiosk_verify_pin'; end if;
  if array_length(v_missing,1) > 0 then
    raise exception 'SHIFT TASKS: PREREQUISITES MISSING — %', array_to_string(v_missing, ', ')
      using hint = 'Nothing in this file has been applied.';
  end if;
end $prereq$;

-- ═══ 1 · WHO SUPERVISES ════════════════════════════════════════════════════
-- Mr Sĩ and Miss Chau may revert a done. Everyone else may only touch their own.
alter table team_members add column if not exists is_shift_supervisor boolean not null default false;

-- ═══ 2 · THE STANDING SHIFTS ═══════════════════════════════════════════════
create table if not exists shift_templates (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  day_of_week   int  not null check (day_of_week between 1 and 7),   -- 1 = Monday
  title_en      text not null,
  title_vi      text,
  assignee_team_member_id uuid references team_members(id),
  -- Vietnamese is supplied separately. NULL means NOT TRANSLATED YET, and every
  -- reader falls back to English rather than rendering an empty block.
  charter_en    text,
  charter_vi    text,
  measure_en    text,
  measure_vi    text,
  active        boolean not null default true,
  sort          int not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists shift_template_tasks (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references shift_templates(id) on delete cascade,
  sort         int  not null,
  title_en     text not null,
  title_vi     text,
  -- The standing prospect rule. Its evidence is a row in the EXISTING prospects
  -- table, not a new one.
  is_prospect_task boolean not null default false,
  -- DEACTIVATE, NEVER DELETE: historic instances point here and must keep their
  -- wording. A deleted task would orphan a completed week.
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_shift_template_tasks_tpl on shift_template_tasks(template_id, sort);

-- Blocks shown across several shifts (the prospect rule, The Half Hour).
create table if not exists shift_shared_notes (
  key      text primary key,
  body_en  text not null,
  body_vi  text,
  applies_to text not null default 'all'      -- 'all' | 'non_supervisor'
);

-- ═══ 3 · THE WEEK'S INSTANCES ══════════════════════════════════════════════
create table if not exists shift_task_instances (
  id                uuid primary key default gen_random_uuid(),
  template_task_id  uuid not null references shift_template_tasks(id),
  template_id       uuid not null references shift_templates(id),
  week_start        date not null,                      -- the MONDAY
  shift_date        date not null,
  assignee_team_member_id uuid references team_members(id),
  status            text not null default 'not_started'
                    check (status in ('not_started','in_progress','done','blocked')),
  -- NO EVIDENCE, NOT DONE. Enforced here as well as in the UI, because a rule
  -- that lives only in a form is one fetch away from being bypassed.
  evidence          text,
  blocked_reason    text,
  blocked_unblocker text,
  note              text,
  prospect_id       uuid references prospects(prospect_id),
  carried_over_count int not null default 0,
  completed_at      timestamptz,
  completed_by      uuid references team_members(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint shift_done_needs_evidence
    check (status <> 'done' or (evidence is not null and btrim(evidence) <> '')),
  constraint shift_blocked_needs_reason
    check (status <> 'blocked' or (blocked_reason is not null and btrim(blocked_reason) <> ''))
);
-- Idempotent generation: a re-fired or retried job cannot create a second row.
create unique index if not exists idx_shift_instance_once
  on shift_task_instances(template_task_id, week_start);
create index if not exists idx_shift_instance_week on shift_task_instances(week_start, template_id);

-- ═══ 4 · THE REVERT TRAIL ══════════════════════════════════════════════════
-- The row that matters is not "status changed" generically. It is Chau or Sy
-- turning a DONE back, with a note — and the person who ticked it must see that
-- on their own task row without going looking for it.
create table if not exists shift_task_events (
  id           uuid primary key default gen_random_uuid(),
  instance_id  uuid not null references shift_task_instances(id) on delete cascade,
  kind         text not null check (kind in ('revert','status','note','evidence')),
  actor_team_member_id uuid references team_members(id),
  actor_name   text,                                  -- snapshot: people leave
  old_status   text,
  new_status   text,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_shift_events_instance on shift_task_events(instance_id, created_at desc);

-- ═══ 5 · THE WEEK'S FIVE OBJECTIVES ════════════════════════════════════════
create table if not exists shift_week_objectives (
  id           uuid primary key default gen_random_uuid(),
  week_start   date not null,
  template_id  uuid not null references shift_templates(id),
  objective_en text not null,
  objective_vi text,
  created_by   uuid references team_members(id),
  created_at   timestamptz not null default now(),
  unique (week_start, template_id)
);

-- ═══ 6 · RLS ═══════════════════════════════════════════════════════════════
-- Admin-gated at the table. OWNERSHIP is enforced in shift_task_update(), which
-- is the only thing that knows who is acting — see the header.
alter table shift_templates enable row level security;
drop policy if exists "admins rw shift_templates" on shift_templates;
create policy "admins rw shift_templates" on shift_templates for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
alter table shift_template_tasks enable row level security;
drop policy if exists "admins rw shift_template_tasks" on shift_template_tasks;
create policy "admins rw shift_template_tasks" on shift_template_tasks for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
alter table shift_shared_notes enable row level security;
drop policy if exists "admins rw shift_shared_notes" on shift_shared_notes;
create policy "admins rw shift_shared_notes" on shift_shared_notes for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
alter table shift_task_instances enable row level security;
drop policy if exists "admins rw shift_task_instances" on shift_task_instances;
create policy "admins rw shift_task_instances" on shift_task_instances for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
alter table shift_task_events enable row level security;
drop policy if exists "admins rw shift_task_events" on shift_task_events;
create policy "admins rw shift_task_events" on shift_task_events for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
alter table shift_week_objectives enable row level security;
drop policy if exists "admins rw shift_week_objectives" on shift_week_objectives;
create policy "admins rw shift_week_objectives" on shift_week_objectives for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ═══ 7 · GENERATION ════════════════════════════════════════════════════════
-- Called from the EXISTING daily cron (/api/cron/ops-materialise), not a new
-- scheduler and not lazily on first view. Lazy generation is the worst of the
-- three: a week nobody opens never exists, so carry-over silently misses it and
-- the Monday review is short a person with no error anywhere.
--
-- Idempotent by the unique index, so a daily call is harmless and a retry cannot
-- double-insert.
create or replace function shift_materialise_week(p_week_start date default null)
  returns int language plpgsql security definer set search_path = public as $fn$
declare
  v_week date;
  v_prev date;
  v_made int := 0;
begin
  -- Default to the Monday of the current Vietnam week.
  v_week := coalesce(p_week_start,
    (date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date));
  v_prev := v_week - 7;

  insert into shift_task_instances (
    template_task_id, template_id, week_start, shift_date,
    assignee_team_member_id, carried_over_count)
  select
    tt.id, t.id, v_week,
    v_week + (t.day_of_week - 1),
    t.assignee_team_member_id,
    -- CARRY-OVER: last week's row for this task, if it did not finish, brings
    -- its count forward plus one. A task done last week starts at zero.
    coalesce((
      select case when pi.status = 'done' then 0 else pi.carried_over_count + 1 end
        from shift_task_instances pi
       where pi.template_task_id = tt.id and pi.week_start = v_prev
    ), 0)
  from shift_template_tasks tt
  join shift_templates t on t.id = tt.template_id
  where tt.active and t.active
  on conflict (template_task_id, week_start) do nothing;

  get diagnostics v_made = row_count;
  return v_made;
end $fn$;
revoke all on function shift_materialise_week(date) from public;
grant execute on function shift_materialise_week(date) to service_role, authenticated;

-- ═══ 8 · THE ONE PLACE OWNERSHIP IS ENFORCED ═══════════════════════════════
-- Takes the ACTING team member (PIN-verified, from the trc_admin_staff cookie)
-- because the database cannot see a cookie and auth.uid() is a shared staff
-- login. Refuses a mismatch. Writes the revert trail itself, so a revert cannot
-- happen without one.
create or replace function shift_task_update(
  p_instance uuid,
  p_actor    uuid,                    -- team_members.id, PIN-verified upstream
  p_status   text default null,
  p_evidence text default null,
  p_blocked_reason text default null,
  p_blocked_unblocker text default null,
  p_note     text default null,
  p_revert_note text default null,
  p_prospect uuid default null
) returns text language plpgsql security definer set search_path = public as $fn$
declare
  v_row shift_task_instances%rowtype;
  v_actor team_members%rowtype;
  v_old text;
  v_is_revert boolean := false;
begin
  select * into v_row from shift_task_instances where id = p_instance for update;
  if not found then return 'unknown'; end if;
  select * into v_actor from team_members where id = p_actor;
  if not found then return 'no_actor'; end if;

  v_old := v_row.status;

  -- NOBODY TICKS ANYONE ELSE'S BOX. A supervisor may act, but only to revert —
  -- see below — never to complete someone's work for them.
  if v_row.assignee_team_member_id is distinct from p_actor and not v_actor.is_shift_supervisor then
    return 'not_yours';
  end if;

  -- A supervisor turning a DONE back is a REVERT and requires a note.
  if v_actor.is_shift_supervisor
     and v_row.assignee_team_member_id is distinct from p_actor
     and v_old = 'done' and p_status is not null and p_status <> 'done' then
    if p_revert_note is null or btrim(p_revert_note) = '' then return 'revert_needs_note'; end if;
    v_is_revert := true;
  elsif v_row.assignee_team_member_id is distinct from p_actor then
    -- A supervisor may ONLY revert. Anything else on someone else's row is refused.
    return 'not_yours';
  end if;

  update shift_task_instances set
    status            = coalesce(p_status, status),
    evidence          = coalesce(p_evidence, evidence),
    blocked_reason    = coalesce(p_blocked_reason, blocked_reason),
    blocked_unblocker = coalesce(p_blocked_unblocker, blocked_unblocker),
    note              = coalesce(p_note, note),
    prospect_id       = coalesce(p_prospect, prospect_id),
    completed_at      = case when coalesce(p_status, status) = 'done' then now() else null end,
    completed_by      = case when coalesce(p_status, status) = 'done' then p_actor else null end,
    updated_at        = now()
  where id = p_instance;

  if v_is_revert then
    insert into shift_task_events (instance_id, kind, actor_team_member_id, actor_name, old_status, new_status, note)
    values (p_instance, 'revert', p_actor, v_actor.display_name, v_old, p_status, p_revert_note);
  elsif p_status is not null and p_status is distinct from v_old then
    insert into shift_task_events (instance_id, kind, actor_team_member_id, actor_name, old_status, new_status, note)
    values (p_instance, 'status', p_actor, v_actor.display_name, v_old, p_status, null);
  end if;

  return null;   -- null = accepted
exception when check_violation then
  -- The DB constraints are the backstop for the UI rules; report which one.
  return case when p_status = 'done' then 'needs_evidence' else 'needs_reason' end;
end $fn$;
revoke all on function shift_task_update(uuid,uuid,text,text,text,text,text,text,uuid) from public;
grant execute on function shift_task_update(uuid,uuid,text,text,text,text,text,text,uuid) to service_role, authenticated;

-- ═══ 9 · SEED ══════════════════════════════════════════════════════════════
-- Charters seed with *_vi NULL. Vietnamese is supplied separately; the UI
-- falls back to English rather than rendering an empty block.

insert into shift_templates (slug, day_of_week, title_en, assignee_team_member_id, charter_en, measure_en, sort)
select 'operations_stock', 1, 'Operations & Stock',
       (select id from team_members where display_name = 'Mr Sĩ' limit 1),
       'Your day is the one nobody sees, which is exactly why it matters. The club works on Friday night because of what you did on Monday afternoon.

You publish the rota two weeks ahead, not one, so the team can plan their lives and so cover is matched to what''s actually booked rather than to habit. You reconcile the hours people worked against the hours they were given. You count the stock, and when the numbers don''t agree you find out why rather than writing the difference down and moving on. You chase the suppliers who owe us. You walk the building and check the things that only announce themselves by failing: the lift, the air conditioning, the radios, the chargers, the drains. Each week you take one SOP and bring it up to date, so the whole set stays alive instead of quietly becoming fiction.

At 14:00 you sit with Miss Chau and review the week that''s gone. Five outputs, done or not done. That evening the plan for the week ahead goes to Shawn, so he wakes to it and Tuesday starts properly.', 'Nothing on the floor stopped for a reason that could have been fixed on Monday.', 1
on conflict (slug) do update set
  day_of_week = excluded.day_of_week, title_en = excluded.title_en,
  charter_en = excluded.charter_en, measure_en = excluded.measure_en,
  assignee_team_member_id = coalesce(shift_templates.assignee_team_member_id, excluded.assignee_team_member_id),
  updated_at = now();
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 1, 'Count the back bar and the store. Write the count sheet. Anything more than 2 bottles out, find out why before you leave.', 'Kiểm kê quầy bar và kho. Ghi phiếu kiểm kê. Chênh lệch trên 2 chai phải tìm ra nguyên nhân trước khi về.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 1);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 2, 'Place the supplier order. One order, not five.', 'Đặt hàng nhà cung cấp. Một đơn duy nhất, không đặt lẻ.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 2);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 3, 'Write the rota for the week after next. Send it to the group.', 'Lập lịch làm việc cho tuần sau nữa. Gửi vào nhóm.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 3);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 4, 'Add up last week''s hours. Flag anyone over 48.', 'Tổng hợp giờ công tuần trước. Đánh dấu ai vượt 48 giờ.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 4);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 5, 'Walk the building: lift, AC, lights, drains, toilets. Write down anything broken, who is fixing it, and by when.', 'Đi kiểm tra toà nhà: thang máy, điều hoà, đèn, thoát nước, nhà vệ sinh. Ghi lại hỏng hóc, ai sửa, khi nào xong.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 5);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 6, 'Charge the radios. Test the POS and the printer.', 'Sạc bộ đàm. Kiểm tra máy POS và máy in.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 6);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 7, 'Review with Miss Chau at 14:00. Go through the board. Agree this week''s five jobs.', 'Họp rà soát với Miss Chau lúc 14:00. Xem lại bảng công việc. Thống nhất năm việc của tuần.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 7);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 8, 'Send the week''s plan to Shawn before leaving.', 'Gửi kế hoạch tuần cho Shawn trước khi về.', false from shift_templates t where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 8);

insert into shift_templates (slug, day_of_week, title_en, assignee_team_member_id, charter_en, measure_en, sort)
select 'member_care', 2, 'Member Care & Correspondence',
       (select id from team_members where display_name = 'Tiên' limit 1),
       'You are the club''s written voice and its memory. Both of those things are fragile and both are yours to protect.

Letters and cards go out in the house hand, to the house standard. What you write and seal on Tuesday, Hiếu carries on Wednesday — one day, so it arrives while the reason for writing it is still true. Keep the stationery stocked before we run short, not after. Welcome packs sit assembled and waiting so a new member has theirs within 48 hours of being accepted, while the feeling is still fresh.

Pull the occasion list fourteen days ahead — birthdays, anniversaries, milestones — and write the cards before they''re needed. A card that arrives on the day was written a fortnight ago; that''s the whole trick. Watch the dormancy list, and when someone hasn''t been in for thirty days, bring Miss Chau a reason for them to return rather than just the fact of their absence.

Your Zalo check-ins should be warm and specific. Never a broadcast. And here is the part that matters most: everything a member tells you in a message goes into the MIS. Their daughter''s exam, the trip they''re taking, the dram they didn''t finish. Right now that''s where most of what we know is being lost. You are the person who stops that.', 'A member is remembered for something they only mentioned once.', 2
on conflict (slug) do update set
  day_of_week = excluded.day_of_week, title_en = excluded.title_en,
  charter_en = excluded.charter_en, measure_en = excluded.measure_en,
  assignee_team_member_id = coalesce(shift_templates.assignee_team_member_id, excluded.assignee_team_member_id),
  updated_at = now();
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 1, 'Pull every member with a birthday or anniversary in the next 14 days. Write the cards today.', 'Lọc danh sách hội viên có sinh nhật hoặc kỷ niệm trong 14 ngày tới. Viết thiệp ngay hôm nay.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 1);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 2, 'Write next day''s letters. Print, sign, seal, and list them for Hiếu.', 'Soạn thư cho ngày mai. In, ký, niêm phong và lập danh sách bàn giao cho Hiếu.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 2);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 3, 'Message 10 members on Zalo. Ask something specific, not "how are you".', 'Nhắn tin 10 hội viên qua Zalo. Hỏi điều cụ thể, không hỏi chung chung.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 3);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 4, 'Everything they tell you goes into the MIS the same afternoon.', 'Mọi thông tin hội viên chia sẻ phải nhập vào MIS ngay trong buổi chiều đó.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 4);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 5, 'Pull members who have not visited in 30, 60, 90 days. Give the list to Miss Chau with one reason each to return.', 'Lọc hội viên chưa ghé 30, 60, 90 ngày. Gửi danh sách cho Miss Chau kèm một lý do mời quay lại cho từng người.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 5);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 6, 'Write thank-you notes for anyone who had a significant visit last week. Miss Chau signs them.', 'Viết thư cảm ơn cho hội viên có buổi ghé đáng nhớ tuần trước. Miss Chau ký.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 6);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 7, 'Count the stationery: cards, envelopes, wax, ribbon. Order if under 50.', 'Kiểm kê văn phòng phẩm: thiệp, phong bì, xi, ruy băng. Đặt thêm nếu dưới 50.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 7);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 8, 'Check two welcome packs are built and ready.', 'Kiểm tra có hai bộ quà chào mừng đã hoàn thiện và sẵn sàng.', false from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 8);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 9, 'Propose one possible new member to Miss Chau.', 'Đề cử một hội viên tiềm năng cho Miss Chau.', true from shift_templates t where t.slug = 'member_care'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 9);

insert into shift_templates (slug, day_of_week, title_en, assignee_team_member_id, charter_en, measure_en, sort)
select 'delivery_beverage', 3, 'Delivery & Beverage',
       (select id from team_members where display_name = 'Hiếu' limit 1),
       'You have two jobs and they''re both about craft.

At 13:00 you collect Tuesday''s letters from Miss Tiên and plan your route; by 14:00 you''re on the road. Hand-delivered, not couriered, because a letter that arrives in someone''s hand is a different object from one that arrives in a pile. You log every drop: who took it, when, what they said. Write down the assistant''s name at every office. That name is what makes the second visit easy, and there will always be a second visit.

Back at the desk, the drinks are yours. Every cocktail gets a spec sheet with the exact build, glass, ice and garnish, and a costing behind it. Nothing goes on a menu without one. You develop the batching and the syrups, you set the ice standard, and you look for what Vietnam grows that Scotland can''t. Build one serve for each Compass quadrant, so a member can drink their way around the system. When you decide what stays on the menu and what goes, use the POS data rather than your own taste.

Once a week you go and stand in someone else''s bar and watch how they work. Come back with one page: what they do better, what we should take, what we already do better. Film your technique while you work and hand the footage to Miss Nhi.', 'A drink made three times by three people tastes the same.', 3
on conflict (slug) do update set
  day_of_week = excluded.day_of_week, title_en = excluded.title_en,
  charter_en = excluded.charter_en, measure_en = excluded.measure_en,
  assignee_team_member_id = coalesce(shift_templates.assignee_team_member_id, excluded.assignee_team_member_id),
  updated_at = now();
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 1, 'Collect the letters from Miss Tiên at 13:00. Count them against her list.', 'Nhận thư từ Miss Tiên lúc 13:00. Đối chiếu số lượng với danh sách.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 1);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 2, 'Plan the route by district. Leave at 14:00.', 'Lên lộ trình theo quận. Khởi hành lúc 14:00.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 2);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 3, 'Deliver. For each: who took it, what time, what they said, the assistant''s name.', 'Giao thư. Mỗi lần ghi: ai nhận, mấy giờ, nói gì, tên trợ lý.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 3);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 4, 'Back by 15:30. Hand the delivery sheet to Miss Chau.', 'Về trước 15:30. Bàn giao phiếu giao thư cho Miss Chau.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 4);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 5, 'Write up one cocktail in full: measures, glass, ice, garnish, ingredient cost, GP%.', 'Viết đầy đủ một công thức cocktail: định lượng, ly, đá, trang trí, giá vốn nguyên liệu, GP%.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 5);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 6, 'Check the bar par. Anything short goes on Mr Sy''s order list.', 'Kiểm tra định mức tồn quầy. Thiếu gì đưa vào danh sách đặt hàng của Mr Sy.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 6);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 7, 'Film one drink being made. Send the footage to Miss Nhi.', 'Quay video pha chế một món. Gửi tư liệu cho Miss Nhi.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 7);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 8, 'One page on the bar visited this week. Read it out at 16:00.', 'Viết một trang về quầy bar đã đến học tuần này. Trình bày lúc 16:00.', false from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 8);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 9, 'Propose one possible new member to Miss Chau.', 'Đề cử một hội viên tiềm năng cho Miss Chau.', true from shift_templates t where t.slug = 'delivery_beverage'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 9);

insert into shift_templates (slug, day_of_week, title_en, assignee_team_member_id, charter_en, measure_en, sort)
select 'content_presentation', 4, 'Content & Presentation',
       (select id from team_members where display_name = 'Nhi' limit 1),
       'You decide what the club looks like, both to the outside and to itself.

Shoot in daylight, with a shot list written before you pick up the camera. Bank two weeks of captions in English and Vietnamese so nothing is written at midnight the night before. Keep the library filed by month, raw and edited and approved, so anyone can find an image in ten seconds. Edit Hiếu''s footage into something short and good.

On the accounts, members are never named, never confirmed, never discussed. If someone asks whether so-and-so is a member, that goes to Miss Chau. No face is published without written permission.

Your bigger job is the look book. Record every space as it should be: the table setting, the glassware, the lighting level, the number of candles, the flowers, the volume of the music. Library Bar, Rampant Room, the private dining room, the Studio, the Gallery. Then the team stops guessing and simply matches the picture. Do the same for events, so we have three or four defined set-ups with a layout, a cover count and a kit list, rather than reinventing a room every time.', 'Someone who has never worked here could set a room correctly from your photograph.', 4
on conflict (slug) do update set
  day_of_week = excluded.day_of_week, title_en = excluded.title_en,
  charter_en = excluded.charter_en, measure_en = excluded.measure_en,
  assignee_team_member_id = coalesce(shift_templates.assignee_team_member_id, excluded.assignee_team_member_id),
  updated_at = now();
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 1, 'Write the shot list before touching the camera.', 'Lập danh sách cảnh quay trước khi cầm máy.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 1);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 2, 'Charge the batteries, clear the cards.', 'Sạc pin, xoá thẻ nhớ.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 2);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 3, 'Dress the room. Shoot before 16:00 while there is light.', 'Bày trí không gian. Chụp trước 16:00 khi còn ánh sáng.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 3);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 4, '15 usable photos minimum. Upload the same day into that month''s folder.', 'Tối thiểu 15 ảnh dùng được. Tải lên thư mục của tháng ngay trong ngày.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 4);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 5, 'Write 5 captions, English and Vietnamese. Load next week''s posts.', 'Viết 5 caption, tiếng Anh và tiếng Việt. Nạp lịch đăng tuần sau.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 5);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 6, 'Cut Hiếu''s video into one clip under 30 seconds.', 'Dựng video của Hiếu thành một clip dưới 30 giây.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 6);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 7, 'Answer the DMs. Never confirm who is or is not a member — send those to Miss Chau.', 'Trả lời tin nhắn. Không bao giờ xác nhận ai là hội viên — chuyển các trường hợp đó cho Miss Chau.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 7);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 8, 'Photograph one room set up correctly. Save it to the look book.', 'Chụp một không gian đã bày trí chuẩn. Lưu vào sổ diện mạo.', false from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 8);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 9, 'Propose one possible new member to Miss Chau.', 'Đề cử một hội viên tiềm năng cho Miss Chau.', true from shift_templates t where t.slug = 'content_presentation'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 9);

insert into shift_templates (slug, day_of_week, title_en, assignee_team_member_id, charter_en, measure_en, sort)
select 'events_guest', 5, 'Events & Guest Relations',
       (select id from team_members where display_name = 'Bình' limit 1),
       'You build the things that have to exist before the day arrives.

The sponsor pipeline is yours, but the tracker matters more than the pipeline: what we promised each sponsor against what we actually delivered, and a short report back to them afterwards. That report is what buys the second year. Most people never send it.

Run sheets for anything in the next fourteen days. Guest lists built in advance, not on the afternoon. Your RSVP rhythm is fixed: invitation at fourteen days, chase at seven, confirm at two. Every event has a cap and a waitlist, and the waitlist gets contacted rather than quietly forgotten. When members need to sign up, tell them how, clearly, rather than hinting.

For the art events, hold the whole chain: artist, hanging plan, pricing, commission, insurance, install and de-install. For member trips, cost them properly — deposits, minimum numbers, cancellation terms — before anyone is invited. Keep chasing the reciprocal club letters; they only work if someone owns the follow-up.

Afterwards, both the attendance and the no-shows go into the MIS. Who came matters. Who said yes and didn''t come matters just as much.', 'Nothing on an event night is decided on an event night.', 5
on conflict (slug) do update set
  day_of_week = excluded.day_of_week, title_en = excluded.title_en,
  charter_en = excluded.charter_en, measure_en = excluded.measure_en,
  assignee_team_member_id = coalesce(shift_templates.assignee_team_member_id, excluded.assignee_team_member_id),
  updated_at = now();
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 1, 'Print the run sheet for anything happening in the next 14 days.', 'In kịch bản vận hành cho mọi hoạt động trong 14 ngày tới.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 1);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 2, 'Update the guest list. Send the T-7 chase and the T-2 confirmation messages.', 'Cập nhật danh sách khách. Gửi tin nhắc T-7 và tin xác nhận T-2.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 2);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 3, 'Call anyone who has not replied. A message does not count.', 'Gọi điện cho ai chưa phản hồi. Nhắn tin không tính.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 3);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 4, 'Ring the waitlist. All of them.', 'Gọi danh sách chờ. Tất cả.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 4);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 5, 'Enter last week''s event into the MIS: who came, who said yes and did not.', 'Nhập sự kiện tuần trước vào MIS: ai đã đến, ai nhận lời nhưng không đến.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 5);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 6, 'Update the sponsor sheet: who, what stage, next action, by when.', 'Cập nhật bảng nhà tài trợ: ai, giai đoạn nào, bước tiếp theo, hạn khi nào.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 6);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 7, 'Enter last week''s event costs into the budget sheet. Close it.', 'Nhập chi phí sự kiện tuần trước vào bảng ngân sách. Chốt sổ.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 7);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 8, 'Give Miss Chau the weekend''s bookings and names by 16:00.', 'Gửi Miss Chau danh sách đặt chỗ và tên khách cuối tuần trước 16:00.', false from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 8);
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 9, 'Propose one possible new member to Miss Chau.', 'Đề cử một hội viên tiềm năng cho Miss Chau.', true from shift_templates t where t.slug = 'events_guest'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 9);
insert into shift_shared_notes (key, body_en, applies_to) values ('prospect_rule', 'Every afternoon shift you bring Miss Chau one person who might belong here. Their name, who they are, why now, what they would bring to the room, and how we would reach them. Not what they''d spend — what they''d add. It will be checked. Between the four of you that''s around sixteen considered names a month, each with someone''s name against it, and that is how a 99-member club gets built.', 'non_supervisor')
  on conflict (key) do update set body_en = excluded.body_en, applies_to = excluded.applies_to;
insert into shift_shared_notes (key, body_en, applies_to) values ('half_hour', 'At 16:00 you teach The Half Hour. Whoever is on the desk takes it: a distillery, a region, a Compass quadrant, one bottle in depth. Preparing it is how you learn it.', 'all')
  on conflict (key) do update set body_en = excluded.body_en, applies_to = excluded.applies_to;

-- Supervisors: Mr Sĩ and Miss Chau.
update team_members set is_shift_supervisor = true
 where display_name in ('Mr Sĩ', 'Miss Chau');

-- ═══ 10 · SELF-CHECK ═══════════════════════════════════════════════════════
do $check$
declare v_t int; v_tasks int; v_sup int; v_unassigned int; v_prospect int;
begin
  select count(*) into v_t from shift_templates;
  if v_t <> 5 then raise exception 'SELF-CHECK: expected 5 shifts, found %', v_t; end if;

  select count(*) into v_tasks from shift_template_tasks;
  if v_tasks <> 44 then raise exception 'SELF-CHECK: expected 44 template tasks, found %', v_tasks; end if;

  select count(*) into v_prospect from shift_template_tasks where is_prospect_task;
  if v_prospect <> 4 then raise exception 'SELF-CHECK: the prospect rule is 4 shifts, not %', v_prospect; end if;

  select count(*) into v_sup from team_members where is_shift_supervisor;
  if v_sup < 1 then raise exception 'SELF-CHECK: no shift supervisor — nobody could revert a done'; end if;

  select count(*) into v_unassigned from shift_templates where assignee_team_member_id is null;
  if v_unassigned > 0 then
    raise warning 'SELF-CHECK: % shift(s) have no assignee — a name in the seed did not match team_members. Assign them in /admin/shifts/templates.', v_unassigned;
  end if;

  if exists (select 1 from shift_templates where charter_vi is not null) then
    raise warning 'SELF-CHECK: a Vietnamese charter is present — the seed leaves these NULL deliberately.';
  end if;

  raise notice 'shift tasks ready — % shifts, % tasks, % supervisor(s). Charters are EN-only by design.', v_t, v_tasks, v_sup;
end $check$;

commit;
