-- ═══════════════════════════════════════════════════════════════════════════
-- THE WEEKLY TRACKER — TWO INPUTS, AND NOTHING ELSE.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Cash in against cash out, weekly, closing to a month. Everything else the
-- tracker needs is ALREADY IN THE SYSTEM — membership_payments carries
-- tier_snap and the amount actually collected, card_transactions carries
-- top-ups and charges, visits carries arrival and (sometimes) duration.
--
-- So this file adds exactly two things, because a tracker asking for one number
-- a week survives and one asking for six does not:
--
--   1. finance_settings      — ONE ROW, edited every few months
--   2. whisky_weekly_sales   — ONE NUMBER, entered weekly
--
-- DELIBERATELY NOT BUILT: an expense table and a whisky sales ledger. There is
-- no sold-at, invoice or expense table anywhere in this schema, and inventing
-- one to hold a single number a week would be a ledger nobody asked for. When
-- either genuinely needs itemising, that is the moment to build it.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- ═══ 1 · THE SETTINGS — one row, occasional edits ══════════════════════════
create table if not exists finance_settings (
  id                    boolean primary key default true check (id),   -- one row, enforced
  monthly_target_usd    integer not null default 19000,
  -- BREAKEVEN COMES FROM HERE, so it moves when this is updated. It is NOT the
  -- target: the July runway work had outflows near US$26,400 against receipts
  -- near US$3,900, so hitting 19k still loses money. Showing green at target
  -- while the month bleeds is worse than showing nothing.
  monthly_cost_base_usd integer not null default 26400,
  -- EVERY FIGURE IN THE DATA IS VND AND EVERY TARGET IS USD. A live rate would
  -- make last month's number move, so the rate is STORED and versioned by
  -- updated_at — history stays where it was.
  usd_vnd_rate          integer not null default 26000 check (usd_vnd_rate > 1000),
  cost_base_note        text,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references profiles(id)
);
insert into finance_settings (id) values (true) on conflict (id) do nothing;

alter table finance_settings enable row level security;
drop policy if exists "admins rw finance_settings" on finance_settings;
create policy "admins rw finance_settings" on finance_settings for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ═══ 2 · THE WHISKY NUMBER — one row per week ══════════════════════════════
-- A MISSING WEEK MUST READ AS MISSING, NOT AS ZERO. On a chart they are the
-- same bar and mean opposite things: "we sold nothing" versus "nobody entered
-- it". That is why absence is a MISSING ROW rather than a defaulted zero — the
-- tracker can then say "not entered" instead of drawing a floor.
create table if not exists whisky_weekly_sales (
  week_start  date primary key,                    -- the MONDAY of the week
  amount_vnd  bigint not null check (amount_vnd >= 0),
  note        text,
  entered_by  uuid references profiles(id),
  entered_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint whisky_week_is_monday check (extract(isodow from week_start) = 1)
);

alter table whisky_weekly_sales enable row level security;
drop policy if exists "admins rw whisky_weekly_sales" on whisky_weekly_sales;
create policy "admins rw whisky_weekly_sales" on whisky_weekly_sales for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

comment on table whisky_weekly_sales is
  'One number a week: showroom sales. Absence is MISSING, never zero — see the weekly tracker.';
comment on table finance_settings is
  'Target, cost base (which drives breakeven) and the stored USD/VND rate. One row.';

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_n int;
begin
  select count(*) into v_n from finance_settings;
  if v_n <> 1 then raise exception 'SELF-CHECK: finance_settings should hold exactly one row, found %', v_n; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='finance_settings')
    then raise exception 'SELF-CHECK: RLS on with no policy — admins locked out'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whisky_weekly_sales')
    then raise exception 'SELF-CHECK: RLS on with no policy — admins locked out'; end if;
  raise notice 'weekly tracker inputs ready — 1 settings row, weekly whisky table, both admin-only.';
end $check$;

commit;
