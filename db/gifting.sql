-- Run once in the Supabase SQL editor.
--
-- Unreasonable Hospitality — gifting ledger.
--
-- Two coupled concepts:
--   1. tier_budgets — for each membership tier we store the annual dues
--      and the % of dues earmarked for gifting. Edit via /admin/tier-budgets.
--   2. gifts — each thoughtful gesture, with cost, source, occasion, the
--      "why we did this" reasoning. The MX team uploads these manually.
--
-- A member's annual gifting budget is computed live:
--   budget = tier_budgets.annual_dues_vnd * tier_budgets.gifting_pct / 100
-- The "year" runs from the member's previous anniversary to the next.

-- ── 1. Tier budgets ───────────────────────────────────────────────────
create table if not exists tier_budgets (
  tier             varchar(20) primary key,
  annual_dues_vnd  bigint  not null default 0 check (annual_dues_vnd >= 0),
  gifting_pct      numeric(4,1) not null default 10.0
                   check (gifting_pct >= 0 and gifting_pct <= 100),
  notes            text,
  updated_at       timestamptz not null default now()
);

alter table tier_budgets enable row level security;
drop policy if exists "admin all on tier_budgets" on tier_budgets;
create policy "admin all on tier_budgets" on tier_budgets
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Seed with placeholders so the page renders out of the box. Edit these
-- via /admin/tier-budgets — the values are intentionally rough so the
-- founder/GM sets them deliberately.
insert into tier_budgets (tier, annual_dues_vnd, gifting_pct) values
  ('Founding',  100000000, 10),
  ('Legacy',     80000000, 10),
  ('Pioneer',    60000000, 10),
  ('Corporate',  80000000, 10),
  ('Honorary',          0,  0)
on conflict (tier) do nothing;

-- ── 2. Gifts ──────────────────────────────────────────────────────────
create table if not exists gifts (
  id              uuid primary key default gen_random_uuid(),
  member_no       varchar(12) not null references members(member_no) on delete cascade,
  gift_date       date        not null,
  occasion        varchar(40) not null
                  check (occasion in (
                    'birthday','anniversary','thoughtful','apology',
                    'recovery','dining_moment','referral_thanks','other'
                  )),
  category        varchar(40),                          -- bottle / experience / dining / accommodation / merchandise / other
  description     text not null,
  source          text,                                  -- vendor / supplier name
  cost_vnd        bigint not null check (cost_vnd >= 0),
  expected_value  text,                                  -- the "why" — written at gift time
  given_by        text,                                  -- staff who logged the gift
  notes           text,
  photo_url       text,                                  -- Supabase Storage path (gift-photos bucket)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Defence in depth: the API already validates category against
  -- lib/gifting.ts CATEGORIES, but a CHECK here means a hand-written
  -- INSERT can't sneak something through either.
  constraint gifts_category_chk check (
    category is null or category in (
      'bottle','experience','dining','accommodation','merchandise','service','other'
    )
  )
);

create index if not exists idx_gifts_member_date on gifts (member_no, gift_date desc);
create index if not exists idx_gifts_occasion    on gifts (occasion);
create index if not exists idx_gifts_date        on gifts (gift_date desc);

alter table gifts enable row level security;
drop policy if exists "admin all on gifts" on gifts;
create policy "admin all on gifts" on gifts
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- ── 3. Member gifting summary view ────────────────────────────────────
-- Convenience view used by /admin/gifts, the member profile panel, and
-- the MX Daily anniversary widget. Computes the current budget year and
-- spend in one place so the application doesn't reinvent it.

create or replace view member_gifting_summary as
with anniv as (
  select
    m.member_no,
    m.full_name,
    m.tier,
    m.join_date,
    m.status,
    -- "This year's anniversary" — computed via interval addition so Feb 29
    -- silently becomes Feb 28 on non-leap years (Postgres handles this).
    -- A future join_date returns null so the member doesn't appear with a
    -- pre-existence budget.
    case
      when m.join_date is null then null
      when m.join_date > current_date then null
      else (m.join_date + (
              (extract(year from current_date)::int - extract(year from m.join_date)::int) || ' years'
            )::interval)::date
    end as this_year_anniv
  from members m
),
windowed as (
  select
    a.*,
    -- window_start is the most recent past anniversary; clamped at
    -- join_date so a member who joined mid-cycle doesn't get a window
    -- predating their membership.
    case
      when a.this_year_anniv is null then null
      when a.this_year_anniv <= current_date then a.this_year_anniv
      else greatest(a.join_date, (a.this_year_anniv - interval '1 year')::date)
    end as window_start,
    case
      when a.this_year_anniv is null then null
      when a.this_year_anniv <= current_date then (a.this_year_anniv + interval '1 year' - interval '1 day')::date
      else (a.this_year_anniv - interval '1 day')::date
    end as window_end
  from anniv a
)
select
  a.member_no,
  a.full_name,
  a.tier,
  a.join_date,
  a.status,
  a.window_start,
  a.window_end,
  coalesce(tb.annual_dues_vnd, 0)                                          as annual_dues_vnd,
  coalesce(tb.gifting_pct, 0)                                              as gifting_pct,
  floor(coalesce(tb.annual_dues_vnd, 0) * coalesce(tb.gifting_pct, 0) / 100)::bigint  as annual_budget_vnd,
  coalesce((
    select sum(g.cost_vnd) from gifts g
    where g.member_no = a.member_no
      and a.window_start is not null
      and g.gift_date >= a.window_start
      and g.gift_date <  a.window_start + interval '1 year'
  ), 0)::bigint                                                             as spent_vnd,
  (select count(*) from gifts g where g.member_no = a.member_no
     and a.window_start is not null
     and g.gift_date >= a.window_start
     and g.gift_date <  a.window_start + interval '1 year')::int            as gift_count
from windowed a
left join tier_budgets tb on tb.tier = a.tier;

grant select on member_gifting_summary to authenticated;

-- ── 4. Storage bucket reminder ────────────────────────────────────────
-- Create a Supabase Storage bucket named "gift-photos" with admin-only
-- read/write policy:
--   - Bucket → Public: NO (private)
--   - Policy: same admin-only pattern as signed_agreements
-- Then the client uploads via supabase.storage.from('gift-photos').upload(...).
