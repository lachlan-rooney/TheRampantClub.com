-- ─────────────────────────────────────────────────────────────────────────
-- calendar_entries — free-text HOUSE / non-member calendar entries (external
-- hires, supplier/distiller visits, closures, tastings). A dedicated table so
-- the member-reservation `bookings` model stays clean and untouched.
--
-- Two careful properties:
--   • VISIBILITY ('member'|'staff') is RLS-enforced — a member session can read
--     ONLY visibility='member' rows. A staff-only entry ("private hire for X")
--     is literally unreadable by a member, even if a query forgets to filter.
--   • ROOM-BLOCKING — an entry WITH a `space` and `blocks_space` makes that
--     space unavailable for overlapping bookings (the bookings API checks this).
--     `space` null = no room (blocks nothing); blocks_space false = informational
--     (e.g. a member-visible "distiller visit in the Library" that doesn't close it).
-- Additive — touches nothing existing.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists calendar_entries (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  entry_date    date not null,
  start_time    time,                         -- optional precise window
  end_time      time,
  session_label text,                         -- 'early'|'evening'|'late'|custom (optional)
  space         text,                         -- null = no specific room (blocks nothing)
  kind          text not null default 'other' check (kind in ('closure','private_hire','supplier','tasting','other')),
  visibility    text not null check (visibility in ('member','staff')),
  blocks_space  boolean not null default true, -- a space-entry blocks bookings unless opted out
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_calendar_entries_date on calendar_entries(entry_date);
create index if not exists idx_calendar_entries_vis  on calendar_entries(visibility);
create index if not exists idx_calendar_entries_space on calendar_entries(space, entry_date);

alter table calendar_entries enable row level security;

-- Admins read/write everything (incl. staff-only). (The admin calendar also reads
-- via the service-role API, which bypasses RLS — this covers session-client reads.)
drop policy if exists "admins rw calendar_entries" on calendar_entries;
create policy "admins rw calendar_entries" on calendar_entries for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- THE STAFF-ONLY-NEVER-LEAKS GUARANTEE: a logged-in member can SELECT only
-- member-visible rows. A staff-only row can never be read by a member session,
-- regardless of any query filter. (Admins still see all via the policy above.)
drop policy if exists "members read member-visible calendar_entries" on calendar_entries;
create policy "members read member-visible calendar_entries" on calendar_entries for select
  using (auth.uid() is not null and visibility = 'member');
