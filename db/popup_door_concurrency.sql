-- ═══════════════════════════════════════════════════════════════════════════
-- TWO FIXES AND THE DOOR — run this after db/popup_timed_entry.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Safe to run more than once: it replaces functions and touches no data.
--
-- ══ FIX 1 · popup_book WAS BROKEN FOR EVERY BOOKING ═══════════════════════
--   ERROR: column reference "status" is ambiguous
--
-- `returns table (... status text, session_id uuid, ticket_code text ...)`
-- declares those names as OUTPUT PARAMETERS. The body then wrote
--
--     where session_id = v_s.id and status = 'confirmed'
--
-- and Postgres cannot tell whether `status` means the column or the output
-- parameter, so it refuses — at RUN time, not at CREATE time, which is why the
-- file installed cleanly and would have failed in front of the first guest.
-- Every column reference is now qualified with a table alias.
--
-- Found by scripts/verify-popup.mjs on its first run. It could not have been
-- found by reading the file, and it could not have been found by using the
-- tablet carefully — only by actually booking.
--
-- ══ FIX 2 · THE SAME TRAP IN popup_scan, BEFORE IT BIT ════════════════════
-- popup_scan declares `admitted_at` and `admitted_by` as outputs and then used
-- both as column references. Identical fault, not yet triggered.
--
-- ══ AND THE DOOR, WITH SEVERAL PEOPLE ON IT ═══════════════════════════════
-- popup_scan read the booking, saw admitted_at was null, then updated it
-- unconditionally. With one person on the door that is correct. With Miss Ni
-- and three colleagues it is a race:
--
--   Ni's phone      reads admitted_at = null
--   Second phone    reads admitted_at = null      ← same instant
--   Ni's phone      writes admitted_at, admitted_by = 'Ni'
--   Second phone    writes admitted_at, admitted_by = someone else
--
-- Both are told "valid", both believe they admitted the guest, and the record
-- names whoever wrote second. The test moves INTO the update — `and
-- admitted_at is null` — which Postgres evaluates under its own row lock, so
-- exactly one of any number of simultaneous scans can match. No explicit lock,
-- no retry, and it stays correct whether two phones are a millisecond apart or
-- two offline phones sync an hour later.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ═══ FIX 1 · TAKING A PLACE ═══════════════════════════════════════════════
drop function if exists popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean);
create function popup_book(
  p_event_id uuid,
  p_session_id uuid,
  p_name text,
  p_email text,
  p_party int,
  p_lang text,
  p_consent boolean,
  p_terms text,
  p_source text,
  p_attempt uuid,
  p_allow_waiting boolean default false
)
returns table (
  ok boolean, reason text, booking_id uuid, status text, ticket_code text,
  session_id uuid, starts_at timestamptz, places_left int
)
language plpgsql security definer set search_path = public as $$
declare
  v_ev popup_events%rowtype;
  v_s  popup_sessions%rowtype;
  v_cap int; v_taken int; v_left int;
  v_key text; v_code text; v_id uuid; v_status text;
  v_clash popup_bookings%rowtype;
  v_prev popup_bookings%rowtype;
begin
  v_key := nullif(lower(btrim(coalesce(p_email, ''))), '');

  -- ── 0 · HAVE WE ALREADY ANSWERED THIS EXACT ATTEMPT? ──────────────────
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
  select coalesce(sum(b.party_size), 0) into v_taken
    from popup_bookings b where b.session_id = v_s.id and b.status = 'confirmed';
  v_left := greatest(v_cap - v_taken, 0);

  -- A party must FIT. One place left and a party of two is not a booking.
  if p_party > v_left then
    -- ⚠ REFUSED, NOT QUIETLY WAITLISTED. Three tablets reaching for the last
    -- place is the likeliest thing this evening will produce, and the two who
    -- lose must be TOLD. The waiting list is a button they press next.
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
    attempt_id, lang, source, consent_marketing, terms_text, waiting_since
  ) values (
    p_event_id, v_s.id, btrim(p_name), nullif(btrim(coalesce(p_email,'')),''), v_key,
    p_party, v_status, v_code, p_attempt, coalesce(p_lang,'en'), coalesce(p_source,'kiosk'),
    coalesce(p_consent,false), p_terms,
    case when v_status = 'waiting' then now() else null end
  ) returning b.id into v_id;

  return query select true, null::text, v_id, v_status, v_code, v_s.id, v_s.starts_at,
                      greatest(v_left - case when v_status='confirmed' then p_party else 0 end, 0);
end $$;

revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) from public;
revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) from anon;
revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) from authenticated;
grant execute on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) to service_role;

-- ═══ FIX 2 + THE DOOR ═════════════════════════════════════════════════════
drop function if exists popup_scan(uuid,text,boolean,text);
create function popup_scan(p_event_id uuid, p_code text, p_admit boolean, p_by text)
returns table (
  state text, booking_id uuid, name text, party_size int, status text,
  starts_at timestamptz, ends_at timestamptz, admitted_at timestamptz,
  admitted_by text, session_idx int
)
language plpgsql security definer set search_path = public as $$
declare
  v_b popup_bookings%rowtype;
  v_s popup_sessions%rowtype;
  v_ev popup_events%rowtype;
  v_state text;
  v_admitted timestamptz;
  v_by text;
  v_rows int;
  v_clean text;
