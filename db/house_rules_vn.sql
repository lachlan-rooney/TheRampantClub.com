-- ═══════════════════════════════════════════════════════════════════════════
-- THE HOUSE RULES LEARN VIETNAMESE — including by machine
-- ───────────────────────────────────────────────────────────────────────────
-- house_rules had a Vietnamese TITLE and an English-only BODY, so the EN/VN
-- switch changed a heading and left the rule beneath it in English. Four rules
-- written on 13–14 September have no Vietnamese title either, because the
-- standing rule was that member-facing Vietnamese is written by a person.
--
-- That rule is RELAXED by the owner, 2026-09-14: translate automatically and
-- let the toggle show it. Two columns rather than one, because "who wrote this"
-- is the thing that will matter later:
--
--   body_vn         the Vietnamese
--   body_vn_source  'machine' or 'human'
--
-- A machine translation is never allowed to overwrite a human one — the
-- translate action skips any row marked human, so when Miss Châu writes a
-- proper version it stays written. The reverse is expected: she can replace a
-- machine row at any time, and marking it human makes it permanent.
--
-- ⚠ This does not translate anything by itself. The translation runs through
-- /api/admin/translate, which calls Claude — and the club's Anthropic balance
-- is currently exhausted, so it will refuse until that is topped up. The
-- columns and the button exist so that it works the moment it is.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.house_rules') is null then
    raise exception 'house_rules does not exist here — wrong database?';
  end if;
end $$;

alter table house_rules add column if not exists body_vn text;
alter table house_rules add column if not exists body_vn_source text;

alter table house_rules drop constraint if exists house_rules_body_vn_source_valid;
alter table house_rules add constraint house_rules_body_vn_source_valid
  check (body_vn_source is null or body_vn_source in ('machine', 'human'));

comment on column house_rules.body_vn is
  'The rule in Vietnamese. NULL = not translated yet; the page shows the English rather than an empty rule.';
comment on column house_rules.body_vn_source is
  '''human'' = written by a person and never overwritten by the translator. ''machine'' = generated, and '
  'replaceable at any time. NULL alongside a body_vn means it predates this column.';

-- Same for the titles, so a machine title can be told from Miss Châu's.
alter table house_rules add column if not exists title_vn_source text;
alter table house_rules drop constraint if exists house_rules_title_vn_source_valid;
alter table house_rules add constraint house_rules_title_vn_source_valid
  check (title_vn_source is null or title_vn_source in ('machine', 'human'));

-- The six titles that already exist were written by a person, before any of
-- this. Marking them protects them from the translator.
update house_rules set title_vn_source = 'human'
 where section_title_vn is not null and title_vn_source is null;

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_rules int; v_vn int; v_human int;
begin
  select count(*) into v_rules from house_rules;
  select count(*) into v_vn from house_rules where body_vn is not null;
  select count(*) into v_human from house_rules where title_vn_source = 'human';
  raise notice 'house rules: % · with a Vietnamese body: % · titles marked human: %', v_rules, v_vn, v_human;
end $$;
