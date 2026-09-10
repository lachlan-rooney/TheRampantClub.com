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

-- ── AND THE DUPLICATE ARTWORK ──────────────────────────────────────────────
-- 01-painting and 03-detail are the SAME PICTURE (mean difference 0.2 on a
-- 10x10 signature). I sourced one painting twice, from Rizal .svg and from
-- PHOTO-2026-09-06-09-57-21, and never compared them — so his four-picture
-- strip showed the same canvas twice. This is the third time in this project
-- that two files turned out to be one image; comparing pixels takes seconds and
-- I keep not doing it until somebody notices.
delete from collaboration_images
 where collaboration_id = (select id from collaborations where slug = 'rizal-fathoni')
   and storage_path = '/images/studio/rizal/03-detail.jpg';

do $check$
declare v text; v_n int; v_dupe int;
begin
  select signature_path into v from collaborations where slug = 'rizal-fathoni';
  if v is null then raise exception 'SELF-CHECK: no signature on his row'; end if;

  select count(*) into v_n from collaboration_images i
    join collaborations c on c.id = i.collaboration_id where c.slug = 'rizal-fathoni';
  select count(*) into v_dupe from collaboration_images i
    join collaborations c on c.id = i.collaboration_id
   where c.slug = 'rizal-fathoni' and i.storage_path like '%03-detail%';
  if v_dupe > 0 then raise exception 'SELF-CHECK: the repeated canvas is still there'; end if;

  raise notice 'Signature set, duplicate canvas removed — % images, each a different picture.', v_n;
end $check$;

commit;
