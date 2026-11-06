// THE WEEKLY SCORECARD'S RULES — every number carries a prescription.
//
// A red figure that does not say what to do about it is decoration. Each rule
// below pairs a measurement with a band and, at warn or act, an owner and a
// next action — so the surface is prescriptive rather than descriptive.
//
// ── THESE ARE CALIBRATION, NOT TRUTH ──────────────────────────────────────
// Every number here is a first guess made against five months of thin data.
// They are gathered in one file, with their reasoning, precisely so they can
// be argued with and changed — and so nobody has to go hunting through a page
// component to find out why something turned amber.
//
// ⚠ THE NEXT STEP FOR THIS FILE IS A TABLE, not more constants. The rota
//   scaling rules and tier_budgets are both editable in the admin; thresholds
//   belong there too, so the owner can tune a warning level against what
//   actually happens rather than asking for a deploy. Keeping them in one
//   module with this shape is what makes that move cheap later.

export type Band = 'ok' | 'watch' | 'warn' | 'act'

export interface Rule {
  /** What is being measured, in the owner's words. */
  label_en: string
  label_vn: string
  /** Graduated, so trouble shows up before it arrives. */
  watch: number
  warn: number
  act: number
  /** true when a HIGHER number is worse (overdue tasks); false when lower is
   *  worse (coverage). Getting this backwards silently inverts a whole card,
   *  so it is explicit rather than inferred from the thresholds. */
  higherIsWorse: boolean
  /** Who picks it up, and what they do. Shown at warn and act. */
  owner: string
  action_en: string
  action_vn: string
  /** Why these numbers. Read this before changing them. */
  why: string
}

export const RULES = {
  pipelineStalled: {
    label_en: 'Candidates stalled in a stage', label_vn: 'Ứng viên đứng yên một giai đoạn',
    watch: 3, warn: 6, act: 10, higherIsWorse: true,
    owner: 'Lachlan',
    action_en: 'Review the stalled list and either move them on or close them.',
    action_vn: 'Xem lại danh sách và hoặc đẩy tiếp, hoặc đóng lại.',
    why: 'A lead that has not moved in 30 days is usually dead and flattering the funnel. 220 prospects with 44 recorded stage changes means most have never moved at all, so the bar starts low and should rise once the pipeline is being worked.',
  },
  overdueTasks: {
    label_en: 'Overdue tasks on the boards', label_vn: 'Công việc quá hạn trên bảng',
    watch: 10, warn: 25, act: 45, higherIsWorse: true,
    owner: 'Lachlan',
    action_en: 'Clear or re-date them in the Monday review; close finished boards.',
    action_vn: 'Xử lý hoặc đổi hạn trong buổi rà soát thứ Hai; đóng các bảng đã xong.',
    why: 'Measured 2026-11-06: 120 overdue, of which 75 sat on two finished events. Closing those took it to 45 — so 45 is the honest "this is live work that is late" level, not a target.',
  },
  grievanceOpen: {
    label_en: 'Grievances still open', label_vn: 'Khiếu nại chưa xử lý',
    watch: 5, warn: 10, act: 15, higherIsWorse: true,
    owner: 'Miss Châu',
    action_en: 'Close the oldest three this week, or say why they cannot be.',
    action_vn: 'Đóng ba vụ cũ nhất trong tuần, hoặc nêu rõ lý do chưa thể.',
    why: '31 complaints logged, 16 resolved, 14 open. A guest complaint that stays open is the one a member remembers.',
  },
  resolutionDays: {
    label_en: 'Days to resolve a grievance', label_vn: 'Số ngày xử lý khiếu nại',
    watch: 7, warn: 14, act: 30, higherIsWorse: true,
    owner: 'Miss Châu',
    action_en: 'Anything older than a fortnight needs a decision, not more waiting.',
    action_vn: 'Việc quá hai tuần cần một quyết định, không phải chờ thêm.',
    why: 'A week is a reasonable turn for a hospitality complaint. Beyond a fortnight the apology stops landing.',
  },
  coveragePct: {
    label_en: 'Rota coverage against target', label_vn: 'Mức phủ ca so với mục tiêu',
    watch: 95, warn: 85, act: 70, higherIsWorse: false,
    owner: 'Mr Sĩ',
    action_en: 'Fill the gap before the week starts, or agree the shift runs short.',
    action_vn: 'Bù ca trước khi tuần bắt đầu, hoặc thống nhất chấp nhận thiếu người.',
    why: 'Below target is a floor short-staffed on a night somebody booked. Under 70% is not a gap, it is a different rota.',
  },
  memberReach: {
    label_en: 'Members seen this month', label_vn: 'Hội viên đã ghé trong tháng',
    watch: 50, warn: 30, act: 15, higherIsWorse: false,
    owner: 'Miss Châu',
    action_en: 'Pick three members nobody has seen and make contact this week.',
    action_vn: 'Chọn ba hội viên lâu chưa gặp và liên hệ trong tuần.',
    why: 'As a PERCENTAGE of members. Blunt on purpose: with 8 of 18 ever recording a visit, how many we have seen at all matters more than any engagement score. ⚠ It reads low partly because visits are barely captured — fix the capture before trusting the number.',
  },
} as const satisfies Record<string, Rule>

export type RuleKey = keyof typeof RULES

/** Which band a value falls in. Handles both directions explicitly. */
export function band(key: RuleKey, value: number | null | undefined): Band {
  if (value == null || !Number.isFinite(value)) return 'ok'
  const r = RULES[key]
  if (r.higherIsWorse) {
    if (value >= r.act) return 'act'
    if (value >= r.warn) return 'warn'
    if (value >= r.watch) return 'watch'
    return 'ok'
  }
  if (value <= r.act) return 'act'
  if (value <= r.warn) return 'warn'
  if (value <= r.watch) return 'watch'
  return 'ok'
}

/** The prescription, or null when there is nothing to do. */
export function prescription(key: RuleKey, value: number | null | undefined, vn = false):
  { owner: string; action: string } | null {
  const b = band(key, value)
  if (b !== 'warn' && b !== 'act') return null
  const r = RULES[key]
  return { owner: r.owner, action: vn ? r.action_vn : r.action_en }
}

export const BAND_COLOUR: Record<Band, string> = {
  ok: '#7AB07A', watch: '#D4B85A', warn: '#E0934A', act: '#C27070',
}
export const BAND_LABEL: Record<Band, { en: string; vn: string }> = {
  ok:    { en: 'On track', vn: 'Ổn' },
  watch: { en: 'Watch',    vn: 'Theo dõi' },
  warn:  { en: 'Warning',  vn: 'Cảnh báo' },
  act:   { en: 'Act now',  vn: 'Cần xử lý' },
}
