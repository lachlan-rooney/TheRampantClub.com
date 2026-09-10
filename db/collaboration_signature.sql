-- ═══════════════════════════════════════════════════════════════════════════
-- COLLABORATIONS · the artist's signature.  REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- A COLUMN, so the next artist's signature is a field rather than a migration.
-- It renders once, small, at the foot of the artist's own words — the way a
-- signed work is signed. It is a person's hand, not a motif: never repeated,
-- never used as decoration, and never on the hub, which belongs to the room.
--
-- Toni's was CREAM (#E5D4C2) on a transparent ground — already transparent, so
-- no alpha rebuild was needed, unlike the floor lions and the Q.Anh line
-- drawings. Only the ink was changed, to club green, so it sits on the sage the
-- way type does. The alpha channel was left untouched, which is what keeps the
-- thin strokes: 3% of the ink is soft-edged and would have been the first thing
-- lost to a rebuild that did not need doing.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table collaborations add column if not exists signature_path text;
comment on column collaborations.signature_path is
  'The artist''s signature, cream or dark on TRANSPARENT. Rendered once at the foot of their own words. Check the ground before adding one: a signature on opaque white renders as a white box on the sage.';

update collaborations
   set signature_path = '/images/studio/rizal/signature.png', updated_at = now()
 where slug = 'rizal-fathoni';

do $check$
declare v text;
begin
  select signature_path into v from collaborations where slug = 'rizal-fathoni';
  if v is null then raise exception 'SELF-CHECK: no signature on his row'; end if;
  raise notice 'Signature set. It renders once, at the foot of his own words.';
end $check$;

commit;
