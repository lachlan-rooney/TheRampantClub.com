-- ═══════════════════════════════════════════════════════════════════════════
-- RIZAL FATHONI · his portrait as the hero.  REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- The lion was standing in as his hero. It is HIS painting inside the club's
-- mark, so it belongs on the hub — where it now lives permanently — but a mark
-- is not a portrait, and on his card it had to be contained with padding while
-- Quỳnh Anh's photograph filled hers. Two artists, two treatments, for no
-- reason a reader would understand.
--
-- His portrait fills the card the same way hers does, and the lion keeps its
-- place on the room.
--
-- Or do this in /admin/studio: upload, then "Use as hero". Two clicks, no SQL.
-- The file is 312KB, well under the 4MB limit.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

update collaborations
   set hero_path = '/images/studio/rizal/00-portrait.jpg', updated_at = now()
 where slug = 'rizal-fathoni';

-- The lion joins his images rather than being dropped: it is his work.
insert into collaboration_images (collaboration_id, storage_path, caption_en, orientation, sort)
select c.id, '/images/studio/rizal/00-lion.png',
       'The club’s rampant mark, filled with his painting.', 'portrait', 0
  from collaborations c
 where c.slug = 'rizal-fathoni'
   and not exists (select 1 from collaboration_images i
                    where i.collaboration_id = c.id
                      and i.storage_path = '/images/studio/rizal/00-lion.png');

do $check$
declare v text;
begin
  select hero_path into v from collaborations where slug = 'rizal-fathoni';
  if v <> '/images/studio/rizal/00-portrait.jpg' then
    raise exception 'SELF-CHECK: hero is %', v;
  end if;
  raise notice 'His portrait leads; the lion stays on the hub and joins his images.';
end $check$;

commit;
