// Shift-checklist template types + fallback seed.
//
// The TEMPLATES table (checklist_templates) is the editable source of
// truth. The arrays below are used only when the DB hasn't been
// migrated yet — they mirror the SQL seed in db/checklist_templates.sql
// so behaviour is identical before/after migration. Once a row exists
// in checklist_templates, that row wins.

export type ChecklistItemType = 'checkbox' | 'text'

export interface ChecklistTemplateItem {
  id: string
  /** EN label (and the only label when label_vn is missing). */
  label_en: string
  /** Optional Vietnamese label. */
  label_vn?: string | null
  /** Renders as a tick OR a typed text input. Required text items block sealing. */
  type: ChecklistItemType
  /** Display group / wall zone. */
  zone: string
  /** Required items must be ticked (checkbox) or filled (text) before the sheet can be sealed. */
  required: boolean
  /** Stable sort order within the template (zones grouped by sort_order). */
  sort_order: number
  /** Optional placeholder hint for text items. */
  placeholder?: string
}

/** ID of the closing item whose value also writes to shift_checklists.free_notes
 *  so the MX Daily handover panel keeps reading from the same denormalised column. */
export const CLOSING_HANDOVER_ITEM_ID = 'handover-note'

const OPENING_FALLBACK: ChecklistTemplateItem[] = [
  { id: 'arrival-doors',         zone: 'Arrival & Security',          sort_order: 10,  type: 'checkbox', required: true,  label_en: 'Doors unlocked, alarm disarmed',                          label_vn: 'Mở cửa, tắt báo động' },
  { id: 'arrival-walkthrough',   zone: 'Arrival & Security',          sort_order: 20,  type: 'checkbox', required: true,  label_en: 'Premises walked, no overnight disturbance',               label_vn: 'Đã đi tuần, không có dấu hiệu xáo trộn qua đêm' },
  { id: 'arrival-cctv',          zone: 'Arrival & Security',          sort_order: 30,  type: 'checkbox', required: true,  label_en: 'CCTV recording, timestamps correct',                       label_vn: 'CCTV đang ghi, dấu thời gian đúng' },
  { id: 'arrival-discrepancy',   zone: 'Arrival & Security',          sort_order: 40,  type: 'text',     required: false, label_en: 'Any discrepancy from closing — note it',                   label_vn: 'Bất kỳ chênh lệch nào từ ca đóng — ghi chú', placeholder: 'e.g. left door deadbolt was disengaged' },

  { id: 'env-hvac',              zone: 'Environment & Comfort',       sort_order: 110, type: 'checkbox', required: true,  label_en: 'HVAC at comfort target',                                   label_vn: 'HVAC ở mức nhiệt phù hợp' },
  { id: 'env-lighting',          zone: 'Environment & Comfort',       sort_order: 120, type: 'checkbox', required: true,  label_en: 'Lighting checked, dimmers correct for time of day',        label_vn: 'Đèn đã kiểm tra, dimmer phù hợp với thời điểm trong ngày' },
  { id: 'env-music',             zone: 'Environment & Comfort',       sort_order: 130, type: 'checkbox', required: true,  label_en: 'Music system tested, playlist queued for service',         label_vn: 'Hệ thống âm nhạc đã kiểm tra, playlist sẵn sàng' },

  { id: 'clean-member-areas',    zone: 'Cleanliness & Presentation',  sort_order: 210, type: 'checkbox', required: true,  label_en: 'Member areas wiped, tables level, candles trimmed',        label_vn: 'Khu vực hội viên đã lau, bàn cân bằng, nến đã tỉa' },
  { id: 'clean-bathrooms',       zone: 'Cleanliness & Presentation',  sort_order: 220, type: 'checkbox', required: true,  label_en: 'Bathrooms inspected, stocked, scented',                    label_vn: 'Phòng vệ sinh đã kiểm tra, đầy đủ, thơm tho' },
  { id: 'clean-glassware',       zone: 'Cleanliness & Presentation',  sort_order: 230, type: 'checkbox', required: true,  label_en: 'Glassware polished, no spots',                              label_vn: 'Ly cốc đánh bóng, không vết' },

  { id: 'bar-setup',             zone: 'Bar & Beverage',              sort_order: 310, type: 'checkbox', required: true,  label_en: 'Bar setup complete — ice, mixers, garnishes',              label_vn: 'Quầy bar sẵn sàng — đá, mixer, trang trí' },
  { id: 'bar-whisky-inventory',  zone: 'Bar & Beverage',              sort_order: 320, type: 'checkbox', required: true,  label_en: 'Whisky inventory matches bar list',                        label_vn: 'Tồn kho whisky khớp danh sách quầy bar' },
  { id: 'bar-lockers',           zone: 'Bar & Beverage',              sort_order: 330, type: 'checkbox', required: true,  label_en: 'Member lockers checked — bottles out for service flagged', label_vn: 'Locker hội viên đã kiểm — chai dùng dịch vụ đã đánh dấu' },

  { id: 'kitchen-temps',         zone: 'Kitchen & Food',              sort_order: 410, type: 'checkbox', required: false, label_en: 'Fridge/freezer temps logged (if serving)',                 label_vn: 'Nhiệt độ tủ lạnh/đông đã ghi (nếu phục vụ)' },
  { id: 'kitchen-prep',          zone: 'Kitchen & Food',              sort_order: 420, type: 'checkbox', required: false, label_en: 'Prep stations clean and ready (if serving)',               label_vn: 'Khu chuẩn bị sạch và sẵn sàng (nếu phục vụ)' },

  { id: 'sys-ipos',              zone: 'Systems & Front Desk',        sort_order: 510, type: 'checkbox', required: true,  label_en: "iPOS open, today's menu loaded",                           label_vn: 'iPOS đã mở, menu hôm nay đã tải' },
  { id: 'sys-cash-float',        zone: 'Systems & Front Desk',        sort_order: 520, type: 'text',     required: true,  label_en: 'Cash float counted — record amount',                       label_vn: 'Quỹ tiền mặt đã đếm — ghi số tiền', placeholder: 'e.g. 5,000,000 VND' },
  { id: 'sys-bookings',          zone: 'Systems & Front Desk',        sort_order: 530, type: 'checkbox', required: true,  label_en: "Tonight's bookings reviewed, MX Daily read",               label_vn: 'Đặt chỗ tối nay đã xem, MX Daily đã đọc' },

  { id: 'safety-fire',           zone: 'Safety & Compliance',         sort_order: 610, type: 'checkbox', required: true,  label_en: 'Fire exits clear, extinguishers in place',                 label_vn: 'Lối thoát hiểm thông thoáng, bình chữa cháy ở vị trí' },
  { id: 'safety-firstaid',       zone: 'Safety & Compliance',         sort_order: 620, type: 'checkbox', required: true,  label_en: 'First aid kit accessible and intact',                       label_vn: 'Hộp sơ cứu dễ tiếp cận và đầy đủ' },

  { id: 'mx-brief-team',         zone: 'Member Experience Readiness', sort_order: 710, type: 'checkbox', required: true,  label_en: 'VIPs, allergies, anniversaries briefed to team',           label_vn: 'Đã phổ biến VIP, dị ứng, kỷ niệm cho team' },
  { id: 'mx-experience-plan',    zone: 'Member Experience Readiness', sort_order: 720, type: 'checkbox', required: true,  label_en: "Tonight's experience plan understood",                     label_vn: 'Kế hoạch trải nghiệm tối nay đã nắm rõ' },
]

