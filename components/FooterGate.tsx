'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

// The public marketing footer doesn't belong inside the admin portal or
// kiosks — and when it does render there, its z-index collides with the
// fixed admin sidebar and covers the bottom of the nav. Gate it.
//
// /embassy is The Spirits Embassy, a different business with its own branding.
// The club's footer — "The Rampant Club. All rights reserved.", the
// membership email address — was rendering at the bottom of an Embassy page
// shown to Embassy buyers. Note that /tet is NOT hidden: that one IS a club
// page and the footer belongs on it.
const HIDDEN_PREFIXES = ['/admin', '/kiosk', '/embassy']

export default function FooterGate() {
  const pathname = usePathname() || ''
  if (HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return null
  return <Footer />
}