begin
  v_clean := upper(btrim(p_code));
  select e.* into v_ev from popup_events e where e.id = p_event_id;
  select b.* into v_b from popup_bookings b
    where b.event_id = p_event_id and b.ticket_code = v_clean;

  if not found then
    -- A real code from ANOTHER event is worth naming: on the night, a
    -- rehearsal ticket still in somebody's inbox is the likeliest cause.
    if exists (select 1 from popup_bookings b2 where b2.ticket_code = v_clean) then
      return query select 'wrong_event', null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::text, null::int;
    else
      return query select 'unknown', null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::text, null::int;
    end if;
    return;
  end if;

  select s.* into v_s from popup_sessions s where s.id = v_b.session_id;
  v_admitted := v_b.admitted_at;
  v_by := v_b.admitted_by;

  if v_b.status = 'cancelled' then v_state := 'cancelled';
  elsif v_b.status = 'waiting' then v_state := 'waiting';
  elsif v_admitted is not null then v_state := 'used';
  elsif now() < v_s.starts_at - make_interval(mins => v_ev.admit_early_minutes) then v_state := 'early';
  elsif now() > v_s.ends_at + make_interval(mins => v_ev.admit_late_minutes) then v_state := 'late';
  else v_state := 'valid';
  end if;

  -- ── THE ATOMIC ADMIT ──────────────────────────────────────────────────
  if p_admit and v_admitted is null and v_b.status = 'confirmed'
     and (v_state = 'valid' or (v_state = 'late' and v_ev.allow_late_move)) then

    update popup_bookings b
       set admitted_at = now(), admitted_by = p_by
     where b.id = v_b.id and b.admitted_at is null;
    get diagnostics v_rows = row_count;

    if v_rows = 1 then
      v_admitted := now();
      v_by := p_by;
      v_state := 'valid';
    else
      -- Somebody else got there first, in the same breath. Read back who, so
      -- the screen says "already admitted by Ni at 19:04" rather than a bare
      -- refusal that looks like a fault.
      select b.admitted_at, b.admitted_by into v_admitted, v_by
        from popup_bookings b where b.id = v_b.id;
      v_state := 'used';
    end if;
  end if;

  return query select v_state, v_b.id, v_b.name, v_b.party_size, v_b.status,
                      v_s.starts_at, v_s.ends_at, v_admitted, v_by, v_s.idx;
end $$;

revoke all on function popup_scan(uuid,text,boolean,text) from public;
revoke all on function popup_scan(uuid,text,boolean,text) from anon;
revoke all on function popup_scan(uuid,text,boolean,text) from authenticated;
grant execute on function popup_scan(uuid,text,boolean,text) to service_role;

-- ═══ UNDOING AN ADMIT ═════════════════════════════════════════════════════
-- A door with four people on it will tick the wrong row sooner or later — two
-- guests with the same first name, a phone handed over mid-scan. Without an
-- undo the only remedy is the admin, which nobody opens with a queue in front
-- of them. It records who undid it, so the history reads honestly.
drop function if exists popup_unadmit(uuid,text);
create function popup_unadmit(p_booking_id uuid, p_by text)
returns table (ok boolean, name text)
language plpgsql security definer set search_path = public as $$
declare v_rows int; v_name text;
begin
  update popup_bookings b
     set admitted_at = null,
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

-- ═══ THE DOOR LIST, FOR EVERY PHONE AT ONCE ═══════════════════════════════
-- What each phone polls, what gets cached for the offline case, and what the
-- printable list is built from. ONE shape, three uses: a phone that has been
-- offline for ten minutes catches up by reading it again, with no merge logic
-- to get clever about and get wrong.
--
-- The whole evening is about a hundred rows at a cap of twelve, so there is no
-- paging and no "changes since" bookkeeping — every phone reads the truth
-- every few seconds and redraws.
drop function if exists popup_doorlist(uuid);
create function popup_doorlist(p_event_id uuid)
returns table (
  booking_id uuid, ticket_code text, name text, party_size int, status text,
  session_idx int, starts_at timestamptz, ends_at timestamptz,
  admitted_at timestamptz, admitted_by text, has_email boolean
)
language sql security definer set search_path = public stable as $$
  select b.id, b.ticket_code, b.name, b.party_size, b.status,
         s.idx, s.starts_at, s.ends_at, b.admitted_at, b.admitted_by,
         b.email is not null
    from popup_bookings b
    join popup_sessions s on s.id = b.session_id
   where b.event_id = p_event_id and b.status in ('confirmed','waiting')
   order by s.starts_at, lower(b.name);
$$;

revoke all on function popup_doorlist(uuid) from public;
revoke all on function popup_doorlist(uuid) from anon;
revoke all on function popup_doorlist(uuid) from authenticated;
grant execute on function popup_doorlist(uuid) to service_role;

commit;

-- ═══ VERIFY ═══════════════════════════════════════════════════════════════
-- Then run:  node scripts/verify-popup.mjs
-- It builds a throwaway event, fires three bookings at one place and four
-- scans at one ticket, and deletes it again. That is the proof, not this file.
