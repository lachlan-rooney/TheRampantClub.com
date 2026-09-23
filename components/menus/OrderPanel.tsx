'use client'

import { useState } from 'react'
import { useLang } from '@/lib/lang'
import { price } from '@/lib/menus/types'
import { NOTE_MAX } from '@/lib/menus/orders'

// ═══════════════════════════════════════════════════════════════════════════
// THE ORDER PANEL — what the room has asked for, and how it gets ordered.
// ───────────────────────────────────────────────────────────────────────────
// THE ORDER DOES NOT SEND ITSELF, AND THIS PANEL USED TO IMPLY IT DID. It said
// "Waiting for the team", which reads as "somebody is on their way". Nobody is:
// confirming on the menu only writes the order down so it can be read back
// correctly. A member has to press the button on their table to call a server,
// and until they do the order sits on a tablet nobody is looking at.
//
// So that instruction is now the largest thing in the panel, in a band above
// the lines rather than in a footnote below them, and it is replaced — not
// merely dimmed — the moment a server marks the order placed.
//
// THE STAFF CONTROLS ARE FENCED OFF. "I have ordered this" and "Clear" used to
// sit in the same row as the member's own total, with an 11px note explaining
// they belonged to somebody else. They are now under a rule, on a darker
// ground, and labelled.
//
// The cost, accepted openly: anyone standing at the tablet can clear it. That
// is survivable precisely because nothing is charged — clearing loses a
// request, not money.
//
// TAKING ONE THING OFF (2026-09-23). Until now the only way to change a
// confirmed order from this panel was Clear, which threw the whole thing away
// and is a staff control besides. Each line has its own ✕ now. A line whose
// dish has since been deleted from the menu (item_id null) cannot be re-sent,
// so where one of those is present the ✕ goes away rather than silently
// dropping it from the order.
//
// THE NOTE is the room's own sentence, shown here so it can be checked and
// changed after confirming, not only before.
//
// THE TOTAL IS BROKEN DOWN (owner, 2026-09-23: "show the breakdown of the
// total and make it clear they need to tell the server"). Every line now shows
// its own arithmetic — 2 × 180K — instead of only the line's total, and the
// foot counts the dishes and the items before the money. The breakdown is the
// ARITHMETIC AND NOTHING ELSE: there is no VAT line and no service line
// because the menus carry no such thing (nothing in lib/menus or the schema
// knows about either), and inventing rows on a screen a member reads as a bill
// would be inventing charges.
//
// AND IT IS NOT A BILL. A list of dishes with a total under it looks exactly
// like one, so the total says so in as many words and repeats the one action
// that actually orders the food: tell the server. Said at the top before the
// list is read, and again at the bottom where the eye lands on the money.
//
// It lives in its own file so it can be rendered and looked at without a
// paired tablet. The kiosk page is device-gated, which is correct and also
// meant this panel could only ever be reviewed in production.
// ═══════════════════════════════════════════════════════════════════════════

export interface OrderLine {
  id: string; item_id?: string | null; venue_name: string; name_en: string; name_vn: string | null
  unit_price_vnd: number; qty: number; line_total_vnd: number
}
export interface Order {
  id: string; room: string; status: 'pending' | 'ordered'
  total_vnd: number; note?: string | null; created_at: string; ordered_at: string | null
  lines: OrderLine[]
}

