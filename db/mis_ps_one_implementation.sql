-- ═══════════════════════════════════════════════════════════════════════════
-- PS(t) — ONE IMPLEMENTATION, TWO CALL SITES.              REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner's ruling, 2026-10-08:
--
--   "Report first, then build: can the view serve a t=0 preview for a
--    preference that is not yet committed? If it can, the preview reads the
--    view and the duplicates go. If it genuinely cannot, then one shared
--    function with the decay term parameterised — one implementation, two
--    call sites, never two implementations."
--
--   "PS(t) never moves out of SQL."
--
-- IT GENUINELY CANNOT. The view's FROM is the preferences TABLE:
--
--     from preferences p
--     join member_stats ms on ms.member_no = p.member_no
--     where p.status = 'active'
--
-- An uncommitted draft — an admin dragging a slider, or a row the extractor
-- has proposed and nobody has saved — has no row in `preferences`, so the view
-- has nothing to score. There is also no function form of PS(t) anywhere in
-- the 156 migrations: `preference_scores` was the only implementation in SQL,
-- which is exactly why two more grew in TypeScript.
--
-- So: the second branch. The arithmetic moves into three IMMUTABLE functions,
-- the view calls them instead of spelling the formula out, and the preview
-- calls the same three. Not a shared TypeScript helper — that would take PS(t)
-- out of SQL, which is the one thing it must never do.
--
-- ═══ WHAT THIS FIXES ═══════════════════════════════════════════════════════
-- The two TypeScript previews had DRIFTED from the view:
--
--   app/admin/mis/[member_no]/page.tsx:79
--     ps = s0 · confidence · frequency · R · 1.0
--     → no decay term at all, and M hardcoded:
--       "const m = 1.0  // visits is empty for now"
--
--   app/admin/mis/[member_no]/intake/page.tsx:76
--     ps = min(5, s0 · confidence · frequency · 1.0 · 1.0)
--     → no decay, no R, no M.
--
--   the view (the truth)
--     ps = min(5, s0 · confidence · e^(−λ·t) · frequency · R · M)
--
-- The comment "visits is empty for now" was true when it was written and is
-- not true now. M is live and it is NOT 1.0 for ANY member, so the preview has
-- been quietly promising a number the save does not deliver.
--
-- ── MEASURED AFTER THIS FILE WAS APPLIED, 2026-10-08 ──────────────────────
-- The preview mis-predicted the save on 146 of 159 rows, by up to 0.91 points
-- of 5 - over-promising on 98 rows and under-promising on 48. The 13 rows that
-- agreed did so only because both the old and the new value hit the cap of 5.
--
-- The cause is M ALONE. A preview is always at t = 0 (a save sets
-- last_validated = current_date; see apply_preference_validation in
-- db/mis_pass2_validations.sql), so e^(-lambda*0) = 1 on both sides and the
-- omitted decay term was dead code in the preview rather than a live error.
-- It still had to go: the next person to want a preview at t > 0 would have
-- inherited a formula that silently ignores time.
--
-- An earlier draft of this file said "156 of 159 rows, up to 3.5 points". That
-- figure compared the preview against each row's CURRENT score, which has
-- decayed for up to 190 days. It measured decay, not preview error, and it
-- overstated the fault. This is NOT
-- fixed by patching M into the preview — that would leave two implementations
-- and they would drift again the next time the formula moves.
--
-- ⚠ THE FORMULA DOES NOT CHANGE. Not one term, not one coefficient. The
--   expression inside mis_ps_t is a VERBATIM lift of the expression in the
--   view, and the point of the equivalence check below is to prove that to
--   the last digit across all 159 live rows. λ is untouched — the designed
--   values stay live and the measured fit stays unpromoted, per the ruling.
--
-- ═══ WHAT RUNS WHERE ═══════════════════════════════════════════════════════
--   mis_r_reinforce(validation_count)  → R, the reinforcement term
--   mis_m_engage(avg_visits_per_month) → M, the engagement term
--   mis_ps_t(s0, c, λ, t, f, R, M)     → PS(t), with the decay term
--                                        parameterised on t so the same
--                                        function serves t=0 and t=live.
--   preference_scores                  → call site 1 (committed rows)
--   mis_preview_ps(member_no, drafts)  → call site 2 (uncommitted drafts)
--
-- mis_preview_ps does NOT compute M. It looks avg_visits_per_month up from
-- member_stats and hands it to mis_m_engage. There is no longer anywhere for
-- a caller to write 1.0 and move on.
--
-- ═══ SECURITY ══════════════════════════════════════════════════════════════
-- Every function is SECURITY INVOKER (the default, stated explicitly so it
-- cannot be read as an oversight). member_stats is a view over members and
-- visits, both admin-only RLS, so a caller who is not an admin reads no stats
-- row and gets the designed null→1.0 fallback — never another member's visit
-- history. No new privilege path is opened. The admin gate that matters is
-- still isAdmin() on the API route, exactly as every other /api/admin/mis
-- route does it.
--
-- search_path is pinned on each function: these are referenced from a view
-- definition, and an unpinned search_path in a function a view depends on is
-- how a schema-shadowing trick gets a foothold.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if to_regclass('public.preferences') is null
     or to_regclass('public.member_stats') is null
     or to_regclass('public.preference_scores') is null then
    raise exception 'PREREQUISITES MISSING — preferences / member_stats / preference_scores'
      using hint = 'Run db/mis_pass1.sql first. Nothing applied.';
  end if;

  -- The rewrite below reproduces a 25-column view. If the live view is not the
  -- one this file was written against, stop rather than reshape it blind.
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'preference_scores') <> 25 then
    raise exception 'preference_scores does not have the 25 columns this file was written against'
      using hint = 'Nothing applied. Re-read the live definition before rewriting it.';
  end if;
