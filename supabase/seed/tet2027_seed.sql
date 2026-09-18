-- =====================================================================
--  Tết 2027 Programme — SEED DATA
--  EVERY NUMBER IN THIS FILE IS A PLACEHOLDER.
--
--  Run this after both migrations. It gives you a working, clickable
--  system today. It does not give you a price you can quote. Each row
--  carries is_placeholder = true; the UI shows a marker while that flag
--  is set, and tet_placeholder_audit() lists what is still outstanding.
--
--  The placeholders are not arbitrary — they are set so the system
--  reproduces the figures already in the xlsx model and on the draft
--  leaflet (12 Year Old at ~1.63m with a sleeve at 50 bottles, ~1.42m
--  at 500+, gross margin walking 40% → 32%). Replace them and every
--  number moves together.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PRICING VERSION
-- ---------------------------------------------------------------------
update public.tet_pricing_inputs set is_active = false where is_active;

insert into public.tet_pricing_inputs (
  version_label, notes, is_active, effective_from,
  fx_vnd_per_gbp, distributor_discount_pct,
  freight_per_bottle_gbp, import_duty_pct, sct_pct, local_cost_per_bottle_vnd,
  target_margin_blend_pct, target_margin_cask_pct,
  vat_pct, rounding_step_vnd,
  artwork_setup_fee_vnd, setup_fee_waiver_bottles,
  bottle_size_ml, cask_bottling_cost_gbp, cask_bottling_loss_pct
) values (
  'v0-placeholder',
  'PLACEHOLDER MODEL. Do not quote from this. Replace FX, duty, freight, '
  || 'ex-works prices and bottling quotes before anything goes to a customer.',
  true, date '2026-09-18',
  33000.00,   -- FX ⚠ PLACEHOLDER — set from your treasury rate, not spot
  0.2000,     -- 20% distributor discount off DT UK list ✔ confirmed term
  1.2000,     -- freight £/bottle ⚠ PLACEHOLDER — forwarder quote needed
  0.1500,     -- UKVFTA duty ⚠ PLACEHOLDER — take 2026 rate from the tariff-phasing model
  0.6500,     -- SCT 65% at import ✔ statutory
  60000.00,   -- local costs VND/bottle ⚠ PLACEHOLDER — broker, stamps, warehousing, delivery
  0.4000,     -- target margin, blends ✔ your decision
  0.4500,     -- target margin, casks ✔ your decision
  0.0800,     -- VAT 8% ⚠ CHECK — confirm the 2027 rate; reverts to 10% if relief lapses
  5000.00,    -- round up to nearest 5,000 VND
  8000000.00, -- artwork + setup fee ⚠ PLACEHOLDER — printer quote needed
  250,        -- setup fee waived from 250 bottles ✔ your decision
  700,
  9.5000,     -- cask bottling £/bottle ⚠ PLACEHOLDER — Huntly quote: glass, closure, label, tube
  0.0200      -- racking/filling loss ⚠ PLACEHOLDER — confirm with Huntly
);


-- ---------------------------------------------------------------------
-- 2. PROGRAMME CALENDAR
-- ---------------------------------------------------------------------
update public.tet_programme set is_active = false where is_active;

insert into public.tet_programme (
  is_active, season_label, timezone, festival_date,
  delivery_before_festival_days,
  bottling_lead_weeks_cask, bottling_lead_weeks_blend,
  sleeve_print_lead_weeks, artwork_approval_weeks,
  transit_weeks, clearance_weeks, local_delivery_weeks, buffer_weeks,
  is_placeholder
) values (
  true, 'Tết Đinh Mùi 2027', 'Asia/Ho_Chi_Minh', date '2027-02-06',
  14,    -- gifts in hand two weeks before Tết, before offices close
  -- Lead times set to land the cask cut-off at 31 Oct 2026 on SEA freight.
  -- This is only true if Huntly commit a three-week bottling slot. If they
  -- come back with six weeks, the cut-off moves to 17 October and no amount
  -- of wishing changes it. Put their real answer in this field.
  3.0,   -- ⚠ CONDITIONAL — Huntly cask bottling slot, assumed booked
  2.0,   -- ⚠ PLACEHOLDER — stock bottling with sleeve
  3.0,   -- ⚠ PLACEHOLDER — sleeve print lead time (Scotland). See note below.
  1.0,   -- artwork approval round
  5.0,   -- ⚠ PLACEHOLDER — direct sea UK → Cát Lái, 30–40 days
  2.0,   -- ⚠ PLACEHOLDER — customs, SCT assessment, stamp application
  1.0,
  1.0,   -- buffer cut to one week to hold the 31 Oct date. This is thin.
  true
);


