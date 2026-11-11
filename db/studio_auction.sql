-- ═══════════════════════════════════════════════════════════════════════════
-- THE SILENT AUCTION — four works bid for from a phone, four with a price.
--                                                   Run this whole file ONCE.
-- ───────────────────────────────────────────────────────────────────────────
-- Supabase SQL editor, paste the lot, run. It installs three tables and two
-- functions and seeds the eight works of the live exhibition with the figures
-- the owner gave on 11 Nov 2026 — and PUBLISHES NOTHING. The auction stays
-- invisible until a human presses Publish at /admin/studio/auction.
--
-- ══ WHAT THE SEED WRITES ══════════════════════════════════════════════════
--   IN THE AUCTION          start    step    reserve (private)
--   Reminds Me Of           350      50      575
--   Rainforest            1,000     100    1,650      + a donation share
--   Black Swan            1,400     100    2,300
--   Punch Punch           1,400     100    2,300
--
--   SOLD — all four. Each shows publicly as "Sold": no price, no enquiry
--   control. The figure is RECORDED against the lot and never published.
--   Fresh Air             3,200
--   Sawit (diptych)       1,425
--   Political Chair       1,950
--   Titit Collection      1,950
--
--   The buyers are entered by the owner in the admin; the sale DATE is
--   today's, written by the seed.
--
-- Every one of those numbers is editable in the admin afterwards. They are
-- written here only so the opening does not depend on eight forms being filled
-- in correctly under time pressure.
--
-- ══ THE ONE RULE THIS SCHEMA EXISTS TO ENFORCE ════════════════════════════
-- A bidder's name, email and phone, every reserve price, and the buyer of a
-- sold work must never reach a browser. RLS cannot hide a COLUMN — it hides
-- rows — so the protection here is not a policy that filters reserve_usd out.
-- It is that **anon and authenticated are granted nothing at all on these
-- tables**. The only public path is one SECURITY DEFINER function that returns
-- a shape with no reserve, no buyer and no bidder in it. There is nothing to
-- leak because there is nothing readable.
--
-- ══ WHY A BID IS PLACED BY A FUNCTION AND NOT BY AN INSERT ════════════════
-- Two guests bidding in the same second is not the rare case in the last
-- minutes of an auction, it is the normal case. Read-the-highest-then-insert
-- accepts both: each reads the same number, each passes its own check, and the
-- lower one wins by arriving second. studio_place_bid takes a row lock on the
-- lot before it reads anything, so bids on one lot serialise — the higher wins
-- and an equal bid is refused as too low, every time, at any traffic.
--
-- ══ AND WHY anon CANNOT CALL IT ═══════════════════════════════════════════
-- execute on studio_place_bid is granted to service_role ONLY. The rate limit,
-- the absurd-amount check and the close enforcement live in the API route that
-- holds that key. If a browser could call the function directly with the anon
-- key, every one of those would be decoration.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if to_regclass('public.collaborations') is null
     or to_regclass('public.collaboration_pieces') is null then
    raise exception 'PREREQUISITES MISSING — collaborations / collaboration_pieces'
      using hint = 'Run db/collaborations.sql and db/collaboration_pieces.sql first. Nothing applied.';
  end if;
end $prereq$;

-- ── THE AUCTION ───────────────────────────────────────────────────────────
-- One row per exhibition. The close is an ABSOLUTE INSTANT, not a date plus a
-- rendered timezone: timestamptz stores UTC, so "has it closed" has exactly
-- one answer no matter where the server, the bidder or the phone's clock is.
-- The guest is shown Ho Chi Minh time; the database never thinks in it.
create table if not exists studio_auctions (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null unique references collaborations(id) on delete cascade,

  closes_at   timestamptz not null,
  announce_at timestamptz not null,

  -- THE ONE PUBLIC SWITCH. Nothing about the auction appears on the guide
  -- until this is true, however complete the lots are.
  published boolean not null default false,

  -- The fallback raise, in whole US dollars, for a lot that sets none of its
  -- own. Each lot carries its own step (see studio_lots.step_usd) because the
  -- US$350 work and the US$1,400 works do not raise by the same amount.
  min_step_usd int not null default 50 check (min_step_usd > 0),

  -- ABSURD AMOUNTS. A fat finger turns US$1,400 into US$1,400,000 and the lot
  -- is dead: nobody can outbid it and the real bidders go home. Above this
  -- multiple of the current highest the route asks the bidder to confirm
  -- rather than refusing outright — a genuine large bid is a real thing.
  confirm_multiple numeric not null default 5 check (confirm_multiple >= 2),

  -- The Vietnamese on the auction block is drafted by machine until a native
  -- speaker has read it. Set when that pass is done; the admin shows a banner
  -- until then.
  vn_reviewed_at timestamptz,

  created_at timestamptz not null default now()
);

