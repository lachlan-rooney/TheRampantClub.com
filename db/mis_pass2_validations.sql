-- Run once in the Supabase SQL editor, after db/mis_pass1.sql.
--
-- MIS Pass 2-lite — validation write contract.
--
-- Implements the SQL transaction template from spec §5 as a single Postgres
-- function so both UPDATE and INSERT happen atomically:
--   1. Bump validation_count + refresh last_validated + last_event_timestamp
--      (this is what makes R climb over time)
--   2. Insert into validation_events (the ONLY source the weekly λ-fit reads)
--
-- The function also accepts optional new values for s0/confidence/lambda/
-- frequency/status so a "revise" can happen in the same transaction. Pass
-- NULL for any field you don't want to change.
--
-- Matches the pattern of apply_card_transaction in db/member_cards.sql.

create or replace function apply_preference_validation(
  p_preference_id  uuid,
  p_event_type     text,                 -- 'confirmed' | 'contradicted' | 'revised' | 'invalidated'
  p_staff_id       text default null,
  p_notes          text default null,
  p_s0             smallint default null,
  p_confidence     numeric  default null,
  p_lambda         numeric  default null,
  p_frequency      numeric  default null,
  p_status         text     default null  -- 'active' | 'invalidated' | 'archived'
) returns uuid                            -- the new event_id
language plpgsql
as $$
declare
  v_member_no         varchar(12);
  v_confidence_before numeric(3,2);
  v_days_since        int;
  v_event_id          uuid;
begin
  -- Validate event_type up front
  if p_event_type not in ('confirmed','contradicted','revised','invalidated') then
    raise exception 'Invalid event_type: %', p_event_type;
  end if;

  -- Lock the preference row and read what we need for the event log
  select member_no, confidence, (current_date - last_validated)
    into v_member_no, v_confidence_before, v_days_since
    from preferences
    where preference_id = p_preference_id
    for update;

  if not found then
    raise exception 'preference_id not found: %', p_preference_id;
  end if;

  -- Update the preference: always bump count + refresh clock; optionally revise fields
  update preferences set
    validation_count     = validation_count + 1,
    last_validated       = current_date,
    last_event_timestamp = now(),
    s0         = coalesce(p_s0,         s0),
    confidence = coalesce(p_confidence, confidence),
    lambda     = coalesce(p_lambda,     lambda),
    frequency  = coalesce(p_frequency,  frequency),
    status     = coalesce(p_status,     status)
    where preference_id = p_preference_id;

  -- Log the event — the canonical record the ML layer will read
  insert into validation_events (
    preference_id, member_no, event_type, days_since_last_validation,
    confidence_before, confidence_after, staff_id, notes
  ) values (
    p_preference_id, v_member_no, p_event_type, v_days_since,
    v_confidence_before, coalesce(p_confidence, v_confidence_before),
    p_staff_id, p_notes
  ) returning event_id into v_event_id;

  return v_event_id;
end;
$$;

-- Grant execute to authenticated so the service-role API route can RPC-call it.
-- (Service role bypasses RLS anyway; the grant lets us also call from the
-- regular client later if we need to.)
grant execute on function apply_preference_validation(uuid, text, text, text, smallint, numeric, numeric, numeric, text) to authenticated;