export default function OrderPanel({ order, busy, onPlaced, onClear, onRemove, onNote }: {
  order: Order
  busy?: boolean
  onPlaced: () => void
  onClear: () => void
  /** Drop one line and re-send the rest. */
  onRemove?: (line: OrderLine) => void
  /** Save the room's note. */
  onNote?: (note: string) => void
}) {
  const { t, lang } = useLang()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(order.note ?? '')
  // Only while it is still the room's to change, and only when every line can
  // be sent again.
  const canEdit = order.status === 'pending' && !busy
  const canRemove = !!onRemove && canEdit && order.lines.every(l => !!l.item_id) && order.lines.length > 0
  // Dishes are the rows; items are the plates and glasses that will arrive.
  const items = order.lines.reduce((n, l) => n + l.qty, 0)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ORDER_PANEL_CSS }} />
      <section className={`km-order ${order.status === 'ordered' ? 'is-placed' : ''}`}>
        {order.status === 'pending' ? (
          <div className="km-call">
            <span className="km-call-icon" aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </span>
            <div>
              <h2 className="km-call-head">
                {t('Press the button on your table to call a server',
                   'Nhấn nút trên bàn để gọi nhân viên')}
              </h2>
              <p className="km-call-sub">
                {t('They will read this order back to you and place it. Nothing is ordered until they do.',
                   'Nhân viên sẽ đọc lại yêu cầu này và đặt món giúp quý vị. Món chỉ được đặt sau khi nhân viên xác nhận.')}
              </p>
            </div>
          </div>
        ) : (
          <div className="km-call is-done">
            <span className="km-call-icon" aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div>
              <h2 className="km-call-head">
                {t('Ordered. It is with the kitchen.', 'Đã đặt món. Yêu cầu đã chuyển cho nhà bếp.')}
              </h2>
              <p className="km-call-sub">
                {t('Nothing is paid at the table. Miss Châu will invoice.',
                   'Không thanh toán tại bàn. Chị Châu sẽ xuất hoá đơn.')}
              </p>
            </div>
          </div>
        )}

        <ul className={`km-lines ${canRemove ? 'has-x' : ''}`}>
          {order.lines.map(li => (
            <li key={li.id}>
              <span className="km-qty">{li.qty}</span>
              <span className="km-what">
                {lang === 'vn' ? (li.name_vn || li.name_en) : li.name_en}
                <span className="km-from">{li.venue_name}</span>
              </span>
              <span className="km-line-money">
                <span className="km-line-total">{price(li.line_total_vnd)}</span>
                {/* The sum, shown rather than assumed — a member checking a
                    total should not have to do the multiplication in their
                    head at eleven at night. */}
                <span className="km-line-each">{li.qty} × {price(li.unit_price_vnd)}</span>
              </span>
              {canRemove && (
                <button className="km-x" onClick={() => onRemove!(li)} disabled={busy}
                        aria-label={`${t('Take off', 'Bỏ')} ${lang === 'vn' ? (li.name_vn || li.name_en) : li.name_en}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* THE ROOM'S NOTE — theirs to change while the order is still theirs. */}
        {(order.note || (canEdit && onNote)) && (
          <div className="km-note">
            <span className="km-note-label">{t('Your note', 'Ghi chú của quý vị')}</span>
            {editing ? (
              <>
                <textarea value={draft} maxLength={NOTE_MAX} rows={2} autoFocus
                          onChange={e => setDraft(e.target.value)}
                          placeholder={t('No ice · one of us is coeliac', 'Không đá · một người không ăn gluten')} />
                <span className="km-note-acts">
                  <button className="km-act is-go" disabled={busy}
                          onClick={() => { onNote?.(draft.trim()); setEditing(false) }}>
                    {t('Save', 'Lưu')}
                  </button>
                  <button className="km-act" disabled={busy}
                          onClick={() => { setDraft(order.note ?? ''); setEditing(false) }}>
                    {t('Cancel', 'Huỷ')}
                  </button>
                </span>
              </>
            ) : (
              <>
                <p>{order.note || <em>{t('None', 'Không có')}</em>}</p>
                {canEdit && onNote && (
                  <button className="km-note-edit" onClick={() => { setDraft(order.note ?? ''); setEditing(true) }}>
                    {order.note ? t('Change it', 'Sửa') : t('Add one', 'Thêm ghi chú')}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="km-sum">
          <div className="km-sum-row">
            <span>{t(`${order.lines.length} ${order.lines.length === 1 ? 'dish' : 'dishes'}`,
                     `${order.lines.length} món`)}
              <span className="km-sum-dot"> · </span>
              {t(`${items} ${items === 1 ? 'item' : 'items'}`, `${items} phần`)}
            </span>
            {/* No amount here. With no tax and no service line there is no
                subtotal to show, and printing the total twice a centimetre
                apart just makes a reader check whether they differ. */}
          </div>
          <div className="km-sum-row is-total">
            <span>{t('Total', 'Tổng cộng')}</span>
            <span className="km-total-n">{price(order.total_vnd)}</span>
          </div>
          <p className="km-notbill">
            {order.status === 'pending'
              ? t('This is not a bill, and nothing has been sent to the kitchen. Tell your server — press the button on your table — and they will place it.',
                  'Đây không phải hoá đơn, và yêu cầu chưa được gửi đến nhà bếp. Vui lòng báo nhân viên — nhấn nút trên bàn — để nhân viên đặt món.')
              : t('This is not a bill. Nothing is paid at the table.',
                  'Đây không phải hoá đơn. Không thanh toán tại bàn.')}
          </p>
        </div>

        {/* Below the rule: not the member's half of the panel. */}
        <div className="km-staff">
          <span className="km-staff-label">{t('For the team', 'Dành cho nhân viên')}</span>
          <span className="km-staff-acts">
            {order.status === 'pending' && (
              <button className="km-act is-go" disabled={busy} onClick={onPlaced}>
                {t('I have ordered this', 'Tôi đã đặt món này')}
              </button>
            )}
            <button className="km-act" disabled={busy} onClick={onClear}>
              {t('Clear', 'Xoá')}
            </button>
          </span>
        </div>
      </section>
    </>
  )
}

const MONO = "'Google Sans Code', monospace"
export const ORDER_PANEL_CSS = `
/* The ink is declared here, not inherited. This panel used to live inside the
   kiosk page's .km wrapper and take its colour from it; pulled out into its
   own file it rendered dark-green-on-dark-green until it was looked at. A
   component that only works inside one particular parent is not a component. */
.km-order { margin-top: 44px; border: 1px solid rgba(212,184,90,.45);
            border-radius: 3px; padding: 0; max-width: 920px; overflow: hidden;
            color: #E5D4C2; background: rgba(0,0,0,.08); }
.km-order.is-placed { border-color: rgba(176,193,142,.5); }

/* THE INSTRUCTION, WHICH IS THE POINT OF THE PANEL. Gold band across the top
   so it is read before the list, not after it. */
.km-call { display: flex; gap: 18px; align-items: flex-start;
           padding: 22px 24px; background: rgba(212,184,90,.13);
           border-bottom: 1px solid rgba(212,184,90,.3); }
.km-call.is-done { background: rgba(176,193,142,.12); border-bottom-color: rgba(176,193,142,.3); }
.km-call-icon { flex: 0 0 auto; color: #D4B85A; margin-top: 2px; }
.km-call.is-done .km-call-icon { color: #B0C18E; }
.km-call-head { margin: 0; font-family: ${MONO}; font-size: 19px; line-height: 1.35;
                letter-spacing: .01em; color: #F2E6D8; font-weight: 400; }
.km-call-sub { margin: 8px 0 0; font-family: ${MONO}; font-size: 13px;
               line-height: 1.7; color: rgba(229,212,194,.72); max-width: 54ch; }
@media (max-width: 560px) { .km-call { padding: 18px; gap: 14px; }
                            .km-call-head { font-size: 16px; } }

/* THE LINES, as a table rather than a run of baseline-aligned spans: the
   quantity column, the name column and the money column now actually line up
   with each other down the list. */
.km-lines { list-style: none; margin: 0; padding: 6px 24px 0; }
.km-lines.has-x li { grid-template-columns: 40px 1fr auto 46px; }
.km-x { background: none; border: none; color: rgba(229,212,194,.5); font-size: 16px; cursor: pointer;
        width: 46px; height: 46px; border-radius: 50%; -webkit-tap-highlight-color: transparent; }
.km-x:hover, .km-x:focus-visible { color: #C27070; background: rgba(194,112,112,.12); }
.km-x:disabled { opacity: .3; cursor: default; }

.km-note { padding: 4px 24px 0; }
.km-note-label { display: block; font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
                 text-transform: uppercase; color: #D4B85A; margin: 14px 0 6px; }
.km-note p { margin: 0; font-family: ${MONO}; font-size: 15px; line-height: 1.6; color: #F2E6D8; }
.km-note p em { opacity: .45; font-style: normal; }
.km-note textarea { width: 100%; resize: none; padding: 11px 12px; border-radius: 3px; background: rgba(0,0,0,.25);
                    border: 1px solid rgba(229,212,194,.25); color: #F2E6D8; font-family: ${MONO};
                    font-size: 15px; line-height: 1.5; }
.km-note textarea:focus { outline: none; border-color: #D4B85A; }
.km-note-acts { display: flex; gap: 10px; margin-top: 10px; }
.km-note-edit { background: none; border: none; padding: 8px 0 0; cursor: pointer; font-family: ${MONO};
                font-size: 12px; color: #D4B85A; border-bottom: 1px solid transparent; }
.km-note-edit:hover { border-bottom-color: #D4B85A; }
.km-lines li { display: grid; grid-template-columns: 40px 1fr auto;
               gap: 16px; align-items: baseline; padding: 13px 0;
               border-bottom: 1px solid rgba(229,212,194,.1); }
.km-qty { font-family: ${MONO}; font-size: 18px; color: #D4B85A; }
.km-what { font-family: ${MONO}; font-size: 17px; line-height: 1.4; min-width: 0; }
.km-from { display: block; font-size: 11px; letter-spacing: .12em;
           text-transform: uppercase; opacity: .45; margin-top: 4px; }
.km-line-total { font-family: ${MONO}; font-size: 15px; opacity: .72;
                 white-space: nowrap; font-variant-numeric: tabular-nums; }

.km-line-money { text-align: right; white-space: nowrap; }
.km-line-each { display: block; font-family: ${MONO}; font-size: 11px; opacity: .45;
                margin-top: 4px; font-variant-numeric: tabular-nums; }

.km-sum { padding: 16px 24px 20px; }
.km-sum-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
              font-family: ${MONO}; font-size: 12px; letter-spacing: .16em; text-transform: uppercase;
              color: rgba(229,212,194,.55); padding: 6px 0; }
.km-sum-row.is-total { border-top: 1px solid rgba(229,212,194,.14); margin-top: 6px; padding-top: 14px;
                       color: rgba(229,212,194,.6); }
.km-sum-dot { opacity: .4; }
.km-total-n { font-size: 22px; letter-spacing: 0; text-transform: none;
              color: #F2E6D8; font-variant-numeric: tabular-nums; }
/* A total looks like a bill. This says what it is, under the money. */
.km-notbill { margin: 14px 0 0; padding: 12px 14px; border-radius: 3px;
              border-left: 2px solid #D4B85A; background: rgba(212,184,90,.1);
              font-family: ${MONO}; font-size: 13.5px; line-height: 1.7; color: #F2E6D8; }

/* THE STAFF STRIP. Fenced off below a rule and on a darker ground, because
   these two buttons belong to somebody other than the person holding the
   tablet. */
.km-staff { display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
            justify-content: space-between;
            padding: 14px 24px; background: rgba(0,0,0,.18);
            border-top: 1px solid rgba(229,212,194,.14); }
.km-staff-label { font-family: ${MONO}; font-size: 10px; letter-spacing: .2em;
                  text-transform: uppercase; opacity: .42; }
.km-staff-acts { display: flex; gap: 12px; flex-wrap: wrap; }
.km-act { background: none; border: 1px solid rgba(229,212,194,.28); border-radius: 2px;
          color: #E5D4C2; font-family: ${MONO}; font-size: 12px; letter-spacing: .1em;
          text-transform: uppercase; padding: 11px 18px; cursor: pointer;
          -webkit-tap-highlight-color: transparent; }
.km-act.is-go { background: #B0C18E; border-color: #B0C18E; color: #052E20; }
.km-act:disabled { opacity: .45; cursor: default; }
`
