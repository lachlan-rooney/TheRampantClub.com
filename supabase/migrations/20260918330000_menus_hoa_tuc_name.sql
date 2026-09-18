-- ═══════════════════════════════════════════════════════════════════════════
-- HOA TÚC, SPELLED THE WAY HOA TÚC SPELL IT
-- ───────────────────────────────────────────────────────────────────────────
-- Entered as "Hoa Tuc" because that is how the owner typed it, and I said at
-- the time that correcting a restaurant's own name is not a tidy-up. Their
-- logo settles it: the artwork reads "Hoa Túc", with the diacritic.
--
-- It is mostly invisible — a venue with a logo shows the picture, and the name
-- only reaches a member through the alt text a screen reader announces. That
-- is exactly why it was worth fixing: nobody would have noticed it being
-- wrong, including the restaurant, until it appeared somewhere that mattered.
--
-- ⚠ IBÉRICO MAY BE THE SAME CASE. Their crest reads "IBÉRICO — VINOS Y TAPAS",
--   while the database holds "Iberico Restaurant", which is the owner's
--   wording. Left alone deliberately: "Restaurant" may be how the club refers
--   to them, or how they are registered. One word from the owner and it
--   becomes "Ibérico".
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

update public.menu_venues
   set name = 'Hoa Túc'
 where slug = 'hoa-tuc';

select slug, name from public.menu_venues order by display_order;
