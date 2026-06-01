-- Run once in the Supabase SQL editor.
--
-- MIS Pass 1 — Member Intelligence System schema.
--
-- This is the read-side foundation for the MIS, migrating the Google Sheet
-- "Master Intelligence Sheet" (ID 1Z1XfrCemeKyO1etsJMNJfp54PK6hnmZIDK-7iQFm40Q)
-- onto Supabase. Spec / DDL canonical source: docs/MIS_canonical_spec_and_DDL.md.
--
-- Pass 1 contents:
--   - Tables: members, preferences, visits, validation_events, learned_decay_constants
--   - Views:  member_stats, preference_scores  (PS(t) computed live, NOT in code)
--   - RLS:    admin-only on every table. Views inherit via the underlying tables
--             (SECURITY INVOKER, which is the Postgres default — do not change).
--
-- Pass 1 EXCLUDES:
--   - Observation / visit entry forms (write-side)
--   - Validation event write contract (the SQL transaction template is in §5
--     of the spec; the API route comes in Pass 2)
--   - Harmony Log → visits migration script
--   - Weekly λ-fit job
--
-- Re-runnable: idempotent for tables and policies. Views use CREATE OR REPLACE
-- but column lists must not change without an explicit DROP first.


-- ─────────────────────────────────────────────────────────────────────
-- 1. MEMBERS  (canonical roster — DIRECTORY cols A–I, N)
-- ─────────────────────────────────────────────────────────────────────
-- Keyed by member_no (TRC-Mxxx). This is the SAME format that
-- member_cards.member_number already uses, so future joins between MIS
-- and the card system stay text-on-text and don't need a translation layer.

create table if not exists members (
  member_no   varchar(12) primary key,                 -- 'TRC-M001'
  full_name   text        not null,
  nickname    text,
  tier        varchar(20) not null,                    -- Founding/Legacy/Pioneer/Corporate/Honorary
  status      varchar(20) not null default 'Active',
  join_date   date,
  birthday    date,
  email       text,
  phone       text,
  referred_by text,
  created_at  timestamptz default now()
);


-- ─────────────────────────────────────────────────────────────────────
-- 2. PREFERENCES  (PREFERENCE REGISTER cols A, D–N, S–V)
-- ─────────────────────────────────────────────────────────────────────
-- Formula cols B, C, O, P, Q, R from the sheet are NOT stored — they are
-- recomputed live by the preference_scores view.
--
-- FK on member_no, NOT on member name. This kills the trailing-space and
-- name-mismatch bugs the Apps Script carries TRIM() workarounds for.

create table if not exists preferences (
  preference_id        uuid primary key default gen_random_uuid(),
  member_no            varchar(12) not null references members(member_no),
  category             varchar(40) not null,           -- one of the 9 canonical values (spec §3)
  subcategory          text,
  preference_name      text        not null,
  detail               text,
  verbatim_quote       text,
  s0                   smallint    not null check (s0 between 1 and 5),
  confidence           numeric(3,2) not null check (confidence in (1.00, 0.75, 0.50, 0.25)),
  lambda               numeric(5,3) not null check (lambda in (0.000, 0.002, 0.005, 0.010, 0.020)),
  frequency            numeric(2,1) not null check (frequency in (0.8, 1.0, 1.2, 1.5)),
  last_validated       date         not null,
  validation_count     int          not null default 1,
  source               varchar(30)  default 'Interview',
  contradiction        boolean      default false,
  logged_by            text,
  created_date         date         default current_date,
  status               varchar(20)  default 'active',  -- active/invalidated/archived
  last_event_timestamp timestamptz                     -- feeds future R/M refinements
);

create index if not exists idx_pref_member   on preferences(member_no);
create index if not exists idx_pref_category on preferences(category);


-- ─────────────────────────────────────────────────────────────────────
-- 3. VISITS  (stable target — Harmony Log maps INTO this in a later pass)
-- ─────────────────────────────────────────────────────────────────────
-- Empty for Pass 1. While empty, member_stats.avg_visits_per_month is NULL
-- and M correctly falls back to 1.0 — so current scores reproduce the
-- legacy sheet exactly until the Harmony Log migration runs.

create table if not exists visits (
  visit_id        uuid primary key default gen_random_uuid(),
  member_no       varchar(12) not null references members(member_no),
  visit_date      date        not null,
  space           text,
  duration_min    int,
  emotional_state text,
  logged_by       text,
  notes           text,
  created_at      timestamptz default now()
);

create index if not exists idx_visits_member      on visits(member_no);
create index if not exists idx_visits_member_date on visits(member_no, visit_date);


