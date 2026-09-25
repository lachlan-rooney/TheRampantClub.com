-- ═══════════════════════════════════════════════════════════════════════════
-- CALENDAR ENTRIES · HOW MANY PEOPLE ARE COMING.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-09-25: "If it's in the calendar.... It's a damn booking."
--
-- He is right, and the schema disagreed with him. A private party booked into
-- The Rampant Room by staff goes in as a calendar ENTRY, and an entry has a
-- title, a room, a time and a description — and nowhere to say how many people
-- are coming. So tomorrow's party of eight exists only inside a sentence:
--
--   "- Booking under Mr. Vu - Arrival time: around 3:00 PM ~ 4:00 PM
--    - Guest: around 8 pax"
--
-- Nothing can count a sentence. Those eight are invisible to the attendance
-- strip, to the week's report, and to anyone asking how busy Saturday is.
--
-- COVERS is that number, and it is deliberately NOT party_size: a booking's
-- party is a member plus guests, and an entry has no member on it. Covers is
-- simply how many people the club expects through the door for that entry.
--
-- NULL MEANS NOBODY SAID, not zero. A closure has no covers and never will; a
-- meeting might. Every surface treats null as "unknown" and shows nothing,
-- which is the behaviour those entries have today.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'calendar_entries') then
    raise exception 'PREREQUISITES MISSING — calendar_entries' using hint = 'Nothing applied.';
  end if;
end $prereq$;

alter table public.calendar_entries
  add column if not exists covers integer
    check (covers is null or (covers > 0 and covers <= 500));

comment on column public.calendar_entries.covers is
  'How many people are expected for this entry. NULL = nobody has said, which is not the same as none. A closure has none.';

-- ── THE ONE THE CLUB ALREADY KNOWS ────────────────────────────────────────
-- Saturday's party, taken from the entry's own note ("Guest: around 8 pax").
-- It is the club's own figure, read off the club's own record — not a guess —
-- and it is set here rather than left for someone to remember.
update public.calendar_entries
   set covers = 8
 where entry_date = '2026-09-26'
   and title ilike '%Vu%'
   and covers is null;

commit;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- alter table public.calendar_entries drop column if exists covers;
