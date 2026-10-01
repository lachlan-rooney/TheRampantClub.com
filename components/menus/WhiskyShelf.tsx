'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'

// THE SHELF, ON THE ROOM TABLET.
//
// Owner, 2026-09-25: "with a list of the current whisky stock on a tab too."
// The bar tab used to end with "The whisky list is a separate thing entirely —
// ask for it", which on a screen standing on the bar is an odd thing to say
// about three hundred bottles the club can see and the tablet could not.
//
// TAP-ONLY, NO TYPING. Three hundred and ten bottles is too many to scroll and
// the Flavour Finder next door is deliberately keyboardless — a search box here
// would be the one place in the kiosk that raises a keyboard over half the
// screen. Regions narrow it instead, in the order a whisky list is read:
// Scotland's six, then everywhere else behind one chip. Within a region the
// list is alphabetical, because that is how somebody looks for a name they have
// already heard.
//
// A BOTTLE OPENS IN PLACE. Same as a dish on the food tabs: nothing navigates,
// no modal, nobody loses their place in a long list.
//
// NO PRICES AND NO ORDERING. The food tabs can send an order because a plate
// has one price; a dram is poured by measure and priced by the pour, and a
// number here would be quoted back to the bar. This tab is the list, and the
// line under it says to ask.
//
// WHAT IS NOT SHOWN, and why, lives in app/api/kiosk/whiskies/route.ts — the
// short version is that how little is left in a bottle is the bar's business.

type Dram = {
  id: string; name: string; distillery: string | null; region: string | null
  age: string | null; abv: string | null; notes: string | null; pick: boolean
}

// Scotland's six, named the way the club's own list names them, then one chip
// for everything else. Ireland, Taiwan, Japan, England and the rest are about
// fifty bottles between them — six more chips of eleven would make the row
// longer than the list it filters.
const SCOTLAND = ['Highland', 'Speyside', 'Islay', 'Lowland', 'Islands', 'Campbeltown']
const ELSEWHERE = '__elsewhere'

