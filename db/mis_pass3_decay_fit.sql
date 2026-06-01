-- Run once in the Supabase SQL editor, after db/mis_pass2_guardian.sql.
--
-- MIS Pass 3 — Bayesian λ-fit (decay model) integration.
--   - learned_decay_constants gains the four governance columns the cron writes
--     (status, ci_relative_width, meets_event_floor, ci_narrow_enough) and the
--     obsolete in_production boolean is dropped (subsumed by status='active').
--   - Three feeder views (v_decay_contradictions, v_decay_confirmations,
--     v_decay_live_exposure) expose the sufficient statistics the cron pulls.
--     Critical safety filter: lambda > 0 on each. Medical preferences are
--     stored as row-level λ=0 inside ordinary categories; without this filter
--     they'd be counted as immortal survivors and deflate the posterior for
--     whichever category they happen to live in. Methods doc §4 calls this
--     the "safety regression"; the filter is what prevents it.
--   - preferences.lambda_origin added now (Pass 4 prep) so the AI extraction
--     can stamp provenance — ai_specific / category_baseline_learned /
--     category_baseline_designed / forced_medical — for audit.

-- ── 1. learned_decay_constants — governance columns ───────────────────
alter table learned_decay_constants
  add column if not exists status            varchar(20),
  add column if not exists ci_relative_width numeric(10,4),
  add column if not exists meets_event_floor boolean,
  add column if not exists ci_narrow_enough  boolean;

-- in_production was the Pass-1 placeholder for the propose/active state machine.
-- Grep of the codebase confirms no caller reads it. The new status column is
-- the single source of truth ('proposed' | 'insufficient_data' | 'active').
alter table learned_decay_constants
  drop column if exists in_production;

-- Partial index so the live-λ read ("currently promoted per category") is
-- deterministic regardless of how many historical proposals the cron has
-- written for the same category.
create index if not exists idx_ldc_active_category
  on learned_decay_constants (category)
  where status = 'active';

create index if not exists idx_ldc_category_fit_ts
  on learned_decay_constants (category, fit_timestamp desc);

-- ── 2. preferences.lambda_origin (Pass 4 prep) ────────────────────────
-- Records WHY a preference has its current λ:
--   'ai_specific'                — the AI gave a specific λ on transcript signal
--   'category_baseline_learned'  — fell back to the category baseline, where
--                                  the baseline was a promoted learned λ
--   'category_baseline_designed' — fell back to the designed prior centre
--   'forced_medical'             — content-based medical guardrail fired
alter table preferences
  add column if not exists lambda_origin varchar(40);

-- ── 3. Feeder views for the cron ──────────────────────────────────────
-- Each row is one survival "spell" for the model. Row-level lambda > 0
-- excludes medical preferences from fitting. Categories listed in the
-- canonical 9 only (the materialised filter happens in the cron's
-- DESIGNED map; the view exposes everything for transparency).

create or replace view v_decay_contradictions as
select p.category as category,
       ve.days_since_last_validation::float as days
from validation_events ve
join preferences p on p.preference_id = ve.preference_id
where ve.event_type = 'contradicted'
  and ve.days_since_last_validation is not null
  and ve.days_since_last_validation >= 0
  and p.lambda > 0;

create or replace view v_decay_confirmations as
select p.category as category,
       ve.days_since_last_validation::float as days
from validation_events ve
join preferences p on p.preference_id = ve.preference_id
where ve.event_type = 'confirmed'
  and ve.days_since_last_validation is not null
  and ve.days_since_last_validation >= 0
  and p.lambda > 0;

create or replace view v_decay_live_exposure as
select category,
       (current_date - last_validated)::float as days
from preferences
where status = 'active'
  and last_validated is not null
  and (current_date - last_validated) >= 0
  and lambda > 0;

grant select on v_decay_contradictions, v_decay_confirmations, v_decay_live_exposure to authenticated;

-- ── 4. RLS — admin only on the table; views inherit ──────────────────
alter table learned_decay_constants enable row level security;

drop policy if exists "admin all on learned_decay_constants" on learned_decay_constants;
create policy "admin all on learned_decay_constants" on learned_decay_constants
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- ── 5. Promotion audit log ────────────────────────────────────────────
-- Every Accept / Reject on /admin/decay-fit writes here so we can prove who
-- moved live scoring and when. Per the prompt: "Accept/reject must be logged
-- (who, when, old→new λ)."

create table if not exists decay_proposal_decisions (
  decision_id          uuid primary key default gen_random_uuid(),
  category             varchar(40) not null,
  proposal_row_id      uuid not null references learned_decay_constants(id),
  decision             varchar(20) not null check (decision in ('accept','reject')),
  previous_status      varchar(20),
  previous_lambda      numeric(8,6),
  new_status           varchar(20),
  new_lambda           numeric(8,6),
  decided_by           text not null,
  decided_at           timestamptz not null default now(),
  note                 text
);

create index if not exists idx_decay_decisions_category on decay_proposal_decisions (category, decided_at desc);

alter table decay_proposal_decisions enable row level security;
drop policy if exists "admin all on decay_proposal_decisions" on decay_proposal_decisions;
create policy "admin all on decay_proposal_decisions" on decay_proposal_decisions
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
