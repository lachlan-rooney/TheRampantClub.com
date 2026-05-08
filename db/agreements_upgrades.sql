-- Run once in the Supabase SQL editor.
-- Additive only — existing invitations and agreements are untouched.

alter table signing_invitations
  add column if not exists viewed_at        timestamptz,
  add column if not exists view_count       integer       not null default 0,
  add column if not exists last_reminded_at timestamptz,
  add column if not exists reminder_count   integer       not null default 0,
  add column if not exists revoked_at       timestamptz;

-- Optional convenience index
create index if not exists signing_invitations_status_idx
  on signing_invitations (status, created_at desc);
