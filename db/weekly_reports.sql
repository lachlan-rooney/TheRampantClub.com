-- ═══════════════════════════════════════════════════════════════════════
-- WEEKLY EXECUTIVE REPORT
-- Run once in the Supabase SQL editor.
--
-- A weekly report drafted with auto-pulled data + staff narrative → approved by
-- the owner → emailed to an external recipient (Shawn) + a tokened hosted page.
-- The report is a DOCUMENT: auto_data / financials / chart_urls are frozen
-- snapshots (recompute-proof, like activity_events.metadata) so what the reader
-- sees always matches what was approved.
--
-- Conventions: text + CHECK (no enum); admin-only RLS; the hosted page reads
-- one row by share_token via the service-role client (no public policy),
-- exactly like app/sign/[token].
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Settings: who approves, who receives (never env-hardcoded) ─────
create table if not exists report_settings (
  id               int primary key default 1 check (id = 1),   -- singleton
  approver_profile uuid references profiles(id),               -- owner (nudged in-app + email)
  final_recipients text[] not null default '{}',               -- Shawn + anyone else (raw emails)
  cc_recipients    text[] not null default '{}',
  updated_at       timestamptz not null default now(),
  updated_by       uuid references profiles(id)
);
insert into report_settings (id) values (1) on conflict do nothing;

-- ── 2. The report ─────────────────────────────────────────────────────
create table if not exists weekly_reports (
  id                 uuid primary key default gen_random_uuid(),
  period_start       date not null,
  period_end         date not null,                     -- inclusive
  status             text not null default 'draft'
                       check (status in ('draft','pending_approval','approved','sent')),
  auto_data          jsonb not null default '{}'::jsonb,   -- frozen metric snapshot
  narrative          jsonb not null default '{}'::jsonb,   -- staff prose
  include_financials boolean not null default false,
  financials         jsonb not null default '{}'::jsonb,   -- frozen (monthly)
  chart_urls         jsonb not null default '{}'::jsonb,   -- {key: storage url} — filled at send
  headline           text,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  approved_by        uuid references profiles(id),
  approved_at        timestamptz,
  sent_at            timestamptz,
  sent_to            text[],
  share_token        uuid unique default gen_random_uuid(),
  token_viewed_at    timestamptz,
  token_view_count   int not null default 0,
  updated_at         timestamptz not null default now(),
  unique (period_start, period_end)
);
create index if not exists idx_weekly_reports_status on weekly_reports(status, period_start desc);

-- ── 3. Audit trail (mirrors prospect_activity actor/event_type/from→to) ─
create table if not exists report_activity (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references weekly_reports(id) on delete cascade,
  actor       uuid references profiles(id),
  event_type  text not null,   -- generated | data_refreshed | narrative_edited | submitted | approved | sent | reverted
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_report_activity on report_activity(report_id, created_at);

-- ── 4. Register the approval-nudge notification type (emailed) ─────────
insert into notification_email_types (type, email_enabled) values
  ('report_awaiting_approval', true)
on conflict (type) do nothing;

-- ── 5. Row-level security ─────────────────────────────────────────────
alter table weekly_reports  enable row level security;
alter table report_settings enable row level security;
alter table report_activity enable row level security;

drop policy if exists "weekly_reports admin all" on weekly_reports;
create policy "weekly_reports admin all" on weekly_reports for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

drop policy if exists "report_settings admin all" on report_settings;
create policy "report_settings admin all" on report_settings for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

drop policy if exists "report_activity admin all" on report_activity;
create policy "report_activity admin all" on report_activity for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

-- The hosted /reports/[token] page reads ONE row via the service-role client
-- filtered by share_token (unguessable uuid) — no public/anon policy by design.