-- ── A LOT ─────────────────────────────────────────────────────────────────
-- One row per artwork on the wall, including the ones that simply carry a
-- price. Which is which is a FIELD rather than two tables: a work can move
-- from priced to auction and back without losing its row or its bids, and the
-- guide asks one question per piece instead of two.
create table if not exists studio_lots (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references studio_auctions(id) on delete cascade,

  -- THE ARTWORK ITSELF STAYS WHERE IT IS. Title, year, medium, dimensions,
  -- image, the artist's statement and the beneficiary line all live on
  -- collaboration_pieces and are not copied here — one row per piece, one
  -- place to correct a typo.
  piece_id uuid not null unique references collaboration_pieces(id) on delete cascade,

  -- Walking order is the piece's. This is only a tiebreak for the admin list.
  sort int not null default 0,

  -- An optional Vietnamese title. Titles are proper names and are NOT
  -- translated by default — "Sawit" is Indonesian and the printed wall label
  -- prints one form only — so this exists for the case where a VN title is
  -- genuinely wanted, and is null otherwise.
  title_vn text,

  kind text not null default 'sale' check (kind in ('sale','auction')),

  -- draft  → invisible to the public, whatever the auction switch says
  -- live   → shown
  -- sold   → shown, marked Sold, no price, no bidding, no enquiry control
  status text not null default 'draft' check (status in ('draft','live','sold')),

  -- ── FOR A PRICED LOT ────────────────────────────────────────────────────
  price_usd int check (price_usd is null or price_usd > 0),
  -- "Sold as a pair". A price qualifier, bilingual, shown beside the figure.
  price_note_en text,
  price_note_vn text,

  -- ── FOR AN AUCTION LOT ──────────────────────────────────────────────────
  starting_bid_usd int check (starting_bid_usd is null or starting_bid_usd > 0),

  -- PER WORK. US$50 on the small canvas, US$100 on the large ones. Null falls
  -- back to the auction's min_step_usd.
  step_usd int check (step_usd is null or step_usd > 0),

  -- ⚠ NEVER PUBLIC, NOT EVEN AS "nearly met". The guest is told met or not met
  -- and nothing else. This column is readable only by an admin and by the
  -- definer function below; anon has no grant on this table at all.
  reserve_usd int check (reserve_usd is null or reserve_usd > 0),

  -- ── THE DONATION SHARE ──────────────────────────────────────────────────
  -- Rainforest gives a share of what it raises to the Borneo Nature
  -- Foundation. The sentence already under the work
  -- (collaboration_pieces.beneficiary_en) says "a significant portion", which
  -- is what you say before the share is decided. Set this percentage and the
  -- guide states the figure instead; leave it null and the existing sentence
  -- stands. The figure is public by design — it is the commitment.
  donation_pct numeric check (donation_pct is null or (donation_pct > 0 and donation_pct <= 100)),
  donation_org text,

  -- ── THE SALE RECORD ─────────────────────────────────────────────────────
  -- What a sold work actually went for and to whom. ⚠ sold_to is a private
  -- field: the public function does not return it and there is no grant on
  -- this table, so it cannot be read from a browser by any route.
  sold_price_usd int check (sold_price_usd is null or sold_price_usd > 0),
  sold_to text,
  sold_on date,
  sold_note text,

  -- A per-lot close, for the case where one work closes earlier. Null means
  -- "whenever the auction closes", which is the normal case.
  closes_at timestamptz,

  created_at timestamptz not null default now()
);

-- Belt and braces: if an earlier draft of this file was ever applied, the
-- table exists without the newer columns and `create table if not exists`
-- would silently leave it short. These make the file safe to re-run over it.
alter table studio_lots
  add column if not exists price_note_en  text,
  add column if not exists price_note_vn  text,
  add column if not exists step_usd       int,
  add column if not exists donation_pct   numeric,
  add column if not exists donation_org   text,
  add column if not exists sold_price_usd int,
  add column if not exists sold_to        text,
  add column if not exists sold_on        date,
  add column if not exists sold_note      text;

create index if not exists studio_lots_auction on studio_lots (auction_id, sort);

-- ── A BID ─────────────────────────────────────────────────────────────────
create table if not exists studio_bids (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references studio_lots(id) on delete cascade,

  amount_usd int not null check (amount_usd > 0),

  bidder_name  text not null,
  bidder_email text not null,
  -- Lower-cased, for the per-email rate limit and for grouping one person's
  -- bids. The address is kept as typed for the email itself.
  bidder_email_key text not null,
  bidder_phone text,

  -- WHICH LANGUAGE THEY WERE READING. Every email this person receives — the
  -- confirmation, the outbid notice, the result — goes out in it. Captured at
  -- the moment of bidding because that is the only moment it is known.
  lang text not null default 'en' check (lang in ('en','vn')),

  -- THE TICK BOX. Unticked by default, and it affects nothing about whether
  -- the bid is accepted or how it ranks. It decides one thing only: whether
  -- the results email to the OTHER bidders states the winning price.
  share_price_consent boolean not null default false,

  -- The club news box, separate and never bundled with the terms.
  news_consent boolean not null default false,

  -- THE EXACT SENTENCE THAT WAS ON THE SCREEN. A consent record that cannot
  -- say which words the person agreed to is not evidence of anything. The
  -- client sends what it displayed; the server does not invent it.
  terms_text text not null,

  -- A coarse per-device handle: a salted hash of a cookie, not an address and
  -- not a fingerprint. Two jobs — slowing a script down, and recognising a
  -- returning guest so the work can tell them they have been outbid.
  device_hash text,

  -- ── VOIDING ─────────────────────────────────────────────────────────────
  -- A bid is never deleted. A voided bid drops out of the public current
  -- highest and out of ranking, and the fact that it was voided, by whom and
  -- why stays on the row.
  void boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references profiles(id),

  confirmation_sent_at timestamptz,
  outbid_notified_at   timestamptz,

  created_at timestamptz not null default now()
);

-- The ranking index. Partial on live bids, because that is the only set the
-- leader is ever drawn from.
create index if not exists studio_bids_rank
  on studio_bids (lot_id, amount_usd desc, created_at asc) where not void;
create index if not exists studio_bids_email
  on studio_bids (bidder_email_key, created_at desc);
create index if not exists studio_bids_lot_new
  on studio_bids (lot_id, created_at desc);
-- For "you have been outbid" on a returning device, and for the rate limit.
create index if not exists studio_bids_device
  on studio_bids (device_hash, created_at desc);

-- ── AN ENQUIRY ────────────────────────────────────────────────────────────
-- A priced work cannot be bought from a phone — there is a conversation, an
-- invoice and a crate. So the control under it sends the owner a name, an
-- email and the title of the work, and nothing is promised to the guest
-- beyond "we will be in touch".
create table if not exists studio_enquiries (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references studio_lots(id) on delete cascade,

  name  text not null,
  email text not null,
  email_key text not null,
  phone text,
  message text,

  lang text not null default 'en' check (lang in ('en','vn')),
  device_hash text,

  -- Set when the owner has dealt with it, so the admin list can go quiet.
  handled_at timestamptz,
  handled_by uuid references profiles(id),

  created_at timestamptz not null default now()
);

create index if not exists studio_enquiries_lot on studio_enquiries (lot_id, created_at desc);
create index if not exists studio_enquiries_email on studio_enquiries (email_key, created_at desc);

