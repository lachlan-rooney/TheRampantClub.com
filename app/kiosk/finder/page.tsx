'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import TouchFinder from '@/components/whisky/TouchFinder'

// THE FLAVOUR FINDER ON A FLOOR TABLET (2026-09-15) — opened from the board.
// The same public finder as /cup/finder: no sign-in, nothing member-specific, so
// nothing here can be left behind for the next person. Device-gated in middleware
// like the board, so it only opens on a paired room tablet.
//
// It must always find its way home: a bolted-down tablet has no address bar, so
// there is a plain button back, and an untouched finder returns to the board on
// its own rather than sitting on someone's half-set compass all evening.

const IDLE_MS = 90_000

export default function KioskFinder() {
  const router = useRouter()
  const last = useRef(Date.now())
  const home = useCallback(() => router.replace('/kiosk/board'), [router])

  useEffect(() => {
    const mark = () => { last.current = Date.now() }
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'touchmove', 'scroll', 'wheel', 'keydown']
    evs.forEach(e => window.addEventListener(e, mark, { passive: true }))
    const beat = setInterval(() => { if (Date.now() - last.current > IDLE_MS) home() }, 5_000)
    return () => { evs.forEach(e => window.removeEventListener(e, mark)); clearInterval(beat) }
  }, [home])

  return (
    <>
      {/* The finder SCROLLS, so it reserves the bar's height at the foot rather
          than subtracting it from a fixed height as the board does. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .cf-foot { padding-bottom: calc(72px + var(--kiosk-bar, 0px)); }
      ` }} />
      {/* Home is the bottom bar's (components/kiosk/KioskBar) — one way back on
          every screen, not a second button competing with it here. */}
      <TouchFinder eyebrow="The Rampant Club" />
    </>
  )
}
