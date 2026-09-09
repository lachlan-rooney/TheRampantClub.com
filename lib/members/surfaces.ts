// ═══════════════════════════════════════════════════════════════════════════
// MEMBER-FACING NAMES — one place, so they cannot drift apart again.
// ───────────────────────────────────────────────────────────────────────────
// /members/events was, at one point, called four different things: "What's On"
// on the page and the dashboard group, "Events & Fixtures" in the nav and on the
// dashboard tile, and again in the portal guide. None of them was wrong when it
// was typed. That is what makes it a structural problem rather than a careless
// one — a name typed wherever it is needed will drift, and nobody notices because
// each site looks right on its own.
//
// Anything a member READS as the name of a surface belongs here. Page headings may
// still be richer than the nav name ("The Whisky Library" against "Whisky
// Library"), and that is fine — a heading has room a nav item does not. What is
// not fine is two places disagreeing about what the thing is called.
export interface SurfaceName { en: string; vn: string }

export const SURFACE: Record<string, SurfaceName> = {
  '/members/events':         { en: "What's On",      vn: 'Sự Kiện & Thi Đấu' },
  '/members/gallery':        { en: 'Event Gallery',  vn: 'Thư Viện Sự Kiện' },
  // TODO (Miss Châu): the Vietnamese for the notice board is unsettled — the page
  // has said 'Bảng Thông Báo' and the nav 'Bảng Tin'. Taking the fuller form for
  // now because the admin matches it. Settling it is one line HERE, which is the
  // point of this file: before it, it was four files.
  '/members/notices':        { en: 'Notice Board',   vn: 'Bảng Thông Báo' },
  '/members/spaces':         { en: 'Our Spaces',     vn: 'Không gian' },
  '/menus':                  { en: 'The Menus',      vn: 'Thực Đơn' },
  '/members/snug':           { en: 'The Snug',       vn: 'Phòng Khách' },
  '/members/concierge':      { en: 'The Concierge',  vn: 'Quản Gia' },
  '/members/whisky':         { en: 'Whisky Library', vn: 'Thư Viện Whisky' },
  '/members/whisky/finder':  { en: 'Flavour Finder', vn: 'Tìm Ly Của Bạn' },
  '/members/taste':          { en: 'Your Palate',    vn: 'Khẩu Vị Của Bạn' },
  '/members/notes':          { en: 'Your Notes',     vn: 'Nhật Ký Nếm Thử' },
  '/members/journey':        { en: 'Your Journey',   vn: 'Hành Trình Của Bạn' },
  '/members/members':        { en: 'The Members',    vn: 'Thành Viên' },
  '/members/introductions':  { en: 'Introductions',  vn: 'Lời Giới Thiệu' },
  '/members/messages':       { en: 'Messages',       vn: 'Tin Nhắn' },
  '/members/profile':        { en: 'My Membership',  vn: 'Tư Cách Thành Viên' },
  '/members/calendar':       { en: 'My Calendar',    vn: 'Lịch Của Bạn' },
  '/members/visits':         { en: 'Your Visits',    vn: 'Những Lần Ghé Thăm' },
  '/members/rules':          { en: 'House Rules',    vn: 'Nội Quy' },
  '/members/terms':          { en: 'Terms',          vn: 'Điều Khoản' },
  '/members/contact':        { en: 'Contact',        vn: 'Liên hệ' },
  '/members/agree':          { en: 'Your Documents', vn: 'Tài Liệu Của Bạn' },
  // Surfaces that are curated out of the nav but still tiled or linked. They live
  // here for the same reason as the rest: a name with no entry renders BLANK, which
  // is how a tidy refactor quietly empties a label.
  '/members/fixtures':       { en: 'Sports Fixtures',        vn: 'Lịch Thi Đấu' },
  '/members/journal':        { en: "Cellarmaster's Journal", vn: 'Nhật Ký Cellarmaster' },
  '/members/gifts':          { en: 'Gifts',                  vn: 'Quà Tặng' },
}

/** The name of a surface, by href. Falls back to the English so a missing entry
 *  shows a name rather than an empty label. */
export const surfaceName = (href: string, lang: 'en' | 'vn' = 'en'): string => {
  const s = SURFACE[href]
  return s ? (lang === 'vn' ? s.vn || s.en : s.en) : ''
}
