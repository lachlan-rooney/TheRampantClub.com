-- ═══════════════════════════════════════════════════════════════════════════
-- MEMBER HEALTH SNAPSHOTS — the trajectory keystone.   REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Everything in TRC's analytics is LIVE-DERIVED. member_stats recomputes from
-- today's rows; preference_scores recomputes PS(t) on read. Nothing retains
-- what anything looked like last week. So no trajectory can be read, and every
-- early-warning signal in the analytics spec — a member going quiet, spend
-- decelerating, sentiment souring — depends on exactly that.
--
-- This table is the fix, and it is the ONLY thing in Phase 0 that cannot be
-- added later: every week without it is a week of history that does not exist
-- and never will.
--
-- ═══ IT STORES THE INPUTS, NOT JUST A SCORE ════════════════════════════════
-- engagement_score is a sparse heuristic today and will be rewritten. If only
-- the score were kept, every past week would be stranded at the old formula.
-- So every raw input is frozen alongside it and the score is recomputable over
-- the whole history whenever the formula changes.
--
-- ⚠ THE SCORE IS LOW-CONFIDENCE AND SAYS SO. 18 members, ~5 months, and of
--   those members only 8 have ever recorded a visit. engagement_confidence
--   carries that: do not colour a dashboard by this number yet.
--
-- ═══ WHAT IS DELIBERATELY NOT HERE ═════════════════════════════════════════
-- No backfill of history. Today's row can be written now; last month's cannot,
-- because the inputs were never retained. Trajectory starts the week this
-- ships. Saying otherwise would invent data.
--
-- ═══ COLUMN NAMES CHECKED AGAINST THE LIVE SCHEMA, NOT ASSUMED ═════════════
--  · card_transactions keys on member_NUMBER, not member_no
--  · card_transactions.kind is topup(+) / charge(−) / link / unlink.
--    SPEND IS THE CHARGES ONLY. Summing every kind gives +32.3m VND of
--    nonsense, because top-ups and charges cancel.
--  · tasting_notes keys on AUTHOR (a profiles.id); the bridge is
--    profiles.member_no, and only 14 of 18 members have a profile.
--  · member_consumption has NO money column at all — it is amount_pct and
--    estimated_pours. It can never feed spend. The column here counts POURS.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

create table if not exists public.member_health_snapshots (
  id                        uuid primary key default gen_random_uuid(),
  member_no                 varchar(12) not null references public.members(member_no) on delete cascade,

  -- WEEK KEY. The Monday of the VN week, so a re-run on Thursday overwrites
  -- Monday's row rather than making a second one.
  snapshot_week             date        not null,
  snapshot_date             date        not null,
  captured_at               timestamptz not null default now(),

  -- ── membership ──────────────────────────────────────────────────────────
  status                    text,
  tier                      text,
  join_date                 date,
  tenure_days               integer,
  paid_through              date,
  days_to_renewal           integer,          -- negative once lapsed
  period_status             text,
  in_grace                  boolean,

  -- ── visits ──────────────────────────────────────────────────────────────
  total_visits              integer not null default 0,
  days_since_last_visit     integer,
  visits_trailing_30d       integer not null default 0,
  visits_trailing_90d       integer not null default 0,
  avg_visits_per_month      numeric(8,3),

  -- ── money (charges only; see the header) ────────────────────────────────
  card_spend_trailing_30d   bigint  not null default 0,
  card_spend_trailing_90d   bigint  not null default 0,
  card_spend_cumulative     bigint  not null default 0,
  card_balance_vnd          bigint,
  menu_spend_trailing_90d   bigint  not null default 0,
  gifts_cost_cumulative     bigint  not null default 0,
  dues_paid_cumulative      bigint  not null default 0,

  -- ── engagement inputs ───────────────────────────────────────────────────
  bookings_trailing_90d     integer not null default 0,
  -- POURS, not money. member_consumption has no money column.
  consumption_pours_90d     numeric(10,2) not null default 0,
  tasting_notes_count       integer not null default 0,
  social_intro_count        integer not null default 0,
  preferences_active        integer not null default 0,

  -- ── Guardian-Angel sentiment (near-empty today; the habit fills it) ─────
  excellence_count          integer not null default 0,
  grievance_count           integer not null default 0,
  neutral_count             integer not null default 0,
  complaints_open           integer not null default 0,
  guardian_staff_id         uuid,

  -- ── the derived read, and how much to trust it ──────────────────────────
  engagement_score          numeric(5,2),
  engagement_confidence     text not null default 'low'
                              check (engagement_confidence in ('low','medium','high')),
  score_formula_version     text not null default 'v1-sparse',

  created_at                timestamptz not null default now(),

  constraint mhs_one_row_per_member_per_week unique (member_no, snapshot_week)
);

create index if not exists mhs_member_week_idx on public.member_health_snapshots (member_no, snapshot_week desc);
create index if not exists mhs_week_idx        on public.member_health_snapshots (snapshot_week desc);

comment on table public.member_health_snapshots is
  'One frozen row per member per week. The trajectory keystone: TRC''s analytics are otherwise live-derived and retain no history. Stores RAW INPUTS alongside the score so the score can be recomputed over history when its formula changes. Written only by /api/cron/member-snapshots.';
comment on column public.member_health_snapshots.engagement_score is
  'v1-sparse heuristic. LOW CONFIDENCE while data is thin (18 members, 8 with any visit). Read engagement_confidence before using it. The inputs beside it are the durable record.';
comment on column public.member_health_snapshots.card_spend_trailing_30d is
  'CHARGES only (kind = charge), as a positive number. Top-ups are not spend.';
comment on column public.member_health_snapshots.consumption_pours_90d is
  'Estimated POURS from member_consumption. That table carries no money column and never will feed spend.';

-- ── ACCESS: admin reads, nobody writes from a browser ─────────────────────
-- Matches the estate's convention (is_admin_uid). Writes come from the cron
-- route holding the service role, which bypasses RLS — so there is no write
-- policy at all, deliberately.
alter table public.member_health_snapshots enable row level security;

drop policy if exists "admins read member health snapshots" on public.member_health_snapshots;
create policy "admins read member health snapshots" on public.member_health_snapshots
  for select to authenticated using (public.is_admin_uid(auth.uid()));

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
--   select count(*) from public.member_health_snapshots;              -- 0 until the cron runs
--   select * from information_schema.table_constraints
--    where table_name = 'member_health_snapshots' and constraint_type = 'UNIQUE';
--
-- Then hit the route once to write the t=0 baseline:
--   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://therampantclub.com/api/cron/member-snapshots
--
-- And prove it is idempotent — run it twice, the count must not move:
--   select snapshot_week, count(*) from public.member_health_snapshots
--    group by 1 order by 1;
--
-- Then: node scripts/verify-member-snapshots.mjs

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- ⚠ Dropping this discards captured history that CANNOT be regenerated —
--   the inputs are live-derived and last week's values are gone. Export first:
--     \copy (select * from public.member_health_snapshots) to 'snapshots.csv' csv header
--   drop table if exists public.member_health_snapshots;
