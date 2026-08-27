-- ═══════════════════════════════════════════════════════════════════════════
-- Events & Event Media — clickable events people contribute photos + links to
-- ═══════════════════════════════════════════════════════════════════════════
-- Evolution of the flat "event_albums" gallery. Now two levels:
--   events        — the thing you click into (a header: title, date, cover…)
--   event_media   — contributions under an event: uploaded IMAGES or LINKS
-- Both staff ("club" events) and members can create events, and anyone signed
-- in can add photos/links to an event. Everything is live immediately; staff
-- moderate after the fact (hide / delete). Uploaded images live in the public
-- Storage bucket `event-media`; links are external (Drive / Photos / YouTube…).

-- ── 1. Events (the header / container) ──────────────────────────────────────
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'other'
                 check (category in ('fixture','dinner','tasting','social','event','other')),
  event_date   date,
  description  text,
  cover_url    text,                 -- optional cover (a Storage URL or external link)
  fixture_id   uuid references fixtures(id) on delete set null,
  created_by   uuid references profiles(id) on delete set null,
  creator_name text,
  source       text not null default 'member' check (source in ('club','member')),
  status       text not null default 'visible' check (status in ('visible','hidden')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_events_status  on events (status, event_date desc nulls last, created_at desc);
create index if not exists idx_events_fixture on events (fixture_id);
create index if not exists idx_events_by      on events (created_by);

-- ── 2. Event media (contributions under an event) ──────────────────────────
create table if not exists event_media (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  kind          text not null default 'image' check (kind in ('image','link')),
  url           text not null,       -- Storage public URL (image) OR external link
  storage_path  text,                -- set for uploaded images, so we can delete the object
  caption       text,
  submitted_by  uuid references profiles(id) on delete set null,
  submitter_name text,
  source        text not null default 'member' check (source in ('club','member')),
  status        text not null default 'visible' check (status in ('visible','hidden')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_event_media_event on event_media (event_id, status, created_at desc);
create index if not exists idx_event_media_by    on event_media (submitted_by);

-- ── 3. RLS — read visible-or-admin; all writes go through the API (service role) ──
alter table events enable row level security;
alter table event_media enable row level security;

drop policy if exists "events read" on events;
create policy "events read" on events
  for select using (status = 'visible' or is_admin_uid(auth.uid()));
drop policy if exists "events admin write" on events;
create policy "events admin write" on events
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

drop policy if exists "event_media read" on event_media;
create policy "event_media read" on event_media
  for select using (status = 'visible' or is_admin_uid(auth.uid()));
drop policy if exists "event_media admin write" on event_media;
create policy "event_media admin write" on event_media
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

-- ── 4. Storage bucket for uploaded images (public read; authed upload) ─────
insert into storage.buckets (id, name, public)
  values ('event-media', 'event-media', true)
  on conflict (id) do nothing;

-- Anyone signed in may upload into the bucket; anyone may read (public bucket).
-- Deletes happen through the API under service-role, which bypasses these.
drop policy if exists "event-media authed upload" on storage.objects;
create policy "event-media authed upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'event-media');
drop policy if exists "event-media public read" on storage.objects;
create policy "event-media public read" on storage.objects
  for select using (bucket_id = 'event-media');

-- ── 5. Migrate the flat event_albums rows into the new model ───────────────
-- Each old album becomes an event; if it carried a link, that link becomes one
-- link-media row under it. Safe to re-run (skips albums already migrated).
insert into events (id, title, category, event_date, fixture_id, created_by, creator_name, source, status, created_at)
select a.id, a.title, a.category, a.event_date, a.fixture_id, a.submitted_by, a.submitter_name,
       case when a.source = 'staff' then 'club' else 'member' end, a.status, a.created_at
from event_albums a
where not exists (select 1 from events e where e.id = a.id)
on conflict (id) do nothing;

insert into event_media (event_id, kind, url, caption, submitted_by, submitter_name, source, status, created_at)
select a.id, 'link', a.url, a.caption, a.submitted_by, a.submitter_name,
       case when a.source = 'staff' then 'club' else 'member' end, a.status, a.created_at
from event_albums a
where a.url is not null
  and not exists (select 1 from event_media m where m.event_id = a.id and m.url = a.url);
