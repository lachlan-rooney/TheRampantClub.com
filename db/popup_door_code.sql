-- ═══════════════════════════════════════════════════════════════════════════
-- A FOUR-DIGIT DOOR CODE.  13 November 2026, small hours.
-- ───────────────────────────────────────────────────────────────────────────
-- The ticket code is eight hex characters. That is right for a QR and useless
-- for a person: nobody reads "7E833C4F" across a door, and nobody says it.
--
-- So every booking also gets FOUR DIGITS, unique within the evening, which is
-- what a guest reads out and what staff type.
--
-- ══ FOUR DIGITS CANNOT BE A KEY, AND ARE NOT TREATED AS ONE ══════════════
-- Ten thousand codes and a hundred guests means a guessed code hits about one
-- time in a hundred. So THE CODE ALONE NEVER ADMITS ANYBODY. Typing it shows
-- the booking — name, time, party — and the door screen asks staff to check
-- the name before the admit button appears. The QR keeps the full signed
-- token and remains the only thing that admits on its own.
--
-- ⚠ ASSIGNED BY A TRIGGER, NOT BY RESTATING popup_book. That function has
-- been restated three times tonight and carries two fixes found the hard way;
-- a fourth copy is a fourth chance to lose one. A trigger fills the column for
-- every path that inserts — the phone, a walk-up, a promotion, an import —
-- including paths written later that nobody remembers to update.
--
-- Safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

alter table popup_bookings add column if not exists door_code text;
comment on column popup_bookings.door_code is
  'Four digits, unique within the event. What a guest reads out and what staff type. '
  'NEVER admits on its own — popup_find_by_code returns the booking so staff can '
  'check the name first. The QR carries the full signed ticket_code.';

-- Unique per evening, and only where it is set, so an older row with none
-- does not block the index.
create unique index if not exists popup_bookings_door_code_once
  on popup_bookings (event_id, door_code) where door_code is not null;

-- ── ASSIGNING ONE ─────────────────────────────────────────────────────────
-- ⚠ IT LOOPS AGAINST THE UNIQUE INDEX RATHER THAN TRUSTING A RANDOM NUMBER.
-- At a hundred bookings a collision is about a one-in-a-hundred event per
-- insert — rare enough to be missed in testing and common enough to happen on
-- the night, where it would be a guest handed somebody else's code.
create or replace function popup_assign_door_code()
  returns trigger language plpgsql set search_path = public as $fn$
declare v_code text; v_tries int := 0;
begin
  if new.door_code is not null then return new; end if;
  loop
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (
      select 1 from popup_bookings b
       where b.event_id = new.event_id and b.door_code = v_code);
    v_tries := v_tries + 1;
    -- Ten thousand codes against a hundred guests: a hundred failures in a row
    -- is not bad luck, it is a full evening. Say so rather than spin.
    if v_tries > 100 then
      raise exception 'could not find a free door code for this event after % tries', v_tries;
    end if;
  end loop;
  new.door_code := v_code;
  return new;
end $fn$;

drop trigger if exists trg_popup_door_code on popup_bookings;
create trigger trg_popup_door_code
  before insert on popup_bookings
  for each row execute function popup_assign_door_code();

-- ── EVERY BOOKING THAT ALREADY EXISTS GETS ONE ────────────────────────────
do $b$
declare r record; v_code text;
begin
  for r in select id, event_id from popup_bookings where door_code is null loop
    loop
      v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
      exit when not exists (
        select 1 from popup_bookings b where b.event_id = r.event_id and b.door_code = v_code);
    end loop;
    update popup_bookings set door_code = v_code where id = r.id;
  end loop;
end $b$;

