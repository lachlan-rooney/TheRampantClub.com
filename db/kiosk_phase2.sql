-- ═══════════════════════════════════════════════════════════════════════════
-- KIOSK PHASE 2 — three modes on one enrolled tablet  ·  REVIEW, then run
-- ───────────────────────────────────────────────────────────────────────────
-- Phase 1 established TWO layers. Phase 2 adds a THIRD, and a MODE on top:
--
--   LAYER 1 — DEVICE SESSION (Phase 1) = the tablet is enrolled and revocable.
--             Still the outer boundary. Unchanged.
--   LAYER 2 — STAFF PIN (Phase 1) = attribution. Unchanged.
--   LAYER 3 — MEMBER SESSION (NEW) = a real ACCESS boundary. A 6-digit member
--             PIN mints a short-lived, device-bound, non-refreshable session
--             that makes the tablet act AS THAT MEMBER against the member-own
--             RLS already proven in S0–S2d. The kiosk does not get a new member
--             data surface; it gets a member IDENTITY.
--
--   MODE = board | staff | member. Derived SERVER-SIDE from which cookies are
--          live — never from the URL. BOARD is the idle default and the only
--          route into either of the other two.
--
-- WHY THE SESSION TOKEN IS OPAQUE: the token stored on the tablet is a random
-- 32-byte string, NOT a JWT. Only its hash is stored here. The app exchanges it
-- server-side for a 60-second minted member JWT that NEVER reaches the browser.
-- A token lifted off the tablet is useless: it is bound to the device row, dies
-- with the device, and cannot be refreshed.
--
-- Nothing here weakens Phase 1 or the public display kiosk / NFC tap.
-- Additive + idempotent. Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ═══ PART 1 · THE ROOM ═════════════════════════════════════════════════════
-- A tablet knows where it stands. The string MUST match bookings.space /
-- calendar_entries.space exactly, or the board joins nothing — so the admin
-- enrol UI picks from `select distinct space from space_tables`, never free text.
alter table kiosk_devices add column if not exists room text;
comment on column kiosk_devices.room is
  'Room this tablet stands in. Must match bookings.space / calendar_entries.space exactly.';
create index if not exists idx_kiosk_devices_room on kiosk_devices(room) where revoked_at is null;


