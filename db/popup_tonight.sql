-- ═══════════════════════════════════════════════════════════════════════════
-- THE POP-UP, THE REST OF IT.  12 November 2026, the night before.
-- ───────────────────────────────────────────────────────────────────────────
-- ONE FILE, as asked, covering everything the remaining work needs: the door,
-- the run sheet, who took each sign-up, shifting the evening, messaging,
-- the ten-minute email, the follow-up and the morning-after reconciliation.
--
-- It is written to be run ONCE, by hand, tonight, after db/popup_timed_entry.sql,
-- db/popup_door_concurrency.sql and db/popup_staff_phones.sql. It is safe to
-- run twice: every column is `if not exists`, every function is dropped and
-- recreated, and the verification at the end builds and deletes its own event.
--
-- ⚠ IT RESTATES popup_book, popup_scan, popup_unadmit, popup_doorlist AND
-- popup_runsheet IN FULL rather than patching them. Four of those carry fixes
-- that were found the hard way — the ambiguous `status` that broke every
-- booking, and the conditional UPDATE that stops two phones admitting one
-- ticket. A patch file that only adds a parameter would leave two versions of
-- each in the repository and no way to tell which one a database is running.
-- The last file wins, and this is the last file.
--
-- ══ WHAT IS NEW, AND WHY ═════════════════════════════════════════════════
-- · taken_by          who took a sign-up, from the server's idea of who is
--                     signed in. The door has recorded admitted_by since it
--                     was built; a booking recorded only a device hash, which
--                     names a handset, not a person.
-- · admitted_party    HOW MANY OF THE PARTY CAME IN. A booking for two where
--                     one turns up is the commonest thing a door sees, and
--                     "arrived" meant the whole party or nothing.
-- · reconciled_at     the morning after: a paper tick that never reached a
--     reconcile_note  phone, recorded as what it is rather than typed over
--                     the top of the night's data as though it were live.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- ═══ PART 1 · THE COLUMNS ═════════════════════════════════════════════════

alter table popup_bookings add column if not exists taken_by text;
comment on column popup_bookings.taken_by is
  'The staff member who took this sign-up, from the signed staff cookie on the phone. '
  'NEVER from the request body — a name posted in a body is a name anybody can type. '
  'Null for bookings made before 12 Nov 2026 and for any public booking, which nobody takes.';

alter table popup_bookings add column if not exists admitted_party int;
comment on column popup_bookings.admitted_party is
  'How many of the party actually came in. Null until admitted. Set by popup_scan '
  'under the same atomic claim as admitted_at, so two phones cannot both set it.';

alter table popup_bookings add column if not exists reconciled_at timestamptz;
alter table popup_bookings add column if not exists reconcile_note text;
comment on column popup_bookings.reconciled_at is
  'Set when a paper tick was entered after the night, by popup_reconcile. It is kept '
  'SEPARATE from admitted_at''s own provenance so the morning-after corrections can '
  'always be told apart from what the door recorded live.';

-- ═══ PART 2 · TAKING A PLACE ══════════════════════════════════════════════
-- One new trailing argument, defaulted, so a caller that does not pass it
-- still resolves.
drop function if exists popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean);
drop function if exists popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean,text);
create function popup_book(
  p_event_id uuid, p_session_id uuid, p_name text, p_email text, p_party int,
  p_lang text, p_consent boolean, p_terms text, p_source text, p_attempt uuid,
  p_allow_waiting boolean default false,
  p_taken_by text default null
)
returns table (
  ok boolean, reason text, booking_id uuid, status text, ticket_code text,
  session_id uuid, starts_at timestamptz, places_left int
)
language plpgsql security definer set search_path = public as $$
declare
  v_ev popup_events%rowtype; v_s popup_sessions%rowtype;
  v_cap int; v_taken int; v_left int;
  v_key text; v_code text; v_id uuid; v_status text;
  v_clash popup_bookings%rowtype; v_prev popup_bookings%rowtype;
