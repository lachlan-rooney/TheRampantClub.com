-- ═══════════════════════════════════════════════════════════════════════════
-- THE STUDIO · RIZAL FATHONI — the page, from the launch brief.
--                                                        REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Source: "Studio Octave Launch Brief — Rizal Fathoni × The Rampant Club ×
-- Duncan Taylor", 3 Oct 2026, drawing on the artist's questionnaire of
-- 1 Oct 2026. Dates confirmed by the owner the same day: the 10th and 11th.
--
-- The row already exists (slug 'rizal-fathoni', status 'live') with his bio and
-- hero image. This fills the public sections and moves the dates. It does NOT
-- touch bio_en, hero_path, signature_path or accent.
--
-- ═══ WHAT IS DELIBERATELY NOT WRITTEN ══════════════════════════════════════
-- The brief is a PRODUCTION document and this is a PUBLIC page. Four things in
-- it are either not decided yet or not for members' eyes, and inventing them
-- here would put the club's name to them:
--
--  1 · THE WHISKY. The brief gives a direction to pursue — Highland or Islay,
--      light-to-medium peat, dry sherry or port, 12–18 years — and says plainly
--      that the selection is "to be confirmed". Quỳnh Anh Lê's page names her
--      whisky down to the cask because hers was chosen. His is not, so the
--      section says a bottling is coming and nothing more. Tasting notes on a
--      public page for a whisky nobody has selected is a promise the club would
--      have to keep.
--
--  2 · THE EXHIBITION TITLE. "Terroir of Memories" is on her page. The brief
--      gives Rizal no title at all, so title_en stays null — the page renders
--      without one rather than carrying a name he has not given it.
--
--  3 · HIS OWN WORDS. The inspiration section renders under the heading "In the
--      artist's words" with his name signed beneath it (components/
--      StudioExhibition.tsx → Words). The brief gives fragments — "white,
--      mysterious, intense", "smoke, oud, old books, earth after rain" — not
--      sentences. Composing a quotation out of fragments and signing an
--      artist's name to it is not something a page should do, so
--      inspiration_en stays null until he has given a sentence. His
--      questionnaire of 1 October presumably has them verbatim.
--
--  4 · THE PRODUCTION DETAIL. Room design, lighting, the sound direction, the
--      programme timings, "no pork (artist preference)", the press and
--      interpreter notes, the auction's H2 schedule. All internal, none of it
--      members' reading, and the auction date in particular is marked TBC.
--
-- ═══ ⚠ TWO THINGS TO SETTLE, NOT DECIDED HERE ══════════════════════════════
--
--  A · RESOLVED BY THE OWNER, 2026-10-03 — and worth recording, because the
--      live text had it wrong twice. It said "Live painting and a private
--      viewing of the new collection on 11 and 12 November". The live painting
--      is on the 13th, and it is not at The Studio: it is at the Independence
--      Palace. So the published page had the wrong dates AND the wrong venue
--      for the one part of the collaboration that happens somewhere else.
--
--      THREE DATES NOW: the opening at The Studio on the 10th and 11th, and the
--      live painting at the Palace on the 13th.
--
--      ⚠ STILL OPEN: whether members are invited to the Palace, or whether it is
--      a press and public occasion. The page states that it happens and does not
--      imply an invitation either way — say which and it is one sentence.
--      Also unstated: where the hand-painted charity bottle is painted. Quỳnh
--      Anh's was painted live during her own exhibition, so the Palace is the
--      obvious guess and a guess is not what this page is for. It is left out.
--
--  B · "AFTER THE RAIN" IS ALREADY TAKEN. It is the name of Quỳnh Anh Lê's
--      second cocktail, on her page, in this same series — and hers is
--      petrichor too: "Earth, leaves, the air just after a downpour." The
--      brief's Pairing Two cocktail has the same name and the same idea
--      ("Petrichor aromatics: wet earth, green leaves").
--
--      On one page that is a coincidence. On two pages of one series it reads as
--      a copy-paste, and the second one looks like the first one's leftovers.
--
--      NAMED 2026-10-05, owner's call ("random name for the cocktail"):
--      RAIN & OUD. Both words are his own, from the brief's sensory list —
--      "earth after rain" and oud — and it takes the ampersand of Smoke &
--      Stone, so his two cocktails read as a matched pair the way hers did
--      (Dusk Balance · After the Rain). Nothing is borrowed from her page.
--
--  C · HE DOES NOT LIVE IN JAKARTA. The brief calls him "Jakarta-based"; his
--      own artist bio PDF — "Artist Bio - Rizal Fathoni.pdf", the source of the
--      bio_en already on the page — says "Resides and works in Bali/Surabaya".
--      Jakarta is where he has EXHIBITED (Semesta Gallery, Ashta District).
--      The page follows his own document, not the brief.
--
--  D · STILL NO EXHIBITION TITLE. Checked every PDF, .docx and .pptx in
--      ~/Downloads on 2026-10-05: his bio PDF is the only file that mentions
--      him, and its "Exhibition" page lists PAST shows — Asmaraloka Chapter
--      (2025, 2024), UYCC Continuity (2022), Legasy "After Through This"
--      (2021) — not this one. So the title is not on this machine. title_en
--      stays null until he gives one.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if to_regclass('public.collaborations') is null then
    raise exception 'PREREQUISITES MISSING — collaborations' using hint = 'Nothing applied.';
  end if;
  if not exists (select 1 from public.collaborations where slug = 'rizal-fathoni') then
    raise exception 'no rizal-fathoni row to update'
      using hint = 'Run db/collaborations.sql first. Nothing applied.';
  end if;
