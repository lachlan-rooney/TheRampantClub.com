-- ═══════════════════════════════════════════════════════════════════════════
-- GUEST SIGN-IN AT THE DOOR  ·  REVIEW, then run once in the Supabase SQL editor
-- ───────────────────────────────────────────────────────────────────────────
-- The owner's decisions, 2026-09-14:
--   1. Members give their guests' NAMES in advance. Members (portal, on their own
--      upcoming bookings) and staff (admin, on any booking) add, edit and remove.
--   2. Every guest TYPES their name and DRAWS a signature on the door iPad.
--   3. A guest whose name was not given: the DUTY MANAGER admits or refuses, on
--      the iPad, with their staff PIN. Who decided, and why, is recorded.
--   4. House Rule: no guest signed in after 10:30pm. After 22:30 Vietnam time
--      every door sign-in goes to the duty manager rather than self-completing.
--   5. SIGNATURES ARE DELETED AFTER 7 DAYS. The image only — the visit record
--      (name, host, time, on-list / who admitted) stays, because the weekly
--      report counts it.
--   6. The House Rules Guest Policy says so. The Terms are NOT touched.
--
-- RUN ORDER: after db/bookings.sql, db/guest_visits.sql, db/kiosk_phase1.sql,
-- db/kiosk_phase2.sql, db/ops_hub_phase1.sql (team_members), db/house_rules_vn.sql.
-- The code that uses this was written to TOLERATE its absence: before this runs,
-- guest-name editors report "not set up yet", the door refuses every device (no
-- device can be purpose='door'), and /admin/attendance lists manual entries as
-- before. Nothing starts working until this file has run.
--
-- ⚠ THE GUEST POLICY'S VIETNAMESE IS CLEARED. body_vn and body_vn_source are set
-- to NULL on that one row, so the old machine translation of the OLD English
-- cannot sit beside the new English. The translator (/api/admin/translate) skips
-- only 'human' rows, so pressing Translate in /admin/rules refills it — or a
-- person writes it, which is the house preference.
--
-- ⚠ COLUMN GRANTS ON guest_visits. From here, anon and authenticated can no longer
-- SELECT signature_data_url at all — only the service role can, and every
-- service-role read in the app refuses a signature older than 7 days. Every other
-- column is re-granted by name, so a future column added to guest_visits needs its
-- own `grant select (col)` or an authenticated read of it will fail.
--
-- Additive, idempotent and transactional. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ═══ PREREQUISITES — fail loudly, before touching anything ═════════════════
do $prereq$
declare v_missing text[] := '{}'; v_x text;
begin
  foreach v_x in array array['bookings', 'guest_visits', 'kiosk_devices', 'team_members', 'house_rules', 'members'] loop
    if to_regclass('public.' || v_x) is null then v_missing := v_missing || ('table ' || v_x); end if;
  end loop;
  foreach v_x in array array['is_admin_uid', 'kiosk_device_active', 'kiosk_devices_room_guard'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_x)
      then v_missing := v_missing || ('function ' || v_x); end if;
  end loop;
  if array_length(v_missing, 1) > 0 then
    raise exception 'GUEST SIGN-IN: PREREQUISITES MISSING — %', array_to_string(v_missing, ', ')
      using hint = 'Run the files named in the header first. Nothing in this file has been applied.';
  end if;
end $prereq$;


-- ═══ PART 1 · THE NAMES, GIVEN IN ADVANCE ══════════════════════════════════
-- One row per expected guest on a booking. Goes when the booking goes.
-- added_by is TEXT because it holds two kinds of id: a member's profile id, or a
-- staff team_members id (falling back to the admin's email when nobody has
-- picked their name). added_by_kind says which, so it is never guessed.
create table if not exists booking_guests (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(booking_id) on delete cascade,
  guest_name    text not null check (length(btrim(guest_name)) between 1 and 120),
  added_by      text,
  added_by_kind text not null check (added_by_kind in ('member', 'staff')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_booking_guests_booking on booking_guests (booking_id);

-- Admin-only, like bookings. Members reach their OWN booking's guests only through
-- the service-role routes under /api/members/bookings/[id]/guests, which resolve
-- session → profiles.member_no and refuse any booking that is not theirs.
alter table booking_guests enable row level security;
drop policy if exists "booking_guests admin" on booking_guests;
create policy "booking_guests admin" on booking_guests
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));


