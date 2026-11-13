-- ═══════════════════════════════════════════════════════════════════════════
-- THE SCAN WINDOW.  13 November 2026, morning.
-- ───────────────────────────────────────────────────────────────────────────
-- A door with twenty-minute groups has to check the NEXT group in while the
-- CURRENT group is still inside, or there is a queue in the street every
-- twenty minutes. So two groups scan green at any moment, and the screen has
-- to say which of the two a guest is.
--
-- ══ THE WINDOW IS THE GAP BETWEEN STARTS, TAKEN FROM THE EVENT ═══════════
-- session_minutes + changeover_minutes — 15 + 5 tonight. NOT a hardcoded 20:
-- the owner can change either setting before 15:00 and the door follows. The
-- first session of the night opens the same gap before it starts, so the queue
-- outside at 17:40 is checked in rather than kept in the street.
--
-- ══ CHECKED IN IS NOT INSIDE ═════════════════════════════════════════════
-- A guest from the next group who scans green at 18:45 is CHECKED IN for
-- 19:00. They are not in the room. The run sheet counts them separately, and
-- it is derived — admitted_at set AND their session not yet started — rather
-- than stored, because a stored flag would need something to turn it over at
-- 19:00 and there is nothing running at a door to do that.
--
-- Safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- The late allowance the owner asked for: five minutes, and still a setting.
update popup_events set admit_late_minutes = 5
 where slug in ('palace-2026-11-13', 'palace-practice') and admit_late_minutes <> 5;

-- ── THE SCAN, WITH THE WINDOW ─────────────────────────────────────────────
drop function if exists popup_scan(uuid,text,boolean,text,int,timestamptz,boolean);
create function popup_scan(
  p_event_id uuid, p_code text, p_admit boolean, p_by text,
  p_party int default null, p_at timestamptz default null, p_offline boolean default false
)
returns table (
  state text, booking_id uuid, name text, party_size int, status text,
  starts_at timestamptz, ends_at timestamptz, admitted_at timestamptz,
  admitted_by text, session_idx int, admitted_party int, ticket_code text,
  -- NEW: what the screen needs to say which group they are and when to return
  gap_minutes int, come_back_at timestamptz, inside boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_b popup_bookings%rowtype; v_s popup_sessions%rowtype; v_ev popup_events%rowtype;
  v_state text; v_admitted timestamptz; v_by text; v_rows int;
  v_clean text; v_party int; v_when timestamptz;
  v_gap int; v_opens timestamptz; v_late timestamptz; v_inside boolean := false;
begin
  v_clean := upper(btrim(coalesce(p_code, '')));
  v_when := coalesce(p_at, now());

  select e.* into v_ev from popup_events e where e.id = p_event_id;
  select b.* into v_b from popup_bookings b
    where b.event_id = p_event_id and b.ticket_code = v_clean;

  if not found then
    if exists (select 1 from popup_bookings b2 where b2.ticket_code = v_clean) then
      return query select 'wrong_event'::text, null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::text,
                          null::int, null::int, v_clean::text, null::int, null::timestamptz, false;
    else
      return query select 'unknown'::text, null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::text,
                          null::int, null::int, v_clean::text, null::int, null::timestamptz, false;
    end if;
    return;
  end if;

  select s.* into v_s from popup_sessions s where s.id = v_b.session_id;
  v_admitted := v_b.admitted_at;
  v_by := v_b.admitted_by;
  v_party := v_b.admitted_party;

  -- ⚠ THE WINDOW, FROM THE EVENT'S OWN SETTINGS.
  v_gap   := coalesce(v_ev.session_minutes, 15) + coalesce(v_ev.changeover_minutes, 5);
  v_opens := v_s.starts_at - make_interval(mins => v_gap);
  v_late  := v_s.ends_at;   -- replaced below; kept for clarity of intent
  v_late  := v_s.starts_at + make_interval(mins => coalesce(v_ev.admit_late_minutes, 5));

  if    v_b.status = 'cancelled' then v_state := 'cancelled';
  elsif v_b.status = 'waiting'   then v_state := 'waiting';
  elsif v_admitted is not null   then v_state := 'used';
  elsif v_when < v_opens         then v_state := 'too_early';     -- a later group
  elsif v_when < v_s.starts_at   then v_state := 'early_ok';      -- the NEXT group
  elsif v_when <= v_late         then
        v_state := case when v_when > v_s.starts_at then 'late_ok' else 'valid' end;
  elsif v_when <= v_s.ends_at    then v_state := 'valid';         -- their session is running
  else  v_state := 'passed';
  end if;

  -- ── THE ATOMIC ADMIT. Unchanged where it matters: `where admitted_at is
  --    null` + row_count is what makes four phones resolve to one winner.
  if p_admit and v_admitted is null and v_b.status = 'confirmed'
     and v_state in ('valid', 'early_ok', 'late_ok') then
    v_party := least(greatest(coalesce(p_party, v_b.party_size), 1), v_b.party_size);
    update popup_bookings b
       set admitted_at = v_when, admitted_by = p_by,
           admitted_party = v_party, admitted_offline = coalesce(p_offline, false)
     where b.id = v_b.id and b.admitted_at is null;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      v_admitted := v_when; v_by := p_by;
    else
      select b.admitted_at, b.admitted_by, b.admitted_party
        into v_admitted, v_by, v_party
        from popup_bookings b where b.id = v_b.id;
      v_state := 'used';
    end if;
  end if;

  -- ⚠ CHECKED IN IS NOT INSIDE. Derived, every time it is asked.
  v_inside := v_admitted is not null and v_when >= v_s.starts_at;

  return query select v_state, v_b.id, v_b.name, v_b.party_size, v_b.status,
                      v_s.starts_at, v_s.ends_at, v_admitted, v_by, v_s.idx,
                      v_party, v_b.ticket_code, v_gap,
                      -- when to come back: five minutes before their time
                      v_s.starts_at - interval '5 min', v_inside;
end $$;

revoke all on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) from public;
revoke all on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) from anon;
revoke all on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) from authenticated;
grant execute on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) to service_role;

