-- ═══════════════════════════════════════════════════════════════════════
-- MEMBERSHIP FINANCE & RECEIPTS
-- Run once in the Supabase SQL editor.
--
-- A real membership-billing subsystem: staff record a member's annual fee,
-- which mints a gap-free receipt and starts a one-year membership period.
-- Mirrors the card-credit ledger design (db/member_cards.sql): an immutable,
-- append-only ledger written only through an atomic, admin-gated RPC that
-- stamps staff attribution and emits an activity_events audit row.
--
-- Keyed on member_no (TRC-Mxxx text), matching the member_cards convention —
-- no hard FK to `members`, because the operational roster lives in the Google
-- Sheet and not every member has a `members` row.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- for digest() (receipt integrity hash)

-- ── 1. Receipt numbering ──────────────────────────────────────────────
-- One counter row per year, locked FOR UPDATE inside the RPC so receipt
-- numbers are gap-free and race-free even under concurrent recording.
create table if not exists membership_receipt_counters (
  year     int primary key,
  last_seq int not null default 0
);

-- ── 2. Payment ledger (immutable, append-only) ────────────────────────
-- Corrections are never edits/deletes — a void flips status and inserts a
-- mirroring adjustment counter-entry (see void_membership_payment).
create table if not exists membership_payments (
  id               uuid primary key default gen_random_uuid(),
  receipt_no       text unique not null,                  -- 'TRC-R-2026-0001'
  member_no        varchar(12) not null,                  -- text convention, no FK
  member_name_snap text not null,                         -- snapshot at time of payment
  tier_snap        text,                                  -- snapshot (receipts stay truthful if dues change)
  amount_vnd       bigint not null check (amount_vnd <> 0),
  currency         char(3) not null default 'VND',
  payment_method   text not null
                     check (payment_method in ('bank_transfer','cash','card_offline','other')),
  payment_date     date not null,
  fee_kind         text not null default 'membership_fee'
                     check (fee_kind in ('membership_fee','renewal','joining_fee','proration','adjustment')),
  period_id        uuid,                                  -- null for joining_fee/adjustment (grants no time)
  note             text,
  idempotency_key  uuid unique,                           -- client-supplied; blocks double-submit
  integrity_hash   text not null,                         -- sha256 of canonical fields (tamper-evident)
  pdf_path         text,                                  -- storage key in 'membership_receipts'
  status           text not null default 'active' check (status in ('active','voided')),
  void_of          uuid references membership_payments(id),  -- set on the counter-entry
  void_reason      text,
  voided_at        timestamptz,
  voided_by        uuid references auth.users(id),
  staff_id         uuid references auth.users(id),
  staff_email      text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_mp_member  on membership_payments (member_no, created_at desc);
create index if not exists idx_mp_receipt on membership_payments (receipt_no);

-- ── 3. Membership periods ─────────────────────────────────────────────
-- The source of truth for expiry. end_date denormalised so roster due/overdue
-- queries are a plain index scan. members.status is a best-effort cache.
create table if not exists membership_periods (
  id         uuid primary key default gen_random_uuid(),
  member_no  varchar(12) not null,
  payment_id uuid,                                         -- the payment that created it (no hard FK)
  start_date date not null,
  end_date   date not null,                                -- inclusive: start + 1 year - 1 day
  status     text not null default 'active'
               check (status in ('active','expired','voided','superseded')),
  created_at timestamptz not null default now()
);
create index if not exists idx_mperiod_member on membership_periods (member_no, end_date desc);
create index if not exists idx_mperiod_active on membership_periods (status, end_date);

-- ── 4. Atomic write RPC ───────────────────────────────────────────────
-- SECURITY DEFINER so the internal writes (counter, ledger, period) bypass
-- RLS — mirrors the ops-hub write RPCs. auth.uid() still resolves from the
-- request JWT (independent of definer), so the is_admin_uid() gate authorizes
-- and ops_emit_event attributes the real actor. Must be called under the
-- cookie/session client (a service-role client has no JWT → auth.uid() null
-- → the gate rejects). Mirrors apply_card_transaction's atomicity.
create or replace function record_membership_payment(
  p_member_no       varchar,
  p_member_name     text,
  p_tier            text,
  p_amount_vnd      bigint,
  p_payment_method  text,
  p_payment_date    date,
  p_fee_kind        text,
  p_note            text,
  p_idempotency_key uuid,
  p_staff_id        uuid,
  p_staff_email     text
) returns table (payment_id uuid, receipt_no text, period_id uuid, start_date date, end_date date)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_year    int := extract(year from p_payment_date);
  v_seq     int;
  v_receipt text;
  v_pid     uuid := gen_random_uuid();     -- pre-generate both ids (no FK cycle to resolve)
  v_period  uuid := gen_random_uuid();
  v_start   date := p_payment_date;
  v_end     date := (p_payment_date + interval '1 year' - interval '1 day')::date;
  v_hash    text;
  v_existing membership_payments%rowtype;
begin
  if not is_admin_uid(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  if p_amount_vnd <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Idempotency: a replay returns the original, never a second charge.
  if p_idempotency_key is not null then
    select * into v_existing from membership_payments where idempotency_key = p_idempotency_key;
    if found then
      return query
        select v_existing.id, v_existing.receipt_no, v_existing.period_id, mpr.start_date, mpr.end_date
        from membership_periods mpr where mpr.id = v_existing.period_id;
      -- if the payment granted no period, still return the payment row
      if not found then
        return query select v_existing.id, v_existing.receipt_no, v_existing.period_id, null::date, null::date;
      end if;
      return;
    end if;
  end if;

  -- Gap-free receipt number (locked counter row).
  insert into membership_receipt_counters (year, last_seq) values (v_year, 0)
    on conflict (year) do nothing;
  select last_seq + 1 into v_seq from membership_receipt_counters where year = v_year for update;
  update membership_receipt_counters set last_seq = v_seq where year = v_year;
  v_receipt := 'TRC-R-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  v_hash := encode(digest(
    v_receipt || '|' || p_member_no || '|' || p_amount_vnd || '|' || v_start || '|' || v_end,
    'sha256'), 'hex');

  -- Create the period only for fee kinds that grant membership time.
  if p_fee_kind in ('membership_fee','renewal','proration') then
    update membership_periods set status = 'superseded'
      where member_no = p_member_no and status = 'active';
    insert into membership_periods (id, member_no, payment_id, start_date, end_date, status)
      values (v_period, p_member_no, v_pid, v_start, v_end, 'active');
  else
    v_period := null;
  end if;

  insert into membership_payments (
    id, receipt_no, member_no, member_name_snap, tier_snap,
    amount_vnd, payment_method, payment_date, fee_kind, period_id, note,
    idempotency_key, integrity_hash, staff_id, staff_email
  ) values (
    v_pid, v_receipt, p_member_no, p_member_name, p_tier,
    p_amount_vnd, p_payment_method, p_payment_date, p_fee_kind, v_period, p_note,
    p_idempotency_key, v_hash, p_staff_id, p_staff_email
  );

  -- Best-effort roster cache sync (only if a members row exists).
  update members set status = 'Active' where member_no = p_member_no;

  perform ops_emit_event(
    'payment_recorded', 'membership', v_pid, null,
    jsonb_build_object(
      'receipt_no', v_receipt, 'member_no', p_member_no, 'member_name', p_member_name,
      'amount_vnd', p_amount_vnd, 'fee_kind', p_fee_kind, 'end_date', v_end,
      'actor_email', p_staff_email
    )
  );

  return query select v_pid, v_receipt, v_period, v_start, v_end;
