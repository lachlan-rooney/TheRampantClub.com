'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'
import MenuBoard from '@/components/menus/MenuBoard'
import OrderPanel, { type Order } from '@/components/menus/OrderPanel'
import { type MenuVenueGroup } from '@/lib/menus/types'

// THE MENU ON THE ROOM TABLET.
//
// Same board as the members' portal at kiosk scale, plus the one thing the
// portal does not get: a member can build an order here with +/- and confirm
// it. Nothing is charged and no payment exists — the owner's reason was
// "so the staff member doesn't mess up the order and has it confirmed with the
// member". A wrong order is the failure; an unpaid one is not a thing.
//
// The bar owns Home, so this page has no back button of its own.
//
// ── IDLE ───────────────────────────────────────────────────────────────────
// It returns to the board after four minutes untouched, rather than the
// finder's ninety seconds: reading a menu involves long pauses while people
// talk about it, and a screen that resets mid-conversation is one people stop
// picking up.
//
// BUT NOT WHILE AN ORDER IS WAITING. Bouncing to the board with a confirmed
// order still on the table would hide the only thing the staff member needs to
// see. The timer is suspended while an order is open.

const IDLE_MS = 4 * 60 * 1000

export default function KioskMenuPage() {
  const { t } = useLang()
  const router = useRouter()
  const [venues, setVenues] = useState<MenuVenueGroup[] | null>(null)
  const [printed, setPrinted] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
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
    // Whatever this room already has open — a tablet that reloads mid-service
    // must not forget an order somebody is waiting on.
    fetch('/api/kiosk/orders', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j) setOrder(j.order ?? null) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (order) { if (idle.current) clearTimeout(idle.current); return }
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
  }, [router, order])

  const send = useCallback(async (method: string, body?: unknown) => {
    setBusy(true)
    try {
      const r = await fetch('/api/kiosk/orders', {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'That did not send.'); return }
      setErr('')
      setOrder(j.order ?? null)
    } catch {
      setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.'))
    } finally { setBusy(false) }
  }, [t])

  return (
    <main className="km">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {err && <p className="km-msg">{err}</p>}
      {!err && venues === null && <p className="km-msg">{t('Loading…', 'Đang tải…')}</p>}
      {venues !== null && (
        <MenuBoard
          venues={venues} variant="kiosk" masthead
          ordering
          orderOpen={!!order}
          confirmBusy={busy}
          onConfirm={lines => send('POST', { lines })}
        />
      )}

      {/* The panel lives in components/menus/OrderPanel — see the note at the
          top of that file for why the call-a-server instruction leads it. */}
      {order && (
        <OrderPanel order={order} busy={busy}
                    onPlaced={() => send('PATCH')} onClear={() => send('DELETE')} />
      )}

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

const MONO = "'Google Sans Code', monospace"
const CSS = `
.km { min-height: 100dvh; background: #052E20; color: #E5D4C2;
      padding: 40px clamp(24px, 5vw, 64px) calc(56px + var(--kiosk-bar, 0px)); }
/* The page heading lives in MenuBoard's masthead — the crest and wordmark off
   the printed card — so this page draws no title and does not say the club's
   name twice. */
.km-msg { font-family: ${MONO}; font-size: 15px; opacity: .6; padding: 60px 0; }
.km-printed { display: inline-block; margin-top: 36px; font-family: ${MONO};
              font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
              color: rgba(229,212,194,.6); text-decoration: none;
              border-bottom: 1px solid rgba(229,212,194,.3); padding-bottom: 4px; }

`
