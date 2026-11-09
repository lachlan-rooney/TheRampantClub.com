-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS EXHIBITION DOES WITH EACH SENSE.
-- ───────────────────────────────────────────────────────────────────────────
-- lib/studio/senses.ts holds THE ROOM'S METHOD — how The Studio works every
-- time, in one line per sense. That is deliberately general and must stay
-- that way; its own comments say so.
--
-- What was missing is the other half: what THIS show does. Measured on the
-- Rizal Fathoni guide, four of the five tabs carried 26–65 characters and
-- Taste carried 1,618, because food_en and drinks_en gave Taste somewhere to
-- put the specifics and nothing else had anywhere. The aroma is composed with
-- the artist for every exhibition and there was no column to write it in.
--
-- ── WHY A TABLE AND NOT TEN COLUMNS ───────────────────────────────────────
-- sight/touch/taste/sound/scent × en/vn is ten columns on `collaborations`,
-- a table that is already wide, and a sixth sense would be two more. One row
-- per sense per show keeps it flat and lets the admin loop over whatever
-- senses.ts defines rather than over a hardcoded list that can drift from it.
--
-- `sense` is the SENSE'S ENGLISH NAME from senses.ts, lowercased — 'sight',
-- 'touch', 'taste', 'sound', 'scent'. Not an enum: the set lives in that file
-- and a database enum would be a second place to change it.
--
-- ⚠ THE GUIDE WORKS WITHOUT THIS. Read in a request of its own, failure read
--   as "nothing extra for this show", which is exactly what an unrun
--   migration means.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists collaboration_senses (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id) on delete cascade,
  sense text not null,
  body_en text,
  body_vn text,
  updated_at timestamptz not null default now(),
  unique (collaboration_id, sense)
);

create index if not exists collaboration_senses_by_show
  on collaboration_senses (collaboration_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Public, but only for a show that is live or past — the same rule the pieces
-- and the images follow, for the same reason: the guide URL is guessable.
alter table collaboration_senses enable row level security;

drop policy if exists "public reads senses of published" on collaboration_senses;
create policy "public reads senses of published" on collaboration_senses for select
  using (exists (select 1 from collaborations c
                  where c.id = collaboration_id and c.status in ('live','past')));

drop policy if exists "admins write collaboration senses" on collaboration_senses;
create policy "admins write collaboration senses" on collaboration_senses for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop table if exists collaboration_senses;
