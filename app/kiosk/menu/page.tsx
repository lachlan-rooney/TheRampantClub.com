'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'
import MenuBoard from '@/components/menus/MenuBoard'
import { price, type MenuVenueGroup } from '@/lib/menus/types'

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

interface OrderLine {
  id: string; venue_name: string; name_en: string; name_vn: string | null
  unit_price_vnd: number; qty: number; line_total_vnd: number
}
interface Order {
  id: string; room: string; status: 'pending' | 'ordered'
  total_vnd: number; created_at: string; ordered_at: string | null
  lines: OrderLine[]
}

export default function KioskMenuPage() {
  const { t, lang } = useLang()
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

      {/* ── WHAT THE ROOM HAS ASKED FOR ──────────────────────────────────
          Sits at the foot of the menu where it was built, on the owner's
          decision. The cost, accepted openly: anyone standing at the tablet
          can clear it. That is survivable precisely because nothing is
          charged — clearing loses a request, not money. If it becomes a
          nuisance in service, this block moves behind the Staff PIN and
          nothing else changes. */}
      {order && (
        <section className={`km-order ${order.status === 'ordered' ? 'is-placed' : ''}`}>
          <div className="km-order-head">
            <span className="km-order-when">
              {order.status === 'ordered'
                ? t('Placed with the kitchen', 'Đã chuyển cho nhà bếp')
                : t('Waiting for the team', 'Đang chờ nhân viên')}
            </span>
            <span className="km-order-total">{price(order.total_vnd)}</span>
          </div>

          <ul className="km-order-lines">
            {order.lines.map(li => (
              <li key={li.id}>
                <span className="km-qty">{li.qty}</span>
                <span className="km-what">
                  {lang === 'vn' ? (li.name_vn || li.name_en) : li.name_en}
                  <span className="km-from">{li.venue_name}</span>
                </span>
                <span className="km-line-total">{price(li.line_total_vnd)}</span>
              </li>
            ))}
          </ul>

          <div className="km-order-acts">
            {order.status === 'pending' && (
              <button className="km-act is-go" disabled={busy} onClick={() => send('PATCH')}>
                {t('I have ordered this', 'Tôi đã đặt món này')}
              </button>
            )}
            <button className="km-act" disabled={busy} onClick={() => send('DELETE')}>
              {t('Clear', 'Xoá')}
            </button>
            <span className="km-staffnote">
              {t('For the team. Nothing here is charged.', 'Dành cho nhân viên. Không có khoản thanh toán nào.')}
            </span>
          </div>
        </section>
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

.km-order { margin-top: 44px; border: 1px solid rgba(212,184,90,.45);
            border-radius: 3px; padding: 22px 24px; max-width: 920px; }
.km-order.is-placed { border-color: rgba(176,193,142,.5); }
.km-order-head { display: flex; justify-content: space-between; align-items: baseline;
                 gap: 16px; padding-bottom: 14px; border-bottom: 1px solid rgba(229,212,194,.14); }
.km-order-when { font-family: ${MONO}; font-size: 12px; letter-spacing: .18em;
                 text-transform: uppercase; color: #D4B85A; }
.km-order.is-placed .km-order-when { color: #B0C18E; }
.km-order-total { font-family: ${MONO}; font-size: 20px; }

.km-order-lines { list-style: none; margin: 14px 0 0; padding: 0; }
.km-order-lines li { display: flex; align-items: baseline; gap: 18px; padding: 9px 0; }
.km-qty { font-family: ${MONO}; font-size: 19px; color: #D4B85A; min-width: 34px; }
.km-what { flex: 1; font-family: ${MONO}; font-size: 18px; line-height: 1.4; }
.km-from { display: block; font-size: 11px; letter-spacing: .12em;
           text-transform: uppercase; opacity: .45; margin-top: 3px; }
.km-line-total { font-family: ${MONO}; font-size: 16px; opacity: .7; white-space: nowrap; }

.km-order-acts { display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
                 margin-top: 20px; padding-top: 18px;
                 border-top: 1px solid rgba(229,212,194,.14); }
.km-act { background: none; border: 1px solid rgba(229,212,194,.28); border-radius: 2px;
          color: #E5D4C2; font-family: ${MONO}; font-size: 13px; letter-spacing: .1em;
          text-transform: uppercase; padding: 14px 22px; cursor: pointer;
          -webkit-tap-highlight-color: transparent; }
.km-act.is-go { background: #B0C18E; border-color: #B0C18E; color: #052E20; }
.km-act:disabled { opacity: .45; cursor: default; }
.km-staffnote { font-family: ${MONO}; font-size: 11px; opacity: .42; }
`
