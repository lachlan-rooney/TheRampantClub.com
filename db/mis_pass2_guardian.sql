-- Run once in the Supabase SQL editor, after db/mis_pass2_validations.sql.
--
-- MIS Pass 2 — Guardian Angel cycle + Harmony Log feedback loop.
--
-- Makes PS(t) live by wiring three loops:
--   1. visits activate M (engagement multiplier)
--   2. observations activate R (validates an existing preference → atomic
--      bump via apply_preference_validation; same RPC as the inline-edit
--      flow uses)
--   3. revalidation becomes a workflow (⚠ REVALIDATE prefs surface in the
--      Overture brief; staff confirm on the visit; clock resets)
--
-- Schema strategy:
--   - members.guardian_staff_id added for routing/audit only. Staff-role
--     RLS deferred until staff are distinct auth users; today we run on a
--     shared team account so admin-RLS still gates everything.
--   - visits.phase added in three steps so existing rows backfill to
--     'closed' (historical, already through the cycle) while new rows
--     default to 'overture' (Guardian Angel entry point) per the spec.

-- ── 1. members.guardian_staff_id ──────────────────────────────────────
alter table members
  add column if not exists guardian_staff_id uuid references auth.users(id);

create index if not exists idx_members_guardian on members (guardian_staff_id);

-- ── 2. visits — Guardian Angel lifecycle ──────────────────────────────
-- Phase column added nullable, backfilled, then locked to NOT NULL with
-- the canonical default. Splitting it this way means existing visits don't
-- silently land at the 'overture' default — they're historical, so they
-- get 'closed' explicitly.

alter table visits
  add column if not exists phase                  varchar(12),
  add column if not exists overture_generated_at  timestamptz,
  add column if not exists overture_generated_by  uuid references auth.users(id),
  add column if not exists arrival_time           timestamptz,
  add column if not exists departure_time         timestamptz,
  add column if not exists continuum_completed_at timestamptz,
  add column if not exists data_for_next_overture text;

update visits set phase = 'closed' where phase is null;

alter table visits
  alter column phase set not null,
  alter column phase set default 'overture';

alter table visits
  drop constraint if exists visits_phase_chk;
alter table visits
  add constraint visits_phase_chk
  check (phase in ('overture','accord','continuum','closed'));

create index if not exists idx_visits_phase on visits (phase, visit_date desc);

-- ── 3. harmony_observations — per-visit structured log ────────────────
-- The dissertation's Harmony Log. Each row is one observation captured
-- during the Accord phase. Optionally links back to a preference (drives
-- write contract A) or spawns a candidate (drives write contract B).

create table if not exists harmony_observations (
  observation_id  uuid primary key default gen_random_uuid(),
  visit_id        uuid not null references visits(visit_id) on delete cascade,
  member_no       varchar(12) not null references members(member_no),
  category        varchar(40),                      -- one of the 9 canonical preference categories
  observation     text not null,
  sentiment       varchar(12) not null default 'neutral'
                  check (sentiment in ('excellence','neutral','grievance')),
  score           smallint check (score between 1 and 5),
  links_to_preference_id uuid references preferences(preference_id),
  spawned_candidate      boolean not null default false,
  logged_by       text,                             -- staff email / id (text so shared-team account works)
  created_at      timestamptz not null default now()
);

create index if not exists idx_obs_visit  on harmony_observations (visit_id);
create index if not exists idx_obs_member on harmony_observations (member_no, created_at desc);
create index if not exists idx_obs_pref   on harmony_observations (links_to_preference_id);

-- ── 4. preference_candidates — review queue for new prefs ─────────────

