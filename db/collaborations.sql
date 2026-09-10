-- ═══════════════════════════════════════════════════════════════════════════
-- THE STUDIO — collaborations.  REVIEW, then run. Idempotent, transactional.
-- ───────────────────────────────────────────────────────────────────────────
-- One row per exhibition. Adding the third collaboration is an INSERT, never a
-- code change — the same lesson as terms_versions, lib/members/surfaces.ts and
-- the four names /members/events drifted into.
--
-- ═══ BILINGUAL FROM THE START ══════════════════════════════════════════════
-- Every prose field is _en/_vn. NULL in _vn means NOT TRANSLATED YET and the
-- page falls back to English rather than rendering an empty block — the rule
-- already set for shift charters and the privacy notice.
--
-- ═══ THE BIOS ARE DELIBERATELY EMPTY ═══════════════════════════════════════
-- Quỳnh Anh Lê's biography DOES NOT EXIST. The media launch pack carries a
-- placeholder — "[Artist biography to be provided by the artist or her gallery
-- representation]" — and a note asking the PR agency to chase it. So there is
-- nothing to insert, and nothing is to be assembled from the web or from a
-- press release: an unapproved bio is both a factual risk and a discourtesy to
-- someone the club is collaborating with.
--
-- Rizal Fathoni's own bio EXISTS (Downloads/Artist Bio - Rizal Fathoni.pdf,
-- 14 Aug 2026) but is NOT pasted here either: extracting it drops commas and
-- joins words, exactly as the calendar PDF did. It must be lifted from the
-- document itself or supplied by him.
--
-- A row with a null bio renders the exhibition WITHOUT a biography section,
-- rather than with an empty heading. That is the intended state until the real
-- text arrives.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

