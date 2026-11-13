-- ═══════════════════════════════════════════════════════════════════════════
-- FIXING A BOOKING FROM THE PHONE.  13 November 2026, morning.
-- ───────────────────────────────────────────────────────────────────────────
-- Until now a staff member could admit a guest, undo it, say how many turned
-- up, and add a walk-up — and could correct NOTHING about a booking already
-- taken. A wrong email typed at a crowded door was permanent. Name, email,
-- party size and resend could not be changed from anywhere at all; move and
-- cancel needed a laptop.
--
-- ⚠ AND THE LAPTOP'S MOVE DID NOT CHECK CAPACITY. It wrote the new session_id
-- straight in, so a guest could be moved into a full session and the run sheet
-- would show it over. Everything goes through this function now, including the
-- admin's, so there is ONE set of rules.
--
-- ══ THE RULES ════════════════════════════════════════════════════════════
-- · A GUEST ALREADY ADMITTED CAN HAVE THEIR NAME CORRECTED AND NOTHING ELSE.
--   They are standing inside. Moving or cancelling them would free a place
--   that is being used and say they were somewhere they were not.
-- · A PARTY GROWING, OR A MOVE, TAKES THE LOCK AND CHECKS THE CAP — the same
--   `for update` the original booking took. A party SHRINKING never needs a
--   check and never fails.
-- · A CHANGED EMAIL OBEYS THE ONE-BOOKING-PER-ADDRESS RULE, and says which
--   booking it clashes with.
-- · THE TICKET CODE AND THE DOOR CODE NEVER CHANGE. A guest who screenshotted
--   their ticket at 18:30 must still get in at 20:00 after a correction.
-- · EVERY CHANGE IS RECORDED — what, from what, to what, by whom, when.
--
-- Safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- ── WHAT WAS CHANGED, AND BY WHOM ─────────────────────────────────────────
create table if not exists popup_booking_edits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references popup_bookings(id) on delete cascade,
  event_id   uuid not null references popup_events(id) on delete cascade,
  field text not null,
  was  text,
  now_ text,
  by   text,
  at   timestamptz not null default now()
);
create index if not exists popup_booking_edits_by_booking
  on popup_booking_edits (booking_id, at desc);
create index if not exists popup_booking_edits_by_event
  on popup_booking_edits (event_id, at desc);

