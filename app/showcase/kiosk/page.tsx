import { cookies } from 'next/headers'
import { SHOWCASE_COOKIE, verifyShowcasePass } from '@/lib/showcase/gate'
import ShowcaseKiosk from './ShowcaseKiosk'

// ═══════════════════════════════════════════════════════════════════════════
// THE ROOM TABLET, AS A DEMONSTRATION.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: a link to send someone so they can see how the kiosk
// works — "a showcase version and not a real kiosk".
//
// THE DOOR is the route handler beside this file: the link carries ?k=<pass>
// to /showcase/kiosk/enter, which checks it, drops it in an httpOnly cookie
// and sends the visitor here with a clean URL — a page cannot set a cookie in
// Next, and a pass left in the address bar travels in screenshots. This page
// only READS the cookie. Without a valid one there is no page: it is not a
// public menu.
//
// WHAT IT IS NOT. It is not a kiosk. There is no device token, no room, no
// floor board behind it, and no route it could send an order to — the tray
// below is answered in the browser. Nothing here reaches the kitchen, and the
// four real tablets are untouched by it.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Showcase · The Rampant Club',
  robots: { index: false, follow: false },
}

export default async function ShowcaseKioskPage() {
  const jar = await cookies()
  if (!verifyShowcasePass(jar.get(SHOWCASE_COOKIE)?.value)) {
    return (
      <main style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center',
        background: '#052E20', color: '#E5D4C2', padding: 24, textAlign: 'center',
        fontFamily: "'Google Sans Code', monospace", fontSize: 13, lineHeight: 1.8,
      }}>
        <div>
          <p style={{ letterSpacing: '.14em', textTransform: 'uppercase', opacity: .6 }}>The Rampant Club</p>
          <p style={{ marginTop: 12 }}>This showcase opens from its own link, and that link has run out.</p>
        </div>
      </main>
    )
  }
  return <ShowcaseKiosk />
}
