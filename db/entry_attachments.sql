-- ═══════════════════════════════════════════════════════════════════════════
-- ENTRY ATTACHMENTS — one file (image or PDF) on a fixture or calendar entry.
-- REVIEW, then run. Additive, idempotent, transactional.
-- ───────────────────────────────────────────────────────────────────────────
-- Events arrive as artwork: an invitation, a menu, a poster. There was nowhere
-- to put one, so the Ken Grier evening has a description and nothing else.
--
-- ═══ WHY A NEW TABLE AND NOT event_media ═══════════════════════════════════
-- event_media is the GALLERY: member-submitted, staff-moderated links keyed to a
-- gallery `event_id`, with a moderation `status`. This is a different thing —
-- ADMIN-ONLY, one file, attached to a fixture or a calendar entry, no
-- moderation. Bending one table to both would give every row half a meaning.
--
-- The UPLOAD PATTERN is reused, which is what actually matters: server-side
-- through the service role, validated by content, re-encoded for images. NOT the
-- gallery's client-direct upload, which takes Content-Type from the browser and
-- strips no EXIF.
--
-- ═══ WHY A PRIVATE BUCKET ══════════════════════════════════════════════════
-- The obvious reuse was the existing `event-media` bucket. It is PUBLIC, so
-- every object is world-readable by URL — a staff-only entry's file would be
-- reachable by anyone holding the link, which is exactly what must not happen.
-- It is also images-only, so a PDF invitation could not be stored at all.
-- `entry-attachments` is private; files are served through a route that checks
-- the entry's visibility first and mints a short-lived signed URL.
--
-- ONE PER ENTRY, enforced by the unique index below. Several would be nearly
-- free — drop the index and the table already supports them — but a gallery is
-- explicitly not wanted here.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- ═══ PREREQUISITES ═════════════════════════════════════════════════════════
do $prereq$
declare v_missing text[] := '{}'; v_x text;
begin
  foreach v_x in array array['fixtures','calendar_entries'] loop
    if not exists (select 1 from information_schema.tables
                    where table_schema='public' and table_name=v_x)
      then v_missing := v_missing || ('table ' || v_x); end if;
  end loop;
  if array_length(v_missing,1) > 0 then
    raise exception 'ENTRY ATTACHMENTS: PREREQUISITES MISSING — %', array_to_string(v_missing, ', ')
      using hint = 'Run db/fixtures.sql and db/calendar_entries.sql first. Nothing applied.';
  end if;
end $prereq$;

create table if not exists entry_attachments (
  id            uuid primary key default gen_random_uuid(),
  -- Polymorphic on purpose: the two event tables are separate and neither is
  -- going to grow a foreign key to the other. Orphans are swept by the delete
  -- routes, which is why there is no FK here.
  entity_type   text not null check (entity_type in ('fixture','calendar_entry')),
  entity_id     uuid not null,
  storage_path  text not null,
  mime          text not null check (mime in ('image/jpeg','image/png','image/webp','application/pdf')),
  bytes         integer not null check (bytes > 0 and bytes <= 5242880),   -- 5MB
  filename      text not null,
  -- What the file IS, decided by its MAGIC BYTES server-side, never by its
  -- extension or the browser's Content-Type. A .jpg that is actually HTML,
  -- served from our own origin, is stored XSS — and these files come from
  -- outside partners, which is exactly the untrusted case.
  verified_kind text not null check (verified_kind in ('jpeg','png','webp','pdf')),
  uploaded_by   uuid references profiles(id),
  created_at    timestamptz not null default now()
);

create unique index if not exists idx_entry_attachments_one_per_entry
  on entry_attachments (entity_type, entity_id);

alter table entry_attachments enable row level security;

-- No member-facing policy AT ALL, deliberately. Members never read this table
-- directly: files are served by a route that checks the entry's visibility and
-- then signs a URL. A read policy here would be a second, weaker answer to the
-- same question.
drop policy if exists "admins rw entry_attachments" on entry_attachments;
create policy "admins rw entry_attachments" on entry_attachments for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

comment on table entry_attachments is
  'One admin-uploaded file per fixture or calendar entry. Private bucket entry-attachments; served via /api/entries/attachment/[id] after a visibility check. Not the gallery (event_media).';

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
begin
  if not exists (select 1 from pg_indexes
                  where schemaname='public' and indexname='idx_entry_attachments_one_per_entry') then
    raise exception 'SELF-CHECK: the one-per-entry unique index is missing';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname='public' and tablename='entry_attachments') then
    raise exception 'SELF-CHECK: RLS is enabled with NO policy — admins would be locked out';
  end if;
  raise notice 'entry_attachments ready — one file per entry, admin-only, 5MB cap.';
end $check$;

commit;
