-- ═══════════════════════════════════════════════════════════════════════════
-- FIXTURES · SPORT → TYPE  ·  PART 1 of 2.  REVIEW, then run. Re-runnable.
-- ───────────────────────────────────────────────────────────────────────────
-- `fixtures.sport` is NOT NULL and its vocabulary is golf|tennis|padel|hash|
-- other. Every house event — a whisky dinner, a tasting, a social — therefore
-- has to go in as 'other', so the column carries no information and cannot be
-- filtered on. The admin surface is now called Events; the field should mean it.
--
-- House events need RSVPs with a cap, and only `fixtures` has signup machinery
-- (fixture_signups + fixture_signup(), with the FOR UPDATE lock and the deadline
-- check). Widening this column is what lets a whisky dinner inherit all of it
-- rather than growing a second, separately-hardened copy.
--
-- ═══ WHY THIS IS TWO FILES, NOT ONE ════════════════════════════════════════
-- `sport` is read in NINE places, including public routes (/api/sports/
-- fixture-counts), the kiosk member page and the members dashboard. A straight
-- rename breaks every one of them for the whole gap between running SQL and the
-- deploy landing — and it breaks in whichever order you choose, because old code
-- wants `sport` and new code wants `type`.
--
-- So PART 1 (this file) makes BOTH work at once: it adds `type`, backfills it,
-- and keeps the two columns in sync with a trigger in BOTH directions. Old code
-- writing only `sport` gets a correct `type`; new code writing only `type` gets a
-- `sport` that satisfies the existing NOT NULL. There is no broken window.
--
-- PART 2 (db/fixtures_type_cutover.sql) drops `sport` and the trigger, and is run
-- only AFTER the deploy has landed and settled. Nothing here is destructive.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PREREQUISITES ═════════════════════════════════════════════════════════
do $prereq$
declare v_missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='fixtures')
    then v_missing := v_missing || 'table fixtures'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='fixtures' and column_name='sport')
    then v_missing := v_missing || 'column fixtures.sport'; end if;
  if array_length(v_missing,1) > 0 then
    raise exception 'FIXTURES TYPE: PREREQUISITES MISSING — %', array_to_string(v_missing, ', ')
      using hint = 'Run db/fixtures.sql first. Nothing in this file has been applied.';
  end if;
end $prereq$;

-- ═══ PART 1 · THE COLUMN ═══════════════════════════════════════════════════
-- Nullable on purpose: the trigger below fills it. A NOT NULL here would reject
-- every insert from the code that is still live at the moment you run this.
alter table fixtures add column if not exists type text;

-- Backfill. Existing values are all already in the new vocabulary.
update fixtures set type = sport where type is null;

-- ═══ PART 2 · THE VOCABULARY ═══════════════════════════════════════════════
-- Sports keep their names; the house types are the words the club already uses
-- elsewhere (the gallery categorises dinner / tasting / social, and calendar_
-- entries has tasting). Deliberately NOT adding 'fixture' or 'event' as types —
-- every row here is an event, so a type of 'event' would say nothing.
alter table fixtures drop constraint if exists fixtures_type_check;
alter table fixtures add constraint fixtures_type_check check (
  type in ('golf','tennis','padel','hash',        -- sports
           'dinner','tasting','social','other')   -- house
);

comment on column fixtures.type is
  'What this event IS. Sports: golf|tennis|padel|hash. House: dinner|tasting|social|other. Replaces `sport`, which is dropped in db/fixtures_type_cutover.sql.';

-- ═══ PART 3 · THE BOTH-WAYS SYNC ═══════════════════════════════════════════
-- Live for the deploy window only; Part 2 of the migration drops it.
--
--   old code writes sport, no type  → type := sport
--   new code writes type, no sport  → sport := type if it is a sport, else 'other'
--
-- The second direction is what lets `sport` stay NOT NULL while new code has
-- stopped writing it. BEFORE triggers run before NOT NULL is checked.
create or replace function fixtures_sync_type_sport()
  returns trigger language plpgsql as $fn$
begin
  if new.type is null and new.sport is not null then
    new.type := new.sport;
  elsif new.sport is null and new.type is not null then
    new.sport := case when new.type in ('golf','tennis','padel','hash')
                      then new.type else 'other' end;
  end if;
  -- Neither supplied (an old client omitting both) — let NOT NULL raise as it
  -- always has, rather than inventing a value.
  return new;
end $fn$;

drop trigger if exists trg_fixtures_sync_type_sport on fixtures;
create trigger trg_fixtures_sync_type_sport
  before insert or update on fixtures
  for each row execute function fixtures_sync_type_sport();

-- ═══ PART 4 · SELF-CHECK ═══════════════════════════════════════════════════
-- Asserts the state this file is supposed to leave behind. A silent skip (the
-- column already existing with a different shape, the trigger not attaching)
-- is the failure mode that costs the most, because nothing prompts you to look.
do $check$
declare v_null int; v_bad int; v_trg int;
begin
  select count(*) into v_null from fixtures where type is null;
  if v_null > 0 then raise exception 'SELF-CHECK: % fixtures rows still have a null type', v_null; end if;

  select count(*) into v_bad from fixtures where type <> sport
     and not (type in ('dinner','tasting','social') and sport = 'other');
  if v_bad > 0 then raise exception 'SELF-CHECK: % rows where type and sport disagree unexpectedly', v_bad; end if;

  select count(*) into v_trg from pg_trigger
   where tgrelid = 'fixtures'::regclass and tgname = 'trg_fixtures_sync_type_sport' and not tgisinternal;
  if v_trg <> 1 then raise exception 'SELF-CHECK: sync trigger not attached (found %)', v_trg; end if;

  raise notice 'FIXTURES TYPE PART 1 OK — % rows carry a type; both columns live; sync trigger attached.',
    (select count(*) from fixtures);
end $check$;
