-- Run once in the Supabase SQL editor.
--
-- Promotes the opening/closing shift checklists from hard-coded TS arrays
-- (lib/checklist-templates.ts) to a DB-backed, admin-editable system.
--
-- Architecture: TEMPLATES and SHEETS are DECOUPLED. A sheet snapshots the
-- template's items at the moment it's started; editing the template later
-- never rewrites a sheet that's already been sealed. This is what makes
-- the sealed sheet a permanent record of what was actually checked that
-- night.
--
-- Compatible with the existing shift_checklists table: the new columns
-- are additive (template_version_at, item_values), and the existing
-- items jsonb gains optional fields (label_vn, type, zone, required)
-- that legacy rows simply don't carry. Old sheets read identically to
-- before; MX Daily's free_notes seam is untouched.

begin;

-- 0. Base sheet table (idempotent — if you already ran
--    db/shift_checklists.sql this block is a no-op).
create table if not exists shift_checklists (
  id            uuid primary key default gen_random_uuid(),
  shift_date    date        not null,
  kind          varchar(10) not null check (kind in ('opening','closing')),
  items         jsonb       not null default '[]'::jsonb,
  free_notes    text,
  submitted_by  text,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (shift_date, kind)
);
create index if not exists idx_checklists_date on shift_checklists (shift_date desc, kind);