end $prereq$;

-- ── R · the reinforcement term ────────────────────────────────────────────
-- Each re-validation after the first adds 7.5%, capped at +30%. Verbatim from
-- the view: least(1.3, 1.0 + 0.075 * (validation_count - 1)).
create or replace function public.mis_r_reinforce(p_validation_count integer)
returns numeric
language sql immutable parallel safe security invoker
set search_path = public, pg_temp
as $$
  select least(1.3, 1.0 + 0.075 * (p_validation_count - 1));
$$;

comment on function public.mis_r_reinforce(integer) is
  'PS(t) reinforcement term R. The ONLY implementation — preference_scores and mis_preview_ps both call this. Do not inline it anywhere.';

-- ── M · the engagement term ───────────────────────────────────────────────
-- A member who visits more than monthly scores higher, bounded [0.8, 1.5].
-- NULL avg_visits_per_month (never visited, or no join_date) → 1.0, which is
-- a DESIGNED fallback and the reason the old hardcoded m = 1.0 looked
-- harmless. Verbatim from the view.
create or replace function public.mis_m_engage(p_avg_visits_per_month numeric)
returns numeric
language sql immutable parallel safe security invoker
set search_path = public, pg_temp
as $$
  select case
    when p_avg_visits_per_month is null then 1.0
    else least(1.5, greatest(0.8, 1.0 + 0.25 * (p_avg_visits_per_month - 1)))
  end;
$$;

comment on function public.mis_m_engage(numeric) is
  'PS(t) engagement term M. The ONLY implementation. NULL in means 1.0 out by design; callers must pass avg_visits_per_month, never a literal.';

-- ── PS(t) ─────────────────────────────────────────────────────────────────
-- PS(t) = min(5, S0 · C · e^(−λ·t) · F · R · M)
--
-- p_days_since IS the parameterised decay term the ruling asked for: the
-- committed call site passes (current_date − last_validated), the preview
-- passes 0 because a save refreshes last_validated. Same function, same
-- arithmetic, one t.
--
-- Every parameter is unconstrained `numeric` on purpose. An unconstrained
-- numeric carries the scale of the value handed to it, so lambda arrives with
-- its own scale 3 and days_since with scale 0 exactly as they do inside the
-- view today — which is what makes the result bit-identical rather than
-- merely close. Constraining these to numeric(5,3) etc. would re-round them.
create or replace function public.mis_ps_t(
  p_s0           numeric,
  p_confidence   numeric,
  p_lambda       numeric,
  p_days_since   numeric,
  p_frequency    numeric,
  p_r_reinforce  numeric,
  p_m_engage     numeric
)
returns numeric
language sql immutable parallel safe security invoker
set search_path = public, pg_temp
as $$
  select least(5,
    p_s0 * p_confidence * exp(-p_lambda * p_days_since)
         * p_frequency * p_r_reinforce * p_m_engage
  );
$$;

comment on function public.mis_ps_t(numeric,numeric,numeric,numeric,numeric,numeric,numeric) is
  'PS(t) = min(5, S0·C·e^(-lambda·t)·F·R·M). The ONLY implementation, and it never leaves SQL. Call sites: preference_scores (t = current_date - last_validated) and mis_preview_ps (t = 0). Never reimplement this in application code.';

