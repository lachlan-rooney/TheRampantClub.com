-- ═══════════════════════════════════════════════════════════════════════════
-- THE GALLERY NUDGE — ask the people who were there.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- The Event Gallery works. It has 14 contributions across 3 events and 1 album,
-- and every one of them is there because somebody thought of it unprompted.
-- gallery_prompts was built for the asking and has never held a row, because
-- nothing ever asked.
--
-- ── WHY THE TABLE COULD NOT DO THE JOB IT WAS BUILT FOR ───────────────────
-- Its key is (member, event_id) and event_id references events(id). So a
-- dismissal can only be recorded against a gallery event that ALREADY EXISTS —
-- which is the easy case ("others have posted, add yours") and not the one that
-- matters. The ask worth making is the FIRST photograph, after a fixture that
-- nobody has opened an event for yet, and there was nowhere to write "I asked
-- Mr Hoang about the Rampant Cup and he said no".
--
-- The alternative was to create an empty gallery event at the moment of asking,
-- purely to have something to point at. That fills the gallery with events
-- nobody photographed, which is worse than not asking.
--
-- ── SO A PROMPT IS ABOUT A FIXTURE *OR* AN EVENT, NEVER BOTH ──────────────
-- event_id becomes nullable, fixture_id arrives beside it, and a CHECK makes
-- exactly one of them present. The primary key cannot express "one of two
-- columns", so it is replaced by two partial unique indexes — one per target
-- kind — which is the same guarantee stated twice rather than a weaker one.
--
-- SAFE: the table has 0 rows. Nothing to migrate, nothing to lose.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if to_regclass('public.gallery_prompts') is null then
    raise exception 'PREREQUISITES MISSING — gallery_prompts'
      using hint = 'Run db/whisky_interest_and_gallery_prompts.sql first. Nothing applied.';
  end if;
  if to_regclass('public.fixtures') is null then
    raise exception 'PREREQUISITES MISSING — fixtures' using hint = 'Nothing applied.';
  end if;
  -- A table with rows in it would need those rows thought about, and this file
  -- does not do that. It refuses rather than guessing.
  if (select count(*) from public.gallery_prompts) > 0 then
    raise exception 'gallery_prompts is no longer empty (% rows)', (select count(*) from public.gallery_prompts)
      using hint = 'This file assumes an empty table. Nothing applied — come back to it.';
  end if;
end $prereq$;

-- ── 1. A PROMPT MAY POINT AT A FIXTURE ────────────────────────────────────
alter table public.gallery_prompts
  add column if not exists fixture_id uuid references public.fixtures(id) on delete cascade;

-- The old key said "one row per member per event". It also said event_id is
-- NOT NULL, which is the part being undone.
alter table public.gallery_prompts drop constraint if exists gallery_prompts_pkey;
alter table public.gallery_prompts alter column event_id drop not null;

-- EXACTLY ONE TARGET. A row with both would be asked about twice and dismissed
-- once; a row with neither is a dismissal of nothing.
alter table public.gallery_prompts drop constraint if exists gallery_prompts_one_target;
alter table public.gallery_prompts add constraint gallery_prompts_one_target
  check ((event_id is null) <> (fixture_id is null));

-- Asked once, per member, per thing. Two partial indexes rather than one key,
-- because the thing is one of two columns.
create unique index if not exists idx_gallery_prompt_event
  on public.gallery_prompts (member, event_id) where event_id is not null;
create unique index if not exists idx_gallery_prompt_fixture
  on public.gallery_prompts (member, fixture_id) where fixture_id is not null;

comment on table public.gallery_prompts is
  'Asked once. A prompt points at a gallery event OR a fixture (exactly one): the fixture case is the ask that matters, because it is the one made before anybody has opened an event. outcome ''posted''/''dismissed'' both mean do not ask again — keeping which is how we learn whether asking works. See db/gallery_nudge.sql.';

comment on column public.gallery_prompts.fixture_id is
  'The fixture the member was signed up to. Set when no gallery event existed at the time of asking.';

-- ── 2. RLS IS UNCHANGED, AND RE-STATED SO IT IS NOT ASSUMED ───────────────
-- Own-or-admin on read; no member INSERT policy, because every write goes
-- through /api/members/gallery/nudge under the service role, like the rest of
-- the social layer. Re-declared here so running this file leaves the table in a
-- known state rather than whatever the earlier file happened to leave.
alter table public.gallery_prompts enable row level security;
drop policy if exists "gallery_prompts own" on public.gallery_prompts;
create policy "gallery_prompts own" on public.gallery_prompts
  for select using (member = auth.uid() or is_admin_uid(auth.uid()));

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- Exactly one target is enforced. Both of these must FAIL:
--   insert into gallery_prompts (member, outcome) values (auth.uid(), 'dismissed');
--   insert into gallery_prompts (member, event_id, fixture_id, outcome)
--     values ((select id from profiles limit 1), (select id from events limit 1),
--             (select id from fixtures limit 1), 'dismissed');
--   → both: violates check constraint "gallery_prompts_one_target"
--
-- A fixture prompt is accepted, and only once:
--   insert into gallery_prompts (member, fixture_id, outcome)
--     values ((select id from profiles limit 1), (select id from fixtures limit 1), 'dismissed');
--   -- run it a second time → duplicate key value violates idx_gallery_prompt_fixture
--   delete from gallery_prompts;        -- tidy up after checking
--
-- The shape:
--   select column_name, is_nullable from information_schema.columns
--    where table_name = 'gallery_prompts' order by ordinal_position;
--   → member NO · event_id YES · outcome NO · decided_at NO · fixture_id YES

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Only while the table is empty again — a fixture prompt cannot be expressed
-- under the old shape, so dropping the column would silently discard it:
--   delete from public.gallery_prompts where fixture_id is not null;
--   drop index if exists idx_gallery_prompt_event;
--   drop index if exists idx_gallery_prompt_fixture;
--   alter table public.gallery_prompts drop constraint if exists gallery_prompts_one_target;
--   alter table public.gallery_prompts drop column if exists fixture_id;
--   alter table public.gallery_prompts alter column event_id set not null;
--   alter table public.gallery_prompts add primary key (member, event_id);
-- The nudge route reads the column through a select that tolerates its absence,
-- so it stops asking rather than erroring.
