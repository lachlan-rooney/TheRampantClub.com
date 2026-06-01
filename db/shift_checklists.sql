-- Run once in the Supabase SQL editor.
--
-- Opening / closing shift checklists. One row per shift_date + kind
-- (opening | closing) — the team works through the items during the
-- shift, each tick captures the staff initials + timestamp, and a final
-- "Lock & sign" captures who took responsibility for the shift handover.
--
-- The MX (Miss Châu) opens this in the morning to see yesterday's
-- closing notes — the loop-closing handoff between shifts.

create table if not exists shift_checklists (
  id            uuid primary key default gen_random_uuid(),
  shift_date    date        not null,
  kind          varchar(10) not null check (kind in ('opening','closing')),
  items         jsonb       not null default '[]'::jsonb,
                            -- array of { id, label, checked, name, ts }
  free_notes    text,
  submitted_by  text,                                -- name of who locked the sheet
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (shift_date, kind)
);

create index if not exists idx_checklists_date on shift_checklists (shift_date desc, kind);

alter table shift_checklists enable row level security;

drop policy if exists "admin all on shift_checklists" on shift_checklists;
create policy "admin all on shift_checklists" on shift_checklists
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
