-- Run once in the Supabase SQL editor.

create table if not exists sports_interest (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  email text not null,
  name text,
  note text,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists sports_interest_sport_idx
  on sports_interest (sport, created_at desc);

alter table sports_interest enable row level security;

drop policy if exists "anyone registers interest" on sports_interest;
create policy "anyone registers interest" on sports_interest
  for insert with check (true);

drop policy if exists "admin reads sports_interest" on sports_interest;
create policy "admin reads sports_interest" on sports_interest
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );
