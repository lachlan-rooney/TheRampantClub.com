-- Run once in the Supabase SQL editor.
--
-- Lightweight complaint / friction log. The MX flags any incident that needs
-- follow-up; the GM resolves. Lives outside the journal because journal is
-- cultural narrative and complaints are operational triage.

create table if not exists complaints (
  id           uuid primary key default gen_random_uuid(),
  member_no    varchar(12) references members(member_no) on delete set null,
  member_name  text,                                  -- snapshot for the record even if member removed
  severity     int  not null default 2 check (severity between 1 and 5),
  category     varchar(40),                           -- 'service' | 'product' | 'facility' | 'billing' | 'other'
  summary      text not null,
  details      text,
  status       varchar(20) not null default 'open',   -- 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  reported_by  text,                                  -- staff member name/email
  resolved_by  text,
  resolution   text,
  reported_at  timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists idx_complaints_status   on complaints (status, reported_at desc);
create index if not exists idx_complaints_member   on complaints (member_no);
create index if not exists idx_complaints_severity on complaints (severity);

alter table complaints enable row level security;

drop policy if exists "admin all on complaints" on complaints;
create policy "admin all on complaints" on complaints
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
