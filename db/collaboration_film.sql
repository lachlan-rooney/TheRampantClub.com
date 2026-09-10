-- ═══════════════════════════════════════════════════════════════════════════
-- COLLABORATIONS · the process film.  REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- Each exhibition has a film — Quỳnh Anh Lê's documents her process in her
-- Hanoi studio. A COLUMN, so the next collaboration's film is a field in
-- /admin/studio rather than another migration. YouTube only: frame-src already
-- allows it, so no CSP change, and it does not depend on a Drive share that
-- breaks silently when someone tidies a folder.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table collaborations add column if not exists film_url text;
comment on column collaborations.film_url is
  'A YouTube watch or embed URL. The page extracts the id; anything else is ignored rather than rendered as a broken frame.';

update collaborations
   set film_url = 'https://www.youtube.com/watch?v=DOY4fYCpQC0', updated_at = now()
 where slug = 'quynh-anh-le';

do $check$
declare v text;
begin
  select film_url into v from collaborations where slug = 'quynh-anh-le';
  if v is null then raise exception 'SELF-CHECK: no film on the exhibition'; end if;
  raise notice 'Film set. Add the next one in /admin/studio — this is a field now, not a migration.';
end $check$;

commit;
