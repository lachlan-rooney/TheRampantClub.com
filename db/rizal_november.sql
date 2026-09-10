-- ═══════════════════════════════════════════════════════════════════════════
-- RIZAL FATHONI · 11–12 November 2026.  REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- Live painting and a private viewing of the new collection.
--
-- STATUS BECOMES 'live', WHICH DOES NOT MEAN "ON NOW". Since the page derives
-- its tense from the dates, `status` controls only whether the public can see
-- the row at all. With 11 November in the future the page reads "Forthcoming"
-- and the names index marks it "soon"; on the 11th it reads "On now"; on the
-- 13th it reads "Past". Nobody has to change a word on any of those days, which
-- is the whole reason "Now Showing" went stale in the first place.
--
-- His BIO is already in place and is his own writing. Every other section is
-- deliberately empty and will not render until there is something true to put
-- in it — the exhibition has not happened yet, so there is no event, food or
-- drinks copy to write, and inventing some would be the same error as writing
-- a biography for an artist who has not approved one.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

update collaborations
   set opens_on  = date '2026-11-11',
       closes_on = date '2026-11-12',
       status    = 'live',
       event_en  = 'Live painting, and a private viewing of the new collection.',
       updated_at = now()
 where slug = 'rizal-fathoni';

do $check$
declare v record;
begin
  select slug, status, opens_on, closes_on, (bio_en is not null) as has_bio
    into v from collaborations where slug = 'rizal-fathoni';

  if not found then raise exception 'SELF-CHECK: no rizal-fathoni row. Run db/collaborations.sql first.'; end if;
  if v.opens_on <> date '2026-11-11' then raise exception 'SELF-CHECK: opens_on is %', v.opens_on; end if;
  if v.status <> 'live' then raise exception 'SELF-CHECK: status is % — the public cannot see it', v.status; end if;
  if not v.has_bio then raise warning 'SELF-CHECK: his biography is missing — it should be there from db/collaborations.sql'; end if;

  -- The thing most likely to be got wrong later: announcing it as current.
  raise notice 'Rizal Fathoni — 11 to 12 November 2026, visible. The page reads it as Forthcoming until the 11th and Past after the 12th, from the dates alone.';
end $check$;

commit;