end $prereq$;

update public.collaborations set
  -- ── THE DATES (owner, 2026-10-03: "It's going to be the 10th and 11th") ──
  -- closes_on is NOT moved: 2027-02-11 is the end of the quarterly hang, and
  -- opening a day earlier does not shorten the exhibition. Say so if it should.
  opens_on     = '2026-11-10',
  opening_from = '2026-11-10',
  opening_to   = '2026-11-11',

  collaboration_en =
'In November 2026 The Studio gives its walls to Rizal Fathoni, a painter who lives and works between Bali and Surabaya, for a solo exhibition — the second collaboration in Duncan Taylor''s Octave programme after Quỳnh Anh Lê''s.

Where the first was built on softness and stillness, this one carries a different charge. The artist''s references are smoke, rain, rough texture and intensity, and the work is stark where hers was quiet: red, black, dark grey, white.

A whisky is being chosen for him, and it will be introduced on the opening night.

Eighty bottles will be released, each label carrying a different fragment of the flagship painting. One bottle is painted by hand and goes to charity auction, alongside the one Quỳnh Anh painted — three works by three artists, to be auctioned together when the series closes.',

  event_en =
'Two evenings in The Studio, 10 and 11 November, for sixty to eighty invited guests. An exhibition opening rather than a party.

Guests are met with the first cocktail and given time to move through the room before anything is asked of them. Canapés come round shortly after.

Rizal speaks about the exhibition and his practice, with an interpreter to hand. The whisky is introduced after him, with a small pour for every guest, and the second pairing arrives a little later.

Then the room is open — the artist available to talk to for the rest of the evening, and the limited edition open to members.

On the 13th he paints live at the Independence Palace.

The exhibition hangs in The Studio until February.',

  food_en =
'Two canapés, each one bite, no cutlery. Served on dark slate and black ceramic — the room is stark and the food should not apologise for it.

Char & Contrast — drawn from the paintings. Meat-forward and visibly charred, bold with salt and dark spice, rough enough to look hand-formed rather than arranged. The palette is the canvas''s: dark, red, black, one point of brightness. Nothing delicate, nothing sweet.

Malang Memory — drawn from the artist rather than the work. Rizal''s own references are gentler than his paintings suggest: the small Javanese city he comes from, the smell of rain and old books, pastel de nata, the forest. Warm, soft, a little sweet, Indonesian and Portuguese at once — a moment of reprieve inside the intensity.

Comfort, not dessert.',

  drinks_en =
'Two cocktails, dry and low in sweetness, served clear or dark. No pastel tones, and garnish only where it does something.

Smoke & Stone — drawn from the paintings. A smoky base, savoury rather than sweet, finishing on leather and earth with something darker underneath. Meant to feel like picking up a river stone that has been sitting in the sun.

Rain & Oud — drawn from the artist. Petrichor: wet earth, green leaves, the air after a downpour, with coffee and oud behind it. Served cool but not iced, and grounding rather than refreshing. Like sitting on a porch in Malang watching the rain stop.

Both are made in the Source & Origin Lab.',

  updated_at = now()
where slug = 'rizal-fathoni';

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- The dates moved and the hang did not:
--   select slug, opens_on, opening_from, opening_to, closes_on
--     from public.collaborations where slug = 'rizal-fathoni';
--   → 2026-11-10 · 2026-11-10 · 2026-11-11 · 2027-02-11
--
-- The four public sections are filled and the two withheld ones are not:
--   select (collaboration_en is not null) as collab, (event_en is not null) as event,
--          (food_en is not null) as food,            (drinks_en is not null) as drinks,
--          (title_en is null)   as no_title_yet,     (inspiration_en is null) as no_words_yet,
--          (bio_en is not null) as bio_untouched
--     from public.collaborations where slug = 'rizal-fathoni';
--   → t t t t t t t
--
-- Nothing claims a whisky, and the borrowed cocktail name is not there:
--   select collaboration_en ilike '%year-old%' or collaboration_en ilike '%cask%'
--            or drinks_en ilike '%peat%' as names_a_whisky,
--          drinks_en ilike '%after the rain%'                as borrowed_name,
--          drinks_en ilike '%Rain & Oud%'                     as second_is_named,
--          collaboration_en ilike '%Jakarta%'                 as wrong_city
--     from public.collaborations where slug = 'rizal-fathoni';
--   → f f t f
--
-- The three dates read correctly, and the Palace is named:
--   select event_en ilike '%10 and 11 November%' as opening_dates,
--          event_en ilike '%13th%'               as painting_date,
--          event_en ilike '%Independence Palace%' as venue,
--          event_en ilike '%12 November%'        as stale_date_gone
--     from public.collaborations where slug = 'rizal-fathoni';
--   → t t t f
--
-- Then open /studio/rizal-fathoni and read it as a member would.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Restores the row to the state this file found it in — his bio and hero stay
-- either way, because they were never touched:
--   update public.collaborations set
--     opens_on = '2026-11-11', opening_from = '2026-11-11', opening_to = '2026-11-12',
--     collaboration_en = null, food_en = null, drinks_en = null,
--     event_en = 'Live painting and a private viewing of the new collection on 11 and 12 November. The exhibition then hangs in The Studio until February.',
--     updated_at = now()
--   where slug = 'rizal-fathoni';
-- ⚠ That event_en is the live text as of 2026-10-03, truncated in the read I
--   took it from at 151 characters — check it against the page before relying
--   on this line to restore it word for word.
