-- Run once in the Supabase SQL editor.
--
-- Member roster lives in a Google Sheet (see /api/member-profiles); we key card
-- links by `Member No.` rather than the Supabase profile UUID.
--
-- Each card has a unique factory UID; each member has at most one card and a
-- credit balance in whole VND. Every top-up or charge is recorded in
-- card_transactions for an audit trail.

create table if not exists member_cards (
  member_number text primary key,
  card_uid text unique not null,
  credit_vnd bigint not null default 0,
  expires_at timestamptz,                    -- null = no expiry
  linked_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- If you already created member_cards from an earlier copy of this file,
-- run the next line to add the column without recreating the table:
-- alter table member_cards add column if not exists expires_at timestamptz;

create index if not exists member_cards_uid_idx on member_cards (card_uid);

create table if not exists card_transactions (
  id uuid primary key default gen_random_uuid(),
  member_number text not null,
  amount_vnd bigint not null,                -- positive = top-up, negative = charge
  kind text not null check (kind in ('topup','charge','adjust','refund')),
  note text,
  staff_id uuid references auth.users(id),
  staff_email text,
  balance_after_vnd bigint not null,
  created_at timestamptz default now()
);

create index if not exists card_transactions_member_idx
  on card_transactions (member_number, created_at desc);

-- Old per-profile columns from the first iteration. Drop if you want:
-- alter table profiles drop column if exists card_uid;
-- alter table profiles drop column if exists card_issued_at;