-- ── LOOKING ONE UP: SHOW, DO NOT ADMIT ────────────────────────────────────
-- ⚠ THIS FUNCTION CANNOT ADMIT ANYBODY. It has no UPDATE in it at all. That
-- is the guarantee that four guessable digits never let a stranger in: the
-- only thing they can buy is a name on a screen that staff then have to match
-- to the person standing there.
drop function if exists popup_find_by_code(uuid, text);
create function popup_find_by_code(p_event_id uuid, p_code text)
returns table (
  found boolean, booking_id uuid, name text, party_size int, status text,
  ticket_code text, door_code text, starts_at timestamptz, ends_at timestamptz,
  admitted_at timestamptz, admitted_by text, admitted_party int, session_idx int
)
language sql security definer set search_path = public stable as $$
  select true, b.id, b.name, b.party_size, b.status, b.ticket_code, b.door_code,
         s.starts_at, s.ends_at, b.admitted_at, b.admitted_by, b.admitted_party, s.idx
    from popup_bookings b
    join popup_sessions s on s.id = b.session_id
   where b.event_id = p_event_id
     and b.door_code = lpad(regexp_replace(coalesce(p_code, ''), '\D', '', 'g'), 4, '0')
   limit 1;
$$;

revoke all on function popup_find_by_code(uuid, text) from public;
revoke all on function popup_find_by_code(uuid, text) from anon;
revoke all on function popup_find_by_code(uuid, text) from authenticated;
grant execute on function popup_find_by_code(uuid, text) to service_role;

commit;

-- ── PROVE IT ──────────────────────────────────────────────────────────────
do $v$
declare
  v_ev uuid; v_s uuid; v_r record; v_b uuid; v_code text; v_n int; v_dupes int;
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'popup_bookings' and column_name = 'door_code') then
    raise exception 'door_code was not added';
  end if;

  -- every existing booking has one, and none repeats within its evening
  select count(*) into v_n from popup_bookings where door_code is null;
  if v_n > 0 then raise exception '% booking(s) still have no door code', v_n; end if;
  select count(*) into v_dupes from (
    select event_id, door_code from popup_bookings
     group by event_id, door_code having count(*) > 1) x;
  if v_dupes > 0 then raise exception '% duplicate door code(s) within an event', v_dupes; end if;

  -- a new booking gets one automatically, four digits, from the trigger
  insert into popup_events (slug, title_en, venue_en, event_date, first_start, last_finish,
                            default_cap, party_max, published)
  values ('verify-doorcode-' || substr(gen_random_uuid()::text, 1, 8),
          'VERIFY — not an event', 'Verify', current_date + 1, '18:00', '18:20', 12, 2, true)
  returning id into v_ev;
  perform popup_generate_sessions(v_ev);
  select s.id into v_s from popup_sessions s where s.event_id = v_ev order by s.idx limit 1;
  update popup_sessions set starts_at = now() + interval '1 hour', ends_at = now() + interval '2 hours'
   where id = v_s;

  select * into v_r from popup_book(v_ev, v_s, 'Code Guest', null, 1, 'en', false, 'v',
                                    'kiosk', gen_random_uuid(), false, 'Harness');
  if not v_r.ok then raise exception 'the verify booking was refused: %', v_r.reason; end if;
  select b.door_code into v_code from popup_bookings b where b.id = v_r.booking_id;
  if v_code is null or v_code !~ '^[0-9]{4}$' then
    raise exception 'the trigger gave % , not four digits', coalesce(v_code, '<null>');
  end if;

  -- it finds the booking…
  select * into v_r from popup_find_by_code(v_ev, v_code);
  if not v_r.found or v_r.name <> 'Code Guest' then raise exception 'lookup did not find the guest'; end if;
  -- …and typing it changed nothing
  if (select b.admitted_at from popup_bookings b where b.door_code = v_code and b.event_id = v_ev) is not null then
    raise exception 'LOOKING UP A CODE ADMITTED SOMEBODY';
  end if;
  -- a code that is not there answers empty rather than erroring
  if exists (select 1 from popup_find_by_code(v_ev, '0000')
              where door_code <> v_code) then null; end if;

  delete from popup_events where id = v_ev;
  raise notice 'popup_door_code: column ✓ · backfilled ✓ · unique per event ✓ · trigger gives 4 digits ✓ · lookup shows but never admits ✓';
end $v$;
