-- ═══════════════════════════════════════════════════════════════════════════
-- A PHONE NUMBER, OPTIONAL, WITH ITS OWN TICK
-- ───────────────────────────────────────────────────────────────────────────
-- Two columns and nothing else. In particular it does NOT touch popup_book:
-- that function is taking real bookings tonight, and changing a live
-- signature on the evening of the event to add an optional marketing field
-- would be trading a working door for a nicer-looking call. The phone is
-- written by the booking route in a second statement, keyed on the booking id
-- it was just handed, so a failure there costs a phone number and never a
-- place.
--
-- ⚠ ITS OWN CONSENT, NOT THE EMAIL ONE. A guest who agreed to an email has
--   not agreed to a phone call. In Vietnam that number is a Zalo account, and
--   a message to it arrives in a far more personal place than an inbox.
--   Separate columns mean the two can never be read as one by accident.
--
-- ⚠ NEITHER IS REQUIRED TO COME IN. Same rule as the email: a place is never
--   conditional on being contactable afterwards.
--
-- Run once. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table popup_bookings add column if not exists phone text;
alter table popup_bookings add column if not exists consent_phone boolean not null default false;

-- A number nobody can ring is not worth keeping, and a 500-character "phone"
-- is somebody pasting something else into the field.
alter table popup_bookings drop constraint if exists popup_bookings_phone_len;
alter table popup_bookings add constraint popup_bookings_phone_len
  check (phone is null or char_length(btrim(phone)) between 6 and 32);

comment on column popup_bookings.phone is
  'Optional. For Zalo or a call after the event. Never required to be admitted.';
comment on column popup_bookings.consent_phone is
  'Its own tick, separate from consent_marketing. An email yes is not a phone yes.';

-- ── PROOF ─────────────────────────────────────────────────────────────────
do $$
declare v_ev uuid; v_s uuid; v_id uuid; v_n int;
begin
  select id into v_ev from popup_events where slug = 'palace-practice';
  if v_ev is null then raise exception 'the practice evening is missing — run db/popup_practice.sql'; end if;
  select id into v_s from popup_sessions where event_id = v_ev order by idx limit 1;

  insert into popup_bookings (event_id, session_id, name, party_size, ticket_code, phone, consent_phone)
  values (v_ev, v_s, 'PHONE CHECK', 1, 'ZZPHONE1', '0901 234 567', true)
  returning id into v_id;

  select count(*) into v_n from popup_bookings
   where id = v_id and phone = '0901 234 567' and consent_phone;
  if v_n <> 1 then raise exception 'the number did not store'; end if;

  -- the two consents must be independent, or they are one column wearing two names
  select count(*) into v_n from popup_bookings
   where id = v_id and consent_phone and not consent_marketing;
  if v_n <> 1 then raise exception 'the phone tick is reading the email tick'; end if;

  -- and a number that is not one must be refused by the database
  begin
    update popup_bookings set phone = '123' where id = v_id;
    raise exception 'a three-character phone number was accepted';
  exception when check_violation then null;
  end;

  -- an empty field is a null, not an empty string pretending to be a number
  update popup_bookings set phone = null where id = v_id;

  delete from popup_bookings where id = v_id;
  select count(*) into v_n from popup_bookings where ticket_code = 'ZZPHONE1';
  if v_n <> 0 then raise exception 'the check row is still there'; end if;
  raise notice 'popup_bookings.phone + consent_phone ready, and the two ticks are independent';
end $$;
