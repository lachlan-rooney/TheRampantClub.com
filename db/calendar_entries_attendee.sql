-- Calendar entries — two changes for the richer admin calendar:
--
-- 1. `attendee` column: record WHO an entry is with (a member or a "random"
--    guest), so meetings / interviews / events are logged against a named
--    person even when they aren't a member. Free-text.
--
-- 2. Widen the `kind` CHECK to allow the new entry types (meeting, interview,
--    event, reminder). The column IS check-constrained, so the new kinds are
--    rejected until this runs. We drop WHATEVER check constraint references
--    `kind` (its auto-generated name can vary), then add the full-set one.

alter table calendar_entries add column if not exists attendee text;

do $$
declare c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.calendar_entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table calendar_entries drop constraint %I', c);
  end loop;
end $$;

alter table calendar_entries add constraint calendar_entries_kind_check
  check (kind in ('meeting','interview','event','reminder','closure','private_hire','supplier','tasting','other'));
