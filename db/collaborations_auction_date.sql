-- ═══════════════════════════════════════════════════════════════════════════
-- COLLABORATIONS · a date the copy cannot outlive.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- The seeded copy said the hand-painted bottle "goes to charity auction later
-- this year". The auction is Q4 2026, which is now — so that sentence is
-- already close to wrong, and in March it will say "later this year" about
-- something that happened last year. Nothing breaks. Nobody is prompted. It
-- just quietly stops being true, which is the failure mode this project keeps
-- meeting: Daily Open Check, "Now Showing", the four names.
--
-- A NOTE WOULD NOT HAVE HELD. So the date comes out of the prose and becomes a
-- column, and the self-check below refuses to stay quiet when prose starts
-- making time claims again.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table collaborations add column if not exists auction_on date;
comment on column collaborations.auction_on is
  'When the charity bottle goes to auction. The PAGE renders this; prose must not state it, or the prose goes stale silently.';

-- Take the claim out of the sentence. The fact survives; the expiry does not.
update collaborations
   set collaboration_en = replace(
         collaboration_en,
         'It goes to charity auction later this year, to build a school in Vietnam',
         'It goes to charity auction, to build a school in Vietnam')
 where slug = 'quynh-anh-le'
   and collaboration_en like '%later this year%';

-- ═══ SELF-CHECK — the part that keeps working after today ══════════════════
do $check$
declare r record; v_flagged int := 0;
begin
  -- Relative time in published prose is a promise to come back and edit it,
  -- and nobody ever does. Warn loudly rather than fail: a legitimate use may
  -- exist, but it should be a decision rather than an accident.
  for r in
    select slug, k as field
      from collaborations c,
           lateral (values ('collaboration_en', c.collaboration_en),
                           ('inspiration_en',   c.inspiration_en),
                           ('event_en',         c.event_en),
                           ('food_en',          c.food_en),
                           ('drinks_en',        c.drinks_en),
                           ('bio_en',           c.bio_en)) as f(k, v)
     where f.v ~* '(later this year|next year|this year|next month|last month|currently|at the moment|coming soon|recently)'
  loop
    raise warning 'STALE-COPY RISK — %.% contains a relative time claim. Use a date column, or accept that this sentence needs re-reading every quarter.', r.slug, r.field;
    v_flagged := v_flagged + 1;
  end loop;

  if v_flagged = 0 then
    raise notice 'No relative time claims in published collaboration copy.';
  end if;
end $check$;

commit;
