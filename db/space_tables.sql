-- ─────────────────────────────────────────────────────────────────────────
-- Named-table booking inventory — Phase 1 (schema + seed).
--
-- Every bookable UNIT is one row in space_tables. Exclusivity and
-- non-bookability are EMERGENT, not flags:
--   • a room with ONE whole-room unit is exclusive (Dining Room, Lab)
--   • a room with ZERO units is not bookable (Sports Club — seed nothing)
--   • parent_id is the EITHER-OR mechanism: a split segment's parent_id points
--     at the whole unit. conflict(U) = {U} ∪ children(U) ∪ {parent(U)} is then
--     DERIVED from the parent graph (never hand-entered pairs — a forgotten
--     pair would be a silent double-book; derivation is structurally correct).
--
-- A booking holds one-or-more units via booking_tables (the join).
-- Additive — bookings is untouched; booking_tables FKs INTO bookings(booking_id).
-- The availability guard (Phase 2) reasons over this seed, so it must EXACTLY
-- match the real rooms — eyeball the readout before Phase 2.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists space_tables (
  id         uuid primary key default gen_random_uuid(),
  space      text not null,                              -- room name (matches bookings.space strings)
  name       text not null,                              -- unit name e.g. 'Sofa (whole)', 'Sofa — left'
  seats      int  not null check (seats > 0),
  parent_id  uuid references space_tables(id) on delete cascade,  -- either-or: segment → whole
  bookable   boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (space, name)                                   -- lets the seed be re-run safely (on conflict)
);
create index if not exists idx_space_tables_space  on space_tables(space);
create index if not exists idx_space_tables_parent on space_tables(parent_id);

create table if not exists booking_tables (
  booking_id uuid not null references bookings(booking_id) on delete cascade,
  unit_id    uuid not null references space_tables(id),
  primary key (booking_id, unit_id)
);
create index if not exists idx_booking_tables_unit on booking_tables(unit_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- space_tables is room inventory, not sensitive: any authenticated user may
-- read it (the booking form needs the unit list); only admins may write.
alter table space_tables enable row level security;
drop policy if exists "admins write space_tables" on space_tables;
create policy "admins write space_tables" on space_tables for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
drop policy if exists "authenticated read space_tables" on space_tables;
create policy "authenticated read space_tables" on space_tables for select
  using (auth.uid() is not null);

-- booking_tables is booking internals — admin only (members don't self-book).
alter table booking_tables enable row level security;
drop policy if exists "admins rw booking_tables" on booking_tables;
create policy "admins rw booking_tables" on booking_tables for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- ── SEED ───────────────────────────────────────────────────────────────────
-- Step 1: all top-level units (parent_id = null). Re-runnable via on conflict.
insert into space_tables (space, name, seats, sort) values
  ('Library Bar',      'Bookcase Table',  4, 10),
  ('Library Bar',      'Window Table',    4, 20),
  ('Library Bar',      'Sofa (whole)',    8, 30),
  ('Library Bar',      'Bar Stool 1',     1, 50),
  ('Library Bar',      'Bar Stool 2',     1, 51),
  ('Library Bar',      'Bar Stool 3',     1, 52),
  ('Library Bar',      'Bar Stool 4',     1, 53),
  ('Library Bar',      'Bar Stool 5',     1, 54),
  ('Library Bar',      'Bar Stool 6',     1, 55),
  ('The Studio',       'Studio (whole, big table)', 6, 10),
  ('The Rampant Room', 'Rampant Table 1', 6, 10),
  ('The Rampant Room', 'Rampant Table 2', 6, 20),
  ('The Rampant Room', 'Rampant Table 3', 4, 30),
  ('The Rampant Room', 'Rampant Table 4', 4, 40)
on conflict (space, name) do nothing;

-- Step 2: child units (the either-or splits). Each references its whole-unit
-- parent by lookup, so this is re-runnable and order-independent of Step 1's ids.
insert into space_tables (space, name, seats, parent_id, sort)
select 'Library Bar', 'Sofa — left',   3, p.id, 31 from space_tables p where p.space = 'Library Bar' and p.name = 'Sofa (whole)'
on conflict (space, name) do nothing;
insert into space_tables (space, name, seats, parent_id, sort)
select 'Library Bar', 'Sofa — middle', 2, p.id, 32 from space_tables p where p.space = 'Library Bar' and p.name = 'Sofa (whole)'
on conflict (space, name) do nothing;
insert into space_tables (space, name, seats, parent_id, sort)
select 'Library Bar', 'Sofa — right',  3, p.id, 33 from space_tables p where p.space = 'Library Bar' and p.name = 'Sofa (whole)'
on conflict (space, name) do nothing;

insert into space_tables (space, name, seats, parent_id, sort)
select 'The Studio', 'Studio Table A', 2, p.id, 11 from space_tables p where p.space = 'The Studio' and p.name = 'Studio (whole, big table)'
on conflict (space, name) do nothing;
insert into space_tables (space, name, seats, parent_id, sort)
select 'The Studio', 'Studio Table B', 2, p.id, 12 from space_tables p where p.space = 'The Studio' and p.name = 'Studio (whole, big table)'
on conflict (space, name) do nothing;
insert into space_tables (space, name, seats, parent_id, sort)
select 'The Studio', 'Studio Table C', 2, p.id, 13 from space_tables p where p.space = 'The Studio' and p.name = 'Studio (whole, big table)'
on conflict (space, name) do nothing;

-- Exclusive rooms — a single whole-room unit each (seats confirmed by the club:
-- Dining 10, Lab 8). One unit makes the room bookable & exclusive; the seat
-- count only gates the party≤seats check.
insert into space_tables (space, name, seats, sort) values
  ('The Dining Room',     'Dining Room (whole)',          10, 10),
  ('Source & Origin Lab', 'Source & Origin Lab (whole)',   8, 10)
on conflict (space, name) do nothing;

-- Sports Club is intentionally absent (not bookable → zero units).
