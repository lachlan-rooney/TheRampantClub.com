-- ═══════════════════════════════════════════════════════════════════════════
-- THE DINING ROOM · SIX SET MENUS.  Record of what was applied 2026-09-30.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-09-30: "add these to the in room dining on the kiosk, not the
-- snacks tab, the dining room" — six menus, four courses each and five on the
-- last, sent through as plain text.
--
-- WHERE THEY HANG. On the club's own venue (`the-rampant-club`), not on a
-- partner: the owner called it "the dining room", and the dining tab already
-- describes itself as private catering cooked in our dining room and served
-- downstairs. If these are one partner kitchen's menus, moving them is one
-- update of venue_id and nothing else changes.
--
-- WHAT IS DELIBERATELY EMPTY:
--   · price_per_head_vnd — no price was given, and the board says "on request"
--     rather than a number nobody has agreed. A price invented here would be
--     quoted back to the club by a member holding a tablet.
--   · min_covers / notice_hours — the two numbers that stop a booking going
--     wrong, and neither has been said yet.
--   · allergens — 0 of the club's dishes have confirmed allergens and these
--     are no different. An INCOMPLETE list is worse than an empty one: it
--     reads as checked. `allergens_confirmed` stays false, which is what the
--     board shows a caveat for. `dietary` carries only what the dish names
--     themselves state: pork, and spicy.
--
-- THE VIETNAMESE IS MINE and wants Miss Châu's eye before it is served —
-- the same caveat the allergen labels carry in lib/menus/types.ts.
--
-- Idempotent: re-running replaces the six menus and their courses, and
-- touches nothing else on the board.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'menu_set_menus') then
    raise exception 'PREREQUISITES MISSING — menu_set_menus' using hint = 'Nothing applied.';
  end if;
  if not exists (select 1 from public.menu_venues where slug = 'the-rampant-club') then
    raise exception 'PREREQUISITES MISSING — the-rampant-club venue' using hint = 'Nothing applied.';
  end if;
end $prereq$;

with v as (select id from public.menu_venues where slug = 'the-rampant-club'),
     m (slug, ord, name_en, name_vn) as (values
       ('dining-menu-1', 1, 'Menu 1', 'Thực đơn 1'),
       ('dining-menu-2', 2, 'Menu 2', 'Thực đơn 2'),
       ('dining-menu-3', 3, 'Menu 3', 'Thực đơn 3'),
       ('dining-menu-4', 4, 'Menu 4', 'Thực đơn 4'),
       ('dining-menu-5', 5, 'Menu 5', 'Thực đơn 5'),
       ('dining-menu-6', 6, 'Menu 6', 'Thực đơn 6')
     )
insert into public.menu_set_menus (venue_id, slug, name_en, name_vn, display_order, is_active, is_placeholder)
select v.id, m.slug, m.name_en, m.name_vn, m.ord, true, false from v, m
on conflict (venue_id, slug) do update
  set name_en = excluded.name_en, name_vn = excluded.name_vn,
      display_order = excluded.display_order, is_active = true, is_placeholder = false,
      updated_at = now();

-- Courses are rewritten wholesale: a menu is its list, and a half-replaced
-- list is a dish served that nobody ordered.
delete from public.menu_set_courses
 where set_menu_id in (select id from public.menu_set_menus
                        where slug in ('dining-menu-1','dining-menu-2','dining-menu-3',
                                       'dining-menu-4','dining-menu-5','dining-menu-6'));

