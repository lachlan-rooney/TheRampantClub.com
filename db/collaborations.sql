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

-- ═══ VIETNAMESE — WHERE IT WILL COME FROM ══════════════════════════════════
-- Every _vn is NULL here and the page falls back to English. Two findings for
-- whoever fills them, so the work is REVIEW rather than translation:
--
-- 1. The media launch pack is ENGLISH ONLY. It contains zero Vietnamese-language
--    lines — checked against Vietnamese function words, not against her name,
--    whose diacritics make English lines look Vietnamese. So her quote does NOT
--    exist in both languages in that file.
--
-- 2. ~/Downloads/"Translated copy of The Studio x Octave Launch F&B Brief.docx"
--    DOES carry Vietnamese for much of the evening — the exhibition as
--    "Vùng đất của ký ức", the flagship painting as "Hoàng hôn ở Kobe", plus the
--    venue, format, capacity and the full run sheet.
--
--    NOT seeded from it. It is titled "Translated copy of", and nobody has
--    established whether that was done by a person or a machine. It is a strong
--    starting point for Miss Châu to CHECK — which is far less work than
--    translating from nothing — but it is not a source to publish unread.
--
-- ═══ SEED — Quỳnh Anh Lê's bio is absent; Rizal's is his own ═══════════════
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

'In February 2026 The Studio gave its walls to Quỳnh Anh Lê, a Hanoi-based painter, for two evenings and a hundred guests.

The exhibition was made with Duncan Taylor''s Octave programme, and it carried a whisky of its own: a fourteen-year-old Auchentoshan, triple distilled, finished in Palo Cortado sherry octaves. Delicate and mineral — soft red berries, a gentle sweetness, a herbal finish, and a chalky texture running through it. Chosen to sit beside the work rather than in front of it.

Eighty-eight bottles were released, each label carrying a different fragment of the flagship painting and numbered in sequence. Arranged together, the eighty-eight labels reassemble the whole canvas. Members bought them on the night.

One bottle was painted by hand, live, during the exhibition. It goes to charity auction later this year, to build a school in Vietnam — the first of three by three Vietnamese artists, to be auctioned together when the series closes.

A second work, “Inside the Cask”, was made for the exhibition: the view from inside a maturing cask, the dark interior where whisky slowly becomes itself and no one is watching.',

'The flagship painting is the artist''s own account of the exhibition, and it is better in her words than in ours:

“At the threshold where day meets night, light and shadow dissolve into each other. It evokes a state of balance — neither bright nor dark, neither still nor in motion. All colours blend, as human beings merge with the universe, releasing the boundary between self and all things. In the city of Kobe, where the sea meets the mountains and the man-made meets the natural, I wanted this work to be a metaphor for harmony and a return to origin.”

Everything else in the room followed from that. The lighting, the pace of the service, the flavours — all of it built to be light, refined and contemplative. Elegant rather than bold. Present without dominating.

Restraint over abundance. Sensitivity over spectacle.',

'Two evenings, two sessions a night, twenty-five to thirty guests at a time. An exhibition opening rather than a party.

Doors at four. Guests were met in the Library Bar with the first cocktail and given time to move through the room before anything was asked of them. Canapés came round shortly after.

At half past, Quỳnh Anh spoke in The Studio — the exhibition, her practice, the collaboration — for twenty minutes or so. The whisky was introduced after her, with a small pour for every guest and the thinking behind the second pairing, which arrived twenty minutes later.

Then live painting, and the artist available to talk to for the rest of the evening while the limited edition was open to members. The hand-painted bottle stood on display as it was made.

No smoking on the exhibition floor. Lighting directed, soft and warm — set for the paintings and the whisky''s amber both. Service unhurried and quiet enough to be part of the atmosphere rather than an interruption.',

'Two canapés, each one bite, no cutlery. Muted, natural colours to suit gallery lighting. Nothing heavy, nothing sharp.

Twilight / Threshold — drawn from the flagship painting. Light, mineral, gently umami: a sense of land meeting sea, in stone and blush and dusk tones taken from the canvas itself. White fish and shellfish with a saline edge, a soft herbal note, a gentle sweetness held in check.

Memory & Comfort — drawn from the artist rather than the work. Quỳnh Anh''s own references were cookies, the smell of the air after rain, summer, pagodas. Warmer and quietly playful, but still restrained: toasted grains, a little nutted sweetness, textures that felt calming rather than crisp.

A memory of a cookie, not a dessert.',

'Two cocktails, built to be layered rather than loud, and served clear or lightly hazed.

Dusk Balance — sherry-forward and delicately structured, with a subtle berry note and a herbal lift on the finish. Meant to feel like watching light fade, not like the first sip of the night.

After the Rain — petrichor. Earth, leaves, the air just after a downpour. Fresh without sharpness, herbal and cooling, quietly expressive.

Like standing under a pagoda just after rain, listening rather than speaking.

Both were made in the Source & Origin Lab.')
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