begin
  v_key := nullif(lower(btrim(coalesce(p_email, ''))), '');

  -- ── 0 · HAVE WE ALREADY ANSWERED THIS EXACT ATTEMPT? ──────────────────
  -- What makes the phone's one retry safe: a request that timed out may have
  -- SUCCEEDED, and without this the retry would take a second place.
  if p_attempt is not null then
    select b.* into v_prev from popup_bookings b
      where b.event_id = p_event_id and b.attempt_id = p_attempt;
    if found then
      select s.* into v_s from popup_sessions s where s.id = v_prev.session_id;
      return query select true, null::text, v_prev.id, v_prev.status, v_prev.ticket_code,
                          v_prev.session_id, v_s.starts_at, null::int;
      return;
    end if;
  end if;

  select e.* into v_ev from popup_events e where e.id = p_event_id;
  if not found then
    return query select false, 'no_session', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;
  if not v_ev.published then
    return query select false, 'not_published', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;
  if v_ev.bookings_paused then
    return query select false, 'paused', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;

  -- ── 1 · ONE BOOKING PER ADDRESS, and say where the other one is ───────
  if v_key is not null then
    select b.* into v_clash from popup_bookings b
      where b.event_id = p_event_id and b.email_key = v_key
        and b.status in ('confirmed','waiting')
      limit 1;
    if found then
      select s.* into v_s from popup_sessions s where s.id = v_clash.session_id;
      return query select false, 'duplicate', v_clash.id, v_clash.status, null::text,
                          v_clash.session_id, v_s.starts_at, null::int;
      return;
    end if;
  end if;

  -- ── 2 · THE LOCK ──────────────────────────────────────────────────────
  select s.* into v_s from popup_sessions s
    where s.id = p_session_id and s.event_id = p_event_id for update;
  if not found then
    return query select false, 'no_session', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;
  if v_s.closed then
    return query select false, 'closed', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, null::int; return;
  end if;
  if v_s.starts_at <= now() then
    return query select false, 'started', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, null::int; return;
  end if;
  if p_party < 1 or p_party > v_ev.party_max then
    return query select false, 'too_big', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, null::int; return;
  end if;

  v_cap := coalesce(v_s.cap_override, v_ev.default_cap);
  -- ⚠ b.status, NOT status. Unqualified it binds to this function's OUTPUT
  -- column of the same name and raises "column reference is ambiguous" at RUN
  -- time, not create time — which broke every booking until one was tried.
  select coalesce(sum(b.party_size), 0) into v_taken
    from popup_bookings b where b.session_id = v_s.id and b.status = 'confirmed';
  v_left := greatest(v_cap - v_taken, 0);

  if p_party > v_left then
    -- ⚠ REFUSED, NOT QUIETLY WAITLISTED. The waiting list is a button the
    -- guest presses next, not something done to them.
    if not p_allow_waiting then
      return query select false, 'full', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, v_left; return;
    end if;
    v_status := 'waiting';
  else
    v_status := 'confirmed';
  end if;

  loop
    v_code := upper(replace(substr(gen_random_uuid()::text, 1, 9), '-', ''));
    exit when not exists (
      select 1 from popup_bookings b where b.event_id = p_event_id and b.ticket_code = v_code);
  end loop;

  insert into popup_bookings as b (
    event_id, session_id, name, email, email_key, party_size, status, ticket_code,
    attempt_id, lang, source, consent_marketing, terms_text, waiting_since, taken_by
  ) values (
    p_event_id, v_s.id, btrim(p_name), nullif(btrim(coalesce(p_email,'')),''), v_key,
    p_party, v_status, v_code, p_attempt, coalesce(p_lang,'en'), coalesce(p_source,'kiosk'),
    coalesce(p_consent,false), p_terms,
    case when v_status = 'waiting' then now() else null end,
    nullif(btrim(coalesce(p_taken_by,'')), '')
  ) returning b.id into v_id;

  return query select true, null::text, v_id, v_status, v_code, v_s.id, v_s.starts_at,
                      greatest(v_left - case when v_status='confirmed' then p_party else 0 end, 0);
end $$;

-- ⚠ SUPABASE GRANTS EXECUTE TO anon AND authenticated AT CREATE TIME, and
-- `revoke … from public` does NOT take those away. Named explicitly, every time.
revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean,text) from public;
revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean,text) from anon;
revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean,text) from authenticated;
grant execute on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean,text) to service_role;

-- ═══ PART 3 · THE DOOR ════════════════════════════════════════════════════
-- popup_scan gains three arguments, all defaulted:
--   p_party    how many of the party are standing there. Null = all of them.
--   p_at       when they were actually admitted. Null = now. This is what
--              makes a QUEUED OFFLINE ADMISSION honest: a phone that ticked
--              somebody at 19:04 and only reached the network at 19:21 records
--              19:04, not 19:21.
--   p_offline  marks it as having been taken on a phone with no signal.
--
-- ⚠ THE ATOMIC CLAIM IS UNCHANGED AND IS THE WHOLE POINT. `update … where
-- admitted_at is null` + row_count is correct for any number of simultaneous
-- callers AND for two offline phones syncing an hour apart. No lock, no retry.
drop function if exists popup_scan(uuid,text,boolean,text);
drop function if exists popup_scan(uuid,text,boolean,text,int,timestamptz,boolean);
create function popup_scan(
  p_event_id uuid, p_code text, p_admit boolean, p_by text,
  p_party int default null, p_at timestamptz default null, p_offline boolean default false
)
returns table (
  state text, booking_id uuid, name text, party_size int, status text,
  starts_at timestamptz, ends_at timestamptz, admitted_at timestamptz,
  admitted_by text, session_idx int, admitted_party int, ticket_code text
)
language plpgsql security definer set search_path = public as $$
declare
  v_b popup_bookings%rowtype; v_s popup_sessions%rowtype; v_ev popup_events%rowtype;
  v_state text; v_admitted timestamptz; v_by text; v_rows int;
  v_clean text; v_party int; v_when timestamptz;
begin
  v_clean := upper(btrim(coalesce(p_code, '')));
  v_when := coalesce(p_at, now());

  select e.* into v_ev from popup_events e where e.id = p_event_id;
  select b.* into v_b from popup_bookings b
    where b.event_id = p_event_id and b.ticket_code = v_clean;

  if not found then
    -- A real code from ANOTHER event is worth naming: on the night, a
    -- rehearsal ticket still in somebody's inbox is the likeliest cause.
    -- ⚠ TWELVE COLUMNS, EVERY ONE CAST, IN BOTH BRANCHES. Written with eleven
    -- (admitted_party was added to the signature and missed here) this raises
    -- "structure of query does not match function result type" — at RUN time,
    -- only for a code that is not found, which is the one path no happy-case
    -- test touches. An unknown ticket 500'd the door.
    if exists (select 1 from popup_bookings b2 where b2.ticket_code = v_clean) then
      return query select 'wrong_event'::text, null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::text,
                          null::int, null::int, v_clean::text;
    else
      return query select 'unknown'::text, null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::text,
                          null::int, null::int, v_clean::text;
    end if;
    return;
  end if;

  select s.* into v_s from popup_sessions s where s.id = v_b.session_id;
  v_admitted := v_b.admitted_at;
  v_by := v_b.admitted_by;
  v_party := v_b.admitted_party;

  if    v_b.status = 'cancelled' then v_state := 'cancelled';
  elsif v_b.status = 'waiting'   then v_state := 'waiting';
  elsif v_admitted is not null   then v_state := 'used';
  elsif v_when < v_s.starts_at - make_interval(mins => v_ev.admit_early_minutes) then v_state := 'early';
  elsif v_when > v_s.ends_at   + make_interval(mins => v_ev.admit_late_minutes)  then v_state := 'late';
  else  v_state := 'valid';
  end if;

  -- ── THE ATOMIC ADMIT ──────────────────────────────────────────────────
  if p_admit and v_admitted is null and v_b.status = 'confirmed'
     and (v_state = 'valid' or (v_state = 'late' and v_ev.allow_late_move)) then

    -- A partial party, clamped. Asking to admit five of a party of two is a
    -- mistyped number, not an instruction.
    v_party := least(greatest(coalesce(p_party, v_b.party_size), 1), v_b.party_size);

    update popup_bookings b
       set admitted_at = v_when, admitted_by = p_by,
           admitted_party = v_party, admitted_offline = coalesce(p_offline, false)
     where b.id = v_b.id and b.admitted_at is null;
    get diagnostics v_rows = row_count;

    if v_rows = 1 then
      v_admitted := v_when; v_by := p_by; v_state := 'valid';
    else
      -- Somebody else got there first, in the same breath. Read back WHO, so
      -- the screen says "already admitted by Ni at 19:04" rather than a bare
      -- refusal that looks like a fault.
      select b.admitted_at, b.admitted_by, b.admitted_party
        into v_admitted, v_by, v_party
        from popup_bookings b where b.id = v_b.id;
      v_state := 'used';
    end if;
  end if;

  return query select v_state, v_b.id, v_b.name, v_b.party_size, v_b.status,
                      v_s.starts_at, v_s.ends_at, v_admitted, v_by, v_s.idx,
                      v_party, v_b.ticket_code;
end $$;

revoke all on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) from public;
revoke all on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) from anon;
revoke all on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) from authenticated;
grant execute on function popup_scan(uuid,text,boolean,text,int,timestamptz,boolean) to service_role;

-- ── CORRECTING THE NUMBER AFTER THE FACT ─────────────────────────────────
-- ⚠ DELIBERATELY NOT PART OF popup_scan. Changing the count on a booking that
-- is already admitted is a CORRECTION by one person looking at the row, not a
-- race between four phones — and folding it into the scan would have meant the
-- atomic claim no longer decided everything, which is the one property the
-- door rests on. A third guest arriving late goes through here.
drop function if exists popup_set_party(uuid,int,text);
create function popup_set_party(p_booking_id uuid, p_party int, p_by text)
returns table (ok boolean, name text, admitted_party int)
language plpgsql security definer set search_path = public as $$
declare v_b popup_bookings%rowtype; v_n int;
begin
  select b.* into v_b from popup_bookings b where b.id = p_booking_id;
  if not found or v_b.admitted_at is null then
    return query select false, coalesce(v_b.name, null), null::int; return;
  end if;
  v_n := least(greatest(coalesce(p_party, v_b.party_size), 1), v_b.party_size);
  update popup_bookings b
     set admitted_party = v_n,
         admitted_by = coalesce(b.admitted_by, p_by)
   where b.id = p_booking_id;
  return query select true, v_b.name, v_n;
end $$;

revoke all on function popup_set_party(uuid,int,text) from public;
revoke all on function popup_set_party(uuid,int,text) from anon;
revoke all on function popup_set_party(uuid,int,text) from authenticated;
grant execute on function popup_set_party(uuid,int,text) to service_role;

-- ── UNDOING AN ADMIT ─────────────────────────────────────────────────────
-- A door with four people on it will tick the wrong row sooner or later — two
-- guests with the same first name, a phone handed over mid-scan. Without an
-- undo the only remedy is the admin, which nobody opens with a queue in front
-- of them. It clears the party count too, or the next scan would show somebody
-- not admitted with a number of arrivals beside them.
drop function if exists popup_unadmit(uuid,text);
create function popup_unadmit(p_booking_id uuid, p_by text)
returns table (ok boolean, name text)
language plpgsql security definer set search_path = public as $$
declare v_rows int; v_name text;
begin
  update popup_bookings b
     set admitted_at = null, admitted_party = null, admitted_offline = false,
         admitted_by = case when p_by is null then null else p_by || ' (undone)' end
   where b.id = p_booking_id and b.admitted_at is not null;
  get diagnostics v_rows = row_count;
  select b.name into v_name from popup_bookings b where b.id = p_booking_id;
  return query select v_rows = 1, v_name;
end $$;

revoke all on function popup_unadmit(uuid,text) from public;
revoke all on function popup_unadmit(uuid,text) from anon;
revoke all on function popup_unadmit(uuid,text) from authenticated;
grant execute on function popup_unadmit(uuid,text) to service_role;

