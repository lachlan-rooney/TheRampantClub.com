-- ═══════════════════════════════════════════════════════════════════════════
--  Migration: 20260923140000_menu_orders_service_and_vat.sql
--  A room order carries its service charge and its VAT, and the rates it was
--  quoted at.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-23: "we add vat plus 10% service charge" — menu prices are
--  NET, service is 10% of the food, and VAT is 10% of food PLUS service (the
--  usual Vietnamese "++"). A 1,000,000₫ order is 100,000 service, 110,000 VAT,
--  1,210,000 total.
--
--  WHY THE RATES ARE STORED ON THE ORDER, not just applied. Prices are already
--  snapshotted onto menu_order_lines so an order keeps what it was quoted when
--  the menu is edited mid-service. A rate is the same kind of fact: if the
--  service charge ever moves to 5%, last month's orders must still read the
--  way they were shown to the member. A rate that lives only in today's code
--  silently rewrites history.
--
--  WHAT total_vnd NOW MEANS. It was the sum of the lines; it is now the GROSS
--  total the member sees, and subtotal_vnd is the sum of the lines. Both are
--  computed server-side from the menu — never sent by a tablet.
--
--  Existing rows (there are none in service: this table has never held a real
--  order) are backfilled as subtotal = total with zero rates, so nothing is
--  retrospectively charged a service fee it was never shown.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.menu_orders
  add column if not exists subtotal_vnd integer not null default 0 check (subtotal_vnd >= 0),
  add column if not exists service_pct  numeric(6,4) not null default 0 check (service_pct >= 0 and service_pct < 1),
  add column if not exists service_vnd  integer not null default 0 check (service_vnd >= 0),
  add column if not exists vat_pct      numeric(6,4) not null default 0 check (vat_pct >= 0 and vat_pct < 1),
  add column if not exists vat_vnd      integer not null default 0 check (vat_vnd >= 0);

-- Anything written before this migration: the total WAS the net sum.
update public.menu_orders
   set subtotal_vnd = total_vnd
 where subtotal_vnd = 0 and total_vnd > 0;

comment on column public.menu_orders.subtotal_vnd is 'Sum of the lines, before service and VAT.';
comment on column public.menu_orders.service_pct is 'Service charge rate this order was quoted at (0.1000 = 10%).';
comment on column public.menu_orders.vat_pct     is 'VAT rate this order was quoted at, charged on subtotal + service.';
comment on column public.menu_orders.total_vnd   is 'What the member is shown: subtotal + service + VAT.';

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- update public.menu_orders set total_vnd = subtotal_vnd where subtotal_vnd > 0;
-- alter table public.menu_orders
--   drop column if exists subtotal_vnd, drop column if exists service_pct,
--   drop column if exists service_vnd,  drop column if exists vat_pct,
--   drop column if exists vat_vnd;
