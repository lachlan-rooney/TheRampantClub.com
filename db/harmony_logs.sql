-- Run once in the Supabase SQL editor.
--
-- Harmony Log — end-of-shift narrative. The team types what happened in
-- one textarea; Claude extracts structured proposals (visits, preferences,
-- bottle pours, prospects, complaints, card charges). Staff reviews each
-- proposal and accepts; accepted rows fan out into the live MIS tables.
--
-- The raw narrative is preserved on harmony_logs.narrative so we can
-- re-extract or audit. Extractions live separately so their lifecycle
-- (pending → accepted → applied) is independent of the narrative itself.

create table if not exists harmony_logs (
  id              uuid primary key default gen_random_uuid(),
  shift_date      date not null,
  shift_label     varchar(20) not null default 'evening',
                                            -- 'early' | 'evening' | 'late' | 'all-day'
  attendee_count  int,
  weather         text,
  room_state      text,                     -- one-line vibe / atmosphere
  narrative       text not null,            -- the raw textarea content
  submitted_by    text,                     -- staff email / id
  status          varchar(20) not null default 'draft',
                                            -- 'draft' | 'extracted' | 'reviewed' | 'applied'
  extraction_started_at  timestamptz,
  extraction_finished_at timestamptz,
  extraction_token_cost  int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_harmony_logs_date   on harmony_logs (shift_date desc);
create index if not exists idx_harmony_logs_status on harmony_logs (status, shift_date desc);

create table if not exists harmony_extractions (
  id            uuid primary key default gen_random_uuid(),
  log_id        uuid not null references harmony_logs(id) on delete cascade,
  kind          varchar(20) not null,
                                          -- 'visit' | 'preference' | 'bottle_depletion'
                                          -- | 'prospect' | 'complaint' | 'card_charge'
  payload       jsonb not null,           -- the proposed row, kind-shaped
  member_no     varchar(12),              -- resolved target if applicable
  member_hint   text,                     -- raw name the model proposed before resolution
  prospect_id   varchar(20),
  status        varchar(20) not null default 'pending',
                                          -- 'pending' | 'accepted' | 'rejected' | 'applied' | 'failed'
  target_table  varchar(60),              -- table the applied row landed in
  target_id     text,                     -- pk of the applied row
  failure_note  text,
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_harmony_extractions_log    on harmony_extractions (log_id);
create index if not exists idx_harmony_extractions_status on harmony_extractions (log_id, status);
create index if not exists idx_harmony_extractions_member on harmony_extractions (member_no);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table harmony_logs        enable row level security;
alter table harmony_extractions enable row level security;

drop policy if exists "admin all on harmony_logs" on harmony_logs;
create policy "admin all on harmony_logs" on harmony_logs
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on harmony_extractions" on harmony_extractions;
create policy "admin all on harmony_extractions" on harmony_extractions
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- ── Convenience view: log rollups for the list page ───────────────────
create or replace view harmony_logs_with_counts as
select
  l.*,
  (select count(*) from harmony_extractions e where e.log_id = l.id)                              as extraction_count,
  (select count(*) from harmony_extractions e where e.log_id = l.id and e.status = 'pending')     as pending_count,
  (select count(*) from harmony_extractions e where e.log_id = l.id and e.status = 'accepted')    as accepted_count,
  (select count(*) from harmony_extractions e where e.log_id = l.id and e.status = 'applied')     as applied_count,
  (select count(*) from harmony_extractions e where e.log_id = l.id and e.status = 'rejected')    as rejected_count
from harmony_logs l;

grant select on harmony_logs_with_counts to authenticated;
