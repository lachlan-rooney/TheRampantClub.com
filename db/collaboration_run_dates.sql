-- ═══════════════════════════════════════════════════════════════════════════
-- COLLABORATIONS · the opening and the run are different things.
-- REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- Rizal Fathoni's live painting and private viewing are 11–12 November, but the
-- exhibition then HANGS FOR THREE MONTHS for members. One pair of dates cannot
-- carry both: if opens_on/closes_on hold the opening, the page calls the
-- exhibition "Past" from 13 November while the work is still on the wall for
-- another eleven weeks.
--
-- So: opens_on/closes_on are THE RUN — the period a member can walk in and see
-- it, which is what "On now" has to mean — and the opening event gets its own
-- pair. The page derives its tense from the run.
--
-- The same distinction applies backwards to Terroir of Memories: 6–7 February
-- was its opening, and the April calendar page recorded it closing later. Its
-- opening dates are set here; its true run end is NOT invented — see below.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table collaborations add column if not exists opening_from date;
alter table collaborations add column if not exists opening_to   date;
comment on column collaborations.opens_on is
  'First day a member can see the exhibition. THE RUN, not the opening — the page reads its tense from this.';
comment on column collaborations.opening_from is
  'The launch event, if there was one. Separate from the run: an opening is two nights, a run is months.';

-- ── Rizal: opening 11–12 Nov, hanging for three months ────────────────────
update collaborations
   set opening_from = date '2026-11-11',
       opening_to   = date '2026-11-12',
       opens_on     = date '2026-11-11',
       closes_on    = date '2027-02-11',
       event_en     = 'Live painting and a private viewing of the new collection on 11 and 12 November. The exhibition then hangs in The Studio for three months, for members.',
       updated_at   = now()
 where slug = 'rizal-fathoni';

-- ── Quỳnh Anh: the opening is known; the run's end is NOT ──────────────────
-- 6–7 February was the opening. The April calendar page says the exhibition
-- "comes to a close", so the run plainly continued past February — but nobody
-- has said on which day it ended, so no date is invented here. closes_on is
-- left as it stands; the page reads "Past" either way, so nothing is currently
-- wrong on screen, and the missing fact is recorded rather than filled in.
update collaborations
   set opening_from = date '2026-02-06',
       opening_to   = date '2026-02-07',
       updated_at   = now()
 where slug = 'quynh-anh-le';

do $check$
declare r record;
begin
  for r in select slug, opening_from, opens_on, closes_on from collaborations order by sort loop
    -- A run that ends before it opens, or an opening outside its own run, is
    -- the kind of thing that reads fine in a form and is nonsense on a page.
    if r.closes_on is not null and r.opens_on is not null and r.closes_on < r.opens_on then
      raise exception 'SELF-CHECK: % closes before it opens (% → %)', r.slug, r.opens_on, r.closes_on;
    end if;
    if r.opening_from is not null and r.opens_on is not null and r.opening_from < r.opens_on then
      raise exception 'SELF-CHECK: %s opening (%) is before its run starts (%)', r.slug, r.opening_from, r.opens_on;
    end if;
  end loop;

  select slug, opens_on, closes_on into r from collaborations where slug = 'rizal-fathoni';
  if r.closes_on <> date '2027-02-11' then raise exception 'SELF-CHECK: Rizal run ends %, expected 2027-02-11', r.closes_on; end if;

  raise notice 'Runs and openings separated. Rizal hangs 11 Nov 2026 → 11 Feb 2027; the page calls it Forthcoming until the 11th, then On now for three months.';
end $check$;

commit;