-- ═══ PART 2 · THE DOOR DEVICE ══════════════════════════════════════════════
-- A door iPad is a kiosk device like any other — same pairing, same revocation —
-- but it stands in no room. kiosk_devices.room is guarded by a trigger against
-- space_tables; a NULL room already passes it, so the door needs no exemption to
-- exist. What it needs is to be NAMED as the door, so the door API can refuse a
-- room tablet and the room surfaces can refuse the door.
alter table kiosk_devices add column if not exists purpose text not null default 'room';
alter table kiosk_devices drop constraint if exists kiosk_devices_purpose_valid;
alter table kiosk_devices add constraint kiosk_devices_purpose_valid check (purpose in ('room', 'door'));
comment on column kiosk_devices.purpose is
  'room = an in-room tablet (board / member / staff). door = the guest sign-in iPad at the entrance; never has a room.';

-- The room guard, taught about the door: a door device skips the space_tables
-- check, and must not carry a room at all — a door tablet with a room would start
-- showing that room's board, which is exactly the confusion purpose exists to stop.
create or replace function kiosk_devices_room_guard()
  returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.purpose = 'door' then
    if new.room is not null then
      raise exception 'a door device stands in no room (got %)', new.room
        using hint = 'Leave room empty for purpose = door.';
    end if;
    return new;
  end if;
  if new.room is not null
     and not exists (select 1 from space_tables st where st.space = new.room) then
    raise exception 'room % is not a space in space_tables', new.room
      using hint = 'Pick from: select distinct space from space_tables';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_kiosk_devices_room_guard on kiosk_devices;
create trigger trg_kiosk_devices_room_guard
  before insert or update of room, purpose on kiosk_devices
  for each row execute function kiosk_devices_room_guard();

-- Middleware's question, answered in one round trip: is this token live, and if
-- so, is it the door or a room? Same shape and exposure as kiosk_device_active —
-- anon-callable, returns a word or NULL, no row data — and it stamps last_seen
-- the same way, so it can stand in for that call rather than add to it.
create or replace function kiosk_device_purpose(p_token text)
  returns text language plpgsql security definer set search_path = public, extensions as $fn$
declare v_id uuid; v_purpose text;
begin
  if p_token is null or p_token = '' then return null; end if;
  select id, purpose into v_id, v_purpose from kiosk_devices
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revoked_at is null;
  if v_id is null then return null; end if;
  update kiosk_devices set last_seen_at = now() where id = v_id;
  return v_purpose;
end $fn$;
revoke all on function kiosk_device_purpose(text) from public;
grant execute on function kiosk_device_purpose(text) to anon, authenticated, service_role;


-- ═══ PART 3 · THE SIGN-IN, ON THE VISIT RECORD ═════════════════════════════
-- A door sign-in IS a guest visit, so it lands in guest_visits — the table the
-- weekly report already counts — rather than in a parallel table the report would
-- have to learn about. Manual entries from /admin/attendance leave every new
-- column NULL and behave exactly as before.
alter table guest_visits add column if not exists booking_id           uuid references bookings(booking_id) on delete set null;
alter table guest_visits add column if not exists booking_guest_id     uuid references booking_guests(id) on delete set null;
alter table guest_visits add column if not exists signed_in_at         timestamptz;
alter table guest_visits add column if not exists signature_data_url   text;
alter table guest_visits add column if not exists signature_deleted_at timestamptz;
alter table guest_visits add column if not exists on_list              boolean;
-- WHY the duty manager was needed. NULL = the guest self-completed (on the list,
-- before 22:30, first arrival). A referral with decision still NULL is the
-- PENDING state: the guest is standing at the door waiting. No separate
-- door_requests table — the pending thing and the finished thing are one row.
alter table guest_visits add column if not exists referred_reason      text;
alter table guest_visits add column if not exists decision             text;
alter table guest_visits add column if not exists decision_reason      text;
alter table guest_visits add column if not exists decided_by_staff     uuid references team_members(id) on delete set null;
alter table guest_visits add column if not exists decided_at           timestamptz;
alter table guest_visits add column if not exists device_id            uuid references kiosk_devices(id) on delete set null;