-- ═══ RLS — DENY EVERYTHING, THEN LET ADMINS IN ════════════════════════════
-- No public policy on any of the four. A table with RLS on and no SELECT
-- policy returns zero rows to anon and to a signed-in member alike, which is
-- what we want: the public shape comes from the function below, and that
-- function chooses the columns.
alter table studio_auctions  enable row level security;
alter table studio_lots      enable row level security;
alter table studio_bids      enable row level security;
alter table studio_enquiries enable row level security;

drop policy if exists "admins manage auctions" on studio_auctions;
create policy "admins manage auctions" on studio_auctions for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins manage lots" on studio_lots;
create policy "admins manage lots" on studio_lots for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins read bids" on studio_bids;
create policy "admins read bids" on studio_bids for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins read enquiries" on studio_enquiries;
create policy "admins read enquiries" on studio_enquiries for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ═══ THE PUBLIC SHAPE ═════════════════════════════════════════════════════
-- Everything a guest is allowed to know, and not one column more. No reserve
-- amount, no buyer, no bidder, no bid list — only met-or-not, the highest
-- figure, and a count. Computing reserve_met as a boolean HERE is the whole
-- point: the number never leaves the database.
--
-- Dropped and recreated rather than `create or replace`, because Postgres
-- refuses to replace a function whose return type has changed — which would
-- make this file fail to re-run the first time a column is added here.
drop function if exists studio_auction_public(text);
create function studio_auction_public(p_slug text)
returns table (
  lot_id uuid,
  piece_id uuid,
  kind text,
  status text,
  price_usd int,
  price_note_en text,
  price_note_vn text,
  starting_bid_usd int,
  min_step_usd int,
  closes_at timestamptz,
  announce_at timestamptz,
  highest_usd int,
  bid_count int,
  reserve_met boolean,
  is_closed boolean,
  donation_pct numeric,
  donation_org text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id,
    l.piece_id,
    l.kind,
    l.status,
    -- A SOLD WORK SHOWS NO PRICE. What it was listed at, and what it actually
    -- went for, are the owner's business and the buyer's.
    case when l.status = 'sold' then null else l.price_usd end as price_usd,
    case when l.status = 'sold' then null else l.price_note_en end as price_note_en,
    case when l.status = 'sold' then null else l.price_note_vn end as price_note_vn,
    l.starting_bid_usd,
    -- The EFFECTIVE step, so the page can say what the next bid must be.
    coalesce(l.step_usd, a.min_step_usd)          as min_step_usd,
    coalesce(l.closes_at, a.closes_at)            as closes_at,
    a.announce_at,
    h.high                                        as highest_usd,
    coalesce(h.n, 0)::int                         as bid_count,
    -- A lot with no reserve set has nothing to meet, so it reads as met once
    -- there is any bid at all. Null reserve + no bids reads as not met.
    case when l.reserve_usd is null then coalesce(h.n, 0) > 0
         else coalesce(h.high, 0) >= l.reserve_usd end as reserve_met,
    now() >= coalesce(l.closes_at, a.closes_at)   as is_closed,
    l.donation_pct,
    l.donation_org
  from studio_auctions a
  join collaborations  c on c.id = a.collaboration_id
  join studio_lots     l on l.auction_id = a.id
  left join lateral (
    select max(b.amount_usd) as high, count(*) as n
      from studio_bids b
     where b.lot_id = l.id and not b.void
  ) h on true
  where c.slug = p_slug
    and c.status in ('live','past')
    and a.published                 -- the switch
    and l.status <> 'draft'         -- and the lot itself
  order by l.sort;
$$;

revoke all on function studio_auction_public(text) from public;
grant execute on function studio_auction_public(text) to anon, authenticated, service_role;

-- ═══ PLACING A BID ════════════════════════════════════════════════════════
-- Returns a single row: ok plus, on failure, a machine-readable reason the
-- route turns into a sentence in the bidder's own language.
--
-- Reasons: no_lot · not_auction · not_live · closed · too_low
--
-- ⚠ THE LOCK IS THE WHOLE POINT. `for update` on the lot is taken BEFORE the
-- current highest is read, so two simultaneous bids on one lot cannot both see
-- the same highest. The second one waits, then reads the first one's amount.
drop function if exists studio_place_bid(uuid,int,text,text,text,text,boolean,boolean,text,text);
create function studio_place_bid(
  p_lot_id uuid,
  p_amount int,
  p_name text,
  p_email text,
  p_phone text,
  p_lang text,
  p_share_price boolean,
  p_news boolean,
  p_terms text,
  p_device text
)
returns table (ok boolean, reason text, bid_id uuid, min_next int, highest int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot     studio_lots%rowtype;
  v_closes  timestamptz;
  v_step    int;
  v_high    int;
  v_min     int;
  v_id      uuid;
begin
  -- The lock. Everything after this line is serialised per lot.
  select * into v_lot from studio_lots where id = p_lot_id for update;
  if not found then
    return query select false, 'no_lot', null::uuid, null::int, null::int; return;
  end if;

  -- THE STEP IS THE LOT'S, falling back to the auction's.
  select coalesce(v_lot.closes_at, a.closes_at),
         coalesce(v_lot.step_usd, a.min_step_usd)
    into v_closes, v_step
    from studio_auctions a where a.id = v_lot.auction_id;

  if v_lot.kind <> 'auction' then
    return query select false, 'not_auction', null::uuid, null::int, null::int; return;
  end if;
  if v_lot.status <> 'live' then
    return query select false, 'not_live', null::uuid, null::int, null::int; return;
  end if;

  -- THE CLOSE IS ENFORCED HERE, not in the page. A page that has been open
  -- since before the close still shows a form; the server is what refuses it.
  if now() >= v_closes then
    return query select false, 'closed', null::uuid, null::int, null::int; return;
  end if;

  select max(amount_usd) into v_high
    from studio_bids where lot_id = p_lot_id and not void;

  -- The first bid must reach the starting bid; every later one must clear the
  -- current highest BY the step. An equal bid is therefore too low, which is
  -- the rule that decides a tie.
  v_min := case when v_high is null
                then coalesce(v_lot.starting_bid_usd, 1)
                else v_high + v_step end;

  if p_amount < v_min then
    return query select false, 'too_low', null::uuid, v_min, v_high; return;
  end if;

  insert into studio_bids (
    lot_id, amount_usd, bidder_name, bidder_email, bidder_email_key,
    bidder_phone, lang, share_price_consent, news_consent, terms_text, device_hash
  ) values (
    p_lot_id, p_amount, p_name, p_email, lower(p_email),
    nullif(p_phone, ''), coalesce(p_lang, 'en'), coalesce(p_share_price, false),
    coalesce(p_news, false), p_terms, nullif(p_device, '')
  ) returning id into v_id;

  return query select true, null::text, v_id, v_min, p_amount;
end;
$$;

-- SERVICE ROLE ONLY. See the header: the rate limit and the absurd-amount
-- check live in the route that holds that key, and a browser able to call this
-- directly would walk straight past both.
--
-- ⚠ `revoke ... from public` IS NOT ENOUGH ON SUPABASE, and this is the trap
-- that cost us a real hole. Supabase ships
--   alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- so the moment this function is CREATED, anon and authenticated each hold an
-- EXECUTE grant of their own. PUBLIC is a different grantee: revoking from it
-- leaves those two untouched, and the function stays wide open while the file
-- reads as though it had been locked. The verifier caught this by calling the
-- function with the anon key and getting HTTP 200.
revoke all on function studio_place_bid(uuid,int,text,text,text,text,boolean,boolean,text,text) from public;
revoke all on function studio_place_bid(uuid,int,text,text,text,text,boolean,boolean,text,text) from anon;
revoke all on function studio_place_bid(uuid,int,text,text,text,text,boolean,boolean,text,text) from authenticated;
grant execute on function studio_place_bid(uuid,int,text,text,text,text,boolean,boolean,text,text) to service_role;

-- Said out loud, so a future reader does not have to infer it from an absence:
-- studio_auction_public IS granted to anon on purpose. It is the one public
-- door, and it is safe because its RETURN TYPE has no reserve, no buyer and no
-- bidder in it — not because of anything it filters.

-- ═══ SEEDING ══════════════════════════════════════════════════════════════
-- The auction row for the live exhibition. 15:00 Ho Chi Minh time on the 14th,
-- written as +07 so there is no question which instant is meant; the results
-- draft is ready an hour later and is sent by a person, never by a timer.
insert into studio_auctions (collaboration_id, closes_at, announce_at)
select c.id,
       timestamptz '2026-11-14 15:00:00+07',
       timestamptz '2026-11-14 16:00:00+07'
  from collaborations c
 where c.status = 'live'
 order by c.sort
 limit 1
on conflict (collaboration_id) do nothing;

-- THE EIGHT WORKS, as the owner gave them. Held in one temporary table so the
-- figures are written once and the "did every title match" check below reads
-- the same list rather than a second copy of it.
drop table if exists _works;
create temporary table _works (
  title text primary key,
  kind text, status text,
  price int, price_note_en text, price_note_vn text,
  start_bid int, step int, reserve int,
  donation_org text,
  sold_price int, sold_today boolean
) on commit drop;

insert into _works (title, kind, status, price, price_note_en, price_note_vn,
                    start_bid, step, reserve, donation_org, sold_price, sold_today) values
  -- IN THE AUCTION — four.
  ('Reminds Me Of',    'auction', 'live', null, null, null,  350,  50,  575, null, null, false),
  ('Rainforest',       'auction', 'live', null, null, null, 1000, 100, 1650,
     -- The share itself is deliberately NOT set: until the owner enters it the
     -- guide keeps his existing "a significant portion" sentence.
     'Borneo Nature Foundation', null, false),
  ('Black Swan',       'auction', 'live', null, null, null, 1400, 100, 2300, null, null, false),
  ('Punch Punch',      'auction', 'live', null, null, null, 1400, 100, 2300, null, null, false),
  -- SOLD — all four, before the guide went up. status 'sold' is what makes the
  -- public function withhold the price AND withhold price_note_en, so "Sold as
  -- a pair" does not survive the sale either. sold_price_usd is the record;
  -- it is not in the function's return type at all.
  ('Sawit',            'sale',    'sold', 1425, 'Sold as a pair', 'Bán theo cặp',
     null, null, null, null, 1425, true),
  ('Political Chair',  'sale',    'sold', 1950, null, null, null, null, null, null, 1950, true),
  ('Titit Collection', 'sale',    'sold', 1950, null, null, null, null, null, null, 1950, true),
  ('Fresh Air',        'sale',    'sold', 3200, null, null, null, null, null, null, 3200, true);

insert into studio_lots (
  auction_id, piece_id, sort, kind, status,
  price_usd, price_note_en, price_note_vn,
  starting_bid_usd, step_usd, reserve_usd,
  donation_org, sold_price_usd, sold_on
)
select a.id, p.id, p.sort, w.kind, w.status,
       w.price, w.price_note_en, w.price_note_vn,
       w.start_bid, w.step, w.reserve,
       w.donation_org, w.sold_price,
       case when w.sold_today then current_date else null end
  from (select id from collaborations where status = 'live' order by sort limit 1) c
  join studio_auctions a on a.collaboration_id = c.id
  join collaboration_pieces p on p.collaboration_id = c.id
  join _works w on w.title = p.title_en
on conflict (piece_id) do nothing;

-- ── THE NINTH PIECE: NO LOT, DELIBERATELY ───────────────────────
-- collaboration_pieces once held NINE works while the owner's list named
-- eight. The ninth was "A Series Of Body" — the only one not acrylic and oil
-- on canvas (cotton paper and cardboard).
--
-- Three states, in order, because the reasoning is worth keeping:
--   1 · it had a DRAFT lot, so the undecided question was visible rather
--       than silent;
--   2 · the owner decided it was not in the auction and not for sale, so the
--       lot went — a draft lot is one dropdown away from being published by
--       someone tidying the admin screen;
--   3 · on 11 Nov 2026 he confirmed it is not in the EXHIBITION at all, and
--       its collaboration_pieces row was deleted. The guide counts pieces
--       from the data, so every count moved from nine to eight on its own.
--
-- ⚠ THE WAY BACK IS db/restore_a_series_of_body.sql. It puts the row back
-- with its original id, its 1,968-character statement and its image, at
-- sort 9 — and the counts return to nine by themselves.
--
-- The DELETE below still earns its place: it removes a lot for ANY piece not
-- on the owner's list, so an earlier run of this file that created that draft
-- lot is cleaned up, and a piece added later cannot inherit one by accident.
delete from studio_lots l
 using collaboration_pieces p, collaborations c
 where l.piece_id = p.id
   and p.collaboration_id = c.id
   and c.status = 'live'
   and p.title_en not in (select title from _works);

-- ── DID EVERY TITLE MATCH? ────────────────────────────────────────────────
-- The join above is on title_en. A renamed or mistyped title would quietly
-- leave a work with no price and no starting bid, which is exactly the fault
-- that is invisible until a guest stands in front of it. So: fail loudly and
-- roll the whole file back rather than install a half-seeded auction.
do $check$
declare
  v_missing text;
  v_lots int; v_auction_lots int; v_priced int; v_drafts int;
begin
  if not exists (select 1 from studio_auctions) then
    raise notice 'NO LIVE EXHIBITION — schema installed, nothing seeded. Set one live and re-run.';
    return;
  end if;

  select string_agg(w.title, ', ' order by w.title) into v_missing
    from _works w
   where not exists (
     select 1 from studio_lots l
       join collaboration_pieces p on p.id = l.piece_id
      where p.title_en = w.title);

  if v_missing is not null then
    raise exception 'Not found in collaboration_pieces: %', v_missing
      using hint = 'The seed joins on title_en. Check the spelling against the gallery guide. NOTHING APPLIED.';
  end if;

  select count(*),
         count(*) filter (where kind = 'auction' and status = 'live'),
         count(*) filter (where kind = 'sale' and status in ('live','sold')),
         count(*) filter (where status = 'draft')
    into v_lots, v_auction_lots, v_priced, v_drafts
    from studio_lots;

  raise notice 'Seeded: % lots — % in the auction, % priced, % draft. Auction NOT published.',
    v_lots, v_auction_lots, v_priced, v_drafts;
end $check$;

commit;

-- ═══ VERIFY — run this after, and read it ═════════════════════════════════
-- 1 · EIGHT rows: four in the auction, four sold, none draft. The ninth
--     piece has no row — see THE NINTH PIECE above.
--
--   select p.title_en, l.kind, l.status, l.price_usd, l.starting_bid_usd,
--          l.step_usd, l.reserve_usd, l.donation_org, l.sold_on
--     from studio_lots l join collaboration_pieces p on p.id = l.piece_id
--    order by l.sort;
--
-- 2 · The switch is off and the close is the right instant, in both clocks:
--
--   select published,
--          closes_at   at time zone 'Asia/Ho_Chi_Minh' as closes_hcm,
--          announce_at at time zone 'Asia/Ho_Chi_Minh' as announce_hcm,
--          closes_at as closes_utc
--     from studio_auctions;
--   → f · 2026-11-14 15:00 · 2026-11-14 16:00 · 2026-11-14 08:00+00
--
-- 3 · THE PUBLIC FUNCTION RETURNS NOTHING while the switch is off — this is
--     the line that proves the guide cannot leak an unpublished auction:
--
--   select count(*) from studio_auction_public('rizal-fathoni');
--   → 0
--
-- 4 · And no reserve can be reached from the public shape at all. The column
--     is not in the function's return type, so this is a hard error, not an
--     empty column — which is the point:
--
--   select reserve_usd from studio_auction_public('rizal-fathoni');
--   → ERROR: column "reserve_usd" does not exist
--
-- Then go to /admin/studio/auction, check the eight works read correctly,
-- enter the four buyers and Rainforest's donation share, and press Publish.
--
-- ═══ THE WAY BACK ═════════════════════════════════════════════════════════
-- drop function if exists studio_place_bid(uuid,int,text,text,text,text,boolean,boolean,text,text);
-- drop function if exists studio_auction_public(text);
-- drop table if exists studio_enquiries;
-- drop table if exists studio_bids;
-- drop table if exists studio_lots;
-- drop table if exists studio_auctions;
