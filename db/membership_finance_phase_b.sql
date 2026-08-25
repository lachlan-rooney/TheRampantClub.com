-- ═══════════════════════════════════════════════════════════════════════
-- MEMBERSHIP FINANCE — PHASE B: renewal automation + honorary activation
-- Run once in the Supabase SQL editor (after db/membership_finance.sql).
--
-- The single source of truth for membership status is membership_periods.end_date.
-- This adds the PROACTIVE layer: reminders before expiry, Active→Lapsed after a
-- grace window, and a fee-free "activate" path for honorary/complimentary members.
-- Rides the existing Ops-Hub notifications + cron + dispatch spine.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Register the two notification types (emailed) ──────────────────
insert into notification_email_types (type, email_enabled) values
  ('membership_renewal_due', true),
  ('membership_lapsed',      true)
on conflict (type) do nothing;

-- ── 2. Honorary / complimentary activation ────────────────────────────
-- A complimentary period never lapses and never triggers renewal reminders —
-- honorary members are indefinite. The scan (§3) skips complimentary rows.
alter table membership_periods add column if not exists complimentary boolean not null default false;

-- Starts a one-year membership period with NO payment ledger row, NO amount,
-- NO email required. For honorary members (0 dues) and comps. Supersedes any
-- active period, syncs the roster cache, and logs an audit event.
create or replace function activate_membership(
  p_member_no   varchar,
  p_member_name text,
  p_tier        text,
  p_start_date  date,
  p_note        text,
  p_staff_id    uuid,
  p_staff_email text
) returns table (period_id uuid, start_date date, end_date date)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_period uuid := gen_random_uuid();
  v_start  date := coalesce(p_start_date, ops_today_vn());
  v_end    date := (coalesce(p_start_date, ops_today_vn()) + interval '1 year' - interval '1 day')::date;
begin
  if not is_admin_uid(auth.uid()) then raise exception 'Not authorized'; end if;

  update membership_periods set status = 'superseded'
    where member_no = p_member_no and status = 'active';

  insert into membership_periods (id, member_no, payment_id, start_date, end_date, status, complimentary)
    values (v_period, p_member_no, null, v_start, v_end, 'active', true);

  update members set status = 'Active' where member_no = p_member_no;

  perform ops_emit_event('activated', 'membership', v_period, null,
    jsonb_build_object(
      'member_no', p_member_no, 'member_name', p_member_name, 'tier', p_tier,
      'end_date', v_end, 'note', p_note, 'complimentary', true, 'actor_email', p_staff_email
    ));

  return query select v_period, v_start, v_end;
end$$;
grant execute on function activate_membership(varchar,text,text,date,text,uuid,text) to authenticated;

-- ── 3. Renewal scan: reminders + lapse ────────────────────────────────
-- Idempotent (safe to run repeatedly). Reminders at T-30/14/7/1/0 days before
-- end_date; Active→Lapsed once past the 30-day grace window. Notifications go to
-- the member's linked profile; Sheet-only members (no profile) are an honest
-- no-op. Emails flush through the existing dispatcher (quiet-hours aware).
create or replace function membership_scan_renewals()
returns table (reminders int, lapses int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_today   date := ops_today_vn();
  v_grace   int  := 30;
  v_rem     int  := 0;
  v_lap     int  := 0;
  p         record;
  v_profile uuid;
  v_days    int;
begin
  -- Lapse: active periods past the grace window (complimentary never lapses).
  for p in select * from membership_periods where status = 'active' and complimentary = false and end_date < v_today - v_grace loop
    update membership_periods set status = 'expired' where id = p.id;
    update members set status = 'Lapsed' where member_no = p.member_no;

    select id into v_profile from profiles where member_no = p.member_no;
    if v_profile is not null and not exists (
      select 1 from notifications n
      where n.type = 'membership_lapsed' and n.recipient = v_profile
        and n.metadata->>'period_id' = p.id::text
    ) then
      insert into notifications (recipient, type, event_id, metadata, email_status)
      values (v_profile, 'membership_lapsed', null,
        jsonb_build_object('title', 'Membership lapsed', 'link', '/members/profile',
          'period_id', p.id, 'paid_through', p.end_date),
        case when (select email_enabled from notification_email_types where type = 'membership_lapsed')
             then 'pending' else 'in_app_only' end);
    end if;

    perform ops_emit_event('lapsed', 'membership', p.id, null,
      jsonb_build_object('member_no', p.member_no, 'end_date', p.end_date));
    v_lap := v_lap + 1;
  end loop;

  -- Reminders at the renewal milestones (complimentary members are not reminded).
  for p in select * from membership_periods where status = 'active' and complimentary = false and end_date between v_today and v_today + 30 loop
    v_days := p.end_date - v_today;
    if v_days in (30, 14, 7, 1, 0) then
      select id into v_profile from profiles where member_no = p.member_no;
      if v_profile is not null and not exists (
        select 1 from notifications n
        where n.type = 'membership_renewal_due' and n.recipient = v_profile
          and n.metadata->>'period_id' = p.id::text
          and (n.metadata->>'days_left')::int = v_days
      ) then
        insert into notifications (recipient, type, event_id, metadata, email_status)
        values (v_profile, 'membership_renewal_due', null,
          jsonb_build_object('title', 'Membership renewal due', 'link', '/members/profile',
            'period_id', p.id, 'paid_through', p.end_date, 'days_left', v_days),
          case when (select email_enabled from notification_email_types where type = 'membership_renewal_due')
               then 'pending' else 'in_app_only' end);
        v_rem := v_rem + 1;
      end if;
    end if;
  end loop;

  return query select v_rem, v_lap;
end$$;
grant execute on function membership_scan_renewals() to authenticated, service_role;