alter table guest_visits drop constraint if exists guest_visits_referred_reason_valid;
alter table guest_visits add constraint guest_visits_referred_reason_valid
  check (referred_reason is null or referred_reason in ('not_on_list', 'after_last_entry', 'already_signed_in'));
alter table guest_visits drop constraint if exists guest_visits_decision_valid;
alter table guest_visits add constraint guest_visits_decision_valid
  check (decision is null or decision in ('admitted', 'refused'));
-- A decision is never anonymous: it names the staff member who made it.
alter table guest_visits drop constraint if exists guest_visits_decision_attributed;
alter table guest_visits add constraint guest_visits_decision_attributed
  check (decision is null or (decided_by_staff is not null and decided_at is not null));
-- A signature only exists on a door sign-in, which always has a time — the
-- 7-day clock needs something to count from, or the image could never expire.
alter table guest_visits drop constraint if exists guest_visits_signature_has_clock;
alter table guest_visits add constraint guest_visits_signature_has_clock
  check (signature_data_url is null or signed_in_at is not null);

create index if not exists idx_guest_visits_signed_in on guest_visits (signed_in_at desc) where signed_in_at is not null;
create index if not exists idx_guest_visits_booking_guest on guest_visits (booking_guest_id) where booking_guest_id is not null;
create index if not exists idx_guest_visits_device_recent on guest_visits (device_id, created_at desc) where device_id is not null;
-- The purge's own index: only rows still holding an image.
create index if not exists idx_guest_visits_signature_live on guest_visits (signed_in_at) where signature_data_url is not null;


-- ═══ PART 4 · SEVEN DAYS, THEN THE SIGNATURE GOES ══════════════════════════
-- Nulls the image and stamps when; keeps everything else. Called daily by the
-- cron (app/api/cron/notify-daily) and, best-effort, on every door sign-in — so a
-- late or failed cron shortens nothing and lengthens nothing by more than a day.
-- The job is housekeeping; the GUARANTEE is that every read refuses a signature
-- whose signed_in_at is older than 7 days (see the column grants below).
create or replace function guest_signatures_purge()
  returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n integer;
begin
  update guest_visits
     set signature_data_url = null,
         signature_deleted_at = now()
   where signature_data_url is not null
     and signed_in_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;
revoke all on function guest_signatures_purge() from public;
grant execute on function guest_signatures_purge() to service_role;

-- The image is readable by the SERVICE ROLE ONLY. RLS already keeps the table
-- admin-only, but an admin's own browser session could still select the column
-- directly and get a 9-day-old signature while the cron was late. Revoke the
-- table-level SELECT and re-grant every other column by name; the app's
-- signature reads all go through service-role routes that apply the 7-day test.
revoke select on guest_visits from anon, authenticated;
grant select (id, guest_name, host_member_no, visit_date, duration_min, party_size, note, logged_by, created_at,
              booking_id, booking_guest_id, signed_in_at, signature_deleted_at, on_list,
              referred_reason, decision, decision_reason, decided_by_staff, decided_at, device_id)
  on guest_visits to authenticated;


