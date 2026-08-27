-- ═══════════════════════════════════════════════════════════════════════════
-- Member Newsletter — broadcast to all members (updates, recaps, new members)
-- ═══════════════════════════════════════════════════════════════════════════
-- Mirrors the weekly-report machinery (draft → pending_approval → approved →
-- sent), but the audience is MEMBERS, resolved live from profiles↔auth.users at
-- send time. Frozen-snapshot document: auto_data + sections are captured so the
-- reader always sees what was approved.
--
-- SAFETY: a members-wide blast is high-stakes. Sending requires ALL of:
--   1. newsletter_settings.send_enabled = true   (master switch, OFF by default)
--   2. the row is status = 'approved'
--   3. a typed confirmation matching the resolved recipient count (route-level)
-- Until the owner flips send_enabled on, the send route refuses — the newsletter
-- equivalent of the weekly report's hard beta block.

-- ── 1. Settings (singleton) ────────────────────────────────────────────────
create table if not exists newsletter_settings (
  id              int primary key default 1 check (id = 1),
  approver_profile uuid references profiles(id),      -- who may approve (owner)
  send_enabled    boolean not null default false,     -- MASTER SAFETY SWITCH (off)
  from_name       text not null default 'The Rampant Club',
  from_email      text not null default 'members@therampantclub.com',
  test_recipients text[] not null default '{}',       -- addresses for a real test send
  suppress        text[] not null default '{}',       -- never-email list (opt-outs)
  updated_at      timestamptz not null default now(),
  updated_by      uuid references profiles(id)
);
insert into newsletter_settings (id) values (1) on conflict (id) do nothing;

-- ── 2. Newsletters (the document) ──────────────────────────────────────────
create table if not exists newsletters (
  id             uuid primary key default gen_random_uuid(),
  period_start   date not null,
  period_end     date not null,
  subject        text not null default 'The Rampant Club — Newsletter',
  status         text not null default 'draft'
                   check (status in ('draft','pending_approval','approved','sent')),
  sections       jsonb not null default '{}',   -- staff-authored editorial blocks (whitelisted keys)
  auto_data      jsonb not null default '{}',   -- FROZEN recap snapshot (this month + new members)
  hero_image     text,                          -- optional hero image key under /public/images
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  approved_by    uuid references profiles(id),
  approved_at    timestamptz,
  sent_at        timestamptz,
  sent_to        text[],                        -- addresses actually mailed (audit)
  recipient_count int,                          -- how many members received it
  share_token    uuid unique default gen_random_uuid(),
  token_viewed_at timestamptz,
  token_view_count int not null default 0,
  updated_at     timestamptz not null default now(),
  unique (period_start, period_end)
);
create index if not exists idx_newsletters_status on newsletters (status, period_start desc);

-- ── 3. Activity (append-only audit) ────────────────────────────────────────
create table if not exists newsletter_activity (
  id            uuid primary key default gen_random_uuid(),
  newsletter_id uuid references newsletters(id) on delete cascade,
  actor         uuid references profiles(id),
  event_type    text not null,   -- generated|data_refreshed|edited|submitted|approved|reverted|sent
  from_status   text,
  to_status     text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_newsletter_activity on newsletter_activity (newsletter_id, created_at);

-- ── 4. RLS — admin-only (the tokened public page reads via service role) ───
alter table newsletter_settings enable row level security;
alter table newsletters         enable row level security;
alter table newsletter_activity enable row level security;

drop policy if exists "newsletter_settings admin" on newsletter_settings;
create policy "newsletter_settings admin" on newsletter_settings
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
drop policy if exists "newsletters admin" on newsletters;
create policy "newsletters admin" on newsletters
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
drop policy if exists "newsletter_activity admin" on newsletter_activity;
create policy "newsletter_activity admin" on newsletter_activity
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

-- ── 5. Approval-nudge notification type ────────────────────────────────────
insert into notification_email_types (type, email_enabled)
  values ('newsletter_awaiting_approval', true)
  on conflict (type) do nothing;
