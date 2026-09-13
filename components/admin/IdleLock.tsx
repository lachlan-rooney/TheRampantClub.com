'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// ═══════════════════════════════════════════════════════════════════════════
// THE ADMIN PORTAL LOCKS ITSELF.
// ───────────────────────────────────────────────────────────────────────────
// The kiosk has always dropped its staff session after a few idle minutes. The
// admin portal — which holds every member's address, spend, visits and
// documents — had nothing at all: a laptop left open on the bar, or a lid
// closed and reopened tomorrow, was still signed in as an admin.
//
// TWO CLOCKS, because they are two different risks:
//
//   IDLE (5 minutes)  Nobody has touched it. A warning appears at 4:30 with a
//                     countdown and a button, so nobody loses a half-typed
//                     note to a silent logout — the warning is the difference
//                     between a security feature and an infuriating one.
//
//   AWAY (5 minutes)  The page was hidden — the lid closed, the tab left —
//                     and by the time it comes back, more than five minutes
//                     have passed. There is no warning for this one: the
//                     person was not there to see it, and the right thing on
//                     returning to a laptop is a locked screen.
//
// Signing out is the real thing: supabase.auth.signOut() clears the session,
// then a FULL navigation so the server re-reads the cleared cookies. A
// router.push would keep Next's cache and leave the portal looking signed in.
//
// Deliberately not applied to the MEMBER portal. A member reading the whisky
// library on their own phone is not a shared-device risk, and being thrown out
// mid-page would be its own insult. This is staff surfaces only.

const IDLE_MS = 5 * 60_000
const WARN_MS = 30_000          // the last 30 seconds are spent warning
const AWAY_MS = 5 * 60_000

export default function IdleLock() {
  const [warning, setWarning] = useState(false)
  const [left, setLeft] = useState(Math.floor(WARN_MS / 1000))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const hiddenAt = useRef<number | null>(null)
  const goneRef = useRef(false)
  // The warning state, ALSO in a ref. The effect below must not depend on the
  // state: when the warning appeared, the re-render re-ran the effect, which
  // re-armed the timer and cleared the warning — a loop that fired every three
  // seconds and never locked anything. The listener needs to READ the flag, not
  // to be rebuilt when it changes.
  const warningRef = useRef(false)

  const lock = useCallback(async (why: 'idle' | 'away') => {
    if (goneRef.current) return
    goneRef.current = true
    try { await createBrowserSupabaseClient().auth.signOut() } catch { /* sign out locally anyway */ }
    window.location.href = `/login?locked=${why}`
  }, [])

  const clearAll = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (warnTimer.current) { clearInterval(warnTimer.current); warnTimer.current = null }
  }

  const arm = useCallback(() => {
    clearAll()
    warningRef.current = false
    setWarning(false)
    setLeft(Math.floor(WARN_MS / 1000))
    timer.current = setTimeout(() => {
      warningRef.current = true
      setWarning(true)
      let remaining = Math.floor(WARN_MS / 1000)
      warnTimer.current = setInterval(() => {
        remaining -= 1
        setLeft(remaining)
        if (remaining <= 0) { clearAll(); lock('idle') }
      }, 1000)
    }, IDLE_MS - WARN_MS)
  }, [lock])

  useEffect(() => {
    arm()
    // Activity, but NOT while the warning is up: the warning must be dismissed
    // deliberately. Otherwise a stray scroll from a closing lid cancels it.
    const onActivity = () => { if (!warningRef.current) arm() }
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel']
    evs.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
      } else {
        const gone = hiddenAt.current ? Date.now() - hiddenAt.current : 0
        hiddenAt.current = null
        if (gone >= AWAY_MS) lock('away')
        else arm()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearAll()
      evs.forEach(e => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [arm, lock])

  // A marker while it is armed but silent. It renders nothing visible; it
  // exists so a test — and a person with the inspector open — can tell the
  // difference between "the lock is watching" and "the lock never mounted".
  if (!warning) return <span data-idle-lock="armed" hidden />

  return (
    <div role="alertdialog" aria-live="assertive" style={{
      position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(3,20,14,.86)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: 'min(420px, 92vw)', background: '#052E20', color: '#E5D4C2',
        border: '1px solid rgba(229,212,194,.16)', borderRadius: 4, padding: '30px 30px 26px',
      }}>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, lineHeight: 1.05 }}>
          Still there?
        </div>
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 13, lineHeight: 1.9, opacity: .85, margin: '14px 0 22px' }}>
          The portal locks in {left} second{left === 1 ? '' : 's'}. It holds members&rsquo; details,
          so it does not stay open unattended.
        </p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <button onClick={arm} style={{
            background: 'none', border: 'none', borderBottom: '1px solid #D4B85A', color: '#D4B85A',
            padding: '0 0 6px', cursor: 'pointer',
            fontFamily: "'Google Sans Code', monospace", fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase',
          }}>I&rsquo;m here</button>
          <button onClick={() => lock('idle')} style={{
            background: 'none', border: 'none', borderBottom: '1px solid rgba(229,212,194,.4)', color: '#E5D4C2',
            padding: '0 0 6px', cursor: 'pointer', opacity: .8,
            fontFamily: "'Google Sans Code', monospace", fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase',
          }}>Lock now</button>
        </div>
      </div>
    </div>
  )
}