-- ═══ PART 2 · MEMBER PIN STORAGE ═══════════════════════════════════════════
-- 6 digits, bcrypt-hashed, never plaintext. RLS is enabled with NO POLICIES:
-- nothing reachable by anon or authenticated can read this table at all. Every
-- access goes through the SECURITY DEFINER functions below (Phase 1's rule).
create table if not exists member_kiosk_pins (
  member_no   varchar(12) primary key references members(member_no) on delete cascade,
  pin_hash    text not null,
  set_at      timestamptz not null default now(),
  set_by      uuid references profiles(id),
  must_change boolean not null default false   -- admin re-issued a temporary PIN
);
alter table member_kiosk_pins enable row level security;
-- (deliberately no policies — definer functions only)

-- Attempt log. NOTE: member_no is intentionally NOT a foreign key. An attempt
-- against a membership number that does not exist MUST still be recorded, or
-- the lockout counter itself becomes an oracle for which numbers are live.
create table if not exists member_pin_attempts (
  id         uuid primary key default gen_random_uuid(),
  member_no  varchar(12) not null,
  device_id  uuid references kiosk_devices(id) on delete set null,
  ok         boolean not null,
  at         timestamptz not null default now(),
  cleared_at timestamptz                       -- admin cleared a lockout; row kept for history
);
create index if not exists idx_member_pin_attempts
  on member_pin_attempts(member_no, at desc) where cleared_at is null;
alter table member_pin_attempts enable row level security;
-- (deliberately no policies — definer functions only)


-- ═══ PART 3 · THE MEMBER SESSION ═══════════════════════════════════════════
create table if not exists kiosk_member_sessions (
  id           uuid primary key default gen_random_uuid(),
  device_id    uuid        not null references kiosk_devices(id) on delete cascade,
  member_no    varchar(12) not null references members(member_no) on delete cascade,
  profile_id   uuid        not null references profiles(id) on delete cascade,
  token_hash   text        not null unique,     -- sha256(opaque session token)
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,            -- HARD ttl, never extended
  last_seen_at timestamptz not null default now(),  -- the idle clock
  ended_at     timestamptz,
  ended_reason text check (ended_reason in
                ('done','idle','ttl','device_revoked','staff_reclaim','superseded'))
);
create index if not exists idx_kms_live on kiosk_member_sessions(device_id) where ended_at is null;
create index if not exists idx_kms_member on kiosk_member_sessions(member_no, created_at desc);
alter table kiosk_member_sessions enable row level security;
-- (deliberately no policies — definer functions only)

-- ── Tunables, in one place so review is a single read ──────────────────────
--   HARD TTL      10 minutes   — the session cannot outlive this, ever
--   IDLE TIMEOUT   90 seconds  — a bar-top device left alone drops to BOARD
--   SOFT LOCKOUT   5 fails / 15 min   → locked 15 minutes
--   HARD LOCKOUT  10 fails / 24 hours → locked until an admin clears it


-- ═══ PART 4 · ADMIN: ISSUE / RESET / INSPECT A MEMBER PIN ══════════════════
-- Issuance and reset live in the admin portal. No engineer required.
create or replace function set_member_kiosk_pin(p_member_no varchar, p_pin text, p_must_change boolean default false)
  returns void language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if not is_admin_uid(auth.uid()) then raise exception 'admin only'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'pin must be exactly 6 digits'; end if;
  -- Refuse the obvious ones; a 6-digit PIN is the only barrier on an enumerable number.
  if p_pin in ('000000','111111','123456','654321','222222','999999') then
    raise exception 'pin too weak';
  end if;
  insert into member_kiosk_pins (member_no, pin_hash, set_at, set_by, must_change)
  values (p_member_no, crypt(p_pin, gen_salt('bf')), now(), auth.uid(), p_must_change)
  on conflict (member_no) do update
    set pin_hash = excluded.pin_hash, set_at = now(),
        set_by = excluded.set_by, must_change = excluded.must_change;
  -- Re-issuing a PIN clears any standing lockout.
  update member_pin_attempts a set cleared_at = now()
   where a.member_no = p_member_no and a.cleared_at is null;
end $fn$;
revoke all on function set_member_kiosk_pin(varchar, text, boolean) from public;
grant execute on function set_member_kiosk_pin(varchar, text, boolean) to authenticated;

-- Clear a lockout without changing the PIN.
create or replace function clear_member_kiosk_lockout(p_member_no varchar)
  returns void language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if not is_admin_uid(auth.uid()) then raise exception 'admin only'; end if;
  update member_pin_attempts a set cleared_at = now()
   where a.member_no = p_member_no and a.cleared_at is null;
end $fn$;
revoke all on function clear_member_kiosk_lockout(varchar) from public;
grant execute on function clear_member_kiosk_lockout(varchar) to authenticated;

-- The admin portal's view of PIN state + live lockouts. Metadata only —
-- pin_hash is never returned by anything.
create or replace function member_kiosk_pin_status()
  returns table (member_no varchar, full_name text, has_pin boolean, set_at timestamptz,
                 must_change boolean, fails_15m int, fails_24h int, locked boolean, hard_locked boolean)
  language plpgsql security definer set search_path = public stable as $fn$
begin
  if not is_admin_uid(auth.uid()) then raise exception 'admin only'; end if;
  return query
  select m.member_no, m.full_name,
         (p.member_no is not null), p.set_at, coalesce(p.must_change, false),
         a.f15::int, a.f24::int,
         (a.f15 >= 5 or a.f24 >= 10),
         (a.f24 >= 10)
    from members m
    left join member_kiosk_pins p on p.member_no = m.member_no
    left join lateral (
      select count(*) filter (where x.at > now() - interval '15 minutes') as f15,
             count(*) filter (where x.at > now() - interval '24 hours')   as f24
        from member_pin_attempts x
       where x.member_no = m.member_no and x.ok = false and x.cleared_at is null
    ) a on true
   order by (a.f15 >= 5 or a.f24 >= 10) desc, m.member_no;
end $fn$;
revoke all on function member_kiosk_pin_status() from public;
grant execute on function member_kiosk_pin_status() to authenticated;


-- ═══ PART 5 · THE PIN → SESSION MINT ═══════════════════════════════════════
-- Called ONLY by the device-gated server route (service role). Returns the raw
-- opaque session token ONCE, or null. NULL IS THE ONLY FAILURE VALUE: wrong PIN,
-- unknown member, no PIN issued, locked out, dead device and unlinked profile
-- are indistinguishable to the caller — the tablet can never confirm which
-- membership numbers are live.
create or replace function kiosk_member_login(p_device_token text, p_member_no varchar, p_pin text)
  returns text language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_device  uuid;
  v_profile uuid;
  v_hash    text;
  v_f15 int; v_f24 int;
  v_token text;
  -- A fixed bcrypt salt used to burn equivalent time when the member is unknown
  -- or has no PIN, so response timing is not an enumeration oracle.
  c_dummy constant text := '$2a$06$0000000000000000000000';
begin
  -- Shape guards first: a malformed number must fail like any other miss, and
  -- must never reach the varchar(12) insert and surface as a 500.
  if p_member_no is null or p_member_no !~ '^[A-Za-z0-9-]{1,12}$' then return null; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then return null; end if;

  -- The device must still be enrolled and unrevoked (Layer 1 still gates).
  select d.id into v_device from kiosk_devices d
   where d.token_hash = encode(digest(coalesce(p_device_token,''), 'sha256'), 'hex')
     and d.revoked_at is null;
  if v_device is null then return null; end if;

  -- Lockout is counted PER MEMBERSHIP NUMBER, not per device — walking to the
  -- next tablet gains an attacker nothing.
  select count(*) filter (where a.at > now() - interval '15 minutes'),
         count(*) filter (where a.at > now() - interval '24 hours')
    into v_f15, v_f24
    from member_pin_attempts a
   where a.member_no = p_member_no and a.ok = false and a.cleared_at is null;
  if v_f15 >= 5 or v_f24 >= 10 then
    insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, false);
    return null;
  end if;

  select k.pin_hash into v_hash from member_kiosk_pins k where k.member_no = p_member_no;

  -- The member must have a login to act as: member-own RLS keys on
  -- profiles.member_no → auth.uid(). No linked profile = no identity = no session.
  select pr.id into v_profile from profiles pr where pr.member_no = p_member_no limit 1;

  if v_hash is null or v_profile is null then
    perform crypt(p_pin, c_dummy);                       -- constant-ish time
    insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, false);
    return null;
  end if;

  if crypt(p_pin, v_hash) <> v_hash then
    insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, false);
    return null;
  end if;

  -- Success. Any session already live on this tablet is superseded first —
  -- one tablet, one member, never two identities at once.
  update kiosk_member_sessions s
     set ended_at = now(), ended_reason = 'superseded'
   where s.device_id = v_device and s.ended_at is null;

  insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, true);

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into kiosk_member_sessions (device_id, member_no, profile_id, token_hash, expires_at)
  values (v_device, p_member_no, v_profile,
          encode(digest(v_token, 'sha256'), 'hex'),
          now() + interval '10 minutes');
  return v_token;
