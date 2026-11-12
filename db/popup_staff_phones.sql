-- ═══════════════════════════════════════════════════════════════════════════
-- THE POP-UP STAFF PHONE — one pairing, both pop-up jobs, nothing else.
-- 12 November 2026.
-- ───────────────────────────────────────────────────────────────────────────
-- The plan changed: the room tablets are needed INSIDE the pop-up for the
-- Flavour Finder, so sign-up moves onto staff phones. The same people may take
-- a name at one moment and work the door the next, so one phone must do both.
--
-- ══ WHY A THIRD PURPOSE AND NOT A MERGE ══════════════════════════════════
-- The obvious move is to let a door device open the sign-up stand. It is the
-- wrong one. `purpose` exists because of WHAT A SURFACE CARRIES:
--
--   room  → the board, the member PIN pad, the staff shell, the menus with
--           member prices. Member PII.
--   door  → the club's guest sign-in at the entrance. Signatures, hosts.
--   popup → the pop-up sign-up and the pop-up door list. One evening's guests
--           at the Palace, and NOTHING of the club.
--
-- Merging stand into door would have given a phone in a guest's hand at the
-- Palace a pairing that also opens the club's entrance iPad flow. A third
-- purpose is NARROWER THAN EITHER of the two it sits beside: these phones
-- cannot reach the board, the finder, the menus, the staff shell, the member
-- pad or the club's door — not because those screens hide things from them,
-- but because middleware will not open them at all.
--
-- A popup device stands in no room, exactly as a door device does not: the
-- phone is in somebody's pocket, moving.
--
-- Run it on its own. It touches one constraint, one trigger and one comment,
-- and it is safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

alter table kiosk_devices drop constraint if exists kiosk_devices_purpose_valid;
alter table kiosk_devices add constraint kiosk_devices_purpose_valid
  check (purpose in ('room', 'door', 'popup'));

comment on column kiosk_devices.purpose is
  'room = an in-room tablet (board / member / staff / finder / menus). '
  'door = the club''s guest sign-in iPad at the entrance. '
  'popup = a staff phone at the pop-up: the sign-up stand and the pop-up door list, and nothing else. '
  'Neither door nor popup ever carries a room.';

-- The room guard, taught about the third kind. A popup phone with a room set
-- would be a phone claiming to stand in the Library Bar while it is at
-- Independence Palace — which is exactly the confusion `purpose` exists to stop.
create or replace function kiosk_devices_room_guard()
  returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.purpose in ('door', 'popup') then
    if new.room is not null then
      raise exception 'a % device stands in no room (got %)', new.purpose, new.room
        using hint = 'Leave room empty for purpose = door or popup.';
    end if;
    return new;
  end if;
  if new.room is not null
     and not exists (select 1 from space_tables st where st.space = new.room) then
    raise exception 'room % is not a space in space_tables', new.room
      using hint = 'Pick from: select distinct space from space_tables';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_kiosk_devices_room_guard on kiosk_devices;
create trigger trg_kiosk_devices_room_guard
  before insert or update of room, purpose on kiosk_devices
  for each row execute function kiosk_devices_room_guard();

-- kiosk_device_purpose() needs no change: it returns whatever word is in the
-- column, and middleware decides what that word may open. One place.

-- ── PROVE IT, rather than trust that it took ──────────────────────────────
do $v$
declare v_ok boolean;
begin
  -- the constraint accepts the new word
  select exists (
    select 1 from pg_constraint
     where conname = 'kiosk_devices_purpose_valid'
       and pg_get_constraintdef(oid) like '%popup%'
  ) into v_ok;
  if not v_ok then raise exception 'the purpose constraint does not know popup'; end if;

  -- and the guard refuses a popup phone that claims a room.
  -- v_ok is the flag, NOT a raise inside the block: a raise there would be
  -- caught by this block's own handler, which is how a check quietly inverts.
  v_ok := false;
  begin
    insert into kiosk_devices (label, token_hash, purpose, room)
    values ('VERIFY — should not exist', repeat('f', 64), 'popup', 'Library Bar');
  exception
    when others then
      if position('stands in no room' in sqlerrm) > 0 then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'the room guard LET a popup device claim a room'; end if;

  raise notice 'popup_staff_phones: purpose in (room, door, popup) ✓ · a popup device stands in no room ✓';
end $v$;

commit;
