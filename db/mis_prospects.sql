-- Run once in the Supabase SQL editor, after the other MIS migrations.
--
-- MIS — Prospect CRM (the "SALES PIPELINE" tab from the legacy Master
-- Intelligence Sheet, now first-class in the admin).
--
-- One row per prospect. When a prospect's interview is scheduled, the admin
-- mints a provisional member_no so the MIS transcript intake can attach
-- preferences to it. When the prospect is approved, that members row flips
-- from status='Provisional' to status='Active' — no data is moved, no
-- preferences are re-keyed.
--
-- Stages mirror the legacy sheet:
--   Lead → Initial Contact → Interview Scheduled → Interview Complete
--   → Application Received → Onboarded
-- Terminal off-ramps: Declined, Withdrawn, On Hold (back-on-rampable).

create table if not exists prospects (
  prospect_id           varchar(20) primary key,
  stage                 varchar(40) not null default 'Lead',
  full_name             text        not null,
  nickname              text,                          -- often "Title, Company" in legacy data

  -- Referral & context
  referred_by_name      text,
  referred_by_member_no varchar(12) references members(member_no),
  referral_relationship text,
  source_channel        varchar(40),                   -- Referral / Direct Approach / Event
  contact_info          text,                          -- office address / phone / email free-text

  -- Engagement tracking
  first_contact_date    date,
  last_contact_date     date,
  contact_count         int default 0,
  next_action           text,
  next_action_date      date,
  assigned_to           text,
  notes                 text,

  -- Interview details
  interview_date        date,
  interviewer           text,
  interview_location    text,
  interview_duration    text,
  interview_notes       text,
  red_flags             text,

  -- Scoring (1–5 per dimension)
  profession            text,
  cultural_fit          smallint check (cultural_fit          between 1 and 5),
  social_compatibility  smallint check (social_compatibility  between 1 and 5),
  commercial_potential  smallint check (commercial_potential  between 1 and 5),
  whisky_interest       smallint check (whisky_interest       between 1 and 5),
  brand_alignment       smallint check (brand_alignment       between 1 and 5),
  community_value       smallint check (community_value       between 1 and 5),
  diversity_contribution text,

  -- Decision
  committee_notes       text,
  decision              varchar(40),                   -- Approved / Declined / Pending / Deferred
  decision_date         date,
  converted_member_no   varchar(12) references members(member_no),

  -- Communication tracking — "letter sent" was bold formatting in the legacy sheet
  letter_sent           boolean default false,
  letter_sent_at        timestamptz,

  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  archived_at           timestamptz
);

create index if not exists idx_prospects_stage         on prospects (stage)               where archived_at is null;
create index if not exists idx_prospects_assigned      on prospects (assigned_to)         where archived_at is null;
create index if not exists idx_prospects_converted     on prospects (converted_member_no);
create index if not exists idx_prospects_next_action   on prospects (next_action_date)    where archived_at is null and next_action_date is not null;

-- Activity log — every stage transition, scoring update, letter sent, etc.
-- Powers the timeline on the prospect detail page.
create table if not exists prospect_activity (
  id           uuid        primary key default gen_random_uuid(),
  prospect_id  varchar(20) not null references prospects(prospect_id) on delete cascade,
  actor        text,
  event_type   varchar(40) not null,                   -- stage_changed / note_added / scored / letter_sent / converted / etc
  from_value   text,
  to_value     text,
  note         text,
  created_at   timestamptz default now()
);
create index if not exists idx_prospect_activity_pid_time on prospect_activity (prospect_id, created_at desc);

-- View with derived fields the UI needs everywhere
create or replace view prospects_with_score as
select
  p.*,
  case when p.first_contact_date is null then null
       else (current_date - p.first_contact_date) end                      as days_in_pipeline,
  case when (
         (p.cultural_fit         is not null)::int +
         (p.social_compatibility is not null)::int +
         (p.commercial_potential is not null)::int +
         (p.whisky_interest      is not null)::int +
         (p.brand_alignment      is not null)::int +
         (p.community_value      is not null)::int
       ) = 0 then null
       else round(
         (coalesce(p.cultural_fit,0) + coalesce(p.social_compatibility,0)
          + coalesce(p.commercial_potential,0) + coalesce(p.whisky_interest,0)
          + coalesce(p.brand_alignment,0) + coalesce(p.community_value,0))::numeric
         / (
           (p.cultural_fit         is not null)::int +
           (p.social_compatibility is not null)::int +
           (p.commercial_potential is not null)::int +
           (p.whisky_interest      is not null)::int +
           (p.brand_alignment      is not null)::int +
           (p.community_value      is not null)::int
         ),
         2)
  end                                                                       as overall_score
from prospects p;

-- Helper for minting the next provisional or active member_no in TRC-Mnnn
-- format. Locks a one-row counter table so concurrent calls don't collide.
-- Returns the new id (e.g. 'TRC-M004'). Active members and provisional
-- prospects share the same number space.
create table if not exists member_no_sequence (
  id          int primary key default 1,
  next_value  int not null default 1
);
insert into member_no_sequence (id, next_value)
  values (1, (select coalesce(max(substring(member_no from 'TRC-M(\d+)')::int), 0) + 1 from members))
  on conflict (id) do nothing;

create or replace function mint_member_no() returns varchar(12)
language plpgsql
as $$
declare
  v_next int;
begin
  update member_no_sequence
    set next_value = next_value + 1
    where id = 1
    returning next_value - 1 into v_next;
  return 'TRC-M' || lpad(v_next::text, 3, '0');
end;
$$;

grant execute on function mint_member_no() to authenticated;

-- ── RLS — admin-only across everything ──────────────────────────────
alter table prospects        enable row level security;
alter table prospect_activity enable row level security;
alter table member_no_sequence enable row level security;

drop policy if exists "admin all on prospects" on prospects;
create policy "admin all on prospects" on prospects
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on prospect_activity" on prospect_activity;
create policy "admin all on prospect_activity" on prospect_activity
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on member_no_sequence" on member_no_sequence;
create policy "admin all on member_no_sequence" on member_no_sequence
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Extend the members status check (which is implicit via varchar). Members rows
-- now legitimately hold 'Provisional' during the interview phase.
-- (No CHECK constraint to alter — status is a free varchar — left as a comment for the next dev.)