end $fn$;
revoke all on function kiosk_member_login(text, varchar, text) from public;
grant execute on function kiosk_member_login(text, varchar, text) to service_role;

-- Resolve + touch. THE gate every member-mode request passes through. Returns
-- the identity to mint a JWT for, or nothing. Enforces, in one place:
--   device still enrolled · session not ended · hard TTL · 90s idle timeout ·
--   the session belongs to THIS device (a token replayed off-device fails).
create or replace function kiosk_member_touch(p_device_token text, p_session_token text)
  returns table (session_id uuid, out_member_no varchar, out_profile_id uuid, out_expires_at timestamptz)
  language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_device uuid;
  v_sess   kiosk_member_sessions%rowtype;
begin
  select d.id into v_device from kiosk_devices d
   where d.token_hash = encode(digest(coalesce(p_device_token,''), 'sha256'), 'hex')
     and d.revoked_at is null;
  if v_device is null then
    -- Device revoked or unknown → kill anything still live under that token.
    update kiosk_member_sessions s set ended_at = now(), ended_reason = 'device_revoked'
     where s.token_hash = encode(digest(coalesce(p_session_token,''), 'sha256'), 'hex')
       and s.ended_at is null;
    return;
  end if;

  select s.* into v_sess from kiosk_member_sessions s
   where s.token_hash = encode(digest(coalesce(p_session_token,''), 'sha256'), 'hex')
     and s.device_id = v_device
     and s.ended_at is null;
  if not found then return; end if;

  if v_sess.expires_at <= now() then
    update kiosk_member_sessions s set ended_at = now(), ended_reason = 'ttl' where s.id = v_sess.id;
    return;
  end if;
  if v_sess.last_seen_at < now() - interval '90 seconds' then
    update kiosk_member_sessions s set ended_at = now(), ended_reason = 'idle' where s.id = v_sess.id;
    return;
  end if;

  update kiosk_member_sessions s set last_seen_at = now() where s.id = v_sess.id;
  return query select v_sess.id, v_sess.member_no, v_sess.profile_id, v_sess.expires_at;
