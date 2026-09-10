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
-- STATUS 'past'. Confirmed: it ran 6 & 7 February 2026. /spaces no longer says
-- "Now Showing" either — a stale one reads as neglect where naming it as the
-- most recent reads as deliberate. This is also what makes the archive on
-- /studio real rather than theoretical: the first collaboration is already in
-- it, and Rizal is next.
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
  'quynh-anh-le', 'Quỳnh Anh Lê', 'Terroir of Memories', 'past', 1, '#8C5A3C',
  date '2026-02-06', date '2026-02-07',
  'A collaboration between Vietnamese contemporary artist Quỳnh Anh Lê and The Octave, the single cask range from Duncan Taylor Scotch Whisky. The exhibition brings together two disciplines united by their relationship to place and memory, examining how meaning accumulates through origin, transformation, and the slow work of time.

Centred on 88 collaboration bottles carrying the artist''s label, alongside a single hand-painted bottle — the first of three by three Vietnamese artists, to be auctioned for charity at the series'' end. A commissioned work, Inside the Cask, imagines the view from within: the unseen interior where whisky slowly becomes itself. An accompanying film, shot in the artist''s Hanoi studio, documents how the work came about.',
  '"What drew me to this collaboration was the idea of terroir — how place becomes character. In whisky, the water, the peat, the wood all leave their mark. In painting, it''s the studio, the light, the accumulated decisions. Memory lives in materials. A cask remembers what it once held. A canvas remembers every layer beneath the surface."

— Quỳnh Anh Lê',
  'Opening night 6 and 7 February 2026, cocktail reception from four until eight, with a meet and greet and live painting. The exhibition was open to the public for two days only.',
  'Canapés developed specifically in response to the works on display.',
  'Cocktails developed specifically in response to the works on display, alongside the Octave Auchentoshan 14 bottled for the exhibition.')
on conflict (slug) do nothing;

-- Rizal Fathoni's biography, in HIS OWN WORDS, from Downloads/Artist Bio -
-- Rizal Fathoni.pdf. TRANSCRIBED BY EYE from the rendered pages, not taken from
-- the text layer: extracting that file drops commas and joins words, and it
-- produced "Surabaya 1998 is an artist" and "frommemory". A bio is the last
-- place to accept silent corruption.
--
-- The file is titled "Artist Biography — English Rizal Fathoni", which implies
-- another language version exists. Worth asking him for it rather than
-- translating this one.
insert into collaborations (slug, artist_name, status, sort, accent, bio_en)
values ('rizal-fathoni', 'Rizal Fathoni', 'draft', 2, '#3F5546',
'Rizal Fathoni, known as Toni (b. Surabaya, 1998), is an artist whose practice emerges from memory, personal experience, anxieties, and the pleasures found within everyday life. Born and raised in Surabaya during a period marked by Indonesia''s economic crisis in the late 1990s, his early life became part of a personal landscape of memory that continues to inform the way he perceives life and approaches his artistic practice.

Toni''s relationship with art began in childhood. From kindergarten, he was already actively involved in art activities and competitions, gradually developing an intuitive relationship with image-making and visual expression. His artistic sensibility was also deeply influenced by his father, an architect with a strong ability to draw. Through this relationship, art was introduced to Toni not merely as an activity, but as a way of seeing, observing, and understanding the world.

In his practice, Toni often finds himself working through what might be described as a process of memory. His works emerge from accumulated experiences, personal anxieties, moments of pleasure, and seemingly ordinary encounters that leave traces within him. As a result, his works can shift between the playful and the contemplative, between spontaneity and seriousness, and at times between intimacy and confrontation.

Play is an essential part of Toni''s creative process. Within his works, he allows himself the freedom to play without having to fully control the outcome. This play can become a form of protest, a reminder, an escape, or simply a way of engaging with things that cannot always be articulated through language. For Toni, seriousness does not necessarily require rigidity. Instead, it can coexist with intuition, freedom, humor, and experimentation.

The making of each work follows its own rhythm. Some works emerge almost instinctively and within a short period of time, while others demand a longer process of repetition, reconsideration, and revision. Rather than imposing a fixed methodology, Toni allows each work to determine its own pace and direction.

At the core of his practice is a commitment to honesty. Toni does not seek to disguise what lies behind each work. For him, making art is inherently difficult because a work is never simply an image or an object; it carries a part of the artist himself. Each piece becomes a personal record of what he has experienced, questioned, remembered, enjoyed, resisted, and perhaps failed to fully understand.

Ultimately, Toni''s practice is an on going attempt to understand himself through art. He does not regard artistic practice as a destination or a finished achievement, but as a continuous process of questioning, refining, and discovering new possibilities. To make art, for Toni, is to remain willing to confront oneself and to keep trying to make something more honest each day.')
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