-- ---------------------------------------------------------------------
-- 3. CATEGORIES
-- ---------------------------------------------------------------------
insert into public.tet_categories
  (slug, kind, name_en, name_vn, standfirst_en, standfirst_vn, accent_hex, display_order)
values
  ('duncan-taylor', 'blend',
   'Duncan Taylor', 'Duncan Taylor',
   'Three blends from Huntly, in a sleeve carrying your company''s name. From fifty bottles.',
   'Ba dòng rượu pha trộn từ Huntly, trong hộp in tên công ty của bạn. Từ năm mươi chai.',
   '#B87333', 1),
  ('octave', 'cask',
   'The Octave Selection', 'Tuyển tập Octave',
   'Fourteen single casks. One company takes the whole cask, and every bottle is numbered.',
   'Mười bốn thùng đơn. Một công ty sở hữu trọn thùng, mỗi chai đều được đánh số.',
   '#7A2E2E', 2)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------
-- 4. VOLUME TIERS  ✔ your published terms
-- ---------------------------------------------------------------------
delete from public.tet_volume_tiers;
insert into public.tet_volume_tiers
  (label_en, label_vn, min_bottles, max_bottles, discount_pct, sleeve_price_vnd, display_order)
values
  ('50–99 bottles',   '50–99 chai',   50,   99, 0.0000, 50000, 1),
  ('100–249 bottles', '100–249 chai', 100, 249, 0.0500, 40000, 2),
  ('250–499 bottles', '250–499 chai', 250, 499, 0.0800, 30000, 3),
  ('500+ bottles',    '500+ chai',    500, null, 0.1200, 25000, 4);


-- ---------------------------------------------------------------------
-- 5. BLENDS  ⚠ ALL THREE UK LIST PRICES ARE PLACEHOLDERS
-- ---------------------------------------------------------------------
insert into public.tet_products
  (category_id, sku, name_en, name_vn, expression, age_years, abv_pct,
   uk_list_price_gbp, min_order_bottles, display_order, is_placeholder)
select c.id, v.sku, v.name_en, v.name_vn, v.expression, v.age, v.abv,
       v.price, 50, v.ord, true
from public.tet_categories c,
(values
  ('DT-5STAR', 'Duncan Taylor 5 Star', 'Duncan Taylor 5 Star', '5 Star',      null, 40.0, 11.50, 1),
  ('DT-12YO',  'Duncan Taylor 12 Year Old', 'Duncan Taylor 12 Năm', '12 Year Old', 12, 40.0, 14.80, 2),
  ('DT-18YO',  'Duncan Taylor 18 Year Old', 'Duncan Taylor 18 Năm', '18 Year Old', 18, 40.0, 32.00, 3)
) as v(sku, name_en, name_vn, expression, age, abv, price, ord)
where c.slug = 'duncan-taylor'
on conflict (sku) do nothing;


-- ---------------------------------------------------------------------
-- 6. THE FOURTEEN OCTAVES
--    ⚠ Distillery, age, ABV, bulk litres and ex-works are ALL invented
--    placeholders. Replace from Huntly's actual cask list.
--
--    Four are held back. Each has a real reason recorded in reserved_for
--    — the constraint on the table will not let you mark a cask as held
--    without one. If you are not genuinely holding these four, set them
--    back to 'available'.
-- ---------------------------------------------------------------------
insert into public.tet_casks
  (category_id, cask_ref, distillery, region, vintage_year, age_years, wood,
   abv_pct, bulk_litres, ex_works_gbp, status, reserved_for,
   tasting_note_en, colour_hex, display_order, is_placeholder)
