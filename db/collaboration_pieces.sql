-- ═══════════════════════════════════════════════════════════════════════════
-- THE GALLERY GUIDE — one row per piece on the wall, in walking order.
-- ───────────────────────────────────────────────────────────────────────────
-- A guest scans a QR in the room and gets, on their own phone, every piece in
-- the order they will walk past them: the image, the gallery label, and the
-- story. That is what this table holds.
--
-- ── WHY NOT collaboration_images ──────────────────────────────────────────
-- Because it answers a different question. collaboration_images is the SHOW's
-- gallery strip: a storage path, one caption, an orientation and a sort. It
-- has nowhere to put a title, an artist, a year, a medium, dimensions or a
-- description, and widening it would make every existing row half-empty and
-- every existing surface guess which kind of row it was looking at. A piece on
-- the wall and a photograph of the room are not the same object.
--
-- ── WHY A TABLE AND NOT A DATA FILE ───────────────────────────────────────
-- The Studio's content already lives in Postgres and is edited at
-- /admin/studio. A pieces array in a .ts file would mean the gallery guide is
-- the one part of the Studio that needs a developer and a deploy to correct a
-- typo, in a room whose labels change every quarter. It goes where the rest of
-- the Studio's content goes.
--
-- ── BILINGUAL BY DEFAULT ──────────────────────────────────────────────────
-- _en / _vn throughout, the same as collaborations. A guest in this room is as
-- likely to read Vietnamese as English. Where the Vietnamese is missing the
-- page falls back to the English through lib/lang's `pick` — never an empty
-- card.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists collaboration_pieces (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id) on delete cascade,

  -- THE WALKING ORDER. Not a gallery sort: the sequence a guest physically
  -- passes the work in, which is the whole premise of a self-guided guide.
  sort int not null default 0,

  title_en text, title_vn text,

  -- Usually the exhibition's own artist, so it is NULLABLE and the page falls
  -- back to collaborations.artist_name. It exists for the group show, the
  -- collaboration, and the piece that is not by the headline name.
  artist_name text,

  -- TEXT, not int. Gallery labels say "2024", "2023–24", "n.d." and
  -- "c. 1890"; an integer column cannot hold three of those four.
  year text,

  medium_en text, medium_vn text,

  -- As the label prints it ("120 × 90 cm"), not as numbers to be formatted.
  -- Sculpture is three dimensions, a diptych is two sets, and a plinth piece
  -- quotes its height alone.
  dimensions text,

  -- A public URL in the event-media bucket, the same convention
  -- collaboration_images.storage_path uses, so one uploader serves both.
  image_path text,

  description_en text, description_vn text,

  -- The story behind the work, where there is one to tell. Separate from the
  -- description because a provenance line is a fact and a description is prose.
  provenance text,

  created_at timestamptz not null default now()
);

create index if not exists collaboration_pieces_walk
  on collaboration_pieces (collaboration_id, sort);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Read is PUBLIC, because the whole point is a guest with no account scanning
-- a code in the room. But only for a show that is live or past: a draft
-- exhibition's pieces must not be readable before it opens, which is the same
-- rule collaboration_images follows and for the same reason — the guide URL is
-- guessable from the slug.
alter table collaboration_pieces enable row level security;

drop policy if exists "public reads pieces of published" on collaboration_pieces;
create policy "public reads pieces of published" on collaboration_pieces for select
  using (exists (select 1 from collaborations c
                  where c.id = collaboration_id and c.status in ('live','past')));

drop policy if exists "admins write collaboration pieces" on collaboration_pieces;
create policy "admins write collaboration pieces" on collaboration_pieces for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop table if exists collaboration_pieces;
