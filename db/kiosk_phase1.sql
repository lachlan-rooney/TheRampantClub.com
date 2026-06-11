-- ═══════════════════════════════════════════════════════════════════════════
-- KIOSK PHASE 1 — shared-device identity  ·  REVIEW, then run
-- ───────────────────────────────────────────────────────────────────────────
-- TWO DISTINCT LAYERS:
--   LAYER 1 — THE DEVICE SESSION = the SECURITY BOUNDARY. A tablet is enrolled by
--     an admin (pairing code → device token); the token's HASH lives here; the
--     token (a cookie on the tablet) is what permits the gated /kiosk/staff PII
--     routes. Revocable instantly (revoked_at). middleware checks this.
--   LAYER 2 — THE STAFF PIN = ATTRIBUTION on top (who logged this), NOT the access
--     boundary. Reuses team_members (+ pin_hash). Hashed (bcrypt), rate-limited.
-- The tablet never reads these tables directly — only the SECURITY DEFINER fns.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- digest() · crypt()/gen_salt() · gen_random_bytes()

-- ── LAYER 1: kiosk_devices (the boundary) ───────────────────────────────────
create table if not exists kiosk_devices (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,                 -- "Floor 4 bar tablet"
  token_hash      text,                          -- sha256(device token); null until paired
  pair_code       text,                          -- short-lived admin-issued pairing code
  pair_expires_at timestamptz,
  enrolled_by     uuid references profiles(id),
  enrolled_at     timestamptz,                   -- set when paired
  last_seen_at    timestamptz,
  revoked_at      timestamptz,                   -- revoke = set this → token invalid at once
  created_at      timestamptz not null default now()
);
create index if not exists idx_kiosk_devices_token on kiosk_devices(token_hash) where revoked_at is null;
create index if not exists idx_kiosk_devices_pair  on kiosk_devices(pair_code)  where pair_code is not null;
alter table kiosk_devices enable row level security;
-- Admin-only direct access (enrol/list/revoke in the admin portal). The tablet
-- reaches the device layer ONLY through the definer fns below — never the table.
drop policy if exists "admin all kiosk_devices" on kiosk_devices;
create policy "admin all kiosk_devices" on kiosk_devices for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

-- Is this device token valid (paired + not revoked)? middleware calls this (anon).
-- Returns a BOOL only — no row data leaks — and stamps last_seen.
create or replace function kiosk_device_active(p_token text)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if p_token is null or p_token = '' then return false; end if;
  select id into v_id from kiosk_devices
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revoked_at is null;
  if v_id is null then return false; end if;
  update kiosk_devices set last_seen_at = now() where id = v_id;
  return true;
end $$;
grant execute on function kiosk_device_active(text) to anon, authenticated;

-- Pair a tablet: exchange a valid admin-issued code for a fresh device token. The
-- token is generated server-side; only its HASH is stored; the raw token is
-- returned ONCE (the route sets it as the device cookie). Anon-callable (the
-- tablet has no login yet) — but useless without a live admin-issued code.
create or replace function kiosk_pair_device(p_code text)
  returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_token text;
begin
  select id into v_id from kiosk_devices
   where pair_code = p_code and revoked_at is null and pair_expires_at > now() and token_hash is null;
  if v_id is null then return null; end if;        -- bad / expired / already used
  v_token := encode(gen_random_bytes(32), 'hex');
  update kiosk_devices
     set token_hash = encode(digest(v_token, 'sha256'), 'hex'),
         pair_code = null, pair_expires_at = null, enrolled_at = now()
   where id = v_id;
  return v_token;
end $$;
grant execute on function kiosk_pair_device(text) to anon, authenticated;

-- ── LAYER 2: staff PIN on team_members (attribution) ────────────────────────
alter table team_members add column if not exists pin_hash text;

create table if not exists kiosk_pin_attempts (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid references team_members(id) on delete cascade,
  ok             boolean not null,
  at             timestamptz not null default now()
);
create index if not exists idx_kiosk_pin_attempts on kiosk_pin_attempts(team_member_id, at desc);

-- Admin sets a staff PIN — hashed (bcrypt); plaintext is NEVER stored.
create or replace function set_team_member_pin(p_team_member uuid, p_pin text)
  returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin_uid(auth.uid()) then raise exception 'admin only'; end if;
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'pin must be 4-8 digits'; end if;
  update team_members set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_team_member;
end $$;
grant execute on function set_team_member_pin(uuid, text) to authenticated;

-- Verify a staff PIN (ATTRIBUTION; rate-limited ≥5 fails / 5 min → locked). Returns
-- the team_member id on success, null on fail/lockout. Called server-side by the
-- device-gated route (service role) — not the access boundary, just who's acting.
create or replace function kiosk_verify_pin(p_team_member uuid, p_pin text)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_fails int;
begin
  select count(*) into v_fails from kiosk_pin_attempts
   where team_member_id = p_team_member and ok = false and at > now() - interval '5 minutes';
  if v_fails >= 5 then return null; end if;                       -- locked
  select pin_hash into v_hash from team_members where id = p_team_member and active and pin_hash is not null;
  if v_hash is null or crypt(p_pin, v_hash) <> v_hash then
    insert into kiosk_pin_attempts(team_member_id, ok) values (p_team_member, false);
    return null;
  end if;
  insert into kiosk_pin_attempts(team_member_id, ok) values (p_team_member, true);
  return p_team_member;
end $$;
grant execute on function kiosk_verify_pin(uuid, text) to authenticated;

-- Staff roster for the picker — NAMES ONLY (not member PII). Only active staff
-- with a PIN set appear. Reached only through the device-gated route.
create or replace function kiosk_staff_roster()
  returns table (id uuid, display_name text, role_title text)
  language sql security definer set search_path = public stable as $$
  select id, display_name, role_title from team_members
   where active and pin_hash is not null order by display_name;
$$;
grant execute on function kiosk_staff_roster() to authenticated;
