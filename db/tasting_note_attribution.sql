-- ═══════════════════════════════════════════════════════════════════════════
-- TASTING NOTES: SAY WHO WROTE IT.                        REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner's ruling, 2026-10-08: fix the tasting-note attribution BEFORE the tap
-- is ever used. It has not been used: tasting_notes holds 0 rows as of today,
-- so this lands ahead of the first real note and there is nothing to backfill.
--
-- ── THE PROBLEM ───────────────────────────────────────────────────────────
-- tasting_notes.note is NOT NULL, with a check that it is at least one
-- character long. The kiosk's one-tap "what are you drinking?" collects no
-- prose by design — the flavour families come from the whisky, not from the
-- member — so it had nothing to put in a column that insists on something.
--
-- It wrote a sentence of its own: "Poured in The Library Bar." stored against
-- author = the member. Which means the member's own journey timeline renders
-- it in quotation marks under the heading "you noted it", and the club has put
-- words in a member's mouth. Small words, true words, and still not theirs.
--
-- ── THE DECISION ──────────────────────────────────────────────────────────
-- A flag, not a nullable column. The ruling allowed either; the flag is better
-- on three counts:
--
--   1 · The sentence is worth keeping. "Poured in The Library Bar" is a true
--       record of what happened, in the member's own language, and it reads
--       properly in a list where the alternative is a blank line.
--   2 · Nothing weakens. A nullable note column would let any future writer
--       insert an empty note by accident, and every reader in the estate would
--       need a null guard.
--   3 · It is additive. A reader that has not been updated still shows a true
--       sentence rather than breaking — it just does not yet say whose it is.
--
-- composed = true means THE CLUB WROTE THIS, NOT THE MEMBER. Readers must
-- render it as the club's record and never as the member's prose. The member
-- can still edit it, and the moment they type their own words the flag goes
-- false — the note becomes theirs, which is the whole point of the tap.
--
-- ── WHAT DOES NOT CHANGE ──────────────────────────────────────────────────
-- Nothing about the palate derivation. lib/whisky/derive-taste.ts blends the
-- WHISKY's flavour families at weight 2 per note and never reads the note
-- text, so a composed body has never been able to bend a taste profile. This
-- is a question of attribution and of what a member is shown, not of data
-- quality in the model.
--
-- RLS is untouched: the existing policies key on author and visibility, and a
-- new boolean column is covered by them as they stand. Tasting notes have been
-- PRIVATE ONLY since the Snug was stood down on 2026-10-01.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if to_regclass('public.tasting_notes') is null then
    raise exception 'PREREQUISITES MISSING — tasting_notes'
      using hint = 'Run db/social_substrate.sql first. Nothing applied.';
  end if;
end $prereq$;

alter table public.tasting_notes
  add column if not exists composed boolean not null default false;

comment on column public.tasting_notes.composed is
  'TRUE = the club composed this body, not the member. Set by the kiosk one-tap pour log, which collects no prose. Readers MUST render a composed note as the club''s record and never as the member''s words. Goes FALSE the moment the member writes their own.';

-- Only the composed ones are ever rewritten wholesale by a member edit, and
-- the member-facing journal filters and badges on this, so it is worth an
-- index on the member's own slice rather than a full scan per page view.
create index if not exists idx_tasting_notes_author_composed
  on public.tasting_notes (author, composed);

-- ── IF THIS EVER RUNS SOMEWHERE WITH ROWS ─────────────────────────────────
-- It is being run here against 0 rows. On any other environment, the notes
-- the kiosk composed are identifiable by the exact four sentences the route
-- has ever written — and ONLY those, anchored to the start of the body, so a
-- member who genuinely typed "Poured in the garden, lovely" is not relabelled
-- as the club's.
update public.tasting_notes
   set composed = true
 where composed = false
   and (
     note = 'Poured at the club.'
     or note = 'Đã uống tại câu lạc bộ.'
     or note ~ '^Poured in [^.]{1,60}\.$'
     or note ~ '^Đã uống tại [^.]{1,60}\.$'
   );

do $report$
declare n_composed int; n_total int;
begin
  select count(*) filter (where composed), count(*) into n_composed, n_total
    from public.tasting_notes;
  raise notice 'tasting_notes: % of % rows marked composed', n_composed, n_total;
  if n_total > 0 and n_composed = n_total then
    raise notice 'ALL rows are composed — no member has written their own note yet.';
  end if;
end $report$;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- The column is there, defaults false, and is not nullable:
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema='public' and table_name='tasting_notes' and column_name='composed';
--   → composed | boolean | NO | false
--
-- Nothing was relabelled that should not have been (0 rows today, so 0/0):
--   select composed, count(*) from public.tasting_notes group by 1;
--
-- Then: scripts/verify-note-attribution.mjs, which proves a one-tap note is
-- written composed=true, a typed note composed=false, and that a member's edit
-- flips it — and which FAILS if the flag is missing or always the same value.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Dropping the column loses only the attribution, never a note body, and the
-- kiosk route must be reverted in the same breath or it will 500 on an
-- unknown column:
--   drop index if exists public.idx_tasting_notes_author_composed;
--   alter table public.tasting_notes drop column if exists composed;
-- Stepping back puts the club's sentences back in members' mouths, which is
-- the state this file exists to end. Prefer fixing forward.
