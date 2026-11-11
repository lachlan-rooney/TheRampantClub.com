// ═══════════════════════════════════════════════════════════════════════════
// THE SILENT AUCTION — every word of it, and the two formatters.
// ───────────────────────────────────────────────────────────────────────────
// EVERY STRING THE AUCTION CAN SHOW LIVES IN THIS ONE TABLE, including the
// validation messages and the email subjects. Not because a constants file is
// tidy, but because the Vietnamese has to be checked by a native speaker in
// one pass before this goes live, and a string written inline in a component
// is a string that will not be on that list. /admin/studio/auction/vn renders
// this object; if a sentence is not here, it cannot be reviewed.
//
// The Vietnamese below is MY DRAFT. It is marked as such in the admin and the
// auction should not be published until somebody has read it.
// ═══════════════════════════════════════════════════════════════════════════

export type Lang = 'en' | 'vn'
export interface L { en: string; vn: string }

/** Whole US dollars, both languages: "US$1,200". No decimals, ever. */
export const money = (n: number | null | undefined): string =>
  n == null ? '—' : `US$${Math.round(n).toLocaleString('en-US')}`

// ── TIME ──────────────────────────────────────────────────────────────────
// Every time this auction prints is in Ho Chi Minh City, and says so. The
// instant itself is stored in UTC (timestamptz); this is the only place it is
// ever bent into a local reading, so a phone in another timezone cannot show a
// different closing time from the one on the wall.
const VN_TZ = 'Asia/Ho_Chi_Minh'

