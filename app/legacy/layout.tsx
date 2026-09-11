import type { Metadata } from 'next'

// ═══════════════════════════════════════════════════════════════════════════
// /legacy — the old membership page, kept as a reference, not as a page.
// ───────────────────────────────────────────────────────────────────────────
// It was /membership: an earlier landing page that duplicated the homepage and
// carried an "Apply for Membership" button — which contradicts the club's
// rule that membership is by invitation or referral only. The owner wants it
// kept to refer back to, so it lives here unlinked and out of search results.
// /membership itself now redirects to the homepage's Membership section
// (next.config.js), which is the current truth.
export const metadata: Metadata = {
  title: 'Legacy · The Rampant Club',
  robots: { index: false, follow: false },
}

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
