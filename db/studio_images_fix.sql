-- ═══════════════════════════════════════════════════════════════════════════
-- THE STUDIO · put the right pictures with the right artist. REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Three of the images on Quỳnh Anh Lê's page were RIZAL FATHONI'S. I assumed a
-- newer batch of photographs belonged to her because they arrived in the same
-- folder as hers — the same mistake as the floor lions and the Nick Faldo
-- invitation, which is now the third time a folder has been read as evidence.
--
-- They are moved to him rather than deleted, since they are his work. The
-- Octave bottle line-up is removed outright: it is a product shot and has
-- nothing to do with the exhibition.
--
-- This is the LAST content change that needs SQL. /admin/studio now edits all
-- of it — sections, dates, images, captions, order and hero.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── Quỳnh Anh: keep only what is hers ──────────────────────────────────────
delete from collaboration_images
 where collaboration_id = (select id from collaborations where slug = 'quynh-anh-le')
   and storage_path in (
     '/images/studio/quynh-anh/05-canvases.jpg',
     '/images/studio/quynh-anh/06-painting-detail.jpg',
     '/images/studio/quynh-anh/07-studio-floor.jpg',
     '/images/studio/quynh-anh/08-the-octave.jpg');

-- ── Rizal: his lion, his work, and the canvases that were always his ──────
update collaborations
   set hero_path = '/images/studio/rizal/00-lion.png',
       status    = 'live',          -- the dates make it read as Forthcoming
       updated_at = now()
 where slug = 'rizal-fathoni';

delete from collaboration_images
 where collaboration_id = (select id from collaborations where slug = 'rizal-fathoni');

insert into collaboration_images (collaboration_id, storage_path, caption_en, orientation, sort)
select c.id, v.path, v.cap, v.orient, v.sort
  from collaborations c,
       (values
         ('/images/studio/rizal/01-painting.jpg',
          'The painting that fills the lion.', 'portrait', 1),
         ('/images/studio/rizal/02-canvases.jpg',
          'Canvases in the studio.', 'portrait', 2),
         ('/images/studio/rizal/03-detail.jpg',
          'Detail.', 'portrait', 3),
         ('/images/studio/rizal/04-studio.jpg',
          'Work in progress.', 'portrait', 4),
         ('/images/studio/rizal/05-his-studio.jpg',
          'The artist’s studio.', 'portrait', 5)
       ) as v(path, cap, orient, sort)
 where c.slug = 'rizal-fathoni';

do $check$
declare v_q int; v_r int; v_status text; v_hero text;
begin
  select count(*) into v_q from collaboration_images i join collaborations c on c.id = i.collaboration_id
   where c.slug = 'quynh-anh-le';
  select count(*) into v_r from collaboration_images i join collaborations c on c.id = i.collaboration_id
   where c.slug = 'rizal-fathoni';
  select status, hero_path into v_status, v_hero from collaborations where slug = 'rizal-fathoni';

  if v_status <> 'live' then raise exception 'SELF-CHECK: Rizal is still %, so he has no tab', v_status; end if;
  if v_hero is null then raise exception 'SELF-CHECK: Rizal has no hero, so the hub shows him blank'; end if;

  -- Nothing of his may remain filed under her name.
  if exists (select 1 from collaboration_images i join collaborations c on c.id = i.collaboration_id
              where c.slug = 'quynh-anh-le' and i.storage_path like '%/rizal/%') then
    raise exception 'SELF-CHECK: one of his images is still on her page';
  end if;

  raise notice 'Quỳnh Anh % images, Rizal % images and live. Two artists, two heroes, the hub has something to switch between.', v_q, v_r;
end $check$;

commit;