end$$;
grant execute on function record_membership_payment(varchar,text,text,bigint,text,date,text,text,uuid,uuid,text) to authenticated;

-- ── 5. Void RPC ───────────────────────────────────────────────────────
-- Never deletes. Flips the original + its period to voided, inserts a
-- mirroring negative adjustment counter-entry, re-activates the most recent
-- prior period if one exists, and emits an audit event.
create or replace function void_membership_payment(
  p_payment_id uuid,
  p_reason     text,
  p_staff_id   uuid,
  p_staff_email text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_orig membership_payments%rowtype;
  v_year int;
  v_seq int;
  v_receipt text;
  v_hash text;
begin
  if not is_admin_uid(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select * into v_orig from membership_payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_orig.status = 'voided' then raise exception 'Already voided'; end if;

  update membership_payments
    set status = 'voided', void_reason = p_reason, voided_at = now(), voided_by = p_staff_id
    where id = p_payment_id;

  if v_orig.period_id is not null then
    update membership_periods set status = 'voided' where id = v_orig.period_id;
    -- Re-activate the most recent prior period that was superseded by this one.
    update membership_periods set status = 'active'
      where id = (
        select id from membership_periods
        where member_no = v_orig.member_no and status = 'superseded'
        order by end_date desc limit 1
      );
  end if;

  -- Mirroring adjustment counter-entry (negative), with its own receipt no.
  v_year := extract(year from now() at time zone 'Asia/Ho_Chi_Minh');
  insert into membership_receipt_counters (year, last_seq) values (v_year, 0)
    on conflict (year) do nothing;
  select last_seq + 1 into v_seq from membership_receipt_counters where year = v_year for update;
  update membership_receipt_counters set last_seq = v_seq where year = v_year;
  v_receipt := 'TRC-R-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  v_hash := encode(digest(v_receipt || '|VOID|' || v_orig.receipt_no, 'sha256'), 'hex');

  insert into membership_payments (
    id, receipt_no, member_no, member_name_snap, tier_snap, amount_vnd,
    payment_method, payment_date, fee_kind, period_id, note, integrity_hash,
    status, void_of, staff_id, staff_email
  ) values (
    gen_random_uuid(), v_receipt, v_orig.member_no, v_orig.member_name_snap, v_orig.tier_snap,
    -v_orig.amount_vnd, v_orig.payment_method, (now() at time zone 'Asia/Ho_Chi_Minh')::date,
    'adjustment', null, 'Void of ' || v_orig.receipt_no || coalesce(' — ' || p_reason, ''),
    v_hash, 'voided', p_payment_id, p_staff_id, p_staff_email
  );

  perform ops_emit_event(
    'payment_voided', 'membership', p_payment_id, null,
    jsonb_build_object(
      'receipt_no', v_orig.receipt_no, 'member_no', v_orig.member_no,
      'member_name', v_orig.member_name_snap, 'amount_vnd', v_orig.amount_vnd,
      'reason', p_reason, 'actor_email', p_staff_email
    )
  );
end$$;
grant execute on function void_membership_payment(uuid,text,uuid,text) to authenticated;

-- ── 6. Convenience view: each member's latest membership status ────────
create or replace view member_membership_status
  with (security_invoker = on) as
select distinct on (p.member_no)
  p.member_no,
  p.start_date,
  p.end_date as paid_through,
  p.status   as period_status,
  (p.status = 'active' and p.end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date) as is_current,
  (p.end_date <  (now() at time zone 'Asia/Ho_Chi_Minh')::date) as is_expired,
  (p.end_date <  (now() at time zone 'Asia/Ho_Chi_Minh')::date
    and p.end_date >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30)) as in_grace
from membership_periods p
where p.status in ('active','expired','superseded')
order by p.member_no, p.end_date desc;

-- ── 7. Row-level security ─────────────────────────────────────────────
alter table membership_payments          enable row level security;
alter table membership_periods           enable row level security;
alter table membership_receipt_counters  enable row level security;   -- no policies → RPC-only

-- Admin: full access. Member: read own only (NULL member_no fails closed).
drop policy if exists "admin all payments" on membership_payments;
create policy "admin all payments" on membership_payments for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
drop policy if exists "member read own payments" on membership_payments;
create policy "member read own payments" on membership_payments for select
  using (member_no = (select member_no from profiles where id = auth.uid()));

drop policy if exists "admin all periods" on membership_periods;
create policy "admin all periods" on membership_periods for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
drop policy if exists "member read own periods" on membership_periods;
create policy "member read own periods" on membership_periods for select
  using (member_no = (select member_no from profiles where id = auth.uid()));

-- Note: member-facing APIs still read via service-role with an explicit
-- column allow-list (strip staff_*, idempotency_key, integrity_hash, note).
-- These policies are the fail-closed backstop, not the field firewall.
