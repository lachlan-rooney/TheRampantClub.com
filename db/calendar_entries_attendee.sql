-- Calendar entries — two changes for the richer admin calendar:
--
-- 1. `attendee` column: record WHO an entry is with (a member or a "random"
--    guest), so meetings / interviews / events are logged against a named
--    person even when they aren't a member. Free-text — covers members and
--    non-members alike ("at least recorded").
--
-- 2. Widen the `kind` CHECK to allow the new entry types (meeting, interview,
--    event, reminder). The column is CHECK-constrained (not free-text), so the
--    new kinds are rejected until this runs.

alter table calendar_entries add column if not exists attendee text;

alter table calendar_entries drop constraint if exists calendar_entries_kind_check;
alter table calendar_entries add constraint calendar_entries_kind_check
  check (kind in ('meeting','interview','event','reminder','closure','private_hire','supplier','tasting','other'));