-- ── THE RUN SHEET: CHECKED IN, AND INSIDE, ARE NOT THE SAME NUMBER ────────
drop function if exists popup_runsheet(uuid);
create function popup_runsheet(p_event_id uuid)
returns table (
  session_id uuid, idx int, starts_at timestamptz, ends_at timestamptz,
  cap int, booked int, parties int, arrived int, no_show int, waiting int,
  over_by int, closed boolean, ticked int, waiting_outside int
)
language sql security definer set search_path = public stable as $$
  select
    s.id, s.idx, s.starts_at, s.ends_at,
    coalesce(s.cap_override, e.default_cap) as cap,
    coalesce(c.booked, 0)::int,
    coalesce(c.parties, 0)::int,
    -- ⚠ "arrived" MEANS IN THE ROOM. A guest checked in early for a session
    -- that has not started is counted below, not here — otherwise the run
    -- sheet says twelve people are in a room holding four.
    case when now() >= s.starts_at then coalesce(c.arrived, 0) else 0 end::int,
    case when now() > s.ends_at
         then greatest(coalesce(c.booked, 0) - coalesce(c.arrived, 0), 0)
         else 0 end::int,
    coalesce(w.waiting, 0)::int,
    greatest(coalesce(c.booked, 0) - coalesce(s.cap_override, e.default_cap), 0)::int as over_by,
    s.closed,
    coalesce(c.ticked, 0)::int,
    -- checked in, standing outside, waiting for their time
    case when now() < s.starts_at then coalesce(c.arrived, 0) else 0 end::int
  from popup_events e
  join popup_sessions s on s.event_id = e.id
  left join lateral (
    select sum(b.party_size) as booked,
           count(*) as parties,
           sum(case when b.admitted_at is not null
                    then coalesce(b.admitted_party, b.party_size) else 0 end) as arrived,
           count(*) filter (where b.admitted_at is not null) as ticked
      from popup_bookings b where b.session_id = s.id and b.status = 'confirmed'
  ) c on true
  left join lateral (
    select sum(b.party_size) as waiting from popup_bookings b
     where b.session_id = s.id and b.status = 'waiting'
  ) w on true
  where e.id = p_event_id
  order by s.starts_at;
$$;

revoke all on function popup_runsheet(uuid) from public;
revoke all on function popup_runsheet(uuid) from anon;
revoke all on function popup_runsheet(uuid) from authenticated;
grant execute on function popup_runsheet(uuid) to service_role;

commit;

-- ── PROVE IT ──────────────────────────────────────────────────────────────
do $v$
declare
  v_ev uuid; v_s0 uuid; v_s1 uuid; v_s2 uuid; v_r record; v_c0 text; v_c1 text; v_c2 text;
  v_base timestamptz; v_arr int; v_out int;
