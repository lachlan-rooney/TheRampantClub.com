-- ═══════════════════════════════════════════════════════════════════════════
-- STAFF EMAIL ADDRESSES, so a reminder can reach the person it is about.
-- REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-10-01: "I then want to add staff email addresses into the pins
-- bit too so we can send them email reminders of tasks needing done on the
-- boards."
--
-- WHY THIS IS NEEDED AT ALL, which is the interesting part.
--
-- A board task's `assignee` is a TEAM MEMBER (team_members.id). A notification's
-- `recipient` is a LOGIN (an auth user / profiles.id). Those are two different
-- populations joined only by team_members.profile_id — and of fifteen people on
-- the team, two have one. So ops_generate_due_soon has been doing exactly what
-- it was written to do and falling back to the board owner every time: every
-- task_due_soon notification in the table, going back to September, was sent to
-- the owner's address. Bình has fifty-six open tasks and has never been emailed
-- about one.
--
-- Giving the team members their own addresses skips the join entirely. The
-- digest reads team_members.email and writes to it; no staff login, no profile,
-- no seat, nothing to provision. Which matters, because floor staff have PINs
-- and NOT logins — that is the shape of this club, and a reminder system that
-- required fifteen logins would reach nobody.
--
-- THREE COLUMNS AND NOTHING ELSE:
--   email            — where to write. Checked for shape, not for existence.
--   email_reminders  — the person's own off switch. Default on, because an
--                      address added deliberately is an address meant to be
--                      used; a column that defaults to off is fifteen people
--                      wondering why nothing arrives.
--   last_digest_on   — the VN date a digest last went out, so a second run of
--                      the cron (or an admin pressing "send now") cannot send
--                      the same person the same list twice in a day.
--
-- NOT an auth user, NOT a profile, NOT a login. This is an address to write to.
-- It grants nothing and it is never checked for access anywhere.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'team_members') then
    raise exception 'PREREQUISITES MISSING — team_members' using hint = 'Nothing applied.';
  end if;
end $prereq$;

alter table public.team_members
  add column if not exists email           text,
  add column if not exists email_reminders boolean not null default true,
  add column if not exists last_digest_on  date;

-- SHAPE, NOT EXISTENCE. A constraint cannot know whether an address receives
-- mail; it can stop "hieu" and "hieu@" being saved as if they would. Null is
-- allowed and means "we do not have one", which is where everybody starts.
alter table public.team_members drop constraint if exists team_members_email_shape;
alter table public.team_members
  add constraint team_members_email_shape
  check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- ONE ADDRESS, ONE PERSON. Two team members sharing an address means one of
-- them silently receives the other's list — case-insensitively, because
-- Hieu@ and hieu@ are the same inbox and Postgres does not know that.
create unique index if not exists team_members_email_unique
  on public.team_members (lower(email)) where email is not null;

-- WHO MAY READ IT. team_members is already admin-gated (and the kiosk roster
-- function is security definer and selects only id/display_name/role_title, so
-- a tablet standing in the Library still cannot see an address). Nothing is
-- granted here; the columns inherit the table's existing policies.
--
-- The one function that DOES hand out staff rows to a tablet is re-stated
-- verbatim below, so that this file can never be read as having widened it.
create or replace function kiosk_staff_roster()
  returns table (id uuid, display_name text, role_title text)
  language sql security definer set search_path = public stable as $$
  select id, display_name, role_title from team_members
   where active and pin_hash is not null order by display_name;
$$;
grant execute on function kiosk_staff_roster() to authenticated;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- The columns arrived, and nobody has an address yet:
--   select display_name, email, email_reminders, last_digest_on
--     from public.team_members order by display_name;
--
-- The shape constraint bites (this must FAIL):
--   update public.team_members set email = 'not-an-address' where display_name = 'Quy';
--
-- And the tablet still cannot see an address (three columns, no email):
--   select * from kiosk_staff_roster() limit 1;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop index if exists team_members_email_unique;
-- alter table public.team_members drop constraint if exists team_members_email_shape;
-- alter table public.team_members
--   drop column if exists email,
--   drop column if exists email_reminders,
--   drop column if exists last_digest_on;
-- The digest in lib/ops/staff-digest.ts reads those columns through a select
-- that tolerates their absence, so it stands down on its own rather than
-- throwing every morning at nine.
