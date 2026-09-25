'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import MenuBoard from '@/components/menus/MenuBoard'
import OrderPanel, { type Order, type OrderLine } from '@/components/menus/OrderPanel'
import { charges } from '@/lib/menus/orders'
import { type MenuVenueGroup } from '@/lib/menus/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE SHOWCASE TABLET — the real board, an imaginary tray.
// ───────────────────────────────────────────────────────────────────────────
// Everything above the tray is the live club: the same menus, the same
// prices, the same opening hours and last-orders countdown the rooms get,
// read through the same view that keeps cost prices on the server.
//
// The tray is the one thing that is not real. A room tablet posts to
// /api/kiosk/orders and a staff board lights up; here the order is assembled
// IN THE BROWSER, with the club's own arithmetic (lib/menus/orders, the same
// 10% service and 10% VAT), and it goes nowhere. There is no endpoint to call
// and no device to call it with, which is a stronger guarantee than a flag.
//
// It says so, at the top, the whole time. A demonstration that can be mistaken
// for the real thing is a demonstration that eventually sends somebody a
// sandwich.
// ═══════════════════════════════════════════════════════════════════════════

export default function ShowcaseKiosk() {
  const { t } = useLang()
  const [venues, setVenues] = useState<MenuVenueGroup[] | null>(null)
  const [serverNow, setServerNow] = useState<string | undefined>()
  const [err, setErr] = useState('')
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    fetch('/api/showcase/menus', { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'failed')
        return j
      })
      .then(j => { setVenues(j.venues || []); setServerNow(j.now) })
      .catch(e => setErr(String(e?.message || e)))
  }, [])

  // The tray, worked out here. Same charges() the server uses, so the
  // breakdown a visitor sees is the breakdown a member would be shown.
  const confirm = useCallback((lines: { item_id: string; qty: number }[], note?: string) => {
    const all = (venues || []).flatMap(v => v.plates.map(p => ({ ...p, venue_name: v.name })))
    const rows: OrderLine[] = lines.map((l, i) => {
      const item = all.find(p => p.id === l.item_id)
      const unit = Number(item?.price_vnd) || 0
      return {
        id: `showcase-${i}`,
        item_id: l.item_id,
        venue_name: item?.venue_name ?? '',
        name_en: item?.name_en ?? '',
        name_vn: item?.name_vn ?? null,
        unit_price_vnd: unit,
        qty: l.qty,
        line_total_vnd: unit * l.qty,
      }
    })
    const subtotal = rows.reduce((s, r) => s + r.line_total_vnd, 0)
    const c = charges(subtotal)
    setOrder({
      id: 'showcase', room: t('Showcase', 'Bản trình bày'), status: 'pending',
      subtotal_vnd: c.subtotal,
      service_pct: c.servicePct, service_vnd: c.service,
      vat_pct: c.vatPct, vat_vnd: c.vat,
      total_vnd: c.total,
      note: note || null,
      created_at: new Date().toISOString(), ordered_at: null,
      lines: rows,
    })
  }, [venues, t])

  return (
    <main className="sk">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="sk-band" role="note">
        <span className="sk-dot" aria-hidden />
        <strong>{t('Showcase', 'Bản trình bày')}</strong>
        <span>
          {t('This is a demonstration of the tablet in the club’s rooms. The menus, prices and opening hours are live; nothing ordered here reaches the kitchen.',
             'Đây là bản trình bày của máy tính bảng trong các phòng của câu lạc bộ. Thực đơn, giá và giờ mở cửa là thật; món đặt ở đây không được gửi tới bếp.')}
        </span>
      </div>

      {err && <p className="sk-msg">{err}</p>}
      {!err && venues === null && <p className="sk-msg">{t('Loading…', 'Đang tải…')}</p>}
      {venues !== null && (
        <MenuBoard
          venues={venues} variant="kiosk" masthead
          now={serverNow}
          ordering
          orderOpen={!!order}
          onConfirm={confirm}
        />
      )}

      {order && (
        <OrderPanel
          order={order}
          onClear={() => setOrder(null)}
          onRemove={line => setOrder(o => {
            if (!o) return o
            const lines = o.lines.filter(l => l.id !== line.id)
            if (!lines.length) return null
            const c = charges(lines.reduce((s, l) => s + l.line_total_vnd, 0))
            return { ...o, lines, subtotal_vnd: c.subtotal, service_vnd: c.service, vat_vnd: c.vat, total_vnd: c.total }
          })}
          onNote={note => setOrder(o => (o ? { ...o, note } : o))}
          // THE ONE BUTTON THAT DOES NOTHING. On a real tablet this tells the
          // floor a member is waiting; here it marks the tray as it would look
          // once staff had it, and stops.
          onPlaced={() => setOrder(o => (o ? { ...o, status: 'ordered', ordered_at: new Date().toISOString() } : o))}
        />
      )}
    </main>
  )
}

const CSS = `
/* THE GUTTER THE REAL TABLET HAS (owner, 2026-09-25: "The text is honestly
   right up agains the left edge of the page on the desktop view sandboed
   Kiosk"). MenuBoard draws no margin of its own — it is a card, and the page
   it sits on gives it its edges. /kiosk/menu does that; this page never did,
   so on a laptop the menu started at x=0 with the club's name in the gutter.
   Same padding as the room tablet, and on a desk the card is CENTRED: a
   900px board pinned to the left of a 1600px window reads as a broken
   layout, where in the middle it reads as what it is — a tablet screen. */
.sk { min-height: 100dvh; background: #052E20;
      padding: 40px clamp(20px, 5vw, 64px) 72px; }
.sk .mb-inner { margin-left: auto; margin-right: auto; }
.sk .sk-band { margin: -40px clamp(-64px, -5vw, -20px) 34px; }
@media (max-width: 640px) { .sk { padding: 28px 20px 56px; } .sk .sk-band { margin: -28px -20px 24px; } }
.sk-band {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  padding: 10px clamp(20px, 5vw, 64px); background: #D4B85A; color: #052E20;
  font-family: 'Google Sans Code', monospace; font-size: 12px; line-height: 1.6;
  position: sticky; top: 0; z-index: 90;
}
.sk-band strong { letter-spacing: .16em; text-transform: uppercase; font-size: 11px; }
.sk-dot { width: 7px; height: 7px; border-radius: 50%; background: #052E20; align-self: center; }
.sk-msg {
  color: #E5D4C2; font-family: 'Google Sans Code', monospace; font-size: 13px;
  padding: 28px 20px; opacity: .8;
}
@media (max-width: 640px) { .sk-band { font-size: 11.5px; padding: 9px 20px; } }
`
