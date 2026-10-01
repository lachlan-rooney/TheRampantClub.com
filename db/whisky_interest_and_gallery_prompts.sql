-- ═══════════════════════════════════════════════════════════════════════════
-- TWO SMALL TABLES.  REVIEW, then run.
--   1. what the club is looking at  — counts only, never who
--   2. a nudge to the people who were actually there
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-10-01, asked for the Flavour Compass to be made prominent with
-- "top searched drams etc", and chose, when asked how much to record:
-- ANONYMOUS COUNTS ONLY.
--
-- ── 1. WHY THIS IS A COUNTER AND NOT A LOG ────────────────────────────────
-- The obvious table is one row per look: whisky, member, timestamp. Drop the
-- member column and people call it anonymous. It is not. Sixteen members and a
-- precise timestamp is a re-identification waiting to happen — the bar knows
-- who was in at 9.42pm, and the row says what they were reading.
--
-- So there are NO EVENT ROWS AT ALL. There is a counter per bottle per DAY,
-- incremented in place. After the first look of the day there is nothing new
-- to correlate: n goes from 4 to 5 and that is the entire record. You cannot
-- recover an individual from a number, however much else you know.
--
-- This also means the club can never build a per-member view out of it later
-- by accident — there is no member to find. If that is ever wanted it is a new
-- table, a new decision, and a line in the Privacy Notice.
--
-- ── 2. THE GALLERY NUDGE ──────────────────────────────────────────────────
-- The gallery works and is empty: three events, two photographs. The owner's
-- answer was to ask the people who were there, the day after, rather than
-- invite everybody. Who was there is already known — fixture_signups for an
-- event linked to a fixture, and visits/bookings for the date — so the only
-- thing missing is a memory of having asked, which is this table. One row per
-- member per event, written when they dismiss it or when they post.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- ── 1. WHAT THE CLUB IS LOOKING AT ────────────────────────────────────────
create table if not exists public.whisky_interest_daily (
  whisky_id  uuid not null references public.whiskies(id) on delete cascade,
  day        date not null,
  -- Where the look came from. 'bottle' = its page was opened, 'finder' = the
  -- Flavour Finder put it in front of somebody, 'shelf' = it was shown in a
  -- filtered list. Kept apart because they mean different things: a finder
  -- result is the machine's opinion, a bottle page is a person's.
  kind       text not null check (kind in ('bottle','finder','shelf')),
  n          integer not null default 0,
  primary key (whisky_id, day, kind)
);

comment on table public.whisky_interest_daily is
  'Counts only. There is deliberately no member column and no timestamp — see db/whisky_interest_and_gallery_prompts.sql for why a dropped member column is not anonymity.';

create index if not exists idx_whisky_interest_day on public.whisky_interest_daily (day desc);

-- The only way to write. SECURITY DEFINER so the table itself grants nothing,
-- and it takes no member argument — there is nowhere to put one.
create or replace function public.whisky_interest_bump(p_whisky uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('bottle','finder','shelf') then return; end if;
  if not exists (select 1 from whiskies where id = p_whisky) then return; end if;
  insert into whisky_interest_daily (whisky_id, day, kind, n)
  values (p_whisky, (now() at time zone 'Asia/Ho_Chi_Minh')::date, p_kind, 1)
  on conflict (whisky_id, day, kind) do update set n = whisky_interest_daily.n + 1;
end$$;
grant execute on function public.whisky_interest_bump(uuid, text) to authenticated;

alter table public.whisky_interest_daily enable row level security;
-- Anyone signed in may READ the counts: that is the point, they are the club's
-- own shelf talking back. Nobody may write except through the function above.
drop policy if exists "interest read" on public.whisky_interest_daily;
create policy "interest read" on public.whisky_interest_daily
  for select using (auth.uid() is not null);

-- ── 2. ASKED ONCE ─────────────────────────────────────────────────────────
create table if not exists public.gallery_prompts (
  member      uuid not null references public.profiles(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  -- 'posted' they added something · 'dismissed' they said no. Both mean do not
  -- ask again; keeping which is how we learn whether asking works at all.
  outcome     text not null check (outcome in ('posted','dismissed')),
  decided_at  timestamptz not null default now(),
  primary key (member, event_id)
);

alter table public.gallery_prompts enable row level security;
drop policy if exists "gallery_prompts own" on public.gallery_prompts;
create policy "gallery_prompts own" on public.gallery_prompts
  for select using (member = auth.uid() or is_admin_uid(auth.uid()));
-- Writes go through the API under service role, like the rest of the social
-- layer: no member INSERT policy by design.

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- The counter has no member column and no timestamp:
--   select column_name from information_schema.columns
--    where table_name = 'whisky_interest_daily' order by ordinal_position;
--   → whisky_id, day, kind, n   (and nothing else)
--
-- It counts:
--   select public.whisky_interest_bump((select id from whiskies limit 1), 'bottle');
--   select * from public.whisky_interest_daily;          -- n = 1
--   select public.whisky_interest_bump((select id from whiskies limit 1), 'bottle');
--   select * from public.whisky_interest_daily;          -- n = 2, still ONE row
--
-- And a bad kind is ignored rather than stored:
--   select public.whisky_interest_bump((select id from whiskies limit 1), 'nonsense');

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop function if exists public.whisky_interest_bump(uuid, text);
-- drop table if exists public.whisky_interest_daily;
-- drop table if exists public.gallery_prompts;
-- The dashboard panel reads through a select that tolerates their absence, so
-- it simply stops showing rather than erroring.