const parts = (iso: string) => {
  const d = new Date(iso)
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
    day: 'numeric', month: 'long',
  })
  const g = Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]))
  return {
    day: g.day, month: g.month,
    h12: g.hour, min: g.minute, ampm: (g.dayPeriod || '').toLowerCase(),
    h24: new Intl.DateTimeFormat('en-GB', { timeZone: VN_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
    monthNum: new Intl.DateTimeFormat('en-GB', { timeZone: VN_TZ, month: 'numeric' }).format(d),
  }
}

/**
 * The closing instant, as each language says it.
 *   en → "3pm, 14 November (Ho Chi Minh time)"
 *   vn → "15:00, ngày 14 tháng 11 (giờ Hồ Chí Minh)"
 * A clean hour drops ":00" in English, because "3pm" is how it is said aloud.
 */
export const closeLabel = (lang: Lang, iso: string): string => {
  const p = parts(iso)
  if (lang === 'vn') return `${p.h24}, ngày ${p.day} tháng ${p.monthNum} (giờ Hồ Chí Minh)`
  const t = p.min === '00' ? `${p.h12}${p.ampm}` : `${p.h12}.${p.min}${p.ampm}`
  return `${t}, ${p.day} ${p.month} (Ho Chi Minh time)`
}

/** Just the date, for "announced on the 14th". */
export const dateLabel = (lang: Lang, iso: string): string => {
  const p = parts(iso)
  return lang === 'vn' ? `ngày ${p.day} tháng ${p.monthNum}` : `${p.day} ${p.month}`
}

/** A bid's own timestamp, for the confirmation line and the admin list. */
export const stampLabel = (lang: Lang, iso: string): string => {
  const p = parts(iso)
  return lang === 'vn'
    ? `${p.h24}, ngày ${p.day} tháng ${p.monthNum} (giờ Hồ Chí Minh)`
    : `${p.h12}.${p.min}${p.ampm}, ${p.day} ${p.month} (Ho Chi Minh time)`
}

export const pickL = (lang: Lang, l: L): string => (lang === 'vn' && l.vn ? l.vn : l.en)

// ── HOW MANY WORKS ARE IN THE AUCTION ─────────────────────────────────────
// Spelled, not numeralled: "Four of the works" is how the sentence is said,
// and "4 of the works" is how a spreadsheet says it. Counted from the data so
// that moving a work in or out of the auction cannot leave the banner lying.
const WORDS: Record<Lang, string[]> = {
  en: ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  vn: ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'],
}
export const countWord = (lang: Lang, n: number): string => {
  const w = WORDS[lang][n] ?? String(n)
  return w.charAt(0).toUpperCase() + w.slice(1)
}

// ── TIME LEFT ─────────────────────────────────────────────────────────────
// Two parts, never three, and the parts get finer as the close approaches:
// days and hours while there is a day to go, hours and minutes inside that,
// and minutes and seconds in the last hour — which is when a guest standing
// in the room starts counting. Returns null once it is past, because at that
// point the page has something else to say.
export const timeLeft = (lang: Lang, iso: string, nowMs: number = Date.now()): string | null => {
  const ms = Date.parse(iso) - nowMs
  if (!Number.isFinite(ms) || ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60), sec = s % 60
  const part = (k: StringKey, n: number) => tr(lang, k, { n })
  const two = d >= 1 ? [part('cd_days', d), part('cd_hours', h)]
            : h >= 1 ? [part('cd_hours', h), part('cd_mins', m)]
            :          [part('cd_mins', m), part('cd_secs', sec)]
  return two.join(' ')
}

// ═══ THE STRINGS ══════════════════════════════════════════════════════════
// Grouped the way the guest meets them, so the review screen reads in order.
// {amount}, {min}, {time}, {date}, {title} are filled in at render.
export const AUCTION_STRINGS = {
  // ── The banner above the works ──────────────────────────────────────────
  banner_eyebrow: {
    en: 'Silent auction',
    vn: 'Đấu giá kín',
  },
  // ⚠ {n} IS COUNTED FROM THE DATA, not typed. Works move between priced and
  // auction right up to the opening, and a banner that says "three" over four
  // lots is the kind of mistake a guest spots before anybody else does.
  banner_lead: {
    en: '{n} of the works in this exhibition are in a silent auction.',
    vn: '{n} tác phẩm trong triển lãm này được bán theo hình thức đấu giá kín.',
  },
  banner_closes: {
    en: 'Bidding closes at {time}.',
    vn: 'Đấu giá đóng lúc {time}.',
  },
  banner_announce: {
    en: 'Winners are announced by email that day.',
    vn: 'Người thắng sẽ được thông báo qua email trong cùng ngày.',
  },
  banner_jump: {
    en: 'Go to',
    vn: 'Đến',
  },
  // ⚠ ALSO COUNTED, NEVER TYPED — and deliberately plain. Four of the eight
  // works were sold before the guide went up, and a guest standing in front of
  // one should not have to deduce that from the absence of a price. It states
  // the fact and stops: no "available now" on the rest, because nothing is on
  // sale — the other four can only be bid for.
  banner_sold: {
    en: '{n} works in this exhibition have sold.',
    vn: '{n} tác phẩm trong triển lãm này đã được bán.',
  },
  // ⚠ ENGLISH NEEDS THE SINGULAR, VIETNAMESE DOES NOT. Four works have sold
  // today, so the plural is the one that ships — but the count comes from the
  // data, and the first time a single work sold this would have read "One
  // works in this exhibition have sold." Vietnamese marks no plural on the
  // noun or the verb, so its two forms differ only in the number word and
  // this string is a faithful copy of the one above.
  banner_sold_one: {
    en: 'One work in this exhibition has sold.',
    vn: 'Một tác phẩm trong triển lãm này đã được bán.',
  },
  // THE QUIET COUNTDOWN. Prefix only; timeLeft() assembles the figure.
  banner_left: { en: 'Closes in {t}', vn: 'Còn {t}' },
  cd_days:  { en: '{n}d', vn: '{n} ngày' },
  cd_hours: { en: '{n}h', vn: '{n} giờ' },
  cd_mins:  { en: '{n}m', vn: '{n} phút' },
  cd_secs:  { en: '{n}s', vn: '{n} giây' },

  // ── Under an auction work ───────────────────────────────────────────────
  lot_starting: { en: 'Starting bid', vn: 'Giá khởi điểm' },
  lot_highest:  { en: 'Current highest bid', vn: 'Giá cao nhất hiện tại' },
  lot_none:     { en: 'No bids yet', vn: 'Chưa có lượt đấu giá' },
  lot_reserve_met:     { en: 'Reserve met', vn: 'Đã đạt mức tối thiểu' },
  lot_reserve_not_met: { en: 'Reserve not yet met', vn: 'Chưa đạt mức tối thiểu' },
  lot_closes:   { en: 'Closes', vn: 'Kết thúc' },
  lot_cta:      { en: 'Place a bid', vn: 'Đặt giá' },
  lot_price:    { en: 'Price', vn: 'Giá' },
  lot_sold:     { en: 'Sold', vn: 'Đã bán' },
  // A priced work cannot be bought from a phone, so the control starts a
  // conversation rather than pretending to take payment.
  lot_enquire:  { en: 'Enquire', vn: 'Hỏi mua' },
  // ON A RETURN VISIT, on the same device. Said on the work itself, because
  // that is where the guest is looking when they want to know.
  lot_you_leading: { en: 'You are the highest bidder.', vn: 'Bạn đang là người đặt giá cao nhất.' },
  lot_you_outbid:  { en: 'You have been outbid.', vn: 'Đã có người đặt giá cao hơn bạn.' },
  lot_bid_again:   { en: 'Bid again', vn: 'Đặt lại' },
  // THE DONATION SHARE, once the owner has set a figure. Until then the work
  // keeps its existing sentence and this line is not drawn at all.
  lot_donation: {
    en: '{pct}% of the price this work reaches is donated to {org}.',
    vn: '{pct}% số tiền tác phẩm này đạt được sẽ được quyên góp cho {org}.',
  },

  // ── The form ────────────────────────────────────────────────────────────
  form_title:  { en: 'Place a bid', vn: 'Đặt giá' },
  form_name:   { en: 'Your name', vn: 'Tên của bạn' },
  form_email:  { en: 'Email', vn: 'Email' },
  form_phone:  { en: 'Phone (optional)', vn: 'Số điện thoại (không bắt buộc)' },
  form_amount: { en: 'Your bid in US dollars', vn: 'Giá bạn đặt, bằng đô la Mỹ' },
  form_min:    {
    en: 'Minimum {min}.',
    vn: 'Tối thiểu {min}.',
  },

  // ── The terms, and the two boxes ────────────────────────────────────────
  // ONE short line, above the button, in the words the bid is recorded
  // against. This exact sentence is stored with every bid.
  form_terms: {
    en: 'A bid is a commitment to buy at that price if it wins and meets the reserve. Everyone who bids will be emailed the result on {date}.',
    vn: 'Đặt giá là cam kết mua tác phẩm ở mức giá đó nếu bạn thắng và đạt mức tối thiểu. Tất cả người tham gia sẽ nhận email kết quả vào {date}.',
  },
  // The club's standing rule about the two languages, said once, in both.
  form_prevails: {
    en: 'Reading either language is enough. Where the two differ, the English version prevails.',
    vn: 'Đọc một trong hai ngôn ngữ là đủ. Nếu có khác biệt, bản tiếng Anh được ưu tiên.',
  },
  form_share_box: {
    en: 'If I win, the winning price may be shared with the other bidders in the results email.',
    vn: 'Nếu tôi thắng, giá thắng có thể được chia sẻ với những người đặt giá khác trong email kết quả.',
  },
  form_news_box: {
    en: 'Send me news from The Rampant Club.',
    vn: 'Gửi cho tôi tin tức từ The Rampant Club.',
  },
  form_submit:     { en: 'Place bid', vn: 'Đặt giá' },
  form_submitting: { en: 'Placing…', vn: 'Đang gửi…' },
  form_cancel:     { en: 'Cancel', vn: 'Huỷ' },

  // ── The enquiry, for a priced work ──────────────────────────────────────
  enq_title:   { en: 'Enquire about this work', vn: 'Hỏi về tác phẩm này' },
  enq_message: { en: 'Anything you would like us to know (optional)',
                 vn: 'Điều bạn muốn cho chúng tôi biết (không bắt buộc)' },
  // No marketing hidden in a sales enquiry: the news box is a separate
  // decision and is not on this form at all.
  enq_terms: {
    en: 'We will email you about this work. Your details are not added to any list.',
    vn: 'Chúng tôi sẽ gửi email cho bạn về tác phẩm này. Thông tin của bạn không được thêm vào danh sách nào.',
  },
  enq_submit:     { en: 'Send enquiry', vn: 'Gửi yêu cầu' },
  enq_submitting: { en: 'Sending…', vn: 'Đang gửi…' },
  enq_ok_title:   { en: 'Thank you — that is with us', vn: 'Cảm ơn bạn — chúng tôi đã nhận được' },
  enq_ok_line:    { en: 'We will be in touch about {title}.',
                    vn: 'Chúng tôi sẽ liên hệ với bạn về {title}.' },

  // ── What can go wrong, said plainly ─────────────────────────────────────
  err_name:   { en: 'Please give your name.', vn: 'Vui lòng nhập tên của bạn.' },
  err_email:  { en: 'That email address does not look right.', vn: 'Địa chỉ email này có vẻ chưa đúng.' },
  err_amount: { en: 'Please enter a bid in whole dollars.', vn: 'Vui lòng nhập số tiền bằng đô la, số nguyên.' },
  err_low:    {
    en: 'Too low. The next bid must be at least {min}.',
    vn: 'Chưa đủ. Lượt đặt tiếp theo phải từ {min} trở lên.',
  },
  err_closed: {
    en: 'Bidding has closed on this work.',
    vn: 'Tác phẩm này đã kết thúc đấu giá.',
  },
  err_busy: {
    en: 'That is a lot of bids from one place. Please wait a moment and try again.',
    vn: 'Có quá nhiều lượt đặt giá từ một nơi. Vui lòng đợi một lát rồi thử lại.',
  },
  err_failed: {
    en: 'Your bid was not saved. Nothing has been recorded — please try again, or speak to a member of staff.',
    vn: 'Lượt đặt giá của bạn chưa được lưu. Chưa có gì được ghi nhận — vui lòng thử lại, hoặc báo nhân viên.',
  },
  err_enq_failed: {
    en: 'That did not send. Nothing has been recorded — please try again, or speak to a member of staff.',
    vn: 'Yêu cầu chưa được gửi. Chưa có gì được ghi nhận — vui lòng thử lại, hoặc báo nhân viên.',
  },
  // THE FIGURES THEMSELVES FAILED TO LOAD. Said in words, in place, never as
  // an empty block that reads as "no bids yet".
  err_state: {
    en: 'The live figures could not be loaded. Reload the page, or speak to a member of staff.',
    vn: 'Không tải được số liệu trực tiếp. Vui lòng tải lại trang, hoặc báo nhân viên.',
  },
  // One line in the page's own voice while the bids are read. Not a spinner.
  loading: { en: 'Reading the bids…', vn: 'Đang đọc các lượt đặt giá…' },
  // The absurd-amount guard. Asks rather than refuses: a large bid is real.
  err_confirm_big: {
    en: 'That is {amount}, far above the current highest. Press again to confirm you meant it.',
    vn: 'Đó là {amount}, cao hơn rất nhiều so với mức cao nhất hiện tại. Nhấn lần nữa để xác nhận.',
  },

  // ── Afterwards ──────────────────────────────────────────────────────────
  ok_title: { en: 'Your bid is in', vn: 'Đã nhận lượt đặt giá của bạn' },
  ok_line: {
    en: '{amount}, at {time}.',
    vn: '{amount}, lúc {time}.',
  },
  ok_email: {
    en: 'A confirmation is on its way to your email.',
    vn: 'Email xác nhận đang được gửi đến bạn.',
  },
  // ⚠ THE BID STANDS AND THE EMAIL DID NOT. These are two different failures
  // and they were sharing one sentence: the guest was being told "your bid was
  // not saved" about a bid that is in the database with a number beside it.
  // Nobody would bid again after reading that, and the real fault — nobody has
  // their confirmation — would be invisible.
  ok_email_failed: {
    en: 'Your bid is recorded, but the confirmation email did not send. The club has been told.',
    vn: 'Lượt đặt giá của bạn đã được ghi nhận, nhưng email xác nhận chưa gửi được. Chúng tôi đã báo cho câu lạc bộ.',
  },
  ok_outbid_note: {
    en: 'If someone outbids you before the close, we will email you.',
    vn: 'Nếu có người đặt cao hơn trước khi kết thúc, chúng tôi sẽ gửi email cho bạn.',
  },
  // WHERE THE BID STANDS, the moment it lands. Two sentences, one of which is
  // always true: either nobody is above you, or somebody is and here is the
  // figure — never a confirmation that leaves the guest to guess.
  ok_leading:     { en: 'You are the highest bidder.', vn: 'Bạn đang là người đặt giá cao nhất.' },
  ok_not_leading: { en: 'Your bid is recorded; the highest is {amount}.',
                    vn: 'Lượt đặt của bạn đã được ghi nhận; mức cao nhất là {amount}.' },
  ok_again: { en: 'Bid again', vn: 'Đặt lại' },
  ok_back:  { en: 'Back to the exhibition', vn: 'Trở lại triển lãm' },

  closed_title: { en: 'Bidding has closed.', vn: 'Đấu giá đã kết thúc.' },
  closed_line:  {
    en: 'Winners will be announced by email.',
    vn: 'Người thắng sẽ được thông báo qua email.',
  },

  // ── The credit ──────────────────────────────────────────────────────────
  credit: { en: 'Auction by', vn: 'Đấu giá bởi' },

  // ── Emails ──────────────────────────────────────────────────────────────
  mail_confirm_subject: {
    en: 'Your bid — {title}',
    vn: 'Lượt đặt giá của bạn — {title}',
  },
  mail_confirm_lead: {
    en: 'Thank you. Your bid has been recorded.',
    vn: 'Cảm ơn bạn. Lượt đặt giá của bạn đã được ghi nhận.',
  },
  mail_confirm_terms: {
    en: 'A bid is a commitment to buy at that price if it wins and meets the reserve.',
    vn: 'Đặt giá là cam kết mua tác phẩm ở mức giá đó nếu bạn thắng và đạt mức tối thiểu.',
  },
  mail_confirm_when: {
    en: 'Bidding closes at {time}. Everyone who bids will be emailed the result on {date}.',
    vn: 'Đấu giá đóng lúc {time}. Tất cả người tham gia sẽ nhận email kết quả vào {date}.',
  },
  mail_outbid_subject: {
    en: 'You have been outbid — {title}',
    vn: 'Đã có người đặt giá cao hơn — {title}',
  },
  mail_outbid_lead: {
    en: 'Someone has bid higher on a work you were leading.',
    vn: 'Đã có người đặt giá cao hơn cho tác phẩm bạn đang dẫn đầu.',
  },
  mail_outbid_cta: {
    en: 'See the work and bid again',
    vn: 'Xem tác phẩm và đặt lại',
  },
  mail_result_subject: {
    en: 'The result — {title}',
    vn: 'Kết quả — {title}',
  },
  mail_result_won: {
    en: 'You have won this work with a bid of {amount}. We will be in touch about payment and collection.',
    vn: 'Bạn đã thắng tác phẩm này với mức giá {amount}. Chúng tôi sẽ liên hệ về việc thanh toán và nhận tác phẩm.',
  },
  mail_result_lost_with_price: {
    en: 'This work has been won, at {amount}. Thank you for bidding.',
    vn: 'Tác phẩm này đã có người thắng, ở mức {amount}. Cảm ơn bạn đã tham gia.',
  },
  mail_result_lost_no_price: {
    en: 'This work has been won. Thank you for bidding.',
    vn: 'Tác phẩm này đã có người thắng. Cảm ơn bạn đã tham gia.',
  },
  mail_result_unsold: {
    en: 'This work did not meet its reserve and has not been sold. Thank you for bidding.',
    vn: 'Tác phẩm này chưa đạt mức tối thiểu nên không được bán. Cảm ơn bạn đã tham gia.',
  },
} as const

export type StringKey = keyof typeof AUCTION_STRINGS

/** Fill {tokens}. Anything unmatched is left alone rather than blanked. */
export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))

/** The one translator the auction uses. */
export const tr = (lang: Lang, key: StringKey, vars: Record<string, string | number> = {}): string =>
  fill(pickL(lang, AUCTION_STRINGS[key]), vars)

// ── The public shape, as studio_auction_public returns it ─────────────────
export interface PublicLot {
  lot_id: string
  piece_id: string
  kind: 'sale' | 'auction'
  status: 'live' | 'sold'
  price_usd: number | null
  price_note_en: string | null
  price_note_vn: string | null
  starting_bid_usd: number | null
  min_step_usd: number
  closes_at: string
  announce_at: string
  highest_usd: number | null
  bid_count: number
  reserve_met: boolean
  is_closed: boolean
  // Public by design — the donation share IS the commitment. Null until the
  // owner sets a figure, and the work keeps its existing sentence until then.
  donation_pct: number | null
  donation_org: string | null
}

/** What the next acceptable bid is. The server decides again; this is the hint. */
export const minNext = (l: PublicLot): number =>
  l.highest_usd == null ? (l.starting_bid_usd ?? 1) : l.highest_usd + l.min_step_usd
