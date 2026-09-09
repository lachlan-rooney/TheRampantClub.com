-- ═══════════════════════════════════════════════════════════════════════════
-- BOOKINGS · KEEP WHAT WAS ORIGINALLY BOOKED.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Staff correct a booking's times after the member leaves — a person who was
-- there, adjusting a booking they can see. That is a better record of time in
-- the club than a card tap the member may never make, or a duration inferred
-- from a shift narrative.
--
-- BUT THE CORRECTION OVERWRITES. start_time and end_time are edited in place and
-- nothing keeps the original, so the moment staff fix an entry, "booked two
-- hours, stayed four" is gone. 7 of 11 bookings have already been edited; for
-- those the original is unrecoverable and this file does not pretend otherwise.
--
-- From here the booked values are snapshotted on INSERT and never touched again,
-- so the gap starts accruing today rather than after someone notices it is
-- missing.
--
-- BACKFILL IS DELIBERATELY PARTIAL. Rows never edited get their current times
-- (which ARE the originals). Rows already edited are left NULL — "we do not
-- know what was first booked" is the truth, and inventing a value would make the
-- no-show signal quietly wrong for exactly the bookings it matters on.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='bookings') then
    raise exception 'PREREQUISITES MISSING — bookings' using hint = 'Nothing applied.';
  end if;
end $prereq$;

alter table bookings add column if not exists booked_start_time time;
alter table bookings add column if not exists booked_end_time   time;

comment on column bookings.booked_start_time is
  'What was ORIGINALLY booked. Set once on insert, never updated. start_time is the corrected actual.';
comment on column bookings.booked_end_time is
  'What was ORIGINALLY booked. NULL on rows edited before this column existed — unknown, not zero.';

-- Backfill only where the row was never edited, so a corrected row is not
-- mislabelled as having been booked for the time it actually ran.
update bookings
   set booked_start_time = start_time,
       booked_end_time   = end_time
 where booked_start_time is null
   and (updated_at is null or updated_at <= created_at + interval '60 seconds');

create or replace function bookings_snapshot_booked()
  returns trigger language plpgsql as $fn$
begin
  if tg_op = 'INSERT' then
    new.booked_start_time := new.start_time;
    new.booked_end_time   := new.end_time;
  else
    -- An edit corrects the ACTUAL. What was booked is history and does not move.
    new.booked_start_time := old.booked_start_time;
    new.booked_end_time   := old.booked_end_time;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_bookings_snapshot_booked on bookings;
create trigger trg_bookings_snapshot_booked
  before insert or update on bookings
  for each row execute function bookings_snapshot_booked();

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_cols int; v_trg int; v_known int; v_total int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_schema='public' and table_name='bookings'
     and column_name in ('booked_start_time','booked_end_time');
  if v_cols <> 2 then raise exception 'SELF-CHECK: booked_* columns missing (found %)', v_cols; end if;

  select count(*) into v_trg from pg_trigger
   where tgrelid='bookings'::regclass and tgname='trg_bookings_snapshot_booked' and not tgisinternal;
  if v_trg <> 1 then raise exception 'SELF-CHECK: snapshot trigger not attached'; end if;

  select count(*) , count(*) filter (where booked_start_time is not null) into v_total, v_known from bookings;
  raise notice 'bookings: % rows, % with a known original booking time. The rest were edited before this existed.',
    v_total, v_known;
end $check$;

commit;
