-- Guest / non-member attendance — so "who's been in, and how long" in the weekly
-- report counts walk-ins, guests and randoms too, not only members (the visits
-- table is member-only). Lightweight and admin-only; logged by staff.

create table if not exists guest_visits (
  id             uuid primary key default gen_random_uuid(),
  guest_name     text not null,
  host_member_no varchar(12) references members(member_no) on delete set null,  -- optional: the member who brought them
  visit_date     date not null,
  duration_min   int,                 -- how long they stayed (optional)
  party_size     int not null default 1,
  note           text,
  logged_by      text,                -- staff email/id who recorded it
  created_at     timestamptz not null default now()
);
create index if not exists idx_guest_visits_date on guest_visits (visit_date desc);

alter table guest_visits enable row level security;
drop policy if exists "guest_visits admin" on guest_visits;
create policy "guest_visits admin" on guest_visits
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