-- ── THE DOOR LIST, FOR EVERY PHONE AT ONCE ───────────────────────────────
-- What each phone polls, what gets cached for the offline case, and what the
-- printable A4 sheet is built from. ONE shape, three uses: a phone that has
-- been offline for ten minutes catches up by reading it again, with no merge
-- logic to get clever about and get wrong.
--
-- The whole evening is about a hundred rows at a cap of twelve, so there is no
-- paging and no "changes since" bookkeeping: every phone reads the truth every
-- few seconds and redraws.
--
-- ⚠ IT CARRIES THE GUEST'S EMAIL, which no other pop-up surface does. The door
-- has to find a booking from a name the guest half-remembers or the address
-- they signed up with, and it cannot do that from data it was not sent. It is
-- why /kiosk/popup/door is behind BOTH a popup pairing and a staff PIN, and
-- why the sign-up screen on the same phone is never given this shape.
drop function if exists popup_doorlist(uuid);
create function popup_doorlist(p_event_id uuid)
returns table (
  booking_id uuid, ticket_code text, name text, email text, party_size int, status text,
  session_idx int, starts_at timestamptz, ends_at timestamptz,
  admitted_at timestamptz, admitted_by text, admitted_party int,
  admitted_offline boolean, taken_by text, source text
)
language sql security definer set search_path = public stable as $$
  select b.id, b.ticket_code, b.name, b.email, b.party_size, b.status,
         s.idx, s.starts_at, s.ends_at, b.admitted_at, b.admitted_by,
         b.admitted_party, b.admitted_offline, b.taken_by, b.source
    from popup_bookings b
    join popup_sessions s on s.id = b.session_id
   where b.event_id = p_event_id and b.status in ('confirmed','waiting')
   order by s.starts_at, lower(b.name);
$$;

revoke all on function popup_doorlist(uuid) from public;
revoke all on function popup_doorlist(uuid) from anon;
revoke all on function popup_doorlist(uuid) from authenticated;
grant execute on function popup_doorlist(uuid) to service_role;

-- ── A WALK-UP ────────────────────────────────────────────────────────────
-- Somebody at the door who never signed up. popup_book CANNOT serve this and
-- should not be made to: it refuses a session that has already started, which
-- is correct for a phone taking a booking for later and exactly wrong for a
-- person standing in front of you at 19:06 for the 19:00 session.
--
-- So this is its own function, with the same lock and the same cap, and three
-- deliberate differences:
--   · a session that has STARTED is fine; one that has ENDED is not;
--   · it ADMITS THEM AT THE SAME TIME, because they are already here. A
--     walk-up that has to be created and then scanned is two steps at a door
--     with a queue, and the second one gets forgotten;
--   · p_force lets the owner put somebody in over the cap, on purpose, and
--     the row is still counted so the run sheet shows the session over.
drop function if exists popup_walkup(uuid,uuid,text,int,text,boolean);
create function popup_walkup(
  p_event_id uuid, p_session_id uuid, p_name text, p_party int,
  p_by text, p_force boolean default false
)
returns table (
  ok boolean, reason text, booking_id uuid, ticket_code text, places_left int
)
language plpgsql security definer set search_path = public as $$
declare
  v_ev popup_events%rowtype; v_s popup_sessions%rowtype;
  v_cap int; v_taken int; v_left int; v_code text; v_id uuid;
begin
  select e.* into v_ev from popup_events e where e.id = p_event_id;
  if not found or not v_ev.published then
    return query select false, 'not_published', null::uuid, null::text, null::int; return;
  end if;

  select s.* into v_s from popup_sessions s
    where s.id = p_session_id and s.event_id = p_event_id for update;
  if not found then
    return query select false, 'no_session', null::uuid, null::text, null::int; return;
  end if;
  -- Started is fine. Finished, past the late window, is not: putting somebody
  -- into a session that is over records an arrival that cannot have happened.
  if now() > v_s.ends_at + make_interval(mins => v_ev.admit_late_minutes) then
    return query select false, 'over', null::uuid, null::text, null::int; return;
  end if;
  if p_party < 1 or p_party > v_ev.party_max then
    return query select false, 'too_big', null::uuid, null::text, null::int; return;
  end if;

  v_cap := coalesce(v_s.cap_override, v_ev.default_cap);
  select coalesce(sum(b.party_size), 0) into v_taken
    from popup_bookings b where b.session_id = v_s.id and b.status = 'confirmed';
  v_left := greatest(v_cap - v_taken, 0);

  if p_party > v_left and not coalesce(p_force, false) then
    return query select false, 'full', null::uuid, null::text, v_left; return;
  end if;

  loop
    v_code := upper(replace(substr(gen_random_uuid()::text, 1, 9), '-', ''));
    exit when not exists (
      select 1 from popup_bookings b where b.event_id = p_event_id and b.ticket_code = v_code);
  end loop;

  insert into popup_bookings as b (
    event_id, session_id, name, party_size, status, ticket_code, lang, source,
    consent_marketing, taken_by, admitted_at, admitted_by, admitted_party
  ) values (
    p_event_id, v_s.id, btrim(p_name), p_party, 'confirmed', v_code, 'en', 'door',
    false, p_by, now(), p_by, p_party
  ) returning b.id into v_id;

  return query select true, null::text, v_id, v_code, greatest(v_left - p_party, 0);
end $$;

revoke all on function popup_walkup(uuid,uuid,text,int,text,boolean) from public;
revoke all on function popup_walkup(uuid,uuid,text,int,text,boolean) from anon;
revoke all on function popup_walkup(uuid,uuid,text,int,text,boolean) from authenticated;
grant execute on function popup_walkup(uuid,uuid,text,int,text,boolean) to service_role;