end $fn$;
revoke all on function kiosk_member_touch(text, text) from public;
grant execute on function kiosk_member_touch(text, text) to service_role;

-- Boolean-only liveness for MIDDLEWARE (called with the anon client, exactly as
-- kiosk_device_active is). Leaks no row data and does NOT touch the idle clock —
-- a redirect check must never keep a session alive.
create or replace function kiosk_member_session_live(p_device_token text, p_session_token text)
  returns boolean language plpgsql security definer set search_path = public, extensions as $fn$
declare v_ok boolean;
begin
  select true into v_ok
    from kiosk_member_sessions s
    join kiosk_devices d on d.id = s.device_id and d.revoked_at is null
   where s.token_hash = encode(digest(coalesce(p_session_token,''), 'sha256'), 'hex')
     and d.token_hash = encode(digest(coalesce(p_device_token,''), 'sha256'), 'hex')
     and s.ended_at is null
     and s.expires_at > now()
     and s.last_seen_at > now() - interval '90 seconds';
  return coalesce(v_ok, false);
end $fn$;
revoke all on function kiosk_member_session_live(text, text) from public;
grant execute on function kiosk_member_session_live(text, text) to anon, authenticated, service_role;

-- End a session (member taps done, staff reclaims the tablet, idle sweep).
create or replace function kiosk_member_logout(p_session_token text, p_reason text default 'done')
  returns void language plpgsql security definer set search_path = public, extensions as $fn$
begin
  update kiosk_member_sessions s
     set ended_at = now(),
         ended_reason = case when p_reason in ('done','idle','ttl','staff_reclaim')
                             then p_reason else 'done' end
   where s.token_hash = encode(digest(coalesce(p_session_token,''), 'sha256'), 'hex')
     and s.ended_at is null;
end $fn$;
revoke all on function kiosk_member_logout(text, text) from public;
grant execute on function kiosk_member_logout(text, text) to service_role;


-- ═══ PART 6 · THE EVENT BOARD ══════════════════════════════════════════════
-- Source is the EXISTING calendar_entries (house/event calendar), not a new one.
-- Five additive columns close the gaps the board needs and the calendar lacks:
--   show_on_board  — explicit opt-in; not every member-visible entry belongs on
--                    a tablet facing the room
--   doors_open_at  — when ARRIVAL begins (without it, ARRIVAL has no start)
--   board_note(_vn)— the welcome line in TRC voice, bilingual. Distinct from
--                    `description`, which is an internal operational note.
--   title_vn       — the Vietnamese half of the headline
alter table calendar_entries add column if not exists show_on_board boolean not null default false;
alter table calendar_entries add column if not exists doors_open_at time;
alter table calendar_entries add column if not exists board_note    text;
alter table calendar_entries add column if not exists board_note_vn text;
alter table calendar_entries add column if not exists title_vn      text;
create index if not exists idx_calendar_entries_board
  on calendar_entries(space, entry_date) where show_on_board;

