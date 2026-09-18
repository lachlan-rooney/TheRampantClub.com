'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'
import MenuBoard from '@/components/menus/MenuBoard'
import type { MenuVenueGroup } from '@/lib/menus/types'

// THE MENU ON THE ROOM TABLET.
//
// Same board as the members' portal at kiosk scale. The bar owns Home, so this
// page has no back button of its own — the same rule as the Flavour Finder.
//
// It returns to the board after four minutes of nobody touching it, rather than
// the finder's ninety seconds: reading a menu legitimately involves long pauses
// while people talk about it, and a screen that resets mid-conversation is a
// screen people stop picking up.

const IDLE_MS = 4 * 60 * 1000

export default function KioskMenuPage() {
  const { t } = useLang()
  const router = useRouter()
  const [venues, setVenues] = useState<MenuVenueGroup[] | null>(null)
  const [printed, setPrinted] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/kiosk/menus', { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'failed')
        return j
      })
      .then(j => { setVenues(j.venues || []); setPrinted(j.printed || null) })
      .catch(e => setErr(String(e?.message || e)))
  }, [])

  useEffect(() => {
    const bump = () => {
      if (idle.current) clearTimeout(idle.current)
      idle.current = setTimeout(() => router.replace('/kiosk/board'), IDLE_MS)
    }
    bump()
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll']
    evs.forEach(e => window.addEventListener(e, bump, { passive: true }))
    return () => {
      evs.forEach(e => window.removeEventListener(e, bump))
      if (idle.current) clearTimeout(idle.current)
    }
  }, [router])

  return (
    <main className="km">
      <style dangerouslySetInnerHTML={{ __html: `
        .km { min-height: 100dvh; background: #052E20; color: #E5D4C2;
              padding: 40px clamp(24px, 5vw, 64px)
                       calc(56px + var(--kiosk-bar, 0px)); }
        .km-head { font-family: 'Rampant Sans', Georgia, serif;
                   font-size: clamp(34px, 5vw, 52px); margin: 0 0 6px; font-weight: 500; }
        .km-sub { font-family: 'Google Sans Code', monospace; font-size: 12px;
                  letter-spacing: .2em; text-transform: uppercase;
                  color: #D4B85A; margin-bottom: 34px; }
        .km-msg { font-family: 'Google Sans Code', monospace; font-size: 15px;
                  opacity: .6; padding: 60px 0; }
        .km-printed { display: inline-block; margin-top: 36px;
                      font-family: 'Google Sans Code', monospace; font-size: 12px;
                      letter-spacing: .14em; text-transform: uppercase;
                      color: rgba(229,212,194,.6); text-decoration: none;
                      border-bottom: 1px solid rgba(229,212,194,.3); padding-bottom: 4px; }
      ` }} />

      <div className="km-sub">{t('The Rampant Club', 'The Rampant Club')}</div>
      <h1 className="km-head">{t('Menus', 'Thực đơn')}</h1>

      {err && <p className="km-msg">{t('The menu could not be loaded. Please ask a member of the team.',
                                        'Không tải được thực đơn. Vui lòng hỏi nhân viên.')}</p>}
      {!err && venues === null && <p className="km-msg">{t('Loading…', 'Đang tải…')}</p>}
      {!err && venues !== null && <MenuBoard venues={venues} variant="kiosk" />}

      {/* The room's printed menu, kept but demoted. It opens in a new tab, which
          is why it is not in the bar any more. */}
      {printed && (
        <a href={printed} target="_blank" rel="noopener noreferrer" className="km-printed">
          {t('This room’s printed menu', 'Thực đơn in của phòng này')} ↗
        </a>
      )}
    </main>
  )
}