select c.id, v.ref, v.dist, v.region, v.vintage, v.age, v.wood, v.abv, v.bulk,
       v.exw, v.status::tet_cask_status, v.held, v.note, v.hex, v.ord, true
from public.tet_categories c,
(values
 ('OCT-2027-01','Glen Placeholder','Speyside',   2015, 11.0,'First-fill Oloroso octave', 60.1, 50.0, 4200,'available', null, 'PLACEHOLDER tasting note.','#8C3A1E', 1),
 ('OCT-2027-02','Glen Placeholder','Speyside',   2014, 12.0,'Refill barrel, octave finish',59.1,50.0, 3900,'available', null, 'PLACEHOLDER tasting note.','#A0522D', 2),
 ('OCT-2027-03','Placeholder Isle','Islay',      2013, 13.0,'First-fill bourbon octave',  57.4, 50.0, 4600,'available', null, 'PLACEHOLDER tasting note.','#C08A3E', 3),
 ('OCT-2027-04','Placeholder Glen','Highland',   2012, 14.0,'PX octave',                  56.2, 50.0, 4800,'available', null, 'PLACEHOLDER tasting note.','#7A2E2E', 4),
 ('OCT-2027-05','Placeholder Burn','Speyside',   2011, 15.0,'First-fill Oloroso octave',  55.0, 50.0, 5100,'available', null, 'PLACEHOLDER tasting note.','#6B2B20', 5),
 ('OCT-2027-06','Placeholder Loch','Highland',   2010, 16.0,'Refill hogshead, octave finish',54.1,50.0,5400,'available', null, 'PLACEHOLDER tasting note.','#9C5221', 6),
 ('OCT-2027-07','Placeholder Isle','Islay',      2009, 17.0,'Refill barrel, octave finish',53.2,50.0, 5800,'available', null, 'PLACEHOLDER tasting note.','#5E3A1E', 7),
 ('OCT-2027-08','Glen Placeholder','Speyside',   2008, 18.0,'First-fill Oloroso octave',  52.4, 50.0, 6100,'available', null, 'PLACEHOLDER tasting note.','#7B3F1D', 8),
 ('OCT-2027-09','Placeholder Glen','Lowland',    2007, 19.0,'PX octave',                  51.6, 50.0, 6200,'available', null, 'PLACEHOLDER tasting note.','#B5762F', 9),
 ('OCT-2027-10','Placeholder Burn','Highland',   2006, 20.0,'First-fill bourbon octave',  51.0, 50.0, 6400,'available', null, 'PLACEHOLDER tasting note.','#8A4A22',10),
 -- Held back. Reasons are real or they do not go on the board.
 ('OCT-2027-11','Glen Placeholder','Speyside',   2005, 21.0,'First-fill Oloroso octave',  53.8, 50.0, 7200,'reserved','Held for Rampant Club member ballot','PLACEHOLDER tasting note.','#63301A',11),
 ('OCT-2027-12','Placeholder Isle','Islay',      2004, 22.0,'Refill sherry butt, octave finish',52.9,50.0,7600,'reserved','Held for Rampant Club member ballot','PLACEHOLDER tasting note.','#4E2A18',12),
 ('OCT-2027-13','Placeholder Glen','Highland',   2003, 23.0,'PX octave',                  51.4, 50.0, 8100,'reserved','Held for first anchor client','PLACEHOLDER tasting note.','#5A2F1C',13),
 ('OCT-2027-14','Placeholder Burn','Speyside',   2002, 24.0,'First-fill Oloroso octave',  50.8, 50.0, 8800,'reserved','Held for first anchor client','PLACEHOLDER tasting note.','#432314',14)
) as v(ref, dist, region, vintage, age, wood, abv, bulk, exw, status, held, note, hex, ord)
where c.slug = 'octave'
on conflict (cask_ref) do nothing;


-- ---------------------------------------------------------------------
-- 7. MANUAL MILESTONES
-- ---------------------------------------------------------------------
insert into public.tet_milestones
  (slug, kind, applies_to, name_en, name_vn, note_en, note_vn, due_at, is_hard, display_order)