-- ── CALL SITE 1 · the committed rows ──────────────────────────────────────
-- Same 25 columns, same order, same types, same values. The only change is
-- that the formula is no longer spelled out here — it is called. Columns are
-- now listed explicitly rather than taken from scored.*, because the CTE has
-- to carry avg_visits_per_month through for mis_m_engage and that column is
-- NOT part of the view's shape.
create or replace view public.preference_scores as
with scored as (
  select
    p.preference_id, p.member_no, p.category, p.subcategory, p.preference_name,
    p.detail, p.verbatim_quote, p.s0, p.confidence, p.lambda, p.frequency,
    p.last_validated, p.validation_count, p.source, p.contradiction, p.logged_by,
    p.created_date, p.status, p.last_event_timestamp,
    (current_date - p.last_validated)                     as days_since,
    public.mis_r_reinforce(p.validation_count)            as r_reinforce,
    public.mis_m_engage(ms.avg_visits_per_month)          as m_engage
  from preferences p
  join member_stats ms on ms.member_no = p.member_no
  where p.status = 'active'
), with_ps as (
  select s.*,
         public.mis_ps_t(s.s0, s.confidence, s.lambda, s.days_since,
                         s.frequency, s.r_reinforce, s.m_engage) as ps_t
  from scored s
)
select
  preference_id, member_no, category, subcategory, preference_name,
  detail, verbatim_quote, s0, confidence, lambda, frequency,
  last_validated, validation_count, source, contradiction, logged_by,
  created_date, status, last_event_timestamp,
  days_since, r_reinforce, m_engage,
  ps_t,
  round(ps_t / nullif(s0, 0) * 100, 0) as score_health_pct,
  case
    when ps_t < 0.7 * s0
      or days_since > 180
      or (s0 >= 4 and days_since > 90)
    then '⚠ REVALIDATE'
    else '✓ OK'
  end                                  as needs_revalidation
from with_ps;

comment on view public.preference_scores is
  'PS(t) for committed, active preferences. Call site 1 of mis_ps_t. SECURITY INVOKER — inherits RLS from preferences/members/visits. Do not inline the formula back into this definition.';

-- ── CALL SITE 2 · the uncommitted drafts ──────────────────────────────────
-- Scores rows that do not exist yet, which is the one thing the view cannot
-- do. Takes a jsonb array so the intake page can price a whole extracted
-- batch in one round trip instead of one call per row.
--
-- Defaults match what a save actually does: t = 0 because last_validated
-- refreshes, and validation_count defaults to 1 (a brand-new preference →
-- R = 1.0). The edit form passes validation_count + 1, because validating an
-- existing row increments it.
create or replace function public.mis_preview_ps(
  p_member_no varchar,
  p_drafts    jsonb
)
returns table (
  idx                  integer,
  ps_t                 numeric,
  score_health_pct     numeric,
  r_reinforce          numeric,
  m_engage             numeric,
  avg_visits_per_month numeric
)
language sql stable parallel safe security invoker
set search_path = public, pg_temp
as $$
  with stats as (
    select ms.avg_visits_per_month
      from member_stats ms
     where ms.member_no = p_member_no
  ), d as (
    select (ord - 1)::integer                                   as idx,
           (e->>'s0')::numeric                                  as s0,
           (e->>'confidence')::numeric                          as confidence,
           (e->>'lambda')::numeric                              as lambda,
           coalesce((e->>'days_since')::numeric, 0)             as days_since,
           (e->>'frequency')::numeric                           as frequency,
           coalesce((e->>'validation_count')::integer, 1)       as validation_count
      from jsonb_array_elements(p_drafts) with ordinality t(e, ord)
  )
  select d.idx,
         public.mis_ps_t(d.s0, d.confidence, d.lambda, d.days_since, d.frequency,
                         public.mis_r_reinforce(d.validation_count),
                         public.mis_m_engage(s.avg_visits_per_month))        as ps_t,
         round(public.mis_ps_t(d.s0, d.confidence, d.lambda, d.days_since, d.frequency,
                               public.mis_r_reinforce(d.validation_count),
                               public.mis_m_engage(s.avg_visits_per_month))
               / nullif(d.s0, 0) * 100, 0)                                   as score_health_pct,
         public.mis_r_reinforce(d.validation_count)                          as r_reinforce,
         public.mis_m_engage(s.avg_visits_per_month)                         as m_engage,
         s.avg_visits_per_month
    from d
    left join stats s on true
   order by d.idx;
