-- ═══════════════════════════════════════════════════════════════════════════
-- KIOSK AUTH FIXES  ·  REVIEW, then run.  Additive + idempotent + re-runnable.
-- ───────────────────────────────────────────────────────────────────────────
--  1. Six attempts, not five.
--  2. ONE validator for a new code, so no path that sets one can skip the rules.
--     The date-of-birth refusal moves OUT of the API and INTO the database for
--     exactly this reason: reset is a second place a code gets set, and a rule
--     living in one route is a rule the next route forgets.
--  3. Single-use, short-lived reset tokens.
--
-- Companion to the multi-match fix, which is app-side: a name now resolves to
-- EXACTLY ONE member before the code is checked at all, so one attempt writes one
-- row instead of one per member sharing a surname.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1 · THE SHARED VALIDATOR ══════════════════════════════════════════════
-- Returns null when the code is acceptable, or a reason the caller can map to
-- copy. Every path that sets a code calls this — there is no second copy of the
-- rules to drift.
create or replace function kiosk_pin_rejected(p_member_no varchar, p_pin text)
  returns text language plpgsql security definer set search_path = public, extensions stable as $fn$
declare v_b date;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then return 'format'; end if;
  if kiosk_pin_is_weak(p_pin) then return 'weak'; end if;

  -- A date of birth is not a weak PATTERN, it is not private at all: it is on the
  -- membership record and usually on their social media. It is the first thing
  -- anyone tries, so it is refused in every form six digits can carry it.
  select m.birthday into v_b from members m where m.member_no = p_member_no;
  if v_b is not null and p_pin in (
       to_char(v_b, 'DDMMYY'), to_char(v_b, 'MMDDYY'), to_char(v_b, 'YYMMDD'),
       to_char(v_b, 'YYYYMM'), to_char(v_b, 'MMYYYY'), to_char(v_b, 'DDMM')  || to_char(v_b, 'YY')
     ) then
    return 'dob';
  end if;
  return null;
end $fn$;
revoke all on function kiosk_pin_rejected(varchar, text) from public;
grant execute on function kiosk_pin_rejected(varchar, text) to authenticated, service_role;

-- ═══ 2 · set_my_kiosk_pin NOW GOES THROUGH THE VALIDATOR ═══════════════════
create or replace function set_my_kiosk_pin(p_pin text)
  returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare v_member_no varchar(12); v_reason text;
begin
  select pr.member_no into v_member_no from profiles pr where pr.id = auth.uid();
  if v_member_no is null then raise exception 'no member linked to this account'; end if;

  v_reason := kiosk_pin_rejected(v_member_no, p_pin);
  if v_reason = 'format' then raise exception 'pin must be exactly 6 digits'; end if;
  if v_reason = 'weak'   then raise exception 'pin too easily guessed'; end if;
  if v_reason = 'dob'    then raise exception 'pin is the date of birth'; end if;

  insert into member_kiosk_pins (member_no, pin_hash, set_at, set_by, must_change)
  values (v_member_no, crypt(p_pin, gen_salt('bf')), now(), auth.uid(), false)
  on conflict (member_no) do update
    set pin_hash = excluded.pin_hash, set_at = now(), set_by = excluded.set_by, must_change = false;

  update member_pin_attempts a set cleared_at = now()
   where a.member_no = v_member_no and a.cleared_at is null;
end $fn$;
revoke all on function set_my_kiosk_pin(text) from public;
grant execute on function set_my_kiosk_pin(text) to authenticated;

-- ═══ 3 · SIX ATTEMPTS ══════════════════════════════════════════════════════
-- Only the two thresholds change (5 → 6). Everything else is as reviewed.
create or replace function kiosk_member_login(p_device_token text, p_member_no varchar, p_pin text)
  returns text language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_device uuid; v_profile uuid; v_hash text; v_f15 int; v_f24 int; v_token text;
  c_dummy constant text := '$2a$06$0000000000000000000000';
begin
  if p_member_no is null or p_member_no !~ '^[A-Za-z0-9-]{1,12}$' then return null; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then return null; end if;

  select d.id into v_device from kiosk_devices d
   where d.token_hash = encode(digest(coalesce(p_device_token,''), 'sha256'), 'hex')
     and d.revoked_at is null;
  if v_device is null then return null; end if;

  select count(*) filter (where a.at > now() - interval '15 minutes'),
         count(*) filter (where a.at > now() - interval '24 hours')
    into v_f15, v_f24
    from member_pin_attempts a
   where a.member_no = p_member_no and a.ok = false and a.cleared_at is null;
  if v_f15 >= 6 or v_f24 >= 12 then                      -- ← was 5 / 10
    insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, false);
    return null;
  end if;

  select k.pin_hash into v_hash from member_kiosk_pins k where k.member_no = p_member_no;
  select pr.id into v_profile from profiles pr where pr.member_no = p_member_no limit 1;

  if v_hash is null or v_profile is null then
    perform crypt(p_pin, c_dummy);
    insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, false);
    return null;
  end if;
  if crypt(p_pin, v_hash) <> v_hash then
    insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, false);
    return null;
  end if;

  update kiosk_member_sessions s set ended_at = now(), ended_reason = 'superseded'
   where s.device_id = v_device and s.ended_at is null;
  insert into member_pin_attempts(member_no, device_id, ok) values (p_member_no, v_device, true);

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into kiosk_member_sessions (device_id, member_no, profile_id, token_hash, expires_at)
  values (v_device, p_member_no, v_profile, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '10 minutes');
  return v_token;
