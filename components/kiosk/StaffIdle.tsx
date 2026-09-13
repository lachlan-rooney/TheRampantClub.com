'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// ═══════════════════════════════════════════════════════════════════════════
// THE ACTING STAFF SESSION DROPS ITSELF, ON EVERY KIOSK PAGE.
// ───────────────────────────────────────────────────────────────────────────
// /kiosk/staff has always logged the acting staff member out after three idle
// minutes — but that timer lived in that page's component, so it only ran
// while that page was open. Tap a name, enter a PIN, then walk to the board or
// a floor screen and leave the tablet: the attribution cookie survived twelve
// hours, and the next person to pick the tablet up was still "acting" as whoever
// signed in before them.
//
// The timer belongs to the KIOSK, not to one screen. Mounted in the kiosk
// layout, it covers the board, the floors, the member surface and the staff
// page alike.
//
// It logs out the STAFF attribution only — never the device pairing (which is
// what makes the tablet a kiosk at all) and never the member session (which has
// its own, shorter clock, enforced in Postgres).
//
// Three minutes, not five: this is a tablet on a bar, which is a different risk
// from a laptop in an office, and three is what the staff screen has always
// used. Moving it to five would have loosened a rule while claiming to tighten
// one.

const IDLE_MS = 180_000

export default function StaffIdle() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const pathname = usePathname() || ''

  const logout = useCallback(async () => {
    try {
      // Ask first: no staff cookie means there is nothing to drop, and a POST
      // on every idle tablet in the building all night is noise.
      const me = await fetch('/api/kiosk/staff/me').then(r => r.ok ? r.json() : null).catch(() => null)
      if (!me?.staff) return
      await fetch('/api/kiosk/staff/logout', { method: 'POST' })
      // Back to the PIN. The staff page shows the picker when nobody is acting.
      if (pathname.startsWith('/kiosk/staff')) router.refresh()
    } catch { /* the cookie's own maxAge is the backstop */ }
  }, [pathname, router])

  useEffect(() => {
    // The pairing screen has no session to drop, and the member surface runs
    // its own clock — leave both alone.
    if (pathname.startsWith('/kiosk/pair') || pathname.startsWith('/kiosk/member')) return
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(logout, IDLE_MS)
    }
    reset()
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel']
    evs.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => {
      if (timer.current) clearTimeout(timer.current)
      evs.forEach(e => window.removeEventListener(e, reset))
    }
  }, [logout, pathname])

  return null
}
