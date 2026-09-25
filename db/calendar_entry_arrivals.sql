-- ═══════════════════════════════════════════════════════════════════════════
-- DIARY ENTRIES · MARKING A PRIVATE PARTY IN.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-09-25: "no way to mark a diary party arrived, sort that out."
--
-- db/calendar_entry_covers.sql gave an entry a headcount, so Saturday's eight
-- could be counted. This gives it an ARRIVAL, so they can stop being an
-- expectation. Until now the club's judgement ("they will be there") was the
-- only thing holding that figure up; after this, a member of staff taps the
-- row when the party walks in and the number is a record.
--
-- TWO COLUMNS, NOT ONE:
--   arrived_at     when somebody tapped it — the timestamp that makes it real.
--   arrived_covers how many actually came, which is not always what was
--                  booked. Eight expected and six through the door is the
--                  ordinary case, and a club that can only store the booking
--                  learns nothing from it.
--
-- NULL arrived_covers on an arrived row means "as booked": staff tapping one
-- button must not be forced to type a number, and the surfaces read covers
-- when the count is absent.
--
-- LEFT IS DELIBERATELY ABSENT. A party has no member to walk back out, and a
-- second stamp nobody presses is worse than none: the entry's own end time is
-- what the club has, and it is already on the row.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'calendar_entries'
                    and column_name = 'covers') then
    raise exception 'PREREQUISITES MISSING — run db/calendar_entry_covers.sql first'
      using hint = 'Nothing applied.';
  end if;
end $prereq$;

alter table public.calendar_entries
  add column if not exists arrived_at timestamptz,
  add column if not exists arrived_covers integer
    check (arrived_covers is null or (arrived_covers >= 0 and arrived_covers <= 500));

comment on column public.calendar_entries.arrived_at is
  'When staff marked this party as having arrived. NULL = still expected.';
comment on column public.calendar_entries.arrived_covers is
  'How many actually came, where it differs from covers. NULL on an arrived row means "as booked".';

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- select entry_date, title, covers, arrived_at, arrived_covers
--   from public.calendar_entries where covers is not null order by entry_date;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- alter table public.calendar_entries
--   drop column if exists arrived_at, drop column if exists arrived_covers;