values
  ('huntly-confirm', 'bottling', 'cask',
   'Huntly bottling slot confirmed', 'Xác nhận lịch đóng chai tại Huntly',
   'The 31 October cask cut-off assumes a three-week bottling slot. Until Huntly '
   || 'confirm it, that date is an assumption, not a deadline. Single malt must be '
   || 'bottled in Scotland — there is no local workaround.',
   'Hạn chốt thùng 31/10 dựa trên giả định lịch đóng chai ba tuần. Chưa có xác nhận '
   || 'từ Huntly thì đó chỉ là giả định. Rượu single malt bắt buộc đóng chai tại Scotland.',
   timestamptz '2026-10-10 17:00+07', true, 1),
  ('sleeve-local-decision', 'artwork_cutoff', 'blend',
   'Decide where sleeves are printed', 'Quyết định nơi in hộp',
   'If sleeves are printed and applied in Ho Chi Minh City rather than at Huntly, '
   || 'artwork leaves the critical path entirely: bottles ship plain and artwork can '
   || 'be agreed in December instead of 10 October. Cheaper, and it lets a customer '
   || 'order first and decide the design after.',
   'Nếu hộp được in và lồng tại TP.HCM thay vì tại Huntly, phần thiết kế không còn '
   || 'nằm trên đường găng: rượu nhập về không hộp, thiết kế có thể chốt vào tháng 12 '
   || 'thay vì 10/10. Chi phí thấp hơn và khách có thể đặt trước, chọn thiết kế sau.',
   timestamptz '2026-10-03 17:00+07', true, 2),
  ('tet-blank-sailing', 'shipping', null,
   'Pre-Tết shipping congestion', 'Cao điểm vận chuyển trước Tết',
   'Carriers blank sailings in the weeks before Tết. Do not plan to use the final two weeks of transit float.',
   'Các hãng tàu thường hủy chuyến trước Tết. Không nên dựa vào hai tuần dự phòng cuối.',
   timestamptz '2026-12-15 00:00+07', false, 3)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------
-- 8. PLACEHOLDER AUDIT  — what still has to be replaced
-- ---------------------------------------------------------------------
create or replace function public.tet_placeholder_audit()
returns table (area text, item text, detail text)
language sql stable as $fn$
  select 'pricing'::text, 'FX rate',
         'VND per GBP is ' || fx_vnd_per_gbp::text || ' — set from treasury, not spot'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Import duty',
         'UKVFTA rate is ' || (import_duty_pct*100)::text || '% — take the 2026 rate from the tariff-phasing model'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Freight',
         'GBP ' || freight_per_bottle_gbp::text || ' per bottle — forwarder quote outstanding'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'VAT rate',
         (vat_pct*100)::text || '% — confirm the rate applying in Q1 2027'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Sleeve and setup',
         'Setup fee VND ' || artwork_setup_fee_vnd::text || ' — printer quote outstanding'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Cask bottling', 'GBP ' || cask_bottling_cost_gbp::text
         || ' per bottle — Huntly quote outstanding'
    from public.tet_pricing_inputs where is_active
  union all
  select 'calendar', 'Cask bottling lead time',
         bottling_lead_weeks_cask::text || ' weeks — this single number sets the cask cut-off'
    from public.tet_programme where is_active
  union all
  select 'calendar', 'Transit time',
         transit_weeks::text || ' weeks assumed (sea). Air freight would return roughly five weeks.'
    from public.tet_programme where is_active
  union all
  select 'blends', 'UK list price', sku || ' at GBP ' || uk_list_price_gbp::text
    from public.tet_products where is_placeholder and is_active
  union all
  select 'casks', 'Cask specification',
         cask_ref || ' — ' || distillery || ', ' || age_years::text || 'yo, '
         || abv_pct::text || '%, ' || bulk_litres::text || 'L, GBP ' || ex_works_gbp::text
    from public.tet_casks where is_placeholder and is_active
  order by 1, 2;
$fn$;

grant execute on function public.tet_placeholder_audit() to authenticated;

commit;

-- Sanity check after running:
--   select * from public.tet_cask_board order by display_order;
--   select public.tet_quote_blends_public('[{"sku":"DT-12YO","qty":50}]'::jsonb, true);
--   select public.tet_countdown();
--   select * from public.tet_placeholder_audit();
