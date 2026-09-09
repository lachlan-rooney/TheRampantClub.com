-- ═══════════════════════════════════════════════════════════════════════════
-- FIXTURES · SPORT → TYPE  ·  PART 2 of 2 — THE CUTOVER.  DESTRUCTIVE.
-- ───────────────────────────────────────────────────────────────────────────
-- Drops `fixtures.sport` and the sync trigger from Part 1.
--
--   ⚠ DO NOT RUN THIS UNTIL the deploy that reads `type` is live and settled.
--     Part 1 is what makes the two columns coexist; this is what ends that.
--     Once dropped, any surviving reader of `sport` is a 500, not a fallback.
--
-- Run db/fixtures_type.sql (Part 1) first, then deploy, then this.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PREREQUISITES + THE SAFETY THAT MATTERS ═══════════════════════════════
-- Refuses to run if Part 1 has not landed, and refuses if any row would lose
-- information — which is the only way this drop is not reversible.
do $prereq$
declare v_null int;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='fixtures' and column_name='type') then
    raise exception 'CUTOVER: fixtures.type does not exist'
      using hint = 'Run db/fixtures_type.sql (Part 1) first. Nothing has been applied.';
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='fixtures' and column_name='sport') then
    raise notice 'CUTOVER: fixtures.sport is already gone — nothing to do.';
    return;
  end if;

  select count(*) into v_null from fixtures where type is null;
  if v_null > 0 then
    raise exception 'CUTOVER: % rows have a null type — dropping sport would lose them', v_null
      using hint = 'Re-run db/fixtures_type.sql (Part 1); it backfills. Nothing has been applied.';
  end if;
end $prereq$;

-- ═══ THE DROP ══════════════════════════════════════════════════════════════
drop trigger if exists trg_fixtures_sync_type_sport on fixtures;
drop function if exists fixtures_sync_type_sport();
alter table fixtures drop column if exists sport;

-- `type` carried the data all along; now it is the only column, so it says so.
alter table fixtures alter column type set not null;
alter table fixtures alter column type set default 'other';

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_sport int; v_trg int;
begin
  select count(*) into v_sport from information_schema.columns
   where table_schema='public' and table_name='fixtures' and column_name='sport';
  if v_sport <> 0 then raise exception 'SELF-CHECK: fixtures.sport survived the drop'; end if;

  select count(*) into v_trg from pg_trigger
   where tgrelid = 'fixtures'::regclass and tgname = 'trg_fixtures_sync_type_sport' and not tgisinternal;
  if v_trg <> 0 then raise exception 'SELF-CHECK: sync trigger survived the drop'; end if;

  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='fixtures'
                and column_name='type' and is_nullable='YES') then
    raise exception 'SELF-CHECK: fixtures.type is still nullable';
  end if;

  raise notice 'CUTOVER OK — sport dropped, trigger gone, type is NOT NULL over % rows.',
    (select count(*) from fixtures);
end $check$;
