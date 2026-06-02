-- Run once in the Supabase SQL editor.
--
-- Per-locker activity timeline. Every PATCH to a locker (member
-- assignment, status change, label / position / notes edit, or
-- retire) writes a row here. Bottle additions / removals are NOT
-- logged here (locker_contents has its own added_at trail); this
-- table is about the LOCKER itself — who's had it, what it's been
-- called, when it changed status.

begin;

create table if not exists locker_activity (
  id            uuid primary key default gen_random_uuid(),
  locker_no     varchar(10) not null references lockers(locker_no) on delete cascade,
  event_type    varchar(30) not null,
                -- 'assigned' | 'unassigned' | 'status_changed'
                -- | 'label_changed' | 'notes_changed' | 'position_changed'
                -- | 'retired' | 'misc_patch'
  before_state  jsonb,        -- snapshot of just the changed fields before
  after_state   jsonb,        -- snapshot of just the changed fields after
  changed_by    text,         -- auth.uid() string form
  changed_by_email text,      -- frozen at write time so deletions don't orphan
  notes         text,         -- optional human note (admin can add later)
  created_at    timestamptz not null default now()
);

create index if not exists idx_locker_activity_locker
  on locker_activity (locker_no, created_at desc);
create index if not exists idx_locker_activity_when
  on locker_activity (created_at desc);

alter table locker_activity enable row level security;

drop policy if exists "admin all on locker_activity" on locker_activity;
create policy "admin all on locker_activity" on locker_activity
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

commit;

-- Verify.
select count(*) as events_so_far from locker_activity;