const CLOSING_FALLBACK: ChecklistTemplateItem[] = [
  { id: 'close-last-orders',       zone: 'Service close',     sort_order: 10,  type: 'checkbox', required: true,  label_en: 'Last orders called at agreed time',                       label_vn: 'Đã gọi last orders đúng giờ' },
  { id: 'close-members-departed',  zone: 'Service close',     sort_order: 20,  type: 'checkbox', required: true,  label_en: 'All members departed comfortably',                        label_vn: 'Tất cả hội viên đã ra về thoải mái' },
  { id: 'close-floor-cleared',     zone: 'Service close',     sort_order: 30,  type: 'checkbox', required: true,  label_en: 'Floor cleared, no items left behind',                     label_vn: 'Sàn đã dọn, không có đồ bỏ quên' },

  { id: 'bar-bottles-secured',     zone: 'Bar',               sort_order: 110, type: 'checkbox', required: true,  label_en: 'All open bottles secured',                                 label_vn: 'Tất cả chai đã mở được cất giữ' },
  { id: 'bar-consignment',         zone: 'Bar',               sort_order: 120, type: 'checkbox', required: true,  label_en: 'Consignment bottles returned to correct locker, logged',  label_vn: 'Chai ký gửi trả về locker đúng, đã ghi sổ' },
  { id: 'bar-inventory',           zone: 'Bar',               sort_order: 130, type: 'checkbox', required: true,  label_en: "Inventory reconciled against today's pours",              label_vn: 'Tồn kho đối chiếu với pour hôm nay' },
  { id: 'bar-discrepancies',       zone: 'Bar',               sort_order: 140, type: 'text',     required: false, label_en: 'Inventory discrepancies — note them',                      label_vn: 'Chênh lệch tồn kho — ghi chú', placeholder: 'e.g. Lagavulin 16 down half a dram more than receipts show' },

  { id: 'cash-day-end',            zone: 'Cash & systems',    sort_order: 210, type: 'checkbox', required: true,  label_en: 'iPOS day-end run, Z-report saved',                        label_vn: 'Đã chạy day-end iPOS, lưu Z-report' },
  { id: 'cash-card-terminal',      zone: 'Cash & systems',    sort_order: 220, type: 'checkbox', required: true,  label_en: 'Card terminal settled',                                    label_vn: 'Máy thẻ đã settle' },
  { id: 'cash-counted',            zone: 'Cash & systems',    sort_order: 230, type: 'text',     required: true,  label_en: 'Cash counted — closing float + variance',                  label_vn: 'Đã đếm tiền mặt — quỹ đóng + chênh lệch', placeholder: 'e.g. 5,000,000 VND float · variance +20,000 VND' },

  { id: 'kitchen-temps',           zone: 'Kitchen',           sort_order: 310, type: 'checkbox', required: false, label_en: 'Fridge/freezer temps logged (if serving)',                 label_vn: 'Nhiệt độ tủ đã ghi (nếu phục vụ)' },
  { id: 'kitchen-surfaces',        zone: 'Kitchen',           sort_order: 320, type: 'checkbox', required: false, label_en: 'Surfaces cleaned, no stock left out (if serving)',         label_vn: 'Bề mặt sạch, không có hàng để ngoài (nếu phục vụ)' },

  { id: 'clean-member-reset',      zone: 'Cleanliness',       sort_order: 410, type: 'checkbox', required: true,  label_en: 'Member areas reset for tomorrow',                          label_vn: 'Khu vực hội viên đã reset cho ngày mai' },
  { id: 'clean-restrooms',         zone: 'Cleanliness',       sort_order: 420, type: 'checkbox', required: true,  label_en: 'Restrooms checked, replenished',                            label_vn: 'Phòng vệ sinh đã kiểm tra, bổ sung' },
  { id: 'clean-glassware',         zone: 'Cleanliness',       sort_order: 430, type: 'checkbox', required: true,  label_en: 'Glassware cleared, polished, stored',                       label_vn: 'Ly cốc đã dọn, đánh bóng, cất' },

  { id: 'safety-equipment',        zone: 'Safety & lock-up',  sort_order: 510, type: 'checkbox', required: true,  label_en: 'Equipment off where required',                              label_vn: 'Thiết bị tắt theo yêu cầu' },
  { id: 'safety-fire',             zone: 'Safety & lock-up',  sort_order: 520, type: 'checkbox', required: true,  label_en: 'Fire exits clear',                                          label_vn: 'Lối thoát hiểm thông thoáng' },
  { id: 'safety-cctv',             zone: 'Safety & lock-up',  sort_order: 530, type: 'checkbox', required: true,  label_en: 'CCTV confirmed recording',                                  label_vn: 'CCTV đã xác nhận đang ghi' },
  { id: 'safety-alarm',            zone: 'Safety & lock-up',  sort_order: 540, type: 'checkbox', required: true,  label_en: 'Alarm armed',                                                label_vn: 'Báo động đã bật' },
  { id: 'safety-locked',           zone: 'Safety & lock-up',  sort_order: 550, type: 'checkbox', required: true,  label_en: 'Premises locked in correct sequence',                       label_vn: 'Khóa cửa theo đúng trình tự' },

  { id: CLOSING_HANDOVER_ITEM_ID,  zone: 'Handover',          sort_order: 610, type: 'text',     required: true,  label_en: 'Anything the next shift / MX must know',                   label_vn: 'Bất cứ điều gì ca sau / MX cần biết', placeholder: 'e.g. fridge running warm — engineer booked Wednesday; member X celebrated big anniversary' },
]

