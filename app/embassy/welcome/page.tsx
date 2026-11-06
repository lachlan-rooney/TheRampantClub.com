import type { Metadata } from 'next'
import EmbassyWelcome from '@/components/embassy/EmbassyWelcome'

// WHERE THE QR CODE LANDS.
//
// A guest at the Tết event scans the code on the tablet, leaves their name and
// email, and the cask board opens on their own phone. The form is the key:
// there is no password, nothing to be told, and nothing to mistype.
//
// Deliberately NOT gated. This page must open for anyone who scans, on any
// phone, first time, every time — it is the front door of the whole flow.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tết Đinh Mùi 2027 · The Spirits Embassy',
  description: 'Single casks from Duncan Taylor for Tết 2027.',
  robots: { index: false, follow: false },
}

export const viewport = { themeColor: '#151d2a' }

export default function EmbassyWelcomePage() {
  return <EmbassyWelcome />
}
