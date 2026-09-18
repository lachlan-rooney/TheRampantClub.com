-- ═══════════════════════════════════════════════════════════════════════════
-- ORDERS FROM THE ROOM TABLET
-- ───────────────────────────────────────────────────────────────────────────
-- A member builds an order on the tablet with +/- , confirms it, and it sits
-- at the foot of the menu until a staff member has placed it with the kitchen
-- and cleared it.
--
-- This reverses something the menu component says about itself in its own
-- header — "this is a MENU, not a shop" — which was true this morning and is
-- not any more. The comment is corrected in the same commit, because a stale
-- comment that contradicts the code is worse than no comment.
--
-- ── THREE DECISIONS THE OWNER MADE, AND WHAT THEY COST ────────────────────
--
-- 1. THE ROOM TABLET ONLY. No phone ordering, so there is no notification path
--    to build and no question of an order arriving in an empty room.
--
-- 2. THE ORDER BELONGS TO THE ROOM, NOT A MEMBER. No card tap is required to
--    confirm. It is the fastest thing to use and the reason the bill is still
--    worked out by a person — `member_no` exists on the table but stays null
--    until somebody decides they want automatic billing, which is a different
--    conversation with a different set of risks.
--
-- 3. STAFF CLEAR IT ON THE MENU PAGE. Fewest taps during service, and the
--    accepted cost is that anyone standing at the tablet can clear an order.
--    That is survivable because nothing is charged here: clearing loses a
--    request, not money. If it becomes a nuisance the controls move behind the
--    Staff PIN, which is a one-line change to where the panel renders.
--
-- ── THE PRICES ARE NOT TRUSTED FROM THE TABLET ────────────────────────────
-- The client sends item ids and quantities, NOTHING ELSE. The server looks up
-- every price itself and computes the total. A tablet standing unattended in a
-- public room must never be able to tell the club what something costs.
--
-- Prices are SNAPSHOTTED onto the line at confirm time, so an order already
-- placed keeps what was quoted even if somebody edits the menu mid-service.
--
-- ── "DELETE" ARCHIVES ─────────────────────────────────────────────────────
-- Clearing sets `cleared_at`; it does not delete the row. The order vanishes
-- from the tablet either way, and the club keeps a record of what each room
-- actually asked for — which is the only data anyone has ever had about what
-- members eat here.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.menu_orders (
  id           uuid primary key default gen_random_uuid(),

  -- Which tablet it came from. Matches kiosk_devices.room.
  room         text not null,

  status       text not null default 'pending'
               check (status in ('pending', 'ordered')),

  -- Computed by the server from the menu, never sent by the client.
  total_vnd    integer not null default 0 check (total_vnd >= 0),

  -- Null by the owner's decision, above. Here so that attaching a member later
  -- is a change of mind rather than a migration.
  member_no    text,

  created_at   timestamptz not null default now(),
  ordered_at   timestamptz,
  ordered_by   text,
  cleared_at   timestamptz
);

create table if not exists public.menu_order_lines (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.menu_orders(id) on delete cascade,

  -- Nullable on purpose: a dish can be deleted from the menu next week and the
  -- order it appeared on must still read correctly.
  item_id        uuid references public.menu_items(id) on delete set null,

  -- The snapshot. What it was called, whose kitchen, what it cost, on the
  -- evening it was ordered.
  venue_name     text not null,
  name_en        text not null,
  name_vn        text,
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  qty            integer not null check (qty between 1 and 50),
  line_total_vnd integer not null check (line_total_vnd >= 0),

  display_order  integer not null default 0
);

create index if not exists menu_orders_open_idx
  on public.menu_orders (room, cleared_at) where cleared_at is null;
create index if not exists menu_order_lines_order_idx
  on public.menu_order_lines (order_id, display_order);

-- ONE OPEN ORDER PER ROOM. Two half-built orders on one table is how a kitchen
-- gets sent the wrong thing; the tablet edits the open one instead.
create unique index if not exists menu_orders_one_open_per_room
  on public.menu_orders (room) where cleared_at is null;

-- ── Locked to the service role ─────────────────────────────────────────────
-- RLS on with NO policies, and the grants revoked on top. There is no member
-- or anon path to these tables at all: the tablet talks to /api/kiosk/orders,
-- which checks the device token first and uses the service role.
alter table public.menu_orders      enable row level security;
alter table public.menu_order_lines enable row level security;
revoke all on public.menu_orders, public.menu_order_lines from anon, authenticated;

-- ── What a room has open right now ─────────────────────────────────────────
select room, status, to_char(total_vnd, 'FM999,999,999') || '₫' as total, created_at
  from public.menu_orders
 where cleared_at is null
 order by created_at;