create table if not exists collaborations (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  artist_name    text not null,
  artist_name_vn text,
  title_en       text,                        -- the exhibition's name
  title_vn       text,
  -- 'draft' is invisible to the public; 'live' shows; 'past' moves to the
  -- archive list rather than being deleted. Nothing is ever removed — an
  -- exhibition that happened continues to have happened.
  status         text not null default 'draft'
                 check (status in ('draft','live','past')),
  opens_on       date,
  closes_on      date,
  -- Per-artist accent. This is what replaces guessing a scrim opacity: the
  -- Spaces panels needed a fixed overlay tuned to one photograph and it failed
  -- on the next. Here nothing overlays the artwork at all, and the page takes
  -- its colour from the row.
  accent         text default '#052E20',
  hero_path      text,
  bio_en            text, bio_vn            text,
  collaboration_en  text, collaboration_vn  text,
  event_en          text, event_vn          text,
  food_en           text, food_vn           text,
  drinks_en         text, drinks_vn         text,
  inspiration_en    text, inspiration_vn    text,
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_collab_status on collaborations(status, sort);

-- Ordered image set. storage_path points at the SAME bucket and the same
-- server-side, magic-byte-validated, EXIF-stripped upload path built for entry
-- attachments today. A second uploader would be the mistake.
create table if not exists collaboration_images (
  id               uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id) on delete cascade,
  storage_path     text not null,
  caption_en       text,
  caption_vn       text,
  -- A PAINTING IS NOT CROPPED TO FIT. The page frames by the image's own
  -- orientation instead of forcing every picture through one aspect ratio.
  orientation      text not null default 'portrait'
                   check (orientation in ('portrait','landscape','square')),
  sort             int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_collab_images on collaboration_images(collaboration_id, sort);

-- ═══ RLS ═══════════════════════════════════════════════════════════════════
-- PUBLIC READ, but only what is published. /studio is a public page; a draft
-- collaboration must not be visible before it opens.
alter table collaborations enable row level security;
drop policy if exists "public reads published collaborations" on collaborations;
create policy "public reads published collaborations" on collaborations for select
  using (status in ('live','past'));
drop policy if exists "admins write collaborations" on collaborations;
create policy "admins write collaborations" on collaborations for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

alter table collaboration_images enable row level security;
drop policy if exists "public reads images of published" on collaboration_images;
create policy "public reads images of published" on collaboration_images for select
  using (exists (select 1 from collaborations c
                  where c.id = collaboration_id and c.status in ('live','past')));
drop policy if exists "admins write collaboration images" on collaboration_images;
create policy "admins write collaboration images" on collaboration_images for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ═══ SEED — two rows, both with NULL bios ══════════════════════════════════
-- Copy lifted from the media launch pack, which the author has confirmed was
-- the club's own internal wording — so the confidential stamp does not bar the
-- club from using it. Dates come from the printed invitation, not the pack,
-- where both were still [TBC].
--
-- ⚠ STATUS SAYS 'live'. The invitation gives 6 & 7 February 2026 and the April
-- calendar page says the exhibition "comes to a close" — so this is very
-- probably 'past' by now. Left as 'live' rather than asserting a fact nobody
-- has confirmed; change one word when Lachlan says. The same doubt applies to
-- "Now Showing" on /spaces.
--
-- THE NUMBERS, CORRECTED. The pack says "80 hand-painted bottles" in three
-- places — the press release, the key-facts table, and a suggested interview
-- quote ("80 bottles means 80 decisions about when to stop"). That is wrong:
-- there are 88 COLLABORATION bottles carrying the artist's label, and ONE
-- hand-painted bottle. The quote is the dangerous one, because it puts the
-- error in the artist's own mouth.
insert into collaborations (
  slug, artist_name, title_en, status, sort, accent, opens_on, closes_on,
  collaboration_en, inspiration_en, event_en, food_en, drinks_en)
values (
  'quynh-anh-le', 'Quỳnh Anh Lê', 'Terroir of Memories', 'live', 1, '#8C5A3C',
  date '2026-02-06', date '2026-02-07',
  'A collaboration between Vietnamese contemporary artist Quỳnh Anh Lê and The Octave, the single cask range from Duncan Taylor Scotch Whisky. The exhibition brings together two disciplines united by their relationship to place and memory, examining how meaning accumulates through origin, transformation, and the slow work of time.

Centred on 88 collaboration bottles carrying the artist''s label, alongside a single hand-painted bottle — the first of three by three Vietnamese artists, to be auctioned for charity at the series'' end. A commissioned work, Inside the Cask, imagines the view from within: the unseen interior where whisky slowly becomes itself. An accompanying film, shot in the artist''s Hanoi studio, documents how the work came about.',
  '"What drew me to this collaboration was the idea of terroir — how place becomes character. In whisky, the water, the peat, the wood all leave their mark. In painting, it''s the studio, the light, the accumulated decisions. Memory lives in materials. A cask remembers what it once held. A canvas remembers every layer beneath the surface."

— Quỳnh Anh Lê',
  'Opening night 6 and 7 February 2026, cocktail reception from four until eight, with a meet and greet and live painting. The exhibition was open to the public for two days only.',
  'Canapés developed specifically in response to the works on display.',
  'Cocktails developed specifically in response to the works on display, alongside the Octave Auchentoshan 14 bottled for the exhibition.')
on conflict (slug) do nothing;

insert into collaborations (slug, artist_name, status, sort, accent)
values ('rizal-fathoni', 'Rizal Fathoni', 'draft', 2, '#3F5546')
on conflict (slug) do nothing;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_n int; v_bios int;
begin
  select count(*) into v_n from collaborations;
  if v_n < 2 then raise exception 'SELF-CHECK: expected at least 2 collaborations, found %', v_n; end if;

  select count(*) into v_bios from collaborations where bio_en is not null;
  if v_bios > 0 then
    raise warning 'SELF-CHECK: % biography/ies present. If either was written from a press release or the web rather than approved by the artist, remove it.', v_bios;
  end if;

  raise notice 'The Studio ready — % collaboration(s). Bios are NULL by design until the artists supply them.', v_n;
end $check$;

commit;