-- ═══ PART 5 · THE HOUSE RULE ═══════════════════════════════════════════════
-- The sentences that are still true stay word for word. "Signed in at reception"
-- becomes the door, and the three decisions are added in the club's voice. The
-- 10:30pm rule already lives in 'Last Entry & Closing' and is not repeated here.
update house_rules
   set body = 'Each member may introduce up to four guests at a time, as set out in the Terms and Conditions (§14.3). '
              'Additional guests can be arranged in advance with the Member Experience Manager. '
              'Please give us the name of each guest in advance — against your booking in the members'' portal, or through the Club when you book. '
              'Every guest signs in at the door on arrival. A guest whose name we were not given is admitted at the duty manager''s discretion. '
              'The introducing member is responsible for their guests throughout — the Committee trusts members to exercise judgement.',
       body_vn = null,
       body_vn_source = null,
       updated_at = now()
 where section_title = 'Guest Policy';


-- ═══ PROOF, printed by the run ═════════════════════════════════════════════
do $proof$
declare r record; v_missing text[] := '{}'; v_body text; v_vn text; v_rows int;
begin
  for r in
    select * from (values
      ('booking_guests', 'booking_id'), ('booking_guests', 'guest_name'), ('booking_guests', 'added_by_kind'),
      ('kiosk_devices', 'purpose'),
      ('guest_visits', 'booking_id'), ('guest_visits', 'booking_guest_id'), ('guest_visits', 'signed_in_at'),
      ('guest_visits', 'signature_data_url'), ('guest_visits', 'signature_deleted_at'), ('guest_visits', 'on_list'),
      ('guest_visits', 'referred_reason'), ('guest_visits', 'decision'), ('guest_visits', 'decision_reason'),
      ('guest_visits', 'decided_by_staff'), ('guest_visits', 'decided_at'), ('guest_visits', 'device_id')
    ) as t(tbl, col)
  loop
    if not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col) then
      v_missing := v_missing || (r.tbl || '.' || r.col);
    end if;
  end loop;
  if array_length(v_missing, 1) > 0 then
    raise exception 'guest_signin self-check FAILED — missing: %', array_to_string(v_missing, ', ')
      using hint = 'A table of that name may already exist with a different shape.';
  end if;

  if has_column_privilege('authenticated', 'public.guest_visits', 'signature_data_url', 'SELECT') then
    raise exception 'authenticated can still SELECT guest_visits.signature_data_url — the grant change did not land';
  end if;
  if not has_column_privilege('authenticated', 'public.guest_visits', 'guest_name', 'SELECT') then
    raise exception 'authenticated lost SELECT on guest_visits.guest_name — the re-grant did not land';
  end if;

  select body, body_vn into v_body, v_vn from house_rules where section_title = 'Guest Policy';
  if v_body is null then raise exception 'no Guest Policy row in house_rules'; end if;
  if position('reception' in v_body) > 0 then raise exception 'Guest Policy still says reception'; end if;
  if position('signs in at the door' in v_body) = 0 then raise exception 'Guest Policy is missing the door sign-in'; end if;
  if position('duty manager' in v_body) = 0 then raise exception 'Guest Policy is missing the duty manager'; end if;
  if position('§14.3' in v_body) = 0 then raise exception 'Guest Policy lost its Terms citation'; end if;
  if v_vn is not null then raise exception 'Guest Policy body_vn should be cleared for re-translation'; end if;

  -- Dry-run the purge's predicate (counts only; the purge itself is the cron's).
  select count(*) into v_rows from guest_visits
   where signature_data_url is not null and signed_in_at < now() - interval '7 days';

  raise notice 'guest_signin: booking_guests ✓ · kiosk_devices.purpose ✓ · guest_visits door columns ✓ · signature column service-role only ✓';
  raise notice 'guest_signin: Guest Policy updated (% chars), Vietnamese cleared for re-translation · % signature(s) currently past 7 days', length(v_body), v_rows;
end $proof$;

commit;