-- The board runs in BOARD mode, which has NO identity by design — so it cannot
-- read through RLS. Safety is STRUCTURAL instead: this function returns a fixed
-- set of non-PII columns and nothing else. `bookings` is never consulted: a
-- member's reservation is PII and has no place on a screen facing the room.
--
-- Time-driven, computed per call, in club time (Asia/Ho_Chi_Minh). It also
-- returns next_transition_at so a tablet left on for days advances on a poll
-- with no reload and no stale client-side state.
create or replace function kiosk_board(p_device_token text)
  returns table (
    room               text,
    state              text,        -- no_event | arrival | live | wind_down
    title              text,
    title_vn           text,
    note               text,
    note_vn            text,
    starts_at          timestamptz,
    ends_at            timestamptz,
    next_transition_at timestamptz,
    now_at             timestamptz
  )
  language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_room  text;
  v_now   timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Ho_Chi_Minh')::date;
  v_next  timestamptz;
  e       calendar_entries%rowtype;
  v_doors timestamptz; v_start timestamptz; v_end timestamptz;
begin
  select d.room into v_room from kiosk_devices d
   where d.token_hash = encode(digest(coalesce(p_device_token,''), 'sha256'), 'hex')
     and d.revoked_at is null;
  if v_room is null then return; end if;   -- unknown/revoked device → nothing

  v_next := ((v_today + 1)::timestamp) at time zone 'Asia/Ho_Chi_Minh';

  -- Tonight's board-flagged, member-visible entry for THIS room. Earliest first;
  -- one board, one event — the next one takes over as its window opens.
  select ce.* into e
    from calendar_entries ce
   where ce.space = v_room
     and ce.entry_date = v_today
     and ce.show_on_board
     and ce.visibility = 'member'
   order by coalesce(ce.doors_open_at, ce.start_time, '00:00'::time)
   limit 1;

  if not found then
    return query select v_room, 'no_event'::text,
                        null::text, null::text, null::text, null::text,
                        null::timestamptz, null::timestamptz, v_next, v_now;
    return;
  end if;

  v_start := ((e.entry_date + coalesce(e.start_time, '18:00'::time))::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  v_doors := ((e.entry_date + coalesce(e.doors_open_at, e.start_time - interval '1 hour', '17:00'::time))::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  v_end   := ((e.entry_date + coalesce(e.end_time, '23:59'::time))::timestamp) at time zone 'Asia/Ho_Chi_Minh';

  return query select
    v_room,
    case
      when v_now <  v_doors then 'no_event'
      when v_now <  v_start then 'arrival'
      when v_now <  v_end   then 'live'
      when v_now <  v_end + interval '45 minutes' then 'wind_down'
      else 'no_event'
    end::text,
    e.title, e.title_vn, e.board_note, e.board_note_vn,
    v_start, v_end,
    case
      when v_now <  v_doors then v_doors
      when v_now <  v_start then v_start
      when v_now <  v_end   then v_end
      when v_now <  v_end + interval '45 minutes' then v_end + interval '45 minutes'
      else v_next
    end,
    v_now;
end $fn$;
revoke all on function kiosk_board(text) from public;
grant execute on function kiosk_board(text) to service_role;


-- ═══ PART 7 · OPTIONAL — member-own read on `visits` ═══════════════════════
-- ONLY NEEDED IF the member landing should show "your most recent visit".
-- `visits` today is admin-only; there is no member-own policy. The Phase 2
-- landing does NOT require this: display_name comes from `profiles` and the
-- palate signature from `member_taste_profiles`, both already member-own and
-- both proven in S0–S2d. Run this block only if you want the visit line.
--
-- drop policy if exists "members read own visits" on visits;
-- create policy "members read own visits" on visits for select using (
--   member_no = (select member_no from profiles where id = auth.uid())
-- );