-- ═══ PART 4 · THE RUN SHEET ═══════════════════════════════════════════════
-- ⚠ `arrived` NOW COUNTS PEOPLE WHO CAME IN, NOT BOOKINGS THAT WERE TICKED.
-- It used to add the whole party_size the moment a booking was admitted, so a
-- booking for two where one turned up read as two arrivals and the evening's
-- headcount was wrong in the owner's favour. coalesce keeps rows admitted
-- before this file was run counting as the whole party, which is the only
-- thing that was recorded about them.
drop function if exists popup_runsheet(uuid);
create function popup_runsheet(p_event_id uuid)
returns table (
  session_id uuid, idx int, starts_at timestamptz, ends_at timestamptz,
  cap int, booked int, parties int, arrived int, no_show int, waiting int,
  over_by int, closed boolean, ticked int
)
language sql security definer set search_path = public stable as $$
  select
    s.id, s.idx, s.starts_at, s.ends_at,
    coalesce(s.cap_override, e.default_cap) as cap,
    coalesce(c.booked, 0)::int,
    coalesce(c.parties, 0)::int,
    coalesce(c.arrived, 0)::int,
    -- A no-show is only a no-show once the session has ended, and it is now
    -- measured in PEOPLE: booked minus the ones who actually walked in.
    case when now() > s.ends_at
         then greatest(coalesce(c.booked, 0) - coalesce(c.arrived, 0), 0)
         else 0 end::int,
    coalesce(w.waiting, 0)::int,
    greatest(coalesce(c.booked, 0) - coalesce(s.cap_override, e.default_cap), 0)::int as over_by,
    s.closed,
    coalesce(c.ticked, 0)::int
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

-- ═══ PART 5 · SHIFTING THE EVENING ════════════════════════════════════════
-- Everything still to come moves by N minutes. Doors run late; the alternative
-- is editing nine rows by hand with a queue outside.
--
-- ⚠ IT MOVES ONLY SESSIONS THAT HAVE NOT STARTED. A session already running,
-- or finished, is history — moving it would rewrite when people were admitted.
-- ⚠ AND IT REFUSES TO MOVE ANYTHING INTO THE PAST. A negative shift that would
-- start a session before now is rejected whole, not applied in part.
--
-- It RETURNS the affected bookings so the caller can email exactly the people
-- whose time changed, and nobody else.
drop function if exists popup_shift(uuid,int,text);
create function popup_shift(p_event_id uuid, p_minutes int, p_by text default null)
returns table (
  ok boolean, reason text, sessions_moved int,
  booking_id uuid, name text, email text, lang text,
  old_starts_at timestamptz, new_starts_at timestamptz, ticket_code text
)
language plpgsql security definer set search_path = public as $$
declare v_n int; v_bad int; v_ids uuid[];
begin
  if p_minutes is null or p_minutes = 0 or abs(p_minutes) > 240 then
    return query select false, 'bad_minutes', 0, null::uuid, null::text, null::text,
                        null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  -- ⚠ ONLY SESSIONS THAT HAVE NOT STARTED. A session already running, or
  -- finished, is history: moving it would rewrite when people were admitted.
  select array_agg(s.id) into v_ids from popup_sessions s
   where s.event_id = p_event_id and s.starts_at > now();

  if v_ids is null then
    return query select true, null::text, 0, null::uuid, null::text, null::text,
                        null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  -- Would any of them land in the past? Decided BEFORE a row is touched, and
  -- rejected whole rather than applied in part.
  select count(*) into v_bad from popup_sessions s
   where s.id = any(v_ids)
     and s.starts_at + make_interval(mins => p_minutes) <= now();
  if v_bad > 0 then
    return query select false, 'into_the_past', 0, null::uuid, null::text, null::text,
                        null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  -- ⚠ NO TEMP TABLE. An `on commit drop` temp table lives until the end of the
  -- surrounding TRANSACTION, not the end of the function — so calling this
  -- twice in one transaction failed with "relation already exists". The ids are
  -- captured in an array and the old time is simply the new one less the shift.
  update popup_sessions s
     set starts_at = s.starts_at + make_interval(mins => p_minutes),
         ends_at   = s.ends_at   + make_interval(mins => p_minutes)
   where s.id = any(v_ids);
  v_n := array_length(v_ids, 1);

  return query
    select true, null::text, v_n,
           b.id, b.name, b.email, b.lang,
           s.starts_at - make_interval(mins => p_minutes), s.starts_at, b.ticket_code
      from popup_sessions s
      join popup_bookings b on b.session_id = s.id
     where s.id = any(v_ids) and b.status = 'confirmed'
     order by s.starts_at, lower(b.name);

  -- Moved, but nobody was booked on any of them. Still an answer, not silence.
  if not found then
    return query select true, null::text, v_n, null::uuid, null::text, null::text,
                        null::text, null::timestamptz, null::timestamptz, null::text;
  end if;
end $$;

revoke all on function popup_shift(uuid,int,text) from public;
revoke all on function popup_shift(uuid,int,text) from anon;
revoke all on function popup_shift(uuid,int,text) from authenticated;
grant execute on function popup_shift(uuid,int,text) to service_role;

-- ═══ PART 6 · WHO IS DUE A TEN-MINUTE EMAIL ═══════════════════════════════
-- ⚠ IT NEVER RETURNS A SESSION THAT HAS ALREADY STARTED, a cancelled booking,
-- a waiting-list place, somebody already sent one, or anybody without an
-- address. "Your session starts in ten minutes" arriving at 19:25 for a 19:20
-- session is worse than not sending it.
--
-- The lead time is a SETTING on the event (reminder_lead_minutes), read here,
-- so changing it changes who is due without changing any code.
drop function if exists popup_due_reminders(uuid);
create function popup_due_reminders(p_event_id uuid)
returns table (
  booking_id uuid, name text, email text, lang text, ticket_code text,
  starts_at timestamptz, minutes_away int
)
language sql security definer set search_path = public stable as $$
  select b.id, b.name, b.email, b.lang, b.ticket_code, s.starts_at,
         (extract(epoch from (s.starts_at - now())) / 60)::int
    from popup_bookings b
    join popup_sessions s on s.id = b.session_id
    join popup_events  e on e.id = b.event_id
   where b.event_id = p_event_id
     and b.status = 'confirmed'
     and b.email is not null
     and b.reminder_sent_at is null
     and s.starts_at > now()
     and s.starts_at <= now() + make_interval(mins => e.reminder_lead_minutes)
     and not exists (select 1 from popup_unsubscribes u where u.email_key = b.email_key)
   order by s.starts_at, lower(b.name);
