-- Run once in the Supabase SQL editor.
--
-- Member lockers — physical bottle storage on the whisky-library wall.
-- The grid position is editable per locker so the admin map can mirror the
-- real wall. Contents are a separate table so we can track fill levels and
-- audit when bottles were added/depleted.

create table if not exists lockers (
  locker_no    varchar(10) primary key,            -- e.g. 'A-01'
  member_no    varchar(12) references members(member_no) on delete set null,
  label        text,                               -- override display name
  position_row int,
  position_col int,
  status       varchar(20) not null default 'empty',
                                                   -- 'occupied' | 'reserved' | 'empty' | 'retired'
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_lockers_member   on lockers (member_no);
create index if not exists idx_lockers_position on lockers (position_row, position_col);

create table if not exists locker_contents (
  id           uuid primary key default gen_random_uuid(),
  locker_no    varchar(10) not null references lockers(locker_no) on delete cascade,
  bottle_name  text not null,
  distillery   text,
  age          int,
  abv          numeric(4,1),                       -- 0..100
  fill_pct     int not null default 100 check (fill_pct between 0 and 100),
  opened_at    date,
  notes        text,
  added_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_locker_contents_locker on locker_contents (locker_no);

-- RLS — admin only (kiosks read via service role, members do not access).
alter table lockers          enable row level security;
alter table locker_contents  enable row level security;

drop policy if exists "admin all on lockers" on lockers;
create policy "admin all on lockers" on lockers
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on locker_contents" on locker_contents;
create policy "admin all on locker_contents" on locker_contents
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Convenience view — joins member name + contents count for the wall renderer.
create or replace view lockers_with_member as
select
  l.locker_no,
  l.member_no,
  m.full_name      as member_name,
  m.nickname       as member_nickname,
  m.status         as member_status,
  l.label,
  l.position_row,
  l.position_col,
  l.status,
  l.notes,
  l.updated_at,
  (select count(*) from locker_contents lc where lc.locker_no = l.locker_no)        as bottle_count,
  (select coalesce(round(avg(lc.fill_pct))::int, 0)
     from locker_contents lc where lc.locker_no = l.locker_no)                       as avg_fill_pct
from lockers l
left join members m on m.member_no = l.member_no;

grant select on lockers_with_member to authenticated;