begin
  insert into popup_events (slug, title_en, venue_en, event_date, first_start, last_finish,
                            session_minutes, changeover_minutes, default_cap, party_max,
                            published, admit_late_minutes)
  values ('verify-window-' || substr(gen_random_uuid()::text, 1, 8),
          'VERIFY — not an event', 'Verify', current_date + 1, '18:00', '19:00', 15, 5, 12, 2, true, 5)
  returning id into v_ev;
  perform popup_generate_sessions(v_ev);
  select s.id into v_s0 from popup_sessions s where s.event_id = v_ev order by s.idx limit 1;
  select s.id into v_s1 from popup_sessions s where s.event_id = v_ev order by s.idx offset 1 limit 1;
  select s.id into v_s2 from popup_sessions s where s.event_id = v_ev order by s.idx offset 2 limit 1;

  -- ⚠ BOOK FIRST, MOVE THE CLOCK AFTER. popup_book refuses a session that has
  -- already started, so re-timing session 0 to NOW and then booking it got
  -- 'started', left a null ticket code, and the scan reported "unknown" — the
  -- harness testing nothing and blaming the product. Every booking below is
  -- checked before it is used.
  select * into v_r from popup_book(v_ev, v_s0, 'Now Guest', null, 1, 'en', false, 'v', 'kiosk', gen_random_uuid(), false, 'H');
  if not v_r.ok then raise exception 'fixture: Now Guest refused (%)', v_r.reason; end if;
  v_c0 := v_r.ticket_code;
  select * into v_r from popup_book(v_ev, v_s1, 'Next Guest', null, 1, 'en', false, 'v', 'kiosk', gen_random_uuid(), false, 'H');
  if not v_r.ok then raise exception 'fixture: Next Guest refused (%)', v_r.reason; end if;
  v_c1 := v_r.ticket_code;
  select * into v_r from popup_book(v_ev, v_s2, 'Later Guest', null, 1, 'en', false, 'v', 'kiosk', gen_random_uuid(), false, 'H');
  if not v_r.ok then raise exception 'fixture: Later Guest refused (%)', v_r.reason; end if;
  v_c2 := v_r.ticket_code;

  -- NOW set the clock: session 0 running, 1 in twenty minutes, 2 in forty.
  v_base := now();
  update popup_sessions set starts_at = v_base - interval '1 min', ends_at = v_base + interval '14 min' where id = v_s0;
  update popup_sessions set starts_at = v_base + interval '19 min', ends_at = v_base + interval '34 min' where id = v_s1;
  update popup_sessions set starts_at = v_base + interval '39 min', ends_at = v_base + interval '54 min' where id = v_s2;

  -- CURRENT group: green, and the window came from the settings
  select * into v_r from popup_scan(v_ev, v_c0, false, 'H');
  if v_r.state not in ('valid', 'late_ok') then
    raise exception 'the current group scanned %, not valid', v_r.state;
  end if;
  if v_r.gap_minutes <> 20 then raise exception 'the window is % minutes, not 15+5', v_r.gap_minutes; end if;

  -- NEXT group: green, checked in, and NOT inside
  select * into v_r from popup_scan(v_ev, v_c1, true, 'H');
  if v_r.state <> 'early_ok' then raise exception 'the next group scanned %, not early_ok', v_r.state; end if;
  if v_r.inside then raise exception 'a guest checked in early was counted as inside'; end if;
  if (select b.admitted_at from popup_bookings b where b.ticket_code = v_c1) is null then
    raise exception 'the early check-in was not recorded';
  end if;

  -- LATER group: refused, with a time to come back to, and NOT admitted
  select * into v_r from popup_scan(v_ev, v_c2, true, 'H');
  if v_r.state <> 'too_early' then raise exception 'a later group scanned %, not too_early', v_r.state; end if;
  if v_r.come_back_at is null then raise exception 'no come-back time was given'; end if;
  if (select b.admitted_at from popup_bookings b where b.ticket_code = v_c2) is not null then
    raise exception 'A LATER GROUP WAS ADMITTED';
  end if;

  -- the run sheet keeps "waiting outside" apart from "inside"
  select r.arrived, r.waiting_outside into v_arr, v_out
    from popup_runsheet(v_ev) r where r.session_id = v_s1;
  if v_arr <> 0 or v_out <> 1 then
    raise exception 'run sheet says arrived=% waiting_outside=%, expected 0 and 1', v_arr, v_out;
  end if;

  -- LATE, within the allowance
  update popup_sessions set starts_at = v_base - interval '3 min', ends_at = v_base + interval '12 min' where id = v_s0;
  select * into v_r from popup_scan(v_ev, v_c0, false, 'H');
  if v_r.state <> 'late_ok' then raise exception 'three minutes late scanned %, not late_ok', v_r.state; end if;

  -- PASSED, beyond it, and it admits nobody
  update popup_sessions set starts_at = v_base - interval '40 min', ends_at = v_base - interval '25 min' where id = v_s0;
  select * into v_r from popup_scan(v_ev, v_c0, true, 'H');
  if v_r.state <> 'passed' then raise exception 'long past scanned %, not passed', v_r.state; end if;
  if (select b.admitted_at from popup_bookings b where b.ticket_code = v_c0) is not null then
    raise exception 'A GUEST WHOSE TIME HAD PASSED WAS ADMITTED';
  end if;

  -- ALREADY IN, and it names who
  select * into v_r from popup_scan(v_ev, v_c1, true, 'Someone Else');
  if v_r.state <> 'used' then raise exception 'a second scan gave %, not used', v_r.state; end if;
  if v_r.admitted_by <> 'H' then raise exception 'the record names %, not H', v_r.admitted_by; end if;

  delete from popup_events where id = v_ev;
  raise notice 'popup_scan_window: window from the settings (20) ✓ · current green ✓ · next=checked in and NOT inside ✓ · later refused with a come-back time and admitted nobody ✓ · run sheet separates waiting from inside ✓ · late_ok ✓ · passed admits nobody ✓ · already in names who ✓';
end $v$;