create table if not exists preference_candidates (
  candidate_id          uuid primary key default gen_random_uuid(),
  member_no             varchar(12) not null references members(member_no),
  source_observation_id uuid references harmony_observations(observation_id) on delete set null,
  -- Suggested fields (admin can revise on accept):
  suggested_category    varchar(40),
  suggested_name        text,
  detail                text,
  verbatim_quote        text,
  suggested_s0          smallint check (suggested_s0 between 1 and 5),
  suggested_confidence  numeric(3,2),
  suggested_lambda      numeric(5,3),
  suggested_frequency   numeric(2,1),
  -- Provenance:
  source                varchar(30) not null default 'Observation',
                                            -- 'Observation' | 'Evening Recap' | 'Other'
  -- Lifecycle:
  status                varchar(12) not null default 'pending'
                        check (status in ('pending','accepted','rejected')),
  reviewed_by           text,
  reviewed_at           timestamptz,
  promoted_preference_id uuid references preferences(preference_id),
  created_at            timestamptz not null default now()
);

create index if not exists idx_cand_member on preference_candidates (member_no);
create index if not exists idx_cand_status on preference_candidates (status, created_at desc);

-- ── 5. last_continuum_note — feeds the next Overture brief ────────────
-- One row per member containing the most recent closed visit's
-- data_for_next_overture. This is the loop-closing handoff.

create or replace view last_continuum_note as
select distinct on (member_no)
  member_no,
  visit_id,
  visit_date,
  continuum_completed_at,
  data_for_next_overture
from visits
where phase = 'closed' and data_for_next_overture is not null
order by member_no, visit_date desc, continuum_completed_at desc nulls last;

grant select on last_continuum_note to authenticated;

-- ── 6. RLS — admin only (matches the shared-team-account decision) ────

alter table harmony_observations   enable row level security;
alter table preference_candidates  enable row level security;

drop policy if exists "admin all on harmony_observations" on harmony_observations;
create policy "admin all on harmony_observations" on harmony_observations
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on preference_candidates" on preference_candidates;
create policy "admin all on preference_candidates" on preference_candidates
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- ── 7. RPC — promote_preference_candidate (write contract B) ──────────
-- Single transaction:
--   1. INSERT into preferences with validation_count=1, source from candidate
--   2. UPDATE candidate → status='accepted', set promoted_preference_id
--
-- Returns the new preference_id. Reject case is handled with a plain
-- PATCH against the candidate row (no preferences write needed).

create or replace function promote_preference_candidate(
  p_candidate_id        uuid,
  p_member_no           varchar(12),
  p_category            varchar(40),
  p_preference_name     text,
  p_detail              text default null,
  p_verbatim_quote      text default null,
  p_s0                  smallint default null,
  p_confidence          numeric  default null,
  p_lambda              numeric  default null,
  p_frequency           numeric  default null,
  p_source              varchar(30) default 'Observation',
  p_reviewer            text     default null
) returns uuid
language plpgsql
as $$
declare
  v_pref_id    uuid;
  v_status     varchar(12);
begin
  -- Lock the candidate; refuse if it has already been resolved
  select status into v_status
    from preference_candidates
    where candidate_id = p_candidate_id
    for update;
  if not found then
    raise exception 'candidate_id not found: %', p_candidate_id;
  end if;
  if v_status <> 'pending' then
    raise exception 'candidate is %, not pending', v_status;
  end if;

  -- Insert the preference with safe defaults that satisfy every CHECK
  insert into preferences (
    member_no, category, preference_name, detail, verbatim_quote,
    s0, confidence, lambda, frequency,
    last_validated, validation_count, source, logged_by
  ) values (
    p_member_no,
    p_category,
    p_preference_name,
    p_detail,
    p_verbatim_quote,
    coalesce(p_s0, 3),
    coalesce(p_confidence, 0.75),
    coalesce(p_lambda, 0.010),
    coalesce(p_frequency, 1.0),
    current_date,
    1,
    coalesce(p_source, 'Observation'),
    p_reviewer
  ) returning preference_id into v_pref_id;

  -- Mark candidate accepted and link it to the preference it became
  update preference_candidates
    set status                 = 'accepted',
        reviewed_by            = coalesce(p_reviewer, reviewed_by),
        reviewed_at            = now(),
        promoted_preference_id = v_pref_id
    where candidate_id = p_candidate_id;

  return v_pref_id;
end;
$$;

grant execute on function promote_preference_candidate(uuid, varchar, varchar, text, text, text, smallint, numeric, numeric, numeric, varchar, text) to authenticated;
