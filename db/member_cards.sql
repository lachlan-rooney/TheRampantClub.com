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
  card_uid text unique,                      -- null when card is unlinked but credit retained
  credit_vnd bigint not null default 0,
  expires_at timestamptz,                    -- null = no expiry
  linked_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- If you already created member_cards from an earlier copy of this file:
-- alter table member_cards add column if not exists expires_at timestamptz;
-- alter table member_cards alter column card_uid drop not null;

create index if not exists member_cards_uid_idx on member_cards (card_uid);

create table if not exists card_transactions (
  id uuid primary key default gen_random_uuid(),
  member_number text not null,
  amount_vnd bigint not null,                -- positive = top-up, negative = charge, 0 = audit-only
  kind text not null check (kind in ('topup','charge','adjust','refund','link','unlink')),
  note text,
  staff_id uuid references auth.users(id),
  staff_email text,
  balance_after_vnd bigint not null,
  created_at timestamptz default now()
);

-- If you already created card_transactions, widen the kind check:
-- alter table card_transactions drop constraint if exists card_transactions_kind_check;
-- alter table card_transactions add constraint card_transactions_kind_check
--   check (kind in ('topup','charge','adjust','refund','link','unlink'));

create index if not exists card_transactions_member_idx
  on card_transactions (member_number, created_at desc);

-- ── Atomic balance update ─────────────────────────────────────────────
-- Locks the card row, validates, updates the balance, and inserts the audit
-- row inside one transaction. Eliminates the read-modify-write race that
-- two simultaneous charges could trigger.

create or replace function apply_card_transaction(
  p_member_number text,
  p_kind text,
  p_amount_vnd bigint,
  p_note text,
  p_staff_id uuid,
  p_staff_email text
) returns table (balance_after_vnd bigint, transaction_id uuid)
language plpgsql
as $$
declare
  v_credit bigint;
  v_expires_at timestamptz;
  v_signed bigint;
  v_new_balance bigint;
  v_tx_id uuid;
begin
  if p_kind not in ('topup','charge','adjust','refund') then
    raise exception 'Invalid kind: %', p_kind;
  end if;

  select credit_vnd, expires_at into v_credit, v_expires_at
    from member_cards
    where member_number = p_member_number
    for update;

  if not found then
    raise exception 'No card linked to this member';
  end if;

  if p_kind in ('topup','refund') then
    v_signed := abs(p_amount_vnd);
  elsif p_kind = 'charge' then
    v_signed := -abs(p_amount_vnd);
  else
    v_signed := p_amount_vnd;
  end if;

  if p_kind = 'charge' and v_expires_at is not null and v_expires_at < now() then
    raise exception 'Credit has expired';
  end if;

  v_new_balance := coalesce(v_credit, 0) + v_signed;
  if v_new_balance < 0 then
    raise exception 'Insufficient credit (balance % VND)', v_credit;
  end if;

  update member_cards
    set credit_vnd = v_new_balance, updated_at = now()
    where member_number = p_member_number;

  insert into card_transactions(member_number, amount_vnd, kind, note, staff_id, staff_email, balance_after_vnd)
    values (p_member_number, v_signed, p_kind, p_note, p_staff_id, p_staff_email, v_new_balance)
    returning id into v_tx_id;

  return query select v_new_balance, v_tx_id;
end;
$$;

grant execute on function apply_card_transaction to authenticated;

-- ── Row-level security ────────────────────────────────────────────────
-- Admin-only access. Both tables are gated by profiles.is_admin.

alter table member_cards enable row level security;
alter table card_transactions enable row level security;

drop policy if exists "admin all on member_cards" on member_cards;
create policy "admin all on member_cards"
  on member_cards
  for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "admin all on card_transactions" on card_transactions;
create policy "admin all on card_transactions"
  on card_transactions
  for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Old per-profile columns from the first iteration. Drop if you want:
-- alter table profiles drop column if exists card_uid;
-- alter table profiles drop column if exists card_issued_at;