-- ─────────────────────────────────────────────────────────────────────
-- 4. VALIDATION EVENTS  (v2 ML layer's source — start logging from day one)
-- ─────────────────────────────────────────────────────────────────────
-- Pass 1 creates the table but the write contract (§5 of the spec) is
-- implemented in Pass 2 when the staff revalidation UI lands. Leaving it
-- empty in Pass 1 is fine — R is derived from preferences.validation_count,
-- not from this table.

create table if not exists validation_events (
  event_id                   uuid primary key default gen_random_uuid(),
  preference_id              uuid        not null references preferences(preference_id),
  member_no                  varchar(12) not null references members(member_no),
  event_type                 varchar(30) not null,  -- confirmed/contradicted/revised/invalidated
  event_timestamp            timestamptz not null default now(),
  days_since_last_validation int         not null,
  confidence_before          numeric(3,2),
  confidence_after           numeric(3,2),
  staff_id                   text,
  notes                      text,
  created_at                 timestamptz default now()
);

create index if not exists idx_ve_pref    on validation_events(preference_id);
create index if not exists idx_ve_member  on validation_events(member_no);
create index if not exists idx_ve_type_ts on validation_events(event_type, event_timestamp);


-- ─────────────────────────────────────────────────────────────────────
-- 5. LEARNED DECAY CONSTANTS  (v2 — output of the weekly fit; empty for now)
-- ─────────────────────────────────────────────────────────────────────

create table if not exists learned_decay_constants (
  id              uuid primary key default gen_random_uuid(),
  category        varchar(40) not null,
  learned_lambda  numeric(8,6) not null,
  designed_lambda numeric(8,6) not null,
  lambda_ci_lower numeric(8,6),
  lambda_ci_upper numeric(8,6),
  n_observations  int not null,
  n_events        int not null,
  half_life_days  numeric(8,2),
  fit_timestamp   timestamptz not null,
  in_production   boolean default false,
  notes           text
);


-- ─────────────────────────────────────────────────────────────────────
-- 6. MEMBER STATS  (visit aggregates feeding M)
-- ─────────────────────────────────────────────────────────────────────
-- avg_visits_per_month is NULL whenever visits is empty for the member,
-- which is what makes the M=1.0 fallback work (see preference_scores).

create or replace view member_stats as
select
  m.member_no,
  count(v.visit_id)                                                  as total_visits,
  max(v.visit_date)                                                  as last_visit,
  (current_date - max(v.visit_date))                                 as days_since_visit,
  case
    when m.join_date is null or count(v.visit_id) = 0 then null
    else count(v.visit_id)::numeric
         / greatest((current_date - m.join_date)::numeric / 30.44, 1)
  end                                                                as avg_visits_per_month
from members m
left join visits v on v.member_no = m.member_no
group by m.member_no, m.join_date;


-- ─────────────────────────────────────────────────────────────────────
-- 7. PREFERENCE SCORES  (LIVE PS(t), full 6-variable model)
-- ─────────────────────────────────────────────────────────────────────
-- PS(t) = S₀ × C × e^(−λt) × F × R × M  (clamped 0..5)
-- R = LEAST(1.3, 1.0 + 0.075 × (validation_count − 1))
-- M = 1.0 when no visit data, otherwise
--     LEAST(1.5, GREATEST(0.8, 1.0 + 0.25 × (avg_visits_per_month − 1)))
--
-- With current data (validation_count=1, no visits) R=M=1.0, so PS(t)
-- reproduces the legacy 4-variable scores exactly. R and M activate
-- automatically as validation_count grows and visits arrive — no code
-- change required.

create or replace view preference_scores as
with scored as (
  select
    p.*,
    (current_date - p.last_validated)                                  as days_since,
    least(1.3, 1.0 + 0.075 * (p.validation_count - 1))                 as r_reinforce,
    case
      when ms.avg_visits_per_month is null then 1.0
      else least(1.5, greatest(0.8, 1.0 + 0.25 * (ms.avg_visits_per_month - 1)))
    end                                                                as m_engage
  from preferences p
  join member_stats ms on ms.member_no = p.member_no
  where p.status = 'active'
)
select
  scored.*,
  least(5,
    s0 * confidence * exp(-lambda * days_since) * frequency * r_reinforce * m_engage
  )                                                                    as ps_t,
  round(
    least(5, s0 * confidence * exp(-lambda * days_since) * frequency * r_reinforce * m_engage)
    / nullif(s0, 0) * 100, 0
  )                                                                    as score_health_pct,
  case
    when least(5, s0 * confidence * exp(-lambda*days_since) * frequency * r_reinforce * m_engage)
         < 0.7 * s0
      or days_since > 180
      or (s0 >= 4 and days_since > 90)
    then '⚠ REVALIDATE'
    else '✓ OK'
  end                                                                  as needs_revalidation
from scored;


-- ─────────────────────────────────────────────────────────────────────
-- 8. ROW-LEVEL SECURITY  (admin-only across the board for Pass 1)
-- ─────────────────────────────────────────────────────────────────────
-- Staff and read-only roles are NOT in Pass 1 — the spec defers them to
-- when the staff PWA lands. Gate everything on profiles.is_admin to
-- match the existing pattern in db/member_cards.sql.

alter table members                  enable row level security;
alter table preferences              enable row level security;
alter table visits                   enable row level security;
alter table validation_events        enable row level security;
alter table learned_decay_constants  enable row level security;

drop policy if exists "admin all on members" on members;
create policy "admin all on members"
  on members
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on preferences" on preferences;
create policy "admin all on preferences"
  on preferences
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on visits" on visits;
create policy "admin all on visits"
  on visits
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on validation_events" on validation_events;
create policy "admin all on validation_events"
  on validation_events
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on learned_decay_constants" on learned_decay_constants;
create policy "admin all on learned_decay_constants"
  on learned_decay_constants
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Note on the views (member_stats, preference_scores):
-- Postgres views default to SECURITY INVOKER, so RLS on the underlying
-- tables (members, visits, preferences) is enforced when a non-admin
-- queries the view. No grants or policies needed on the views themselves.
-- This is the OPPOSITE of the public.member_list view we just dropped —
-- do not change these views to SECURITY DEFINER.
