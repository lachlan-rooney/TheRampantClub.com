-- ═══════════════════════════════════════════════════════════════════════════
-- THE STUDIO · Quỳnh Anh Lê's images.  REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- The page was a wall of prose because nothing had been hung on it. A gallery
-- page with no images is a blurb.
--
-- Paths are public assets under /images/studio/quynh-anh/ rather than bucket
-- keys — srcOf() in the component accepts either, so these render today without
-- waiting on an upload flow. Anything added later through the admin lands in
-- the same table as a storage key and sorts in alongside them.
--
-- ORIENTATION IS STORED, not guessed at render, because the layout gives a
-- portrait and a landscape different room. A painting is never cropped to fit.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

update collaborations
   set hero_path = '/images/studio/quynh-anh/01-artist-at-work.jpg', updated_at = now()
 where slug = 'quynh-anh-le';

delete from collaboration_images
 where collaboration_id = (select id from collaborations where slug = 'quynh-anh-le');

insert into collaboration_images (collaboration_id, storage_path, caption_en, orientation, sort)
select c.id, v.path, v.cap, v.orient, v.sort
  from collaborations c,
       (values
         ('/images/studio/quynh-anh/00-twilight-in-kobe.jpg',
          'Twilight in Kobe — the flagship painting. Its fragments became the eighty-eight labels.', 'landscape', 1),
         ('/images/studio/quynh-anh/09-live-painting.jpg',
          'The hand-painted bottle, made live during the exhibition.', 'portrait', 2),
         ('/images/studio/quynh-anh/02-painted-bottle.jpg',
          'One of one. It goes to charity auction to build a school in Vietnam.', 'portrait', 3),
         ('/images/studio/quynh-anh/03-two-bottles.jpg',
          'Painted bottles in the artist''s studio.', 'portrait', 4),
         ('/images/studio/quynh-anh/04-bottle-in-progress.jpg',
          'In progress, Hanoi.', 'portrait', 5),
         ('/images/studio/quynh-anh/06-painting-detail.jpg',
          'Detail. A canvas remembers every layer beneath the surface.', 'portrait', 6),
         ('/images/studio/quynh-anh/05-canvases.jpg',
          'Canvases in the studio.', 'portrait', 7),
         ('/images/studio/quynh-anh/07-studio-floor.jpg',
          'The studio floor.', 'portrait', 8),
         ('/images/studio/quynh-anh/08-the-octave.jpg',
          'The Octave — single cask, finished in one-eighth casks. The fourteen-year-old Auchentoshan was bottled for the exhibition.', 'landscape', 9)
       ) as v(path, cap, orient, sort)
 where c.slug = 'quynh-anh-le';

do $check$
declare v_n int; v_hero text;
begin
  select count(*) into v_n from collaboration_images i
    join collaborations c on c.id = i.collaboration_id where c.slug = 'quynh-anh-le';
  select hero_path into v_hero from collaborations where slug = 'quynh-anh-le';
  if v_n < 5 then raise exception 'SELF-CHECK: only % images — the page is still a blurb', v_n; end if;
  if v_hero is null then raise exception 'SELF-CHECK: no hero image'; end if;
  raise notice 'Quỳnh Anh Lê — hero set and % images hung.', v_n;
end $check$;

commit;
