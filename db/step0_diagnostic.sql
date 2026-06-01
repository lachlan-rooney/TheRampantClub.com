-- Step 0 diagnostic — read-only audit for Pass 3 / Pass 4 / Pass 5.
--
-- ONE big query. The editor returns ONE table — paste the whole result
-- block back. Long-format: (section, key, value). Nothing here writes.

with
-- ─── 0. headcounts ───
head as (
  select 'HEAD' as section, 'members'                 as key, (select count(*) from members)::text                 as value
  union all
  select 'HEAD',           'preferences',             (select count(*) from preferences)::text
  union all
  select 'HEAD',           'validation_events',       (select count(*) from validation_events)::text
  union all
  select 'HEAD',           'learned_decay_constants', (select count(*) from learned_decay_constants)::text
),

-- ─── A3 distinct event_type values + counts ───
a3 as (
  select 'A3' as section, coalesce(event_type, '(null)') as key, count(*)::text as value
  from validation_events
  group by event_type
),

-- ─── A4 days_since_last_validation populated + range ───
a4 as (
  select 'A4' as section, 'total_rows' as key,
         (select count(*)::text from validation_events) as value
  union all
  select 'A4', 'non_null',
         (select count(days_since_last_validation)::text from validation_events)
  union all
  select 'A4', 'lo',
         (select coalesce(min(days_since_last_validation), 0)::text from validation_events)
  union all
  select 'A4', 'hi',
         (select coalesce(max(days_since_last_validation), 0)::text from validation_events)
),

-- ─── A5 totals by event_type ───
a5 as (
  select 'A5' as section, 'total' as key,
         (select count(*)::text from validation_events) as value
  union all
  select 'A5', 'contradictions',
         (select count(*)::text from validation_events where event_type = 'contradicted')
  union all
  select 'A5', 'confirmations',
         (select count(*)::text from validation_events where event_type = 'confirmed')
  union all
  select 'A5', 'revisions',
         (select count(*)::text from validation_events where event_type = 'revised')
  union all
  select 'A5', 'invalidations',
         (select count(*)::text from validation_events where event_type = 'invalidated')
),

-- ─── B3 distinct status values + counts ───
b3 as (
  select 'B3' as section, coalesce(status, '(null)') as key, count(*)::text as value
  from preferences
  group by status
),

-- ─── B4 distinct category values + counts (codebase canonical 9 expected) ───
b4 as (
  select 'B4' as section, coalesce(category, '(null)') as key, count(*)::text as value
  from preferences
  group by category
),

-- ─── B5 stored λ per category (one row per category × λ bucket) ───
b5 as (
  select 'B5' as section,
         coalesce(category, '(null)') || ' | lambda=' || coalesce(lambda::text, '(null)') as key,
         count(*)::text as value
  from preferences
  group by category, lambda
),

-- ─── B6 active preferences with usable censoring time ───
b6 as (
  select 'B6' as section, 'active_with_censoring' as key,
         (select count(*)::text from preferences
          where status = 'active'
            and last_validated is not null
            and (current_date - last_validated) >= 0) as value
),

-- ─── B6b bucketed exposure (active prefs, days since last_validated) ───
b6b as (
  select 'B6b' as section,
         'days_bucket_' || lpad(width_bucket(current_date - last_validated, 0, 730, 8)::text, 2, '0') as key,
         count(*)::text as value
  from preferences
  where status = 'active'
    and last_validated is not null
    and (current_date - last_validated) >= 0
  group by 2
),

-- ─── C4a learned_decay_constants row count ───
c4a as (
  select 'C4a' as section, 'row_count' as key,
         (select count(*)::text from learned_decay_constants) as value
)

select section, key, value
from (
  select * from head
  union all select * from a3
  union all select * from a4
  union all select * from a5
  union all select * from b3
  union all select * from b4
  union all select * from b5
  union all select * from b6
  union all select * from b6b
  union all select * from c4a
) all_sections
order by section, key;