$$;

comment on function public.mis_preview_ps(varchar, jsonb) is
  'Call site 2 of mis_ps_t: scores UNCOMMITTED preference drafts at t=0. Returns m_engage and avg_visits_per_month so the UI can show which M it used. Replaced two drifted TypeScript reimplementations (2026-10-08).';

commit;

-- ── CHECK · THE EQUIVALENCE PROOF ─────────────────────────────────────────
-- This is the only check that matters. The formula must not have moved by one
-- digit on any of the 159 live rows. Run scripts/verify-ps-one-impl.mjs, which
-- diffs every row against the snapshot taken BEFORE this file was applied.
--
-- By hand, the same thing in SQL — the old expression written out long-hand,
-- against the new view. Expect ZERO rows:
--
--   select v.preference_id, v.ps_t as new_ps, o.old_ps
--     from public.preference_scores v
--     join (
--       select p.preference_id,
--              least(5, p.s0 * p.confidence
--                       * exp(-p.lambda * (current_date - p.last_validated))
--                       * p.frequency
--                       * least(1.3, 1.0 + 0.075 * (p.validation_count - 1))
--                       * case when ms.avg_visits_per_month is null then 1.0
--                              else least(1.5, greatest(0.8,
--                                   1.0 + 0.25 * (ms.avg_visits_per_month - 1))) end
--              ) as old_ps
--         from public.preferences p
--         join public.member_stats ms on ms.member_no = p.member_no
--        where p.status = 'active'
--     ) o on o.preference_id = v.preference_id
--    where v.ps_t is distinct from o.old_ps;
--   → 0 rows
--
-- The shape did not change:
--   select count(*) from information_schema.columns
--    where table_schema='public' and table_name='preference_scores';
--   → 25
--
-- The preview now agrees with the view. Take any live row, ask the preview for
-- it at its own t, and the two numbers must match — this is the assertion the
-- old TypeScript would have FAILED:
--   with r as (select * from public.preference_scores limit 1)
--   select r.ps_t as view_says, pv.ps_t as preview_says, pv.m_engage
--     from r, public.mis_preview_ps(r.member_no, jsonb_build_array(jsonb_build_object(
--            's0', r.s0, 'confidence', r.confidence, 'lambda', r.lambda,
--            'frequency', r.frequency, 'validation_count', r.validation_count,
--            'days_since', r.days_since))) pv;
--   → the two numbers are equal
--
-- And M is not 1.0 for everybody, which is the whole reason this mattered:
--   select m_engage, count(*) from public.preference_scores group by 1 order by 1;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Restores the original view verbatim and drops the functions. Safe at any
-- time: nothing stores a PS(t), it is computed on read, so there is no
-- migrated data to unwind. The API route /api/admin/mis/preview-score would
-- then 404 at the RPC and the previews would show "—" rather than a wrong
-- number, which is the correct failure.
--
--   create or replace view public.preference_scores as
--   with scored as (
--     select p.*, (current_date - p.last_validated) as days_since,
--            least(1.3, 1.0 + 0.075 * (p.validation_count - 1)) as r_reinforce,
--            case when ms.avg_visits_per_month is null then 1.0
--                 else least(1.5, greatest(0.8, 1.0 + 0.25 * (ms.avg_visits_per_month - 1)))
--            end as m_engage
--       from preferences p
--       join member_stats ms on ms.member_no = p.member_no
--      where p.status = 'active'
--   )
--   select scored.*,
--     least(5, s0 * confidence * exp(-lambda * days_since) * frequency * r_reinforce * m_engage) as ps_t,
--     round(least(5, s0 * confidence * exp(-lambda * days_since) * frequency * r_reinforce * m_engage)
--           / nullif(s0, 0) * 100, 0) as score_health_pct,
--     case when least(5, s0 * confidence * exp(-lambda*days_since) * frequency * r_reinforce * m_engage) < 0.7 * s0
--            or days_since > 180 or (s0 >= 4 and days_since > 90)
--          then '⚠ REVALIDATE' else '✓ OK' end as needs_revalidation
--   from scored;
--
--   drop function if exists public.mis_preview_ps(varchar, jsonb);
--   drop function if exists public.mis_ps_t(numeric,numeric,numeric,numeric,numeric,numeric,numeric);
--   drop function if exists public.mis_m_engage(numeric);
--   drop function if exists public.mis_r_reinforce(integer);
