-- Calendar entries: record WHO an entry is with (a member or a "random" guest),
-- so meetings / interviews / events are logged against a named person even when
-- they aren't a member. Free-text by design — covers members and non-members
-- alike ("at least recorded"). Also underpins the new entry kinds
-- (meeting / interview / event / reminder), which need no schema change since
-- `kind` is a free-text column (the API allow-list governs valid values).

alter table calendar_entries add column if not exists attendee text;