export function fallbackTemplateFor(kind: 'opening' | 'closing'): ChecklistTemplateItem[] {
  return kind === 'opening' ? OPENING_FALLBACK : CLOSING_FALLBACK
}

/** Item shape stored INSIDE a sheet row's items jsonb. Mirrors template
 *  fields PLUS the tick state. Legacy rows may lack the richer fields;
 *  the page renders missing zones as '(no zone)' and missing types as
 *  'checkbox'. */
export interface SheetItemState {
  id: string
  // Legacy fields (kept so old rows render).
  label?: string
  // New, snapshotted from the template at start:
  label_en?: string
  label_vn?: string | null
  type?: ChecklistItemType
  zone?: string
  required?: boolean
  sort_order?: number
  placeholder?: string
  // Tick state (checkbox items).
  checked?: boolean
  name?: string | null
  ts?: string | null
}

/** Build the initial sheet-items snapshot from a template. */
export function snapshotItems(template: ChecklistTemplateItem[]): SheetItemState[] {
  return [...template]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(t => ({
      id: t.id,
      label_en: t.label_en,
      label_vn: t.label_vn ?? null,
      label: t.label_en,  // legacy field kept populated for backwards compat
      type: t.type,
      zone: t.zone,
      required: t.required,
      sort_order: t.sort_order,
      placeholder: t.placeholder,
      checked: false,
      name: null,
      ts: null,
    }))
}