$$;

revoke all on function popup_due_reminders(uuid) from public;
revoke all on function popup_due_reminders(uuid) from anon;
revoke all on function popup_due_reminders(uuid) from authenticated;
grant execute on function popup_due_reminders(uuid) to service_role;

-- ═══ PART 7 · WHO IS DUE THE FOLLOW-UP ════════════════════════════════════
-- ⚠ ONLY GUESTS WHO WERE ACTUALLY ADMITTED. Not everyone who booked, not the
-- waiting list, not a no-show. `wants_more` carries the consent tick, which
-- decides WHICH of the two letters they get — never whether they get one.
drop function if exists popup_followup_due(uuid);
create function popup_followup_due(p_event_id uuid)
returns table (
  booking_id uuid, name text, email text, lang text,
  wants_more boolean, admitted_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select b.id, b.name, b.email, b.lang, b.consent_marketing, b.admitted_at
    from popup_bookings b
   where b.event_id = p_event_id
     and b.admitted_at is not null
     and b.status = 'confirmed'
     and b.email is not null
     and b.followup_sent_at is null
     and not exists (select 1 from popup_unsubscribes u where u.email_key = b.email_key)
   order by lower(b.name);
$$;

revoke all on function popup_followup_due(uuid) from public;
revoke all on function popup_followup_due(uuid) from anon;
revoke all on function popup_followup_due(uuid) from authenticated;
grant execute on function popup_followup_due(uuid) to service_role;

-- ═══ PART 8 · RECONCILING THE PAPER ═══════════════════════════════════════
-- The morning after. Somebody was ticked on a printed sheet because a phone
-- was flat, and that tick has to reach the record before the follow-up goes.
--
-- ⚠ IT IS MARKED AS A RECONCILIATION, not written in as though the door had
-- recorded it. reconciled_at and the note say where the tick came from, so the
-- night's live data and the morning's corrections can always be told apart —
-- and so an admit entered at 10am does not silently become evidence that
-- somebody was scanned at 19:04.
--
-- It can also take a tick AWAY: a sheet that shows somebody never arrived.
drop function if exists popup_reconcile(uuid,boolean,int,text,text);
create function popup_reconcile(
  p_booking_id uuid, p_arrived boolean, p_party int, p_by text, p_note text
)
returns table (ok boolean, name text, admitted_at timestamptz, admitted_party int)
language plpgsql security definer set search_path = public as $$
declare v_b popup_bookings%rowtype; v_n int;
begin
  select b.* into v_b from popup_bookings b where b.id = p_booking_id;
  if not found then return query select false, null::text, null::timestamptz, null::int; return; end if;

  if p_arrived then
    v_n := least(greatest(coalesce(p_party, v_b.party_size), 1), v_b.party_size);
    update popup_bookings b
       set admitted_at = coalesce(b.admitted_at, now()),
           admitted_by = coalesce(b.admitted_by, p_by),
           admitted_party = v_n,
           reconciled_at = now(),
           reconcile_note = nullif(btrim(coalesce(p_note, '')), '')
     where b.id = p_booking_id;
  else
    update popup_bookings b
       set admitted_at = null, admitted_party = null, admitted_offline = false,
           admitted_by = case when p_by is null then null else p_by || ' (paper: did not arrive)' end,
           reconciled_at = now(),
           reconcile_note = nullif(btrim(coalesce(p_note, '')), '')
     where b.id = p_booking_id;
  end if;

  select b.* into v_b from popup_bookings b where b.id = p_booking_id;
  return query select true, v_b.name, v_b.admitted_at, v_b.admitted_party;
end $$;

revoke all on function popup_reconcile(uuid,boolean,int,text,text) from public;
revoke all on function popup_reconcile(uuid,boolean,int,text,text) from anon;
revoke all on function popup_reconcile(uuid,boolean,int,text,text) from authenticated;
grant execute on function popup_reconcile(uuid,boolean,int,text,text) to service_role;

commit;

-- ═══ VERIFY ═══════════════════════════════════════════════════════════════
-- Outside the transaction, on a THROWAWAY event it builds and deletes. If any
-- line of this fails the file has not done what it says.
do $v$
declare
  v_ev uuid; v_s uuid; v_s2 uuid; v_r record; v_b uuid; v_code text;
  v_n int; v_ok boolean; v_cnt int;
begin
  -- 1 · the columns
  foreach v_code in array array['taken_by','admitted_party','reconciled_at','reconcile_note'] loop
    if not exists (select 1 from information_schema.columns
                    where table_name = 'popup_bookings' and column_name = v_code) then
      raise exception 'popup_bookings.% was not added', v_code;
    end if;
  end loop;

  -- 2 · nothing new is callable by anon or authenticated
  select count(*) into v_cnt from information_schema.role_routine_grants
   where routine_name in ('popup_book','popup_scan','popup_set_party','popup_unadmit',
                          'popup_doorlist','popup_runsheet','popup_shift',
                          'popup_due_reminders','popup_followup_due','popup_reconcile')
     and grantee in ('anon','authenticated');
  if v_cnt > 0 then raise exception '% grant(s) to anon/authenticated survived', v_cnt; end if;

  -- 3 · A THROWAWAY EVENING, WITH TWO SESSIONS DOING DIFFERENT JOBS:
  --   v_s  is LIVE NOW          → the door tests can actually admit somebody.
  --        (my first draft left it 30 minutes away, where admit_early_minutes
  --         made every scan 'early' and the partial-party test proved nothing.)
  --   v_s2 is 30 MINUTES AWAY   → the shift tests have something to move, and
  --        the live one must be left exactly where it is.
  insert into popup_events (slug, title_en, venue_en, event_date, first_start, last_finish,
                            session_minutes, changeover_minutes, default_cap, party_max,
                            published, admit_early_minutes, admit_late_minutes, reminder_lead_minutes)
  values ('verify-tonight-' || substr(gen_random_uuid()::text, 1, 8),
          'VERIFY — not an event', 'Verify', current_date + 1, '18:00', '18:40',
          15, 5, 4, 3, true, 10, 10, 10)
  returning id into v_ev;
  perform popup_generate_sessions(v_ev);
  select s.id into v_s  from popup_sessions s where s.event_id = v_ev order by s.idx limit 1;
  select s.id into v_s2 from popup_sessions s where s.event_id = v_ev order by s.idx offset 1 limit 1;
  update popup_sessions set starts_at = now() - interval '1 min',  ends_at = now() + interval '14 min' where id = v_s;
  update popup_sessions set starts_at = now() + interval '30 min', ends_at = now() + interval '45 min' where id = v_s2;

  -- 4 · taken_by is kept
  select * into v_r from popup_book(v_ev, v_s2, 'Later Guest', 'later@example.net', 1, 'en',
                                    false, 'verify', 'kiosk', gen_random_uuid(), false, 'Mr Si');
  if not v_r.ok then raise exception 'the later booking was refused: %', v_r.reason; end if;

  -- v_s is already running, so popup_book refuses it ('started') — which is
  -- correct and is why the door's guest is inserted directly here.
  insert into popup_bookings (event_id, session_id, name, email, email_key, party_size,
                              status, ticket_code, lang, source, consent_marketing, taken_by)
  values (v_ev, v_s, 'Verify Guest', 'verify@example.net', 'verify@example.net', 3,
          'confirmed', 'VERIFY01', 'en', 'kiosk', true, 'Miss Chau')
  returning id into v_b;
  v_code := 'VERIFY01';
  if (select b.taken_by from popup_bookings b where b.id = v_b) is distinct from 'Miss Chau' then
    raise exception 'taken_by was not kept';
  end if;

  -- 4b · A CODE THAT IS NOT ON THE LIST. ⚠ THIS TEST EXISTS BECAUSE IT CAUGHT
  --      A REAL FAULT: the not-found branches returned eleven columns against a
  --      twelve-column signature, so every unknown ticket raised "structure of
  --      query does not match function result type" instead of saying "not on
  --      tonight's list". Nothing in the happy path goes near it.
  select * into v_r from popup_scan(v_ev, 'DEADBEEF', false, 'Miss Ni');
  if v_r.state <> 'unknown' then raise exception 'an unknown code gave %, not unknown', v_r.state; end if;
  select * into v_r from popup_scan(v_ev, 'not-a-code', false, 'Miss Ni');
  if v_r.state <> 'unknown' then raise exception 'a malformed code gave %, not unknown', v_r.state; end if;

  -- 5 · a PARTIAL party: two of three
  select * into v_r from popup_scan(v_ev, v_code, true, 'Miss Ni', 2);
  if v_r.state <> 'valid' then raise exception 'the partial admit was refused: %', v_r.state; end if;
  if v_r.admitted_party <> 2 then raise exception 'admitted_party is %, not 2', v_r.admitted_party; end if;

  -- 6 · and the run sheet counts PEOPLE, not the whole party
  select r.arrived, r.booked into v_n, v_cnt from popup_runsheet(v_ev) r where r.session_id = v_s;
  if v_n <> 2 or v_cnt <> 3 then
    raise exception 'run sheet says % arrived of % booked, expected 2 of 3', v_n, v_cnt;
  end if;

  -- 7 · the third one turns up late
  select * into v_r from popup_set_party(v_b, 3, 'Miss Ni');
  select r.arrived into v_n from popup_runsheet(v_ev) r where r.session_id = v_s;
  if v_n <> 3 then raise exception 'after the correction the run sheet says %, not 3', v_n; end if;

  -- 8 · a second scan is told it is already used, and by whom
  select * into v_r from popup_scan(v_ev, v_code, true, 'Door 2');
  if v_r.state <> 'used' then raise exception 'a second scan got %, not used', v_r.state; end if;
  if v_r.admitted_by <> 'Miss Ni' then raise exception 'the record names %, not Miss Ni', v_r.admitted_by; end if;

  -- 9 · an OFFLINE admit keeps the time it actually happened, not the sync time
  perform popup_unadmit(v_b, 'Miss Ni');
  select * into v_r from popup_scan(v_ev, v_code, true, 'Miss Ni', 1,
                                    now() - interval '7 min', true);
  if v_r.state <> 'valid' then raise exception 'the queued offline admit was refused: %', v_r.state; end if;
  if (select b.admitted_at from popup_bookings b where b.id = v_b) > now() - interval '5 min' then
    raise exception 'the offline admit was stamped with the sync time, not the door time';
  end if;
  if not (select b.admitted_offline from popup_bookings b where b.id = v_b) then
    raise exception 'the offline admit was not marked as offline';
  end if;

  -- 10 · the follow-up finds the admitted guest and ONLY the admitted guest
  select count(*) into v_cnt from popup_followup_due(v_ev);
  if v_cnt <> 1 then raise exception 'followup_due returned % rows, not 1', v_cnt; end if;
  -- the 30-minute-away session is not due a ten-minute email
  select count(*) into v_cnt from popup_due_reminders(v_ev);
  if v_cnt <> 0 then raise exception 'a reminder is due for a session 30 minutes away'; end if;
  -- bring it inside the lead time and it is
  update popup_sessions set starts_at = now() + interval '6 min', ends_at = now() + interval '21 min' where id = v_s2;
  select count(*) into v_cnt from popup_due_reminders(v_ev);
  if v_cnt <> 1 then raise exception 'no reminder is due for a session six minutes away'; end if;
  -- and an unsubscribe takes them out of it
  insert into popup_unsubscribes (email_key, event_id) values ('later@example.net', v_ev);
  select count(*) into v_cnt from popup_due_reminders(v_ev);
  if v_cnt <> 0 then raise exception 'an unsubscribed guest is still due a reminder'; end if;
  delete from popup_unsubscribes where email_key = 'later@example.net';
  update popup_sessions set starts_at = now() + interval '30 min', ends_at = now() + interval '45 min' where id = v_s2;

  -- 11 · SHIFTING. It refuses the past, leaves the live session alone, and
  --      hands back exactly the guests whose time changed.
  select sh.ok into v_ok from popup_shift(v_ev, -45) sh limit 1;
  if v_ok then raise exception 'a shift that lands a session in the past was allowed'; end if;

  select sh.sessions_moved into v_n from popup_shift(v_ev, 20) sh limit 1;
  if v_n <> 1 then raise exception 'the shift moved % sessions, expected 1 (the live one must stay)', v_n; end if;
  if (select s.starts_at from popup_sessions s where s.id = v_s) > now() then
    raise exception 'the LIVE session was moved — history was rewritten';
  end if;
  if (select s.starts_at from popup_sessions s where s.id = v_s2) < now() + interval '49 min' then
    raise exception 'the later session did not actually move';
  end if;

  -- 11b · A WALK-UP goes straight in, on a session that has already started.
  --       popup_book would refuse this session outright ('started'), which is
  --       the whole reason walk-ups have a function of their own.
  select * into v_r from popup_book(v_ev, v_s, 'Should Be Refused', null, 1, 'en', false,
                                    'verify', 'kiosk', gen_random_uuid(), false, 'Mr Si');
  if v_r.ok or v_r.reason <> 'started' then
    raise exception 'popup_book accepted a started session (got ok=%, reason=%)', v_r.ok, v_r.reason;
  end if;
  select * into v_r from popup_walkup(v_ev, v_s, 'Walk Up', 1, 'Miss Ni');
  if not v_r.ok then raise exception 'the walk-up was refused: %', v_r.reason; end if;
  if (select b.admitted_at from popup_bookings b where b.ticket_code = v_r.ticket_code) is null then
    raise exception 'a walk-up was created but not admitted';
  end if;
  if (select b.source from popup_bookings b where b.ticket_code = v_r.ticket_code) <> 'door' then
    raise exception 'a walk-up is not recorded as having come from the door';
  end if;
  -- and the cap is still the cap: 3 + 1 of 4 taken, so a party of 2 will not fit
  select * into v_r from popup_walkup(v_ev, v_s, 'One Too Many', 2, 'Miss Ni');
  if v_r.ok or v_r.reason <> 'full' then
    raise exception 'a walk-up was let in over the cap without being forced (%)', v_r.reason;
  end if;
  select * into v_r from popup_walkup(v_ev, v_s, 'Forced In', 2, 'Owner', true);
  if not v_r.ok then raise exception 'a forced walk-up was still refused: %', v_r.reason; end if;
  select r.over_by into v_n from popup_runsheet(v_ev) r where r.session_id = v_s;
  if v_n <> 2 then raise exception 'the run sheet says over_by %, expected 2', v_n; end if;

  -- 12 · reconciliation says where the tick came from
  select * into v_r from popup_reconcile(v_b, false, null, 'Owner', 'paper sheet: never arrived');
  if (select b.admitted_at from popup_bookings b where b.id = v_b) is not null then
    raise exception 'reconcile did not take the admit away';
  end if;
  if (select b.reconciled_at from popup_bookings b where b.id = v_b) is null then
    raise exception 'reconcile did not record that it was a reconciliation';
  end if;
  select * into v_r from popup_reconcile(v_b, true, 2, 'Owner', 'paper sheet: two came in');
  if (select b.admitted_party from popup_bookings b where b.id = v_b) <> 2 then
    raise exception 'reconcile did not record how many came in';
  end if;

  delete from popup_events where id = v_ev;
  if exists (select 1 from popup_events e where e.id = v_ev) then
    raise exception 'the verify event was not removed';
  end if;

  raise notice 'popup_tonight: columns ✓ · grants ✓ · taken_by ✓ · an unknown code answers instead of erroring ✓ · partial party ✓ · run sheet counts people ✓ · late arrival ✓ · second scan refused ✓ · offline keeps the door time ✓ · follow-up ✓ · reminder window + unsubscribe ✓ · shift guards the past and the live session ✓ · walk-up admits on a started session and respects the cap ✓ · reconcile ✓ · fixture removed ✓';
end $v$;
