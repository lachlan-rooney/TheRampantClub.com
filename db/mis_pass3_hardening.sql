-- Run once in the Supabase SQL editor, AFTER db/mis_pass3_decay_fit.sql.
--
-- MIS Pass 3 hardening — the two things that aren't blocking at n=3 but
-- become invisible footguns the first time a real promotion happens:
--
--   1. Make idx_ldc_active_category UNIQUE so the database (not the decide
--      route's correctness) is the source of "one active row per category".
--      Without this, a double-promote bug in any future caller — manual SQL,
--      a refactor of decide/route.ts, a script — leaves two active rows for
--      a category and getActiveLearnedLambda becomes non-deterministic.
--      With this, Postgres rejects the second insert/update with a constraint
--      violation and the bug surfaces loudly at write time.
--
--   2. accept_decay_proposal(uuid, text, text) RPC. The decide route does
--      three writes on accept (supersede current active → promote proposal →
--      audit). Without a transaction, a mid-way failure leaves either no
--      active row in the category, or an unlogged scoring change. This RPC
--      wraps the three writes in a single transaction; the route calls it
--      and gets a single all-or-nothing outcome.
--
-- Both are belt-to-the-supersede's-braces. The original migration is safe
-- to leave as written; this file is the second trip.

-- ── 1. Convert the partial active-row index to UNIQUE ───────────────
-- 'drop index' is required because Postgres will not in-place upgrade
-- a non-unique index to a unique one. The window of no-index between the
-- drop and create is < 1ms on a table that currently has 0–9 rows.
-- Wrap in a DO block so re-runs are no-ops.
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname  = 'idx_ldc_active_category'
      and indexdef not ilike '%unique%'
  ) then
    drop index idx_ldc_active_category;
  end if;
end$$;

create unique index if not exists idx_ldc_active_category
  on learned_decay_constants (category)
  where status = 'active';

-- ── 2. Atomic accept RPC ────────────────────────────────────────────
-- Inputs: the proposal row id, the deciding admin's identity (email/uid),
-- and an optional note. Returns the new active row id.
--
-- Guard rails inside the function:
--   - proposal must currently exist with status='proposed' (anything else
--     is rejected with a clear error — superseded/rejected/active/insufficient
--     are not promotable)
--   - any current active row in the same category is marked 'superseded'
--     in the same transaction
--   - the audit row is inserted in the same transaction
-- The partial-unique index from step 1 is the final backstop: even if this
-- function had a bug and tried to promote two rows in one call, the second
-- update would fail and the transaction would roll back.
create or replace function accept_decay_proposal(
  p_proposal_id   uuid,
  p_decided_by    text,
  p_note          text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category        varchar(40);
  v_proposed_lambda numeric(8,6);
  v_proposed_status varchar(20);
  v_prev_id         uuid;
  v_prev_lambda     numeric(8,6);
begin
  select category, learned_lambda, status
    into v_category, v_proposed_lambda, v_proposed_status
    from learned_decay_constants
   where id = p_proposal_id
   for update;

  if not found then
    raise exception 'Proposal % not found', p_proposal_id;
  end if;

  if v_proposed_status <> 'proposed' then
    raise exception 'Cannot accept row with status=%, only proposed rows are promotable', v_proposed_status;
  end if;

  -- Capture and supersede any current active row for this category.
  select id, learned_lambda
    into v_prev_id, v_prev_lambda
    from learned_decay_constants
   where category = v_category
     and status   = 'active'
   for update;

  if v_prev_id is not null then
    update learned_decay_constants
       set status = 'superseded'
     where id = v_prev_id;
  end if;

  -- Promote the proposal.
  update learned_decay_constants
     set status = 'active'
   where id = p_proposal_id;

  -- Audit.
  insert into decay_proposal_decisions (
    category, proposal_row_id, decision,
    previous_status, previous_lambda,
    new_status, new_lambda,
    decided_by, note
  )
  values (
    v_category, p_proposal_id, 'accept',
    case when v_prev_id is not null then 'active' else null end,
    v_prev_lambda,
    'active', v_proposed_lambda,
    p_decided_by, p_note
  );

  return p_proposal_id;
end;
$$;

revoke all on function accept_decay_proposal(uuid, text, text) from public;
-- Only the service role calls this (the decide route uses svc()).
-- Admin auth happens in the Next.js route; this function trusts its caller.
grant execute on function accept_decay_proposal(uuid, text, text) to service_role;

-- ── 3. Companion reject RPC ─────────────────────────────────────────
-- Symmetric with accept: one transaction for the status update + audit row.
-- Reject is simpler (no supersede dance) but keeping it atomic means the
-- route never has to reason about "what if the audit insert failed after
-- the status update succeeded".
create or replace function reject_decay_proposal(
  p_proposal_id   uuid,
  p_decided_by    text,
  p_note          text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category        varchar(40);
  v_proposed_lambda numeric(8,6);
  v_proposed_status varchar(20);
begin
  select category, learned_lambda, status
    into v_category, v_proposed_lambda, v_proposed_status
    from learned_decay_constants
   where id = p_proposal_id
   for update;

  if not found then
    raise exception 'Proposal % not found', p_proposal_id;
  end if;

  if v_proposed_status <> 'proposed' then
    raise exception 'Cannot reject row with status=%, only proposed rows are actionable', v_proposed_status;
  end if;

  update learned_decay_constants
     set status = 'rejected'
   where id = p_proposal_id;

  insert into decay_proposal_decisions (
    category, proposal_row_id, decision,
    previous_status, previous_lambda,
    new_status, new_lambda,
    decided_by, note
  )
  values (
    v_category, p_proposal_id, 'reject',
    'proposed', v_proposed_lambda,
    'rejected', v_proposed_lambda,
    p_decided_by, p_note
  );

  return p_proposal_id;
end;
$$;

revoke all on function reject_decay_proposal(uuid, text, text) from public;
grant execute on function reject_decay_proposal(uuid, text, text) to service_role;
