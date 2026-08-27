-- ═══════════════════════════════════════════════════════════════════════════
-- Event Gallery — external media links from club events
-- ═══════════════════════════════════════════════════════════════════════════
-- Members and staff post LINKS (Google Drive / Google Photos / YouTube / Vimeo /
-- Dropbox …) to photos & video from any club event: sports fixtures, dinners,
-- tastings, socials, one-off events. No files are stored here — links only.
--
-- Members submit their own; staff moderate (hide / remove). Following the social
-- layer's philosophy, there are NO member write policies — every insert/update/
-- delete goes through the API routes under service-role, which authorise in code.
-- RLS below is defense-in-depth for any direct client read.

create table if not exists event_albums (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'other'
                  check (category in ('fixture','dinner','tasting','social','event','other')),
  event_date    date,
  url           text not null,
  caption       text,
  -- Optional link to a specific sports fixture (so a past fixture can show its
  -- photos inline). Null for dinners/tastings/socials that aren't fixtures.
  fixture_id    uuid references fixtures(id) on delete set null,
  submitted_by  uuid references profiles(id) on delete set null,
  submitter_name text,
  source        text not null default 'member' check (source in ('member','staff')),
  status        text not null default 'visible' check (status in ('visible','hidden')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_event_albums_status  on event_albums (status, event_date desc nulls last, created_at desc);
create index if not exists idx_event_albums_fixture on event_albums (fixture_id);
create index if not exists idx_event_albums_by       on event_albums (submitted_by);

alter table event_albums enable row level security;

-- Read: anyone signed in sees VISIBLE albums; admins see everything (incl. hidden).
drop policy if exists "event_albums read" on event_albums;
create policy "event_albums read" on event_albums
  for select using (status = 'visible' or is_admin_uid(auth.uid()));

-- No member INSERT/UPDATE/DELETE policies by design — the API routes (service-role)
-- are the only write path and authorise per request. Admins may act directly too:
drop policy if exists "event_albums admin write" on event_albums;
create policy "event_albums admin write" on event_albums
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