end $fn$;
revoke all on function kiosk_member_login(text, varchar, text) from public;
grant execute on function kiosk_member_login(text, varchar, text) to service_role;

create or replace function member_kiosk_pin_status()
  returns table (member_no varchar, full_name text, has_pin boolean, set_at timestamptz,
                 must_change boolean, fails_15m int, fails_24h int, locked boolean, hard_locked boolean)
  language plpgsql security definer set search_path = public stable as $fn$
begin
  if not is_admin_uid(auth.uid()) then raise exception 'admin only'; end if;
  return query
  select m.member_no, m.full_name, (p.member_no is not null), p.set_at, coalesce(p.must_change, false),
         a.f15::int, a.f24::int, (a.f15 >= 6 or a.f24 >= 12), (a.f24 >= 12)   -- ← was 5 / 10
    from members m
    left join member_kiosk_pins p on p.member_no = m.member_no
    left join lateral (
      select count(*) filter (where x.at > now() - interval '15 minutes') as f15,
             count(*) filter (where x.at > now() - interval '24 hours')   as f24
        from member_pin_attempts x
       where x.member_no = m.member_no and x.ok = false and x.cleared_at is null
    ) a on true
   order by (a.f15 >= 6 or a.f24 >= 12) desc, m.member_no;
end $fn$;
revoke all on function member_kiosk_pin_status() from public;
grant execute on function member_kiosk_pin_status() to authenticated;

-- ═══ 4 · RESET TOKENS ══════════════════════════════════════════════════════
-- TTL 30 MINUTES. Long enough to walk from the bar to a phone and read an email;
-- short enough that a link left open in a mail app is not a standing key. Single
-- use, and requesting a new one invalidates the last.
create table if not exists member_pin_resets (
  id         uuid primary key default gen_random_uuid(),
  member_no  varchar(12) not null references members(member_no) on delete cascade,
  token_hash text not null unique,               -- sha256(emailed token)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists idx_member_pin_resets_live
  on member_pin_resets(member_no) where used_at is null;
alter table member_pin_resets enable row level security;
-- (deliberately no policies — definer functions only)

-- Issue a token for ONE member. The caller resolved that member; this never
-- searches by name, so a reset request can never fan out across a shared surname.
create or replace function request_member_pin_reset(p_member_no varchar)
  returns text language plpgsql security definer set search_path = public, extensions as $fn$
declare v_token text;
begin
  if not exists (select 1 from members m where m.member_no = p_member_no) then return null; end if;
  update member_pin_resets r set used_at = now()
   where r.member_no = p_member_no and r.used_at is null;      -- one live link at a time
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into member_pin_resets (member_no, token_hash, expires_at)
  values (p_member_no, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '30 minutes');
  return v_token;
end $fn$;
revoke all on function request_member_pin_reset(varchar) from public;
grant execute on function request_member_pin_reset(varchar) to service_role;

-- Spend the token and set the code. Goes through the SAME validator, so the
-- weak-code and date-of-birth rules apply here exactly as they do in the portal —
-- this is the path that would otherwise have been forgotten.
create or replace function set_kiosk_pin_via_reset(p_token text, p_pin text)
  returns text language plpgsql security definer set search_path = public, extensions as $fn$
declare v_member_no varchar(12); v_reason text;
begin
  select r.member_no into v_member_no from member_pin_resets r
   where r.token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex')
     and r.used_at is null and r.expires_at > now();
  if v_member_no is null then return 'token'; end if;

  v_reason := kiosk_pin_rejected(v_member_no, p_pin);
  if v_reason is not null then return v_reason; end if;       -- token NOT spent on a bad code

  insert into member_kiosk_pins (member_no, pin_hash, set_at, must_change)
  values (v_member_no, crypt(p_pin, gen_salt('bf')), now(), false)
  on conflict (member_no) do update
    set pin_hash = excluded.pin_hash, set_at = now(), set_by = null, must_change = false;

  update member_pin_resets r set used_at = now()
   where r.token_hash = encode(digest(p_token, 'sha256'), 'hex');
  -- A successful reset clears the lockout that sent them here.
  update member_pin_attempts a set cleared_at = now()
   where a.member_no = v_member_no and a.cleared_at is null;
  return null;
end $fn$;
revoke all on function set_kiosk_pin_via_reset(text, text) from public;
grant execute on function set_kiosk_pin_via_reset(text, text) to service_role;

-- ═══ 5 · SELF-CHECK ════════════════════════════════════════════════════════
do $check$
declare v_missing text[] := '{}'; v_fn text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'member_pin_resets'
                    and column_name = 'token_hash')
    then v_missing := v_missing || 'member_pin_resets.token_hash'; end if;

  foreach v_fn in array array['kiosk_pin_rejected', 'request_member_pin_reset',
                              'set_kiosk_pin_via_reset', 'set_my_kiosk_pin',
                              'kiosk_member_login', 'member_kiosk_pin_status']
  loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_fn)
      then v_missing := v_missing || ('function ' || v_fn); end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise exception 'kiosk_auth_fixes self-check FAILED — missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'kiosk_auth_fixes self-check passed — six-attempt threshold, shared validator, reset tokens.';
end $check$;
