-- One-time backfill of preferences.lambda_origin for legacy rows.
--
-- Context: Pass 4 added preferences.lambda_origin and started populating it
-- on every new write. The 158 preferences in the system today were inserted
-- BEFORE Pass 4 wired the column, so every row has lambda_origin = null.
-- The Observatory honestly displays this as "unknown" / "none" / "(null)";
-- this script derives the correct origin from values already in each row.
--
-- Rules — deterministic functions of (category, lambda), idempotent. Only
-- touches rows where lambda_origin is null:
--
--   λ = 0                            → 'forced_medical'
--   λ > 0 AND λ = designed centre    → 'category_baseline_designed'
--   λ > 0 AND λ ≠ designed centre    → 'ai_specific'
--
-- 'category_baseline_learned' is NOT set retroactively: a preference written
-- before any learned-λ promotion could not have inherited a learned baseline.
-- Future writes via the Pass-4 intake route stamp the column correctly.
--
-- Safe to re-run (the `lambda_origin is null` filter is the guard). Non-
-- canonical categories (if any exist) are left null — they don't join the
-- designed map, so they aren't touched.

-- ── Inspect before ────────────────────────────────────────────────────
-- Run this to see the current breakdown before the backfill.
-- Expected today: one row, ('(null)', 158).
select
  coalesce(lambda_origin, '(null)') as origin,
  count(*)                          as n
from preferences
where status = 'active'
group by lambda_origin
order by n desc;

-- ── The backfill ──────────────────────────────────────────────────────
with designed(category, designed_lambda) as (
  values
    ('Business & Productivity'::varchar(40), 0.002::numeric(8,6)),
    ('Cultural & Intellectual',  0.005),
    ('Family & Personal',        0.002),
    ('Food & Beverage',          0.005),
    ('Personal & Lifestyle',     0.002),
    ('Social & Networking',      0.002),
    ('Travel & Global',          0.005),
    ('Wellness & Comfort',       0.002),
    ('Whisky & Beverage',        0.005)
)
update preferences p
   set lambda_origin = case
     when p.lambda = 0                  then 'forced_medical'
     when p.lambda = d.designed_lambda  then 'category_baseline_designed'
     else                                    'ai_specific'
   end
  from designed d
 where p.category      = d.category
   and p.lambda_origin is null;

-- ── Inspect after ─────────────────────────────────────────────────────
-- Run again to confirm the breakdown. Expected (from the live B5 figures):
--   forced_medical             ~14
--   category_baseline_designed ~75  (rows whose λ equals the category centre)
--   ai_specific                ~69  (rows where the AI moved off the centre)
--   (null)                       0  (unless a row sits in a non-canonical category)
select
  coalesce(lambda_origin, '(null)') as origin,
  count(*)                          as n
from preferences
where status = 'active'
group by lambda_origin
order by n desc;
