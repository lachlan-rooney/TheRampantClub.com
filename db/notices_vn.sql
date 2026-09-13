-- ═══════════════════════════════════════════════════════════════════════════
-- THE NOTICE BOARD LEARNS VIETNAMESE
-- ───────────────────────────────────────────────────────────────────────────
-- The board's CHROME already follows the EN/VN switch — the category tabs, the
-- empty states, "Read ↓". The notices themselves never did: `title` and `body`
-- are the only columns there are, so a member reading the portal in Vietnamese
-- still met every notice in English.
--
-- Two optional columns, and nothing else. Deliberately:
--
--   * NULLABLE, NEVER BACKFILLED. Not one existing notice is translated by this
--     file. The house rule is that member-facing Vietnamese is written by a
--     person (Miss Châu), not generated, so an empty column is the honest state
--     until someone writes the words. The board falls back to English per
--     FIELD, so a notice with a Vietnamese title and no Vietnamese body shows
--     the translated title over the English body rather than hiding either.
--
--   * NO `required` FLAG AND NO CONSTRAINT TYING THEM TOGETHER. A notice must
--     be postable in thirty seconds by whoever is on shift; making the
--     translation mandatory would mean either a delayed notice or a machine
--     translation, and both are worse than an English notice on a bilingual
--     board.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- Refuse on the wrong database rather than creating a stray table.
do $$
begin
  if to_regclass('public.notices') is null then
    raise exception 'notices does not exist here — wrong database?';
  end if;
end $$;

alter table notices add column if not exists title_vn text;
alter table notices add column if not exists body_vn  text;

comment on column notices.title_vn is
  'The notice title in Vietnamese. Null = not translated; the board shows the English title.';
comment on column notices.body_vn is
  'The notice body in Vietnamese. Null = not translated; the board shows the English body. '
  'Written by a person — never machine-translated.';

-- What the board will do with them, so the next reader of this file can see it
-- without opening the app:
--   title shown = (lang = 'vn' and title_vn is not null and title_vn <> '') ? title_vn : title
--   body  shown = (lang = 'vn' and body_vn  is not null and body_vn  <> '') ? body_vn  : body

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_cols int; v_notices int; v_translated int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_name = 'notices' and column_name in ('title_vn', 'body_vn');
  select count(*) into v_notices from notices;
  select count(*) into v_translated from notices where title_vn is not null or body_vn is not null;
  raise notice 'notices: % columns added (expect 2) · % notices on the board · % with any Vietnamese',
    v_cols, v_notices, v_translated;
  if v_cols <> 2 then raise exception 'the columns are not both there'; end if;
end $$;
