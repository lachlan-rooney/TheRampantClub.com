'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import { price } from '@/lib/menus/types'
import type { OrderRow } from '@/lib/menus/orders'

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE ROOMS HAVE ASKED FOR — one list, on three screens.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-23: staff tablet (behind the PIN), the door tablet, and an
// admin page for managers. The same component on all three, because a server
// and a manager looking at the same order and seeing different things is how
// a dish goes missing.
//
// WHAT IT IS FOR. An order written on a room tablet used to be visible only on
// that tablet. Now it is on the floor's screen the moment it is confirmed, so
// whoever answers the table button walks in already knowing what was asked
// for. The TABLE BUTTON IS STILL THE CALL (owner's decision, same day) — this
// list never rings, never flashes, and is not a pager. It is a list.
//
// ORDERED BY HOW LONG THEY HAVE WAITED, oldest first, with the wait in
// minutes on the row. A list sorted by room tells you where things are; a list
// sorted by waiting tells you where to go. The wait counts up on its own every
// half minute, and a pending order that has sat for a quarter of an hour wears
// it in amber — noticed, not alarming.
//
// Placed orders stay on the list until they are cleared, so a room's order is
// still readable while the food is coming.
// ═══════════════════════════════════════════════════════════════════════════

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const GOLD = '#D4B85A'
const SAGE = '#B0C18E'
const AMBER = '#C49555'
/** After this long unplaced, a pending order says so in amber. */
const NAGGING_MIN = 15

export type OrdersSource = 'kiosk' | 'admin'