insert into public.menu_set_courses (set_menu_id, dish_en, dish_vn, note_en, note_vn, dietary, display_order)
select sm.id, c.dish_en, c.dish_vn, c.note_en, c.note_vn, c.dietary, c.ord
  from (values
    -- Menu 1
    ('dining-menu-1', 1, 'Thai grilled chicken salad', 'Gỏi gà nướng kiểu Thái', null, null, '{}'::text[]),
    ('dining-menu-1', 2, 'Cauliflower soup', 'Súp súp lơ trắng', null, null, '{}'::text[]),
    ('dining-menu-1', 3, 'Tiger prawns in salted egg sauce', 'Tôm sú sốt trứng muối', null, null, '{}'::text[]),
    ('dining-menu-1', 4, 'Wagyu beef', 'Bò Wagyu', null, null, '{}'::text[]),
    -- Menu 2
    ('dining-menu-2', 1, 'Grilled peach and burrata salad', 'Salad đào nướng và phô mai burrata', null, null, '{}'::text[]),
    ('dining-menu-2', 2, 'Abalone soup', 'Súp bào ngư', null, null, '{}'::text[]),
    ('dining-menu-2', 3, 'Prawn-stuffed chicken wings', 'Cánh gà nhồi tôm', null, null, '{}'::text[]),
    ('dining-menu-2', 4, 'Hong Kong-style steamed cod', 'Cá tuyết hấp kiểu Hồng Kông', null, null, '{}'::text[]),
    -- Menu 3
    ('dining-menu-3', 1, 'Scallop salad', 'Salad sò điệp', null, null, '{}'::text[]),
    ('dining-menu-3', 2, 'Korean spicy beef soup', 'Canh bò cay kiểu Hàn Quốc', null, null, '{spicy}'::text[]),
    ('dining-menu-3', 3, 'Crab pasta', 'Mì Ý sốt cua', null, null, '{}'::text[]),
    ('dining-menu-3', 4, 'Iberico pork', 'Thịt heo Iberico', null, null, '{pork}'::text[]),
    -- Menu 4
    ('dining-menu-4', 1, 'Salmon salad', 'Salad cá hồi', null, null, '{}'::text[]),
    ('dining-menu-4', 2, 'Vegetable consommé', 'Súp rau củ trong', null, null, '{}'::text[]),
    ('dining-menu-4', 3, 'Beef short rib with H''Mông sauce', 'Sườn bò sốt H''Mông', null, null, '{}'::text[]),
    ('dining-menu-4', 4, 'Peanut butter grilled chicken', 'Gà nướng bơ đậu phộng', null, null, '{}'::text[]),
    -- Menu 5
    ('dining-menu-5', 1, 'Beef salad with tamarind dressing', 'Gỏi bò sốt me', null, null, '{}'::text[]),
    ('dining-menu-5', 2, 'Snow fungus, crab and chicken soup', 'Súp nấm tuyết, cua và gà', null, null, '{}'::text[]),
    ('dining-menu-5', 3, 'Octopus in XO sauce', 'Bạch tuộc sốt XO', null, null, '{}'::text[]),
    ('dining-menu-5', 4, 'Lobster in tom yum sauce', 'Tôm hùm sốt tom yum', null, null, '{spicy}'::text[]),
    -- Menu 6 — the notes are the owner's own parentheses, lifted out of the
    -- dish names so a course reads as a dish and the detail sits under it.
    ('dining-menu-6', 1, 'Soft-shell crab salad', 'Salad cua lột',
        'With a sharing salad bowl for the table, and a sourdough loaf',
        'Kèm tô salad dùng chung cho bàn và một ổ bánh mì sourdough', '{}'::text[]),
    ('dining-menu-6', 2, 'Crab leg and snow fungus soup', 'Súp càng cua và nấm tuyết', null, null, '{}'::text[]),
    ('dining-menu-6', 3, 'Grilled oysters with spicy butter', 'Hàu nướng bơ cay',
        'Three per person', 'Ba con mỗi người', '{spicy}'::text[]),
    ('dining-menu-6', 4, 'Roast duck breast with mắc mật sauce', 'Ức vịt quay sốt mắc mật',
        'Mắc mật — a fragrant leaf from northern Vietnam',
        'Mắc mật — loại lá thơm của vùng núi phía Bắc', '{}'::text[]),
    ('dining-menu-6', 5, 'Grilled lamb chops', 'Sườn cừu nướng', null, null, '{}'::text[])
  ) as c (menu_slug, ord, dish_en, dish_vn, note_en, note_vn, dietary)
  join public.menu_set_menus sm on sm.slug = c.menu_slug;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- select m.name_en, count(c.*) as courses
--   from public.menu_set_menus m left join public.menu_set_courses c on c.set_menu_id = m.id
--  where m.slug like 'dining-menu-%' group by m.name_en order by m.name_en;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- delete from public.menu_set_menus where slug like 'dining-menu-%';
-- (the courses go with them — on delete cascade)
