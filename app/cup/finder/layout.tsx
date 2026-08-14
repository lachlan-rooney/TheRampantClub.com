import type { Viewport } from 'next'

// Tablet/kiosk viewport for the event finder — device-width, no pinch-zoom, so it
// sits cleanly full-screen on an iPad or Samsung on the night.
export const viewport: Viewport = {
  themeColor: '#052E20',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function CupFinderLayout({ children }: { children: React.ReactNode }) {
  return children
}