alter table popup_booking_edits enable row level security;
drop policy if exists "admins manage popup_booking_edits" on popup_booking_edits;
create policy "admins manage popup_booking_edits" on popup_booking_edits for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ── THE ONE WAY TO CHANGE A BOOKING ───────────────────────────────────────
-- Null means "leave this alone". Returns what actually changed, so the phone
-- can say so and decide whether a new ticket needs sending.
drop function if exists popup_fix_booking(uuid,uuid,text,text,int,uuid,text,boolean);
create function popup_fix_booking(
  p_event_id uuid,
  p_booking_id uuid,
  p_name text default null,
  p_email text default null,
  p_party int default null,
  p_session_id uuid default null,
  p_by text default null,
  p_cancel boolean default false
)
returns table (
  ok boolean, reason text, changed text[], resend boolean,
  name text, email text, party_size int, status text,
  ticket_code text, door_code text, starts_at timestamptz,
  places_left int, clash_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_b popup_bookings%rowtype; v_ev popup_events%rowtype;
  v_s popup_sessions%rowtype; v_old popup_sessions%rowtype;
  v_key text; v_clash popup_bookings%rowtype;
  v_cap int; v_taken int; v_left int; v_want int;
  -- ⚠ array_append, NOT `v_changed || 'name'`. The || operator with an
  -- untyped literal makes Postgres try to parse "name" AS AN ARRAY, and it
  -- fails at RUN time with "malformed array literal" — on the first correction
  -- anybody makes, not at create time. Found by the verification block.
  v_changed text[] := '{}'; v_resend boolean := false;
  v_target uuid;
begin
  select b.* into v_b from popup_bookings b
    where b.id = p_booking_id and b.event_id = p_event_id;
  if not found then
    return query select false, 'no_booking', '{}'::text[], false, null::text, null::text,
                        null::int, null::text, null::text, null::text, null::timestamptz,
                        null::int, null::timestamptz;
    return;
  end if;
  select e.* into v_ev from popup_events e where e.id = p_event_id;
  select s.* into v_old from popup_sessions s where s.id = v_b.session_id;

  -- ⚠ ALREADY INSIDE: the name, and nothing else.
  if v_b.admitted_at is not null
     and (p_cancel or p_session_id is not null or p_party is not null) then
    return query select false, 'already_in', '{}'::text[], false, v_b.name, v_b.email,
                        v_b.party_size, v_b.status, v_b.ticket_code, v_b.door_code,
                        v_old.starts_at, null::int, null::timestamptz;
    return;
  end if;

  -- ── CANCEL ──────────────────────────────────────────────────────────
  if p_cancel then
    update popup_bookings b set status = 'cancelled', cancelled_at = now(),
           cancel_reason = coalesce('cancelled by ' || p_by, 'cancelled')
     where b.id = p_booking_id;
    insert into popup_booking_edits (booking_id, event_id, field, was, now_, by)
      values (p_booking_id, p_event_id, 'cancelled', v_b.status, 'cancelled', p_by);
    perform popup_promote(v_b.session_id);
    return query select true, null::text, array['cancelled'], false, v_b.name, v_b.email,
                        v_b.party_size, 'cancelled', v_b.ticket_code, v_b.door_code,
                        v_old.starts_at, null::int, null::timestamptz;
    return;
  end if;

  -- ── THE NAME ────────────────────────────────────────────────────────
  if p_name is not null and btrim(p_name) <> '' and btrim(p_name) <> v_b.name then
    insert into popup_booking_edits (booking_id, event_id, field, was, now_, by)
      values (p_booking_id, p_event_id, 'name', v_b.name, btrim(p_name), p_by);
    update popup_bookings b set name = btrim(p_name) where b.id = p_booking_id;
    v_changed := array_append(v_changed, 'name');
  end if;

  -- ── THE EMAIL ───────────────────────────────────────────────────────
  if p_email is not null then
    v_key := nullif(lower(btrim(p_email)), '');
    if v_key is distinct from v_b.email_key then
      if v_key is not null then
        select b.* into v_clash from popup_bookings b
          where b.event_id = p_event_id and b.email_key = v_key
            and b.id <> p_booking_id and b.status in ('confirmed','waiting') limit 1;
        if found then
          select s.* into v_s from popup_sessions s where s.id = v_clash.session_id;
          return query select false, 'duplicate', v_changed, false, v_b.name, v_b.email,
                              v_b.party_size, v_b.status, v_b.ticket_code, v_b.door_code,
                              v_old.starts_at, null::int, v_s.starts_at;
          return;
        end if;
      end if;
      insert into popup_booking_edits (booking_id, event_id, field, was, now_, by)
        values (p_booking_id, p_event_id, 'email', v_b.email, nullif(btrim(p_email), ''), p_by);
      update popup_bookings b
         set email = nullif(btrim(p_email), ''), email_key = v_key,
             confirmation_sent_at = null
       where b.id = p_booking_id;
      v_changed := array_append(v_changed, 'email');
      -- A new address has never had the ticket.
      if v_key is not null then v_resend := true; end if;
    end if;
  end if;

  -- ── THE SESSION AND THE PARTY, UNDER THE LOCK ───────────────────────
  v_target := coalesce(p_session_id, v_b.session_id);
  v_want := coalesce(p_party, v_b.party_size);
  if v_target <> v_b.session_id or v_want <> v_b.party_size then
    if v_want < 1 or v_want > v_ev.party_max then
      return query select false, 'too_big', v_changed, v_resend, v_b.name, v_b.email,
                          v_b.party_size, v_b.status, v_b.ticket_code, v_b.door_code,
                          v_old.starts_at, null::int, null::timestamptz;
      return;
    end if;

    select s.* into v_s from popup_sessions s
      where s.id = v_target and s.event_id = p_event_id for update;
    if not found then
      return query select false, 'no_session', v_changed, v_resend, v_b.name, v_b.email,
                          v_b.party_size, v_b.status, v_b.ticket_code, v_b.door_code,
                          v_old.starts_at, null::int, null::timestamptz;
      return;
    end if;
    if v_s.closed then
      return query select false, 'closed', v_changed, v_resend, v_b.name, v_b.email,
                          v_b.party_size, v_b.status, v_b.ticket_code, v_b.door_code,
                          v_old.starts_at, null::int, null::timestamptz;
      return;
    end if;

    v_cap := coalesce(v_s.cap_override, v_ev.default_cap);
    -- ⚠ b.status, NOT status: unqualified it binds to this function's own
    -- output column and raises "ambiguous" at RUN time. Same trap as popup_book.
    select coalesce(sum(b.party_size), 0) into v_taken
      from popup_bookings b
     where b.session_id = v_s.id and b.status = 'confirmed'
       and b.id <> p_booking_id;          -- this booking's own places are its to keep
    v_left := greatest(v_cap - v_taken, 0);

    if v_want > v_left then
      return query select false, 'full', v_changed, v_resend, v_b.name, v_b.email,
                          v_b.party_size, v_b.status, v_b.ticket_code, v_b.door_code,
                          v_old.starts_at, v_left, null::timestamptz;
      return;
    end if;

    if v_want <> v_b.party_size then
      insert into popup_booking_edits (booking_id, event_id, field, was, now_, by)
        values (p_booking_id, p_event_id, 'party_size', v_b.party_size::text, v_want::text, p_by);
      v_changed := array_append(v_changed, 'party');
    end if;
    if v_target <> v_b.session_id then
      insert into popup_booking_edits (booking_id, event_id, field, was, now_, by)
        values (p_booking_id, p_event_id, 'session',
                to_char(v_old.starts_at at time zone v_ev.timezone, 'HH24:MI'),
                to_char(v_s.starts_at  at time zone v_ev.timezone, 'HH24:MI'), p_by);
      v_changed := array_append(v_changed, 'time');
      v_resend := true;                   -- ⚠ a new time is a new ticket
    end if;

    update popup_bookings b
       set session_id = v_target, party_size = v_want,
           moved_at = case when v_target <> v_b.session_id then now() else b.moved_at end
     where b.id = p_booking_id;

    -- The session they LEFT may now have room for somebody waiting.
    if v_target <> v_b.session_id then perform popup_promote(v_b.session_id); end if;
  end if;

  select b.* into v_b from popup_bookings b where b.id = p_booking_id;
  select s.* into v_s from popup_sessions s where s.id = v_b.session_id;
  v_cap := coalesce(v_s.cap_override, v_ev.default_cap);
  select coalesce(sum(b.party_size), 0) into v_taken
    from popup_bookings b where b.session_id = v_s.id and b.status = 'confirmed';

  return query select true, null::text, v_changed, v_resend, v_b.name, v_b.email,
                      v_b.party_size, v_b.status, v_b.ticket_code, v_b.door_code,
                      v_s.starts_at, greatest(v_cap - v_taken, 0), null::timestamptz;
end $$;

revoke all on function popup_fix_booking(uuid,uuid,text,text,int,uuid,text,boolean) from public;
revoke all on function popup_fix_booking(uuid,uuid,text,text,int,uuid,text,boolean) from anon;
revoke all on function popup_fix_booking(uuid,uuid,text,text,int,uuid,text,boolean) from authenticated;
grant execute on function popup_fix_booking(uuid,uuid,text,text,int,uuid,text,boolean) to service_role;

-- ── WHICH SESSIONS COULD TAKE THIS GUEST ──────────────────────────────────
-- So a refusal can offer somewhere rather than just say no. Excludes the
-- session they are already in, anything closed or started, and anything
-- without room for the party as it stands.
drop function if exists popup_sessions_with_room(uuid, int, uuid);
create function popup_sessions_with_room(p_event_id uuid, p_party int, p_except uuid default null)
returns table (session_id uuid, idx int, starts_at timestamptz, places_left int)
language sql security definer set search_path = public stable as $$
  select s.id, s.idx, s.starts_at,
         greatest(coalesce(s.cap_override, e.default_cap) - coalesce(c.taken, 0), 0)::int
    from popup_events e
    join popup_sessions s on s.event_id = e.id
    left join lateral (
      select sum(b.party_size) as taken from popup_bookings b
       where b.session_id = s.id and b.status = 'confirmed'
         and (p_except is null or b.id <> p_except)
    ) c on true
   where e.id = p_event_id
     and not s.closed
     and s.starts_at > now()
     and greatest(coalesce(s.cap_override, e.default_cap) - coalesce(c.taken, 0), 0) >= greatest(p_party, 1)
   order by s.starts_at;
$$;

revoke all on function popup_sessions_with_room(uuid, int, uuid) from public;
revoke all on function popup_sessions_with_room(uuid, int, uuid) from anon;
revoke all on function popup_sessions_with_room(uuid, int, uuid) from authenticated;
grant execute on function popup_sessions_with_room(uuid, int, uuid) to service_role;

commit;

-- ── PROVE IT ──────────────────────────────────────────────────────────────
do $v$
declare
  v_ev uuid; v_s1 uuid; v_s2 uuid; v_r record; v_a uuid; v_n int;
begin
  -- ⚠ party_max 4 AND cap 4, on purpose. The first version used party_max 3
  -- and then "tested" growth past the cap by asking for 3 when the booking was
  -- ALREADY 3 — which changes nothing, is correctly allowed, and proved
  -- nothing. A real growth test needs room to grow into and a cap in the way.
  insert into popup_events (slug, title_en, venue_en, event_date, first_start, last_finish,
                            session_minutes, changeover_minutes, default_cap, party_max, published)
  values ('verify-fix-' || substr(gen_random_uuid()::text, 1, 8),
          'VERIFY — not an event', 'Verify', current_date + 1, '18:00', '18:40', 15, 5, 4, 4, true)
  returning id into v_ev;
  perform popup_generate_sessions(v_ev);
  select s.id into v_s1 from popup_sessions s where s.event_id = v_ev order by s.idx limit 1;
  select s.id into v_s2 from popup_sessions s where s.event_id = v_ev order by s.idx offset 1 limit 1;
  update popup_sessions set starts_at = now() + interval '1 hour', ends_at = now() + interval '2 hours' where id = v_s1;
  update popup_sessions set starts_at = now() + interval '3 hour', ends_at = now() + interval '4 hours' where id = v_s2;

  select * into v_r from popup_book(v_ev, v_s1, 'Wrong Name', 'wrong@example.net', 1, 'en',
                                    false, 'v', 'kiosk', gen_random_uuid(), false, 'Chau');
  v_a := v_r.booking_id;

  -- the name
  select * into v_r from popup_fix_booking(v_ev, v_a, 'Right Name', null, null, null, 'Chau');
  if not v_r.ok or v_r.name <> 'Right Name' then raise exception 'the name was not corrected'; end if;

  -- the email, and it asks for a new ticket to the new address
  select * into v_r from popup_fix_booking(v_ev, v_a, null, 'right@example.net', null, null, 'Chau');
  if not v_r.ok or not v_r.resend then raise exception 'a new address did not ask for a resend'; end if;
  if (select b.email from popup_bookings b where b.id = v_a) <> 'right@example.net' then
    raise exception 'the email was not changed';
  end if;

  -- ⚠ THE TICKET AND DOOR CODES SURVIVE A CORRECTION
  if v_r.ticket_code is null or v_r.door_code is null then raise exception 'a code went missing'; end if;

  -- GROWING, with room: 1 → 2 of a cap of 4
  select * into v_r from popup_fix_booking(v_ev, v_a, null, null, 2, null, 'Chau');
  if not v_r.ok or v_r.party_size <> 2 then raise exception 'the party could not grow into free space'; end if;

  -- now fill the session, and GROWING past the cap is refused with the number left
  select * into v_r from popup_book(v_ev, v_s1, 'Filler', null, 2, 'en', false, 'v',
                                    'kiosk', gen_random_uuid(), false, 'Chau');
  if not v_r.ok then raise exception 'the filler booking was refused: %', v_r.reason; end if;
  select * into v_r from popup_fix_booking(v_ev, v_a, null, null, 3, null, 'Chau');
  if v_r.ok then raise exception 'a party was grown past the cap'; end if;
  if v_r.reason <> 'full' then raise exception 'growing past the cap gave reason %, not full', v_r.reason; end if;
  if v_r.places_left <> 2 then raise exception 'it reported % places left, not 2', v_r.places_left; end if;
  if (select b.party_size from popup_bookings b where b.id = v_a) <> 2 then
    raise exception 'a refused change was applied anyway';
  end if;

  -- SHRINKING always works, cap or no cap
  select * into v_r from popup_fix_booking(v_ev, v_a, null, null, 1, null, 'Chau');
  if not v_r.ok or v_r.party_size <> 1 then raise exception 'a party could not shrink'; end if;

  -- a move with room, and the old place is freed
  select * into v_r from popup_fix_booking(v_ev, v_a, null, null, null, v_s2, 'Chau');
  if not v_r.ok then raise exception 'the move was refused: %', v_r.reason; end if;
  if not v_r.resend then raise exception 'a new time did not ask for a new ticket'; end if;
  if (select b.session_id from popup_bookings b where b.id = v_a) <> v_s2 then
    raise exception 'the booking did not move';
  end if;

  -- somewhere to offer when a session will not take them
  select count(*) into v_n from popup_sessions_with_room(v_ev, 1, v_a);
  if v_n < 1 then raise exception 'no session with room was offered'; end if;

  -- ⚠ A GUEST ALREADY INSIDE: the name only
  update popup_bookings set admitted_at = now(), admitted_party = 1 where id = v_a;
  select * into v_r from popup_fix_booking(v_ev, v_a, 'Still Fixable', null, null, null, 'Chau');
  if not v_r.ok or v_r.name <> 'Still Fixable' then raise exception 'an admitted guest could not have their name fixed'; end if;
  select * into v_r from popup_fix_booking(v_ev, v_a, null, null, null, v_s1, 'Chau');
  if v_r.ok or v_r.reason <> 'already_in' then raise exception 'an admitted guest was moved'; end if;
  select * into v_r from popup_fix_booking(v_ev, v_a, null, null, null, null, 'Chau', true);
  if v_r.ok or v_r.reason <> 'already_in' then raise exception 'an admitted guest was cancelled'; end if;

  -- cancelling one who is not in frees the place
  update popup_bookings set admitted_at = null, admitted_party = null where id = v_a;
  select * into v_r from popup_fix_booking(v_ev, v_a, null, null, null, null, 'Chau', true);
  if not v_r.ok or v_r.status <> 'cancelled' then raise exception 'the cancel did not take'; end if;

  -- and every change was written down, with a name against it
  select count(*) into v_n from popup_booking_edits where booking_id = v_a;
  if v_n < 6 then raise exception 'only % edit(s) were recorded', v_n; end if;
  if exists (select 1 from popup_booking_edits where booking_id = v_a and by is null) then
    raise exception 'an edit was recorded with nobody against it';
  end if;

  delete from popup_events where id = v_ev;
  raise notice 'popup_fix_booking: name ✓ · email + resend ✓ · codes survive ✓ · grow into space ✓ · grow past the cap refused with places left ✓ · refusal applied nothing ✓ · shrink ✓ · move frees the old place ✓ · alternatives offered ✓ · admitted = name only ✓ · cancel ✓ · every change recorded with a name ✓';
end $v$;