alter table shift_checklists enable row level security;
drop policy if exists "admin all on shift_checklists" on shift_checklists;
create policy "admin all on shift_checklists" on shift_checklists
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- 1. The editable templates. Exactly two rows, kind is the primary key.
create table if not exists checklist_templates (
  kind        varchar(10) primary key check (kind in ('opening','closing')),
  items       jsonb       not null default '[]'::jsonb,
                          -- ordered array of:
                          -- { id, label_en, label_vn, type ('checkbox'|'text'),
                          --   zone, required (bool), sort_order, placeholder? }
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table checklist_templates enable row level security;

drop policy if exists "admin all on checklist_templates" on checklist_templates;
create policy "admin all on checklist_templates" on checklist_templates
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- 2. Extend the existing sheets table.
--    template_version_at: a stamp of which template revision produced
--      this snapshot (the templates.updated_at at start-time). Lets us
--      audit "this sheet was started against template v of 2026-06-02".
--    item_values: text-input answers keyed by item id, separate from the
--      legacy items.checked/name/ts state.
alter table shift_checklists
  add column if not exists template_version_at timestamptz,
  add column if not exists item_values         jsonb default '{}'::jsonb;

-- 3. Seed the two templates. Edit afterward via /admin/checklists/templates.

insert into checklist_templates (kind, items, updated_by, updated_at) values (
  'opening',
  $opening_items$
[
  {"id":"arrival-doors","zone":"Arrival & Security","sort_order":10,"type":"checkbox","required":true,
   "label_en":"Doors unlocked, alarm disarmed","label_vn":"Mở cửa, tắt báo động"},
  {"id":"arrival-walkthrough","zone":"Arrival & Security","sort_order":20,"type":"checkbox","required":true,
   "label_en":"Premises walked, no overnight disturbance","label_vn":"Đã đi tuần, không có dấu hiệu xáo trộn qua đêm"},
  {"id":"arrival-cctv","zone":"Arrival & Security","sort_order":30,"type":"checkbox","required":true,
   "label_en":"CCTV recording, timestamps correct","label_vn":"CCTV đang ghi, dấu thời gian đúng"},
  {"id":"arrival-discrepancy","zone":"Arrival & Security","sort_order":40,"type":"text","required":false,
   "label_en":"Any discrepancy from closing — note it","label_vn":"Bất kỳ chênh lệch nào từ ca đóng — ghi chú",
   "placeholder":"e.g. left door deadbolt was disengaged"},

  {"id":"env-hvac","zone":"Environment & Comfort","sort_order":110,"type":"checkbox","required":true,
   "label_en":"HVAC at comfort target","label_vn":"HVAC ở mức nhiệt phù hợp"},
  {"id":"env-lighting","zone":"Environment & Comfort","sort_order":120,"type":"checkbox","required":true,
   "label_en":"Lighting checked, dimmers correct for time of day","label_vn":"Đèn đã kiểm tra, dimmer phù hợp với thời điểm trong ngày"},
  {"id":"env-music","zone":"Environment & Comfort","sort_order":130,"type":"checkbox","required":true,
   "label_en":"Music system tested, playlist queued for service","label_vn":"Hệ thống âm nhạc đã kiểm tra, playlist sẵn sàng"},

  {"id":"clean-member-areas","zone":"Cleanliness & Presentation","sort_order":210,"type":"checkbox","required":true,
   "label_en":"Member areas wiped, tables level, candles trimmed","label_vn":"Khu vực hội viên đã lau, bàn cân bằng, nến đã tỉa"},
  {"id":"clean-bathrooms","zone":"Cleanliness & Presentation","sort_order":220,"type":"checkbox","required":true,
   "label_en":"Bathrooms inspected, stocked, scented","label_vn":"Phòng vệ sinh đã kiểm tra, đầy đủ, thơm tho"},
  {"id":"clean-glassware","zone":"Cleanliness & Presentation","sort_order":230,"type":"checkbox","required":true,
   "label_en":"Glassware polished, no spots","label_vn":"Ly cốc đánh bóng, không vết"},

  {"id":"bar-setup","zone":"Bar & Beverage","sort_order":310,"type":"checkbox","required":true,
   "label_en":"Bar setup complete — ice, mixers, garnishes","label_vn":"Quầy bar sẵn sàng — đá, mixer, trang trí"},
  {"id":"bar-whisky-inventory","zone":"Bar & Beverage","sort_order":320,"type":"checkbox","required":true,
   "label_en":"Whisky inventory matches bar list","label_vn":"Tồn kho whisky khớp danh sách quầy bar"},
  {"id":"bar-lockers","zone":"Bar & Beverage","sort_order":330,"type":"checkbox","required":true,
   "label_en":"Member lockers checked — bottles out for service flagged","label_vn":"Locker hội viên đã kiểm — chai dùng dịch vụ đã đánh dấu"},

  {"id":"kitchen-temps","zone":"Kitchen & Food","sort_order":410,"type":"checkbox","required":false,
   "label_en":"Fridge/freezer temps logged (if serving)","label_vn":"Nhiệt độ tủ lạnh/đông đã ghi (nếu phục vụ)"},
  {"id":"kitchen-prep","zone":"Kitchen & Food","sort_order":420,"type":"checkbox","required":false,
   "label_en":"Prep stations clean and ready (if serving)","label_vn":"Khu chuẩn bị sạch và sẵn sàng (nếu phục vụ)"},

  {"id":"sys-ipos","zone":"Systems & Front Desk","sort_order":510,"type":"checkbox","required":true,
   "label_en":"iPOS open, today's menu loaded","label_vn":"iPOS đã mở, menu hôm nay đã tải"},
  {"id":"sys-cash-float","zone":"Systems & Front Desk","sort_order":520,"type":"text","required":true,
   "label_en":"Cash float counted — record amount","label_vn":"Quỹ tiền mặt đã đếm — ghi số tiền",
   "placeholder":"e.g. 5,000,000 VND"},
  {"id":"sys-bookings","zone":"Systems & Front Desk","sort_order":530,"type":"checkbox","required":true,
   "label_en":"Tonight's bookings reviewed, MX Daily read","label_vn":"Đặt chỗ tối nay đã xem, MX Daily đã đọc"},

  {"id":"safety-fire","zone":"Safety & Compliance","sort_order":610,"type":"checkbox","required":true,
   "label_en":"Fire exits clear, extinguishers in place","label_vn":"Lối thoát hiểm thông thoáng, bình chữa cháy ở vị trí"},
  {"id":"safety-firstaid","zone":"Safety & Compliance","sort_order":620,"type":"checkbox","required":true,
   "label_en":"First aid kit accessible and intact","label_vn":"Hộp sơ cứu dễ tiếp cận và đầy đủ"},

  {"id":"mx-brief-team","zone":"Member Experience Readiness","sort_order":710,"type":"checkbox","required":true,
   "label_en":"VIPs, allergies, anniversaries briefed to team","label_vn":"Đã phổ biến VIP, dị ứng, kỷ niệm cho team"},
  {"id":"mx-experience-plan","zone":"Member Experience Readiness","sort_order":720,"type":"checkbox","required":true,
   "label_en":"Tonight's experience plan understood","label_vn":"Kế hoạch trải nghiệm tối nay đã nắm rõ"}
]
$opening_items$::jsonb,
  'system-seed', now()
) on conflict (kind) do nothing;

insert into checklist_templates (kind, items, updated_by, updated_at) values (
  'closing',
  $closing_items$
[
  {"id":"close-last-orders","zone":"Service close","sort_order":10,"type":"checkbox","required":true,
   "label_en":"Last orders called at agreed time","label_vn":"Đã gọi last orders đúng giờ"},
  {"id":"close-members-departed","zone":"Service close","sort_order":20,"type":"checkbox","required":true,
   "label_en":"All members departed comfortably","label_vn":"Tất cả hội viên đã ra về thoải mái"},
  {"id":"close-floor-cleared","zone":"Service close","sort_order":30,"type":"checkbox","required":true,
   "label_en":"Floor cleared, no items left behind","label_vn":"Sàn đã dọn, không có đồ bỏ quên"},

  {"id":"bar-bottles-secured","zone":"Bar","sort_order":110,"type":"checkbox","required":true,
   "label_en":"All open bottles secured","label_vn":"Tất cả chai đã mở được cất giữ"},
  {"id":"bar-consignment","zone":"Bar","sort_order":120,"type":"checkbox","required":true,
   "label_en":"Consignment bottles returned to correct locker, logged","label_vn":"Chai ký gửi trả về locker đúng, đã ghi sổ"},
  {"id":"bar-inventory","zone":"Bar","sort_order":130,"type":"checkbox","required":true,
   "label_en":"Inventory reconciled against today's pours","label_vn":"Tồn kho đối chiếu với pour hôm nay"},
  {"id":"bar-discrepancies","zone":"Bar","sort_order":140,"type":"text","required":false,
   "label_en":"Inventory discrepancies — note them","label_vn":"Chênh lệch tồn kho — ghi chú",
   "placeholder":"e.g. Lagavulin 16 down half a dram more than receipts show"},

  {"id":"cash-day-end","zone":"Cash & systems","sort_order":210,"type":"checkbox","required":true,
   "label_en":"iPOS day-end run, Z-report saved","label_vn":"Đã chạy day-end iPOS, lưu Z-report"},
  {"id":"cash-card-terminal","zone":"Cash & systems","sort_order":220,"type":"checkbox","required":true,
   "label_en":"Card terminal settled","label_vn":"Máy thẻ đã settle"},
  {"id":"cash-counted","zone":"Cash & systems","sort_order":230,"type":"text","required":true,
   "label_en":"Cash counted — closing float + variance","label_vn":"Đã đếm tiền mặt — quỹ đóng + chênh lệch",
   "placeholder":"e.g. 5,000,000 VND float · variance +20,000 VND"},

  {"id":"kitchen-temps","zone":"Kitchen","sort_order":310,"type":"checkbox","required":false,
   "label_en":"Fridge/freezer temps logged (if serving)","label_vn":"Nhiệt độ tủ đã ghi (nếu phục vụ)"},
  {"id":"kitchen-surfaces","zone":"Kitchen","sort_order":320,"type":"checkbox","required":false,
   "label_en":"Surfaces cleaned, no stock left out (if serving)","label_vn":"Bề mặt sạch, không có hàng để ngoài (nếu phục vụ)"},

  {"id":"clean-member-reset","zone":"Cleanliness","sort_order":410,"type":"checkbox","required":true,
   "label_en":"Member areas reset for tomorrow","label_vn":"Khu vực hội viên đã reset cho ngày mai"},
  {"id":"clean-restrooms","zone":"Cleanliness","sort_order":420,"type":"checkbox","required":true,
   "label_en":"Restrooms checked, replenished","label_vn":"Phòng vệ sinh đã kiểm tra, bổ sung"},
  {"id":"clean-glassware","zone":"Cleanliness","sort_order":430,"type":"checkbox","required":true,
   "label_en":"Glassware cleared, polished, stored","label_vn":"Ly cốc đã dọn, đánh bóng, cất"},

  {"id":"safety-equipment","zone":"Safety & lock-up","sort_order":510,"type":"checkbox","required":true,
   "label_en":"Equipment off where required","label_vn":"Thiết bị tắt theo yêu cầu"},
  {"id":"safety-fire","zone":"Safety & lock-up","sort_order":520,"type":"checkbox","required":true,
   "label_en":"Fire exits clear","label_vn":"Lối thoát hiểm thông thoáng"},
  {"id":"safety-cctv","zone":"Safety & lock-up","sort_order":530,"type":"checkbox","required":true,
   "label_en":"CCTV confirmed recording","label_vn":"CCTV đã xác nhận đang ghi"},
  {"id":"safety-alarm","zone":"Safety & lock-up","sort_order":540,"type":"checkbox","required":true,
   "label_en":"Alarm armed","label_vn":"Báo động đã bật"},
  {"id":"safety-locked","zone":"Safety & lock-up","sort_order":550,"type":"checkbox","required":true,
   "label_en":"Premises locked in correct sequence","label_vn":"Khóa cửa theo đúng trình tự"},

  {"id":"handover-note","zone":"Handover","sort_order":610,"type":"text","required":true,
   "label_en":"Anything the next shift / MX must know","label_vn":"Bất cứ điều gì ca sau / MX cần biết",
   "placeholder":"e.g. fridge running warm — engineer booked Wednesday; member X celebrated big anniversary"}
]
$closing_items$::jsonb,
  'system-seed', now()
) on conflict (kind) do nothing;

commit;

-- Verify.
select kind, jsonb_array_length(items) as item_count, updated_at
  from checklist_templates
 order by kind;
