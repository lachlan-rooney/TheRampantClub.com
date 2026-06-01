'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

// The public marketing footer doesn't belong inside the admin portal or
// kiosks — and when it does render there, its z-index collides with the
// fixed admin sidebar and covers the bottom of the nav. Gate it.
const HIDDEN_PREFIXES = ['/admin', '/kiosk']

export default function FooterGate() {
  const pathname = usePathname() || ''
  if (HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return null
  return <Footer />
}
