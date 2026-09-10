// ═══════════════════════════════════════════════════════════════════════════
// ADMIN-FACING NAMES — one place, so they cannot drift apart.
// ───────────────────────────────────────────────────────────────────────────
// The same problem lib/members/surfaces.ts was written for, caught mid-flight
// this time. /admin/shifts was already called three things before anyone used
// it: "Weekly Shifts" in the nav, "Your shift" as the page heading, and
// "Shifts" on every back-link. None was wrong when it was typed. That is what
// makes it structural rather than careless.
//
// A heading may be richer than a nav item — that is fine. Two places disagreeing
// about what the thing IS CALLED is not.
export interface SurfaceName { en: string; vn: string }

export const ADMIN_SURFACE: Record<string, SurfaceName> = {
  '/admin/shifts':           { en: 'Day Shifts',    vn: 'Ca Trong Ngày' },
  '/admin/shifts/review':    { en: 'Monday Review', vn: 'Rà Soát Thứ Hai' },
  '/admin/shifts/templates': { en: 'Templates',     vn: 'Mẫu Công Việc' },
  '/admin/shifts/prospects': { en: 'Prospects',     vn: 'Đề Cử' },
}

export const adminName = (path: string, lang: string) => {
  const s = ADMIN_SURFACE[path]
  if (!s) return path
  return lang === 'vn' ? s.vn : s.en
}