export default function WhiskyShelf() {
  const { t, lang } = useLang()
  const [rows, setRows] = useState<Dram[] | null>(null)
  const [err, setErr] = useState('')
  const [region, setRegion] = useState<string>('')   // '' = the whole shelf
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/kiosk/whiskies', { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'failed')
        return j
      })
      .then(j => setRows(j.whiskies || []))
      .catch(() => setErr(t('The shelf could not be read just now — ask your server.',
                            'Chưa đọc được danh sách lúc này — vui lòng hỏi nhân viên.')))
  }, [t])

  // Only the regions the shelf actually holds get a chip. A region chip that
  // leads to an empty list is a tap that punishes whoever took it.
  const regions = useMemo(() => {
    if (!rows) return []
    const have = new Set(rows.map(r => r.region).filter(Boolean) as string[])
    const list = SCOTLAND.filter(r => have.has(r))
    if (rows.some(r => !r.region || !SCOTLAND.includes(r.region))) list.push(ELSEWHERE)
    return list
  }, [rows])

  const shown = useMemo(() => {
    if (!rows) return []
    if (!region) return rows
    if (region === ELSEWHERE) return rows.filter(r => !r.region || !SCOTLAND.includes(r.region))
    return rows.filter(r => r.region === region)
  }, [rows, region])

  const label = (r: string) => r === ELSEWHERE ? t('Beyond Scotland', 'Ngoài Scotland') : r

  return (
    <section className="ws">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {err && <p className="ws-msg">{err}</p>}
      {!err && rows === null && <p className="ws-msg">{t('Reading the shelf…', 'Đang đọc danh sách…')}</p>}

      {rows !== null && !rows.length && (
        <p className="ws-msg">{t('Nothing is on the shelf list yet.', 'Danh sách chưa có chai nào.')}</p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="ws-chips" role="tablist">
            <button role="tab" aria-selected={!region}
                    className={`ws-chip ${!region ? 'is-on' : ''}`}
                    onClick={() => { setRegion(''); setOpen(null) }}>
              {t('The whole shelf', 'Toàn bộ')} <b>{rows.length}</b>
            </button>
            {regions.map(r => {
              const n = r === ELSEWHERE
                ? rows.filter(x => !x.region || !SCOTLAND.includes(x.region)).length
                : rows.filter(x => x.region === r).length
              return (
                <button key={r} role="tab" aria-selected={region === r}
                        className={`ws-chip ${region === r ? 'is-on' : ''}`}
                        onClick={() => { setRegion(r); setOpen(null) }}>
                  {label(r)} <b>{n}</b>
                </button>
              )
            })}
          </div>

          <ul className="ws-list">
            {shown.map(w => {
              const isOpen = open === w.id
              // The line under the name: what a member would ask for it by.
              // Region is left off when a region chip is already selected —
              // repeating "Highland" down ninety-nine rows says nothing.
              const line = [
                w.distillery && w.distillery.toLowerCase() !== w.name.toLowerCase().slice(0, w.distillery.length)
                  ? w.distillery : null,
                !region || region === ELSEWHERE ? w.region : null,
                w.age, w.abv,
              ].filter(Boolean).join(' · ')
              return (
                <li key={w.id} className={isOpen ? 'is-open' : ''}>
                  <button className="ws-row"
                          aria-expanded={isOpen}
                          onClick={() => setOpen(o => (o === w.id ? null : w.id))}>
                    <span className="ws-name">
                      {w.name}
                      {w.pick && <span className="ws-pick">{t("Committee's pick", 'Lựa chọn của hội đồng')}</span>}
                    </span>
                    {line && <span className="ws-meta">{line}</span>}
                  </button>
                  {isOpen && (
                    <div className="ws-note">
                      {w.notes
                        ? w.notes.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p.trim()}</p>)
                        : <p className="ws-dim">{t('No note written for this one yet — ask your server what it drinks like.',
                                                   'Chai này chưa có ghi chú — vui lòng hỏi nhân viên.')}</p>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* The pour, not the bottle. Said once at the bottom rather than on
              three hundred rows. */}
          <p className="ws-foot">
            {lang === 'vn'
              ? 'Giá rót theo từng ly — vui lòng hỏi nhân viên. Danh sách cập nhật theo kệ thật, nên chai nào đã hết sẽ không xuất hiện ở đây.'
              : 'Pours are priced by the measure — ask your server. The list follows the real shelf, so a bottle that has run out is not on it.'}
          </p>
        </>
      )}
    </section>
  )
}

const CSS = `
.ws { --cream: #E5D4C2; --gold: #D4B85A; --hair: rgba(229,212,194,.14);
      --mono: 'Google Sans Code','DM Mono',monospace;
      --serif: 'Rampant Sans', Georgia, serif; color: var(--cream); }
.ws-msg { font-family: var(--mono); font-size: 13px; opacity: .6; padding: 36px 0; }

/* The regions. A row that wraps rather than scrolls sideways — a horizontal
   scroller on a bolted-down tablet hides whatever is off the right edge, and
   Campbeltown would be the thing nobody ever found. */
.ws-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 28px; }
.ws-chip {
  background: none; border: 1px solid var(--hair); cursor: pointer;
  padding: 10px 15px; color: rgba(229,212,194,.62);
  font-family: var(--mono); font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
  transition: color .2s, border-color .2s; -webkit-tap-highlight-color: transparent;
}
.ws-chip b { font-weight: 400; opacity: .5; margin-left: 5px; font-variant-numeric: tabular-nums; }
.ws-chip.is-on { color: #052E20; background: var(--gold); border-color: var(--gold); }
.ws-chip.is-on b { opacity: .62; }
.ws-chip:hover:not(.is-on) { color: var(--cream); border-color: rgba(229,212,194,.3); }

/* Hairlines between bottles, no boxes — the printed list. */
.ws-list { list-style: none; margin: 0; padding: 0; }
.ws-list li { border-bottom: 1px solid var(--hair); }
.ws-list li:first-child { border-top: 1px solid var(--hair); }
.ws-row {
  display: block; width: 100%; text-align: left; background: none; border: none;
  cursor: pointer; padding: 15px 2px; color: inherit;
  -webkit-tap-highlight-color: transparent;
}
.ws-name { display: block; font-family: var(--serif); font-size: 17px; line-height: 1.28; }
.ws-pick {
  display: inline-block; margin-left: 9px; vertical-align: 2px;
  font-family: var(--mono); font-size: 9px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--gold); border: 1px solid rgba(212,184,90,.4); padding: 2px 6px;
}
.ws-meta { display: block; font-family: var(--mono); font-size: 11px; letter-spacing: .08em;
           text-transform: uppercase; color: rgba(229,212,194,.5); margin-top: 6px; }
.ws-list li.is-open .ws-name { color: #F2E6D8; }
.ws-list li.is-open { border-bottom-color: rgba(212,184,90,.34); }
.ws-note { padding: 0 2px 20px; max-width: 64ch; }
.ws-note p { font-family: var(--mono); font-size: 12.5px; line-height: 1.95;
             color: rgba(229,212,194,.72); margin: 0 0 10px; }
.ws-note p:last-child { margin-bottom: 0; }
.ws-note .ws-dim { opacity: .5; }

.ws-foot { font-family: var(--mono); font-size: 11.5px; line-height: 1.9;
           color: rgba(229,212,194,.45); margin: 34px 0 0; max-width: 62ch; }

/* ── THE TABLET ────────────────────────────────────────────────────────────
   Read at arm's length by somebody standing up, so everything grows; and the
   list runs to a couple of hundred rows on Highland, so the rows get real
   height rather than only bigger type. */
.mb.is-kiosk .ws-chip { font-size: 15px; padding: 14px 20px; }
.mb.is-kiosk .ws-name { font-size: 23px; }
.mb.is-kiosk .ws-meta { font-size: 13px; margin-top: 8px; }
.mb.is-kiosk .ws-row { padding: 20px 2px; }
.mb.is-kiosk .ws-note p { font-size: 15px; line-height: 2; }
.mb.is-kiosk .ws-foot { font-size: 13px; }

/* A tablet lying in landscape is about 800px tall. Same reasoning as the food
   tabs: keep the chips compact so more than three bottles sit above the bar. */
@media (orientation: landscape) and (max-height: 860px) {
  .mb.is-kiosk .ws-chip { font-size: 13px; padding: 10px 14px; }
  .mb.is-kiosk .ws-chips { margin-bottom: 20px; }
  .mb.is-kiosk .ws-name { font-size: 20px; }
  .mb.is-kiosk .ws-row { padding: 15px 2px; }
}

@media (max-width: 560px) {
  .ws-chip { font-size: 11px; padding: 9px 12px; }
  .ws-name { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .ws-chip { transition: none; } }
`