export default function OpenOrders({ source, poll = 15_000, heading = true, compact = false }: {
  /** Which door it knocks on: the device-gated board, or the admin one. */
  source: OrdersSource
  /** How often to re-read, in ms. */
  poll?: number
  heading?: boolean
  /** The door tablet: rooms and totals, no per-dish list until tapped. */
  compact?: boolean
}) {
  const { t, lang } = useLang()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [open, setOpen] = useState<string | null>(null)

  const url = source === 'admin' ? '/api/admin/menu-orders' : '/api/kiosk/orders/open'

  const load = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not read the orders.'); return }
      setErr(''); setOrders(j.orders ?? [])
    } catch { setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.')) }
  }, [url, t])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, poll)
    return () => clearInterval(id)
  }, [load, poll])
  // The waits count up without re-reading the server.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const act = async (orderId: string, action: 'ordered' | 'clear') => {
    setBusy(orderId)
    try {
      const r = await fetch(url, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, action }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'That did not go through.'); return }
      setErr(''); setOrders(j.orders ?? [])
    } catch { setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.')) }
    finally { setBusy(null) }
  }

  const waited = (iso: string) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  const waitText = (m: number) =>
    m < 1 ? t('just now', 'vừa xong')
      : m < 60 ? t(`${m} min`, `${m} phút`)
        : t(`${Math.floor(m / 60)}h ${m % 60}m`, `${Math.floor(m / 60)} giờ ${m % 60} phút`)

  const pending = (orders ?? []).filter(o => o.status === 'pending').length

  return (
    <section className="oo">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {heading && (
        <header className="oo-head">
          <h2 className="oo-title">{t('Room orders', 'Yêu cầu gọi món')}</h2>
          <span className="oo-count">
            {orders === null ? t('reading…', 'đang tải…')
              : pending ? t(`${pending} waiting to be placed`, `${pending} đang chờ đặt`)
                : t('nothing waiting', 'không có yêu cầu nào')}
          </span>
        </header>
      )}

      {err && <p className="oo-err">{err}</p>}

      {orders !== null && orders.length === 0 && (
        <p className="oo-empty">
          {t('No room has an order open. They appear here the moment one is confirmed on a room tablet.',
             'Chưa phòng nào gọi món. Yêu cầu sẽ hiện ở đây ngay khi được xác nhận trên máy tính bảng trong phòng.')}
        </p>
      )}

      <ul className="oo-list">
        {(orders ?? []).map(o => {
          const mins = waited(o.status === 'ordered' && o.ordered_at ? o.ordered_at : o.created_at)
          const late = o.status === 'pending' && mins >= NAGGING_MIN
          const shown = !compact || open === o.id
          return (
            <li key={o.id} className={`oo-card ${o.status === 'ordered' ? 'is-placed' : ''} ${late ? 'is-late' : ''}`}>
              <button className="oo-top" onClick={() => setOpen(v => (v === o.id ? null : o.id))}
                      aria-expanded={shown} disabled={!compact}>
                <span className="oo-room">{o.room}</span>
                <span className="oo-state">
                  {o.status === 'ordered'
                    ? t(`Ordered · ${waitText(mins)}`, `Đã đặt · ${waitText(mins)}`)
                    : t(`Waiting · ${waitText(mins)}`, `Đang chờ · ${waitText(mins)}`)}
                  {o.ordered_by && <span className="oo-by"> · {o.ordered_by}</span>}
                </span>
                <span className="oo-total">{price(o.total_vnd)}</span>
              </button>

              {shown && (
                <>
                  <ul className="oo-lines">
                    {o.lines.map(li => (
                      <li key={li.id}>
                        <span className="oo-qty">{li.qty}</span>
                        <span className="oo-what">
                          {lang === 'vn' ? (li.name_vn || li.name_en) : li.name_en}
                          <span className="oo-from">{li.venue_name}</span>
                        </span>
                        <span className="oo-line-money">
                          <span className="oo-line-total">{price(li.line_total_vnd)}</span>
                          {li.qty > 1 && <span className="oo-line-each">{li.qty} × {price(li.unit_price_vnd)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* What it adds up to, the way the room was shown it. */}
                  <div className="oo-sum">
                    <span>{t('Food', 'Món ăn')}<b>{price(o.subtotal_vnd ?? o.total_vnd)}</b></span>
                    {!!o.service_vnd && (
                      <span>{t('Service', 'Phí phục vụ')} {Math.round((o.service_pct || 0) * 100)}%<b>{price(o.service_vnd)}</b></span>
                    )}
                    {!!o.vat_vnd && (
                      <span>{t('VAT', 'GTGT')} {Math.round((o.vat_pct || 0) * 100)}%<b>{price(o.vat_vnd)}</b></span>
                    )}
                    <span className="is-total">{t('Total', 'Tổng')}<b>{price(o.total_vnd)}</b></span>
                  </div>

                  {/* The room's own words, never edited and never hidden: it is
                      the part most likely to matter ("one of us is coeliac"). */}
                  {o.note && (
                    <p className="oo-note">
                      <span>{t('From the room', 'Ghi chú từ phòng')}</span>
                      {o.note}
                    </p>
                  )}

                  <div className="oo-acts">
                    {o.status === 'pending' && (
                      <button className="oo-act is-go" disabled={busy === o.id} onClick={() => act(o.id, 'ordered')}>
                        {t('I have ordered this', 'Tôi đã đặt món này')}
                      </button>
                    )}
                    <button className="oo-act" disabled={busy === o.id} onClick={() => act(o.id, 'clear')}>
                      {t('Clear', 'Xoá')}
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const CSS = `
.oo { color: #E5D4C2; }
.oo-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.oo-title { margin: 0; font-family: ${MONO}; font-size: 13px; letter-spacing: .2em; text-transform: uppercase; font-weight: 400; color: rgba(229,212,194,.75); }
.oo-count { font-family: ${MONO}; font-size: 12px; color: ${GOLD}; }
.oo-err { font-family: ${MONO}; font-size: 13px; color: #C27070; margin: 0 0 12px; }
.oo-empty { font-family: ${MONO}; font-size: 13px; line-height: 1.8; color: rgba(229,212,194,.45); max-width: 58ch; margin: 0; }

.oo-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.oo-card { border: 1px solid rgba(229,212,194,.16); border-radius: 3px; overflow: hidden; background: rgba(0,0,0,.12); }
.oo-card.is-placed { border-color: rgba(176,193,142,.45); }
.oo-card.is-late { border-color: rgba(196,149,85,.65); }

.oo-top { display: grid; grid-template-columns: 1fr auto auto; gap: 8px 18px; align-items: baseline; width: 100%;
          padding: 14px 18px; background: rgba(229,212,194,.05); border: none; text-align: left;
          color: inherit; font: inherit; cursor: default; -webkit-tap-highlight-color: transparent; }
.oo-top:not(:disabled) { cursor: pointer; }
.oo-room { font-family: ${MONO}; font-size: 17px; color: #F2E6D8; }
.oo-state { font-family: ${MONO}; font-size: 12px; color: rgba(229,212,194,.6); }
.is-late .oo-state { color: ${AMBER}; }
.is-placed .oo-state { color: ${SAGE}; }
.oo-by { opacity: .7; }
.oo-total { font-family: ${MONO}; font-size: 15px; font-variant-numeric: tabular-nums; color: #F2E6D8; }

.oo-lines { list-style: none; margin: 0; padding: 4px 18px 0; }
.oo-lines li { display: grid; grid-template-columns: 34px 1fr auto; gap: 14px; align-items: baseline;
               padding: 11px 0; border-bottom: 1px solid rgba(229,212,194,.09); }
.oo-qty { font-family: ${MONO}; font-size: 16px; color: ${GOLD}; }
.oo-what { font-family: ${MONO}; font-size: 15px; line-height: 1.4; min-width: 0; }
.oo-from { display: block; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; opacity: .45; margin-top: 3px; }
.oo-line-money { text-align: right; white-space: nowrap; }
.oo-line-total { font-family: ${MONO}; font-size: 13px; opacity: .7; font-variant-numeric: tabular-nums; }
.oo-line-each { display: block; font-family: ${MONO}; font-size: 10px; opacity: .4; margin-top: 3px;
                font-variant-numeric: tabular-nums; }

.oo-sum { display: flex; flex-wrap: wrap; gap: 6px 22px; padding: 12px 18px 0; font-family: ${MONO};
          font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: rgba(229,212,194,.45); }
.oo-sum b { font-weight: 400; margin-left: 8px; letter-spacing: 0; text-transform: none;
            color: rgba(229,212,194,.8); font-variant-numeric: tabular-nums; }
.oo-sum .is-total { color: ${GOLD}; }
.oo-sum .is-total b { color: #F2E6D8; }
.oo-note { margin: 12px 18px 0; padding: 11px 13px; border-left: 2px solid ${GOLD}; background: rgba(212,184,90,.08);
           font-family: ${MONO}; font-size: 14px; line-height: 1.6; color: #F2E6D8; }
.oo-note span { display: block; font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
                color: ${GOLD}; margin-bottom: 5px; }

.oo-acts { display: flex; gap: 12px; flex-wrap: wrap; padding: 14px 18px; }
.oo-act { background: none; border: 1px solid rgba(229,212,194,.28); border-radius: 2px; color: #E5D4C2;
          font-family: ${MONO}; font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
          padding: 13px 18px; min-height: 46px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.oo-act.is-go { background: ${SAGE}; border-color: ${SAGE}; color: #052E20; }
.oo-act:disabled { opacity: .45; cursor: default; }
@media (max-width: 560px) { .oo-top { grid-template-columns: 1fr auto; } .oo-total { grid-column: 2; } }
`
