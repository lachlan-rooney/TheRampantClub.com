import type { Metadata, Viewport } from 'next'

// The gated kiosk-staff shell: a fullscreen, tightly-scoped surface. Its own
// manifest (scope /kiosk/staff, display fullscreen) so an installed Android PWA
// launches straight here with no browser chrome and no link-out to /admin or
// /members. The middleware gates every route under this on the device session.

export const metadata: Metadata = {
  title: 'Rampant Kiosk',
  manifest: '/kiosk-manifest.json',
}
export const viewport: Viewport = {
  themeColor: '#052E20',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function KioskStaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#052E20', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
