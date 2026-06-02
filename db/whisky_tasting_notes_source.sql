-- Run once in the Supabase SQL editor.
--
-- Adds source-attribution columns for tasting_notes so the team can
-- distinguish notes the AI backfilled (claude-auto-backfill-<date>)
-- from notes a human curated by hand. After the one-shot backfill the
-- team takes over manual edits, and those edits set tasting_notes_source
-- back to 'human' automatically.

begin;

alter table whiskies
  add column if not exists tasting_notes_source       text,
  add column if not exists tasting_notes_confidence   text,
  add column if not exists tasting_notes_generated_at timestamptz;

-- Any existing non-empty tasting_notes were entered by the team, mark
-- them as 'human' so the backfill script knows to skip them.
update whiskies
   set tasting_notes_source = 'human'
 where tasting_notes is not null
   and trim(tasting_notes) <> ''
   and tasting_notes_source is null;

commit;

-- Verify.
select
  count(*) filter (where tasting_notes_source = 'human')                              as human_curated,
  count(*) filter (where tasting_notes is null or trim(tasting_notes) = '')           as missing_notes,
  count(*)                                                                            as total
from whiskies;
