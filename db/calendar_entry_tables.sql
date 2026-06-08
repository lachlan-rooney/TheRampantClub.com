-- ─────────────────────────────────────────────────────────────────────────
-- calendar_entry_tables — table allocation for HOUSE entries.
--
-- A house calendar_entry can now occupy specific tables (units), mirroring the
-- member-booking booking_tables join. Semantics (enforced in
-- lib/booking-availability.ts):
--   • entry with blocks_space + NO units  → closes the WHOLE room (unchanged).
--   • entry with blocks_space + units      → blocks ONLY those units (+ their
--     either-or conflicts); the rest of the room stays bookable (e.g. a private
--     hire of just the Library Bar sofa).
--   • entry with blocks_space = false      → informational; units are a note,
--     they block nothing.
-- Additive — calendar_entries untouched; FKs INTO it + space_tables.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists calendar_entry_tables (
  entry_id uuid not null references calendar_entries(id) on delete cascade,
  unit_id  uuid not null references space_tables(id),
  primary key (entry_id, unit_id)
);
create index if not exists idx_calendar_entry_tables_unit on calendar_entry_tables(unit_id);

alter table calendar_entry_tables enable row level security;

-- Admin only — house allocation is staff data; the availability guard reads it
-- via the service role.
drop policy if exists "admins rw calendar_entry_tables" on calendar_entry_tables;
create policy "admins rw calendar_entry_tables" on calendar_entry_tables for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
