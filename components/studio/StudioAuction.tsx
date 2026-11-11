'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'
import {
  closeLabel, countWord, dateLabel, minNext, money, stampLabel, timeLeft, tr,
  type Lang, type PublicLot,
} from '@/lib/studio/auction'

// ═══════════════════════════════════════════════════════════════════════════
// THE SILENT AUCTION, ON THE GUIDE.
// ───────────────────────────────────────────────────────────────────────────
// Nothing here invents a visual. Every value below was read off the guide and
// the studio page rather than chosen: the sage ground and ink, the exhibition
// accent, mono for reading and the display face for a figure, hairlines
// instead of boxes, and the house CTA — mono 12 uppercase, letter-spacing
// .12em, a 1px underline and an arrow that slides 7px. The entrance is the
// studio page's own `rise`, same curve and same distance. There is no card, no
// modal, no new colour and no motion that is not already in the product.
//
// ── WHY THE FORM IS INLINE AND NOT A MODAL ────────────────────────────────
// The product has one modal vocabulary and it belongs to the admin. A guest is
// standing in front of a painting holding a phone; opening a dialog over the
// work they are bidding on takes the work away at the moment they are deciding
// what it is worth. The form unfolds under the label instead.
//
// ── THE FIGURES ARE FETCHED, NOT RENDERED ─────────────────────────────────
// The guide is a cached page (revalidate 60). See the state route: a current
// highest baked into that render would be up to a minute stale and two guests
// would see different numbers on the same work. Everything live comes from the
// browser.
//
// ── AND THE COUNTDOWN RUNS ON THE SERVER'S CLOCK ──────────────────────────
// The state route returns its own `now`. The difference between that and the
// phone's clock is measured once and carried through every countdown and every
// "has it closed" decision below. A phone ten minutes fast must not hide the
// form from a guest who still has ten minutes to bid.
// ═══════════════════════════════════════════════════════════════════════════

const SAGE = '#B0C18E'
const INK = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

export interface AuctionPieceRef { id: string; index: number; title: string }

// ── THE STATE ─────────────────────────────────────────────────────────────
// One fetch for the whole page, refreshed on a timer, whenever the tab is
// looked at again, and FASTER as the close approaches — the last two minutes
// of an auction are the only ones in which 25 seconds is a long time.
export function useAuctionState(slug: string) {
  const [lots, setLots] = useState<PublicLot[] | null>(null)
  const [mine, setMine] = useState<Record<string, number>>({})
  const [failed, setFailed] = useState(false)
  const [skew, setSkew] = useState(0)
  const closesRef = useRef<string | null>(null)
  // The poll's own heartbeat is set up once and must keep reading the CURRENT
  // correction, not the zero it was mounted with — hence a ref beside the
  // state. The state is what the components render from; this is what the
  // timer thinks with.
  const skewRef = useRef(0)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/studio/auction/state?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      if (!r.ok) { setFailed(true); setLots([]); return }
      const j = await r.json()
      const rows: PublicLot[] = j.lots || []
      setLots(rows)
      setFailed(false)
      // THE CLOCK CORRECTION, measured against the server's own stamp.
      if (j.now) {
        const d = Date.parse(j.now) - Date.now()
        skewRef.current = d
        setSkew(d)
      }
      closesRef.current = rows.find(l => l.kind === 'auction')?.closes_at ?? null
    } catch { setFailed(true); setLots([]) }
  }, [slug])

  // MY OWN BIDS, so a work can say "you have been outbid" when the guest comes
  // back to it. One number per lot, read through this device's own cookie.
  const loadMine = useCallback(async () => {
    try {
      const r = await fetch(`/api/studio/auction/mine?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      setMine(j.mine || {})
    } catch { /* not knowing is the normal case; it changes nothing on screen */ }
  }, [slug])

  useEffect(() => {
    load(); loadMine()
    let stopped = false
    let id: ReturnType<typeof setTimeout>
    const beat = () => {
      if (stopped) return
      const closes = closesRef.current
      const left = closes ? Date.parse(closes) - (Date.now() + skewRef.current) : Infinity
      // Inside the last two minutes, every five seconds. Otherwise 25.
      const every = left > 0 && left < 120_000 ? 5_000 : 25_000
      id = setTimeout(async () => { await load(); beat() }, every)
    }
    beat()
    const onShow = () => { if (document.visibilityState === 'visible') { load(); loadMine() } }
    document.addEventListener('visibilitychange', onShow)
    return () => { stopped = true; clearTimeout(id); document.removeEventListener('visibilitychange', onShow) }
  }, [load, loadMine])

  return { lots, mine, failed, skew, reload: load, reloadMine: loadMine }
}

// ── THE COUNTDOWN ─────────────────────────────────────────────────────────
// Re-renders every thirty seconds while there is an hour or more to go and
// every second inside the last hour, which is when a guest starts counting.
// Returns null the moment it is past, because then the page has something else
// to say.
function useTimeLeft(lang: Lang, iso: string | null, skew: number): string | null {
  const [, bump] = useState(0)
  useEffect(() => {
    if (!iso) return
    let id: ReturnType<typeof setTimeout>
    const tick = () => {
      const left = Date.parse(iso) - (Date.now() + skew)
      if (left <= 0) { bump(n => n + 1); return }
      bump(n => n + 1)
      id = setTimeout(tick, left < 3_600_000 ? 1_000 : 30_000)
    }
    id = setTimeout(tick, 0)
    return () => clearTimeout(id)
  }, [iso, skew])
  return iso ? timeLeft(lang, iso, Date.now() + skew) : null
}

/** One line of text in the page's own voice. Never a spinner. */
export function AuctionLoading() {
  const { lang } = useLang() as { lang: Lang }
  return <div className="sga-loading">{tr(lang, 'loading')}<Dots /></div>
}

/** The product's three-dot indicator: the only busy affordance on this page. */
function Dots() {
  return (
    <span className="sga-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function AuctionFailed() {
  const { lang } = useLang() as { lang: Lang }
  return <div className="sga-statefail" role="alert">{tr(lang, 'err_state')}</div>
}

// ═══ THE BANNER ═══════════════════════════════════════════════════════════
export function AuctionBanner({ lots, pieces, skew = 0 }: {
  lots: PublicLot[]; pieces: AuctionPieceRef[]; skew?: number
}) {
  const { lang } = useLang() as { lang: Lang }
  const auctionLots = lots.filter(l => l.kind === 'auction')
  const closes = auctionLots[0]?.closes_at ?? null
  const left = useTimeLeft(lang, closes, skew)

  // The styles belong to the whole auction, not to the banner — an exhibition
  // with priced works and no auction still needs them.
  if (!auctionLots.length) return <AuctionStyles accent={INK} />

  const allClosed = auctionLots.every(l => l.is_closed) || left === null
  const byPiece = new Map(pieces.map(p => [p.id, p]))
  // ⚠ COUNTED ACROSS ALL LOTS, not just the auction ones. `lots` is everything
  // the public function published for this exhibition; a sold work is in there
  // with a null price, which is exactly how the page knows to write "Sold".
  const soldCount = lots.filter(l => l.status === 'sold').length

  return (
    <>
      <AuctionStyles accent={INK} />
      <section className="sga-banner sga-rise" aria-label={tr(lang, 'banner_eyebrow')}>
        <div className="sga-eyebrow">{tr(lang, 'banner_eyebrow')}</div>
        <p className="sga-lead">
          {/* ⚠ COUNTED, NOT TYPED. Four works today, and the sentence follows
              the data if one moves out of the auction tomorrow. */}
          {tr(lang, 'banner_lead', { n: countWord(lang, auctionLots.length) })}{' '}
          {allClosed
            ? `${tr(lang, 'closed_title')} ${tr(lang, 'closed_line')}`
            : <>{tr(lang, 'banner_closes', { time: closeLabel(lang, closes!) })}{' '}
               {tr(lang, 'banner_announce')}</>}
        </p>
        {/* ⚠ COUNTED FROM THE SAME DATA AS THE LEAD. Sold works are still
            published lots — they just carry no price and no control — so the
            figure moves on its own if another sells. Deliberately in the quiet
            mono voice rather than the display face: it is a fact about the
            room, not the headline. */}
        {soldCount > 0 && (
          <div className="sga-sold">
            {soldCount === 1
              ? tr(lang, 'banner_sold_one')
              : tr(lang, 'banner_sold', { n: countWord(lang, soldCount) })}
          </div>
        )}
        {!allClosed && left && (
          <div className="sga-left" aria-live="off">{tr(lang, 'banner_left', { t: left })}</div>
        )}
        <div className="sga-jumps">
          <span className="sga-jump-label">{tr(lang, 'banner_jump')}</span>
          {auctionLots.map(l => {
            const p = byPiece.get(l.piece_id)
            if (!p) return null
            return (
              <a key={l.lot_id} href={`#piece-${p.index}`} className="sga-jump">
                {String(p.index).padStart(2, '0')} · {p.title}
              </a>
            )
          })}
        </div>
        <div className="sga-credit">
          {tr(lang, 'credit')}{' '}
          <a href="https://lactonelabs.co.uk" target="_blank" rel="noreferrer noopener">Lactone Labs</a>
        </div>
      </section>
    </>
  )
}

// ═══ WHAT SITS UNDER ONE WORK ═════════════════════════════════════════════
export function AuctionLotBlock({ lot, accent, title, slug, myHigh, skew = 0, onPlaced }: {
  lot: PublicLot
  accent: string
  title: string
  slug: string
  myHigh?: number | null
  skew?: number
  onPlaced: () => void
}) {
  const { lang } = useLang() as { lang: Lang }

  // A PRICED WORK. A figure and a way to ask about it — or, once it is gone,
  // the word Sold and nothing else. The price of a sold work is not in this
  // payload at all: the database withholds it.
  if (lot.kind === 'sale') {
    if (lot.status === 'sold') {
      return <div className="sga-sale"><span className="sga-sold">{tr(lang, 'lot_sold')}</span></div>
    }
    if (lot.price_usd == null) return null
    return <SaleLot lot={lot} lang={lang} accent={accent} title={title} />
  }

  if (lot.status === 'sold') {
    return <div className="sga-sale"><span className="sga-sold">{tr(lang, 'lot_sold')}</span></div>
  }

  return <AuctionLive lot={lot} accent={accent} lang={lang} title={title} slug={slug}
                      myHigh={myHigh ?? null} skew={skew} onPlaced={onPlaced} />
}

// ═══ A PRICED WORK ════════════════════════════════════════════════════════
function SaleLot({ lot, lang, accent, title }: {
  lot: PublicLot; lang: Lang; accent: string; title: string
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const note = lang === 'vn' ? (lot.price_note_vn || lot.price_note_en) : lot.price_note_en

  return (
    <div className="sga-saleblock">
      <div className="sga-sale">
        <span className="sga-sale-label">{tr(lang, 'lot_price')}</span>
        <span className="sga-sale-figure">{money(lot.price_usd)}</span>
        {note && <span className="sga-sale-note">{note}</span>}
      </div>

      {sent ? (
        <div className="sga-done" role="status" style={{ borderLeftColor: accent }}>
          <div className="sga-done-h">{tr(lang, 'enq_ok_title')}</div>
          <div className="sga-done-line">{tr(lang, 'enq_ok_line', { title })}</div>
        </div>
      ) : open ? (
        <EnquireForm lot={lot} lang={lang} accent={accent}
                     onCancel={() => setOpen(false)} onSent={() => { setOpen(false); setSent(true) }} />
      ) : (
        <button className="sga-cta" onClick={() => setOpen(true)}>
          {tr(lang, 'lot_enquire')} <span className="sga-go" aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}

// ═══ AN AUCTION WORK ══════════════════════════════════════════════════════
function AuctionLive({ lot, accent, lang, title, slug, myHigh, skew, onPlaced }: {
  lot: PublicLot; accent: string; lang: Lang; title: string; slug: string
  myHigh: number | null; skew: number; onPlaced: () => void
}) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<{ amount: number; at: string; emailed: boolean } | null>(null)
  const left = useTimeLeft(lang, lot.closes_at, skew)

  // ⚠ THE CLOSE IS CHECKED HERE ONLY TO DECIDE WHAT TO DRAW, and it is checked
  // against the SERVER's clock (see the header). The database refuses a late
  // bid regardless; this is what lets the form give way at the close without a
  // reload rather than waiting for the next poll.
  const closed = lot.is_closed || left === null

  // ── THE FIGURE THAT MOVES ───────────────────────────────────────────────
  // When the highest changes under a guest who is standing at the work, the
  // new number eases in and a hairline draws under it once. `key` is what
  // restarts the animation; re-rendering the same element would not.
  const [flash, setFlash] = useState(0)
  const prev = useRef<number | null>(null)
  useEffect(() => {
    if (prev.current !== null && prev.current !== lot.highest_usd) setFlash(n => n + 1)
    prev.current = lot.highest_usd
  }, [lot.highest_usd])

  const next = minNext(lot)
  // WHERE I STAND, if this device has bid. Equal amounts cannot happen — a tie
  // is refused as too low — so a straight comparison is the whole rule.
  const leading = myHigh != null && lot.highest_usd != null && myHigh >= lot.highest_usd
  const outbid = myHigh != null && lot.highest_usd != null && myHigh < lot.highest_usd

  return (
    <div className="sga-lot" style={{ borderTopColor: accent }}>
      <dl className="sga-facts">
        <div>
          <dt>{tr(lang, 'lot_starting')}</dt>
          <dd>{money(lot.starting_bid_usd)}</dd>
        </div>
        <div>
          <dt>{tr(lang, 'lot_highest')}</dt>
          {/* AMOUNT ONLY. There is no bidder in the data this page receives. */}
          <dd className="sga-high" style={{ color: accent }}>
            {lot.highest_usd == null
              ? <span className="sga-none">{tr(lang, 'lot_none')}</span>
              : <span key={flash} className="sga-figure">
                  {money(lot.highest_usd)}
                  <i className="sga-draw" style={{ background: accent }} aria-hidden="true" />
                </span>}
          </dd>
        </div>
        <div>
          <dt>{tr(lang, 'lot_closes')}</dt>
          <dd className="sga-when">
            {closeLabel(lang, lot.closes_at)}
            {!closed && left && <em className="sga-left-inline">{tr(lang, 'banner_left', { t: left })}</em>}
          </dd>
        </div>
      </dl>

      {/* MET OR NOT MET, and never the number. The figure does not exist in
          the payload this component is given — it is computed in the database. */}
      <div className={`sga-reserve ${lot.reserve_met ? 'is-met' : ''}`}>
        {lot.reserve_met ? tr(lang, 'lot_reserve_met') : tr(lang, 'lot_reserve_not_met')}
      </div>

      {/* ON A RETURN VISIT. Said before the control, because it is the reason
          the guest is about to press it. */}
      {!closed && !done && (leading || outbid) && (
        <div className={`sga-standing ${outbid ? 'is-outbid' : ''}`}>
          {outbid ? tr(lang, 'lot_you_outbid') : tr(lang, 'lot_you_leading')}
        </div>
      )}

      {closed ? (
        <div className="sga-closed">
          <strong>{tr(lang, 'closed_title')}</strong> {tr(lang, 'closed_line')}
        </div>
      ) : done ? (
        <Confirmed lot={lot} lang={lang} accent={accent} title={title} slug={slug} done={done}
                   onAgain={() => { setDone(null); setOpen(true) }} />
      ) : open ? (
        <BidForm lot={lot} lang={lang} accent={accent} next={next}
                 onCancel={() => setOpen(false)}
                 onDone={d => { setDone(d); setOpen(false); onPlaced() }} />
      ) : (
        <button className="sga-cta" onClick={() => setOpen(true)}>
          {tr(lang, outbid ? 'lot_bid_again' : 'lot_cta')} <span className="sga-go" aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}

// ═══ THE ONE SIGNATURE MOMENT ═════════════════════════════════════════════
// The amount set large in the display face, easing up; a hairline drawing
// across beneath it; then the work, the time, and where the bid stands. Two
// ways onward. Nothing bounces and nothing is thrown at the screen — the
// restraint IS the club.
function Confirmed({ lot, lang, accent, title, slug, done, onAgain }: {
  lot: PublicLot; lang: Lang; accent: string; title: string; slug: string
  done: { amount: number; at: string; emailed: boolean }
  onAgain: () => void
}) {
  // READ LIVE, not frozen at the moment of bidding. A guest who bid two
  // minutes ago and is still looking at the screen should see the truth.
  const standing = lot.highest_usd == null || done.amount >= lot.highest_usd
    ? tr(lang, 'ok_leading')
    : tr(lang, 'ok_not_leading', { amount: money(lot.highest_usd) })

  return (
    <div className="sga-ok" role="status" style={{ borderLeftColor: accent }}>
      <div className="sga-ok-eyebrow">{tr(lang, 'ok_title')}</div>
      <div className="sga-ok-amount">{money(done.amount)}</div>
      <i className="sga-ok-rule" style={{ background: accent }} aria-hidden="true" />
      <div className="sga-ok-title">{title}</div>
      <div className="sga-ok-when">{stampLabel(lang, done.at)}</div>
      <div className="sga-ok-standing">{standing}</div>
      {/* TWO DIFFERENT FAILURES, TWO DIFFERENT SENTENCES. The bid is in the
          database by the time this renders — saying "your bid was not saved"
          because an EMAIL failed would send a guest away from a bid they
          actually hold. */}
      <div className="sga-ok-sub">{tr(lang, done.emailed ? 'ok_email' : 'ok_email_failed')}</div>
      <div className="sga-ok-sub">{tr(lang, 'ok_outbid_note')}</div>
      <div className="sga-actions sga-ok-actions">
        <button className="sga-cta" onClick={onAgain}>
          {tr(lang, 'ok_again')} <span className="sga-go" aria-hidden="true">→</span>
        </button>
        <a className="sga-cta" href={`/studio/${slug}`}>
          {tr(lang, 'ok_back')} <span className="sga-go" aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  )
}

// ═══ THE BID FORM ═════════════════════════════════════════════════════════
function BidForm({ lot, lang, accent, next, onCancel, onDone }: {
  lot: PublicLot; lang: Lang; accent: string; next: number
  onCancel: () => void
  onDone: (d: { amount: number; at: string; emailed: boolean }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState(String(next))
  const [share, setShare] = useState(false)   // ⚠ BOTH BOXES START UNTICKED.
  const [news, setNews] = useState(false)     //   Never pre-ticked, never bundled.
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // The absurd-amount guard: the server asks once, and pressing again is the
  // answer. Kept in state so the second press carries the confirmation.
  const [confirmBig, setConfirmBig] = useState(false)

  // THE EXACT SENTENCE ON SCREEN, sent with the bid and stored on the row.
  const termsText = tr(lang, 'form_terms', { date: dateLabel(lang, lot.announce_at) })

  const submit = async () => {
    setErr('')
    const amt = Number(amount)
    if (!name.trim()) return setErr(tr(lang, 'err_name'))
    if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email.trim())) return setErr(tr(lang, 'err_email'))
    if (!Number.isFinite(amt) || !Number.isInteger(amt) || amt <= 0) return setErr(tr(lang, 'err_amount'))
    if (amt < next) return setErr(tr(lang, 'err_low', { min: money(next) }))

    setBusy(true)
    try {
      const r = await fetch('/api/studio/auction/bid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lot.lot_id, name: name.trim(), email: email.trim(), phone: phone.trim(),
          amount: amt, lang, share_price: share, news, terms_text: termsText,
          confirmed: confirmBig,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        // 409 + needs_confirm is the "are you sure" — arm the next press.
        if (j.needs_confirm) setConfirmBig(true)
        setErr(j.error || tr(lang, 'err_failed'))
        return
      }
      onDone({ amount: j.amount, at: j.placed_at, emailed: !!j.emailed })
    } catch {
      // A NETWORK FAILURE IS NOT A SILENT ONE. We do not know whether the row
      // was written, so the guest is told exactly that rather than being shown
      // a confirmation we cannot stand behind — and what they typed stays on
      // screen, because asking them to type it again is how a bid is lost.
      setErr(tr(lang, 'err_failed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="sga-form">
      <div className="sga-form-h">{tr(lang, 'form_title')}</div>

      <label className="sga-field">
        <span>{tr(lang, 'form_name')}</span>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={120}
               autoComplete="name" disabled={busy} />
      </label>
      <label className="sga-field">
        <span>{tr(lang, 'form_email')}</span>
        <input value={email} onChange={e => setEmail(e.target.value)} maxLength={254}
               type="email" inputMode="email" autoComplete="email" disabled={busy} />
      </label>
      <label className="sga-field">
        <span>{tr(lang, 'form_phone')}</span>
        <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40}
               type="tel" inputMode="tel" autoComplete="tel" disabled={busy} />
      </label>
      <label className="sga-field">
        <span>{tr(lang, 'form_amount')}</span>
        <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
               inputMode="numeric" pattern="[0-9]*" disabled={busy} />
        <em className="sga-hint">{tr(lang, 'form_min', { min: money(next) })}</em>
      </label>

      {/* ── THE TERMS. One short line, in the words the bid is recorded
          against, immediately above the button. ── */}
      <p className="sga-terms">{termsText}</p>
      {/* The club's standing rule, said once, in both languages at once — the
          same sentence the consent gate prints. */}
      <p className="sga-prevails">
        {tr('en', 'form_prevails')}
        <span> · </span>
        {tr('vn', 'form_prevails')}
      </p>

      {/* TWO BOXES, SEPARATE, BOTH UNTICKED. The first changes only what the
          results email says; it never affects whether a bid is accepted or how
          it ranks. The second is club news and is never bundled with it. */}
      <label className="sga-check">
        <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} disabled={busy} />
        <span>{tr(lang, 'form_share_box')}</span>
      </label>
      <label className="sga-check">
        <input type="checkbox" checked={news} onChange={e => setNews(e.target.checked)} disabled={busy} />
        <span>{tr(lang, 'form_news_box')}</span>
      </label>

      {err && <p className="sga-err" role="alert">{err}</p>}

      {/* IN FLIGHT, NOTHING CAN BE DISMISSED. The label changes, the dots run,
          and Cancel goes with it — a guest who cancels mid-write does not know
          whether their bid exists, and neither do we. */}
      <div className="sga-actions">
        <button className="sga-cta" onClick={submit} disabled={busy} style={{ borderBottomColor: accent }}>
          {busy ? <>{tr(lang, 'form_submitting')}<Dots /></> : <>{tr(lang, 'form_submit')}<span className="sga-go" aria-hidden="true"> →</span></>}
        </button>
        {!busy && <button className="sga-quiet" onClick={onCancel}>{tr(lang, 'form_cancel')}</button>}
      </div>
    </div>
  )
}

// ═══ THE ENQUIRY FORM ═════════════════════════════════════════════════════
function EnquireForm({ lot, lang, accent, onCancel, onSent }: {
  lot: PublicLot; lang: Lang; accent: string; onCancel: () => void; onSent: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!name.trim()) return setErr(tr(lang, 'err_name'))
    if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email.trim())) return setErr(tr(lang, 'err_email'))
    setBusy(true)
    try {
      const r = await fetch('/api/studio/auction/enquire', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lot.lot_id, name: name.trim(), email: email.trim(),
          phone: phone.trim(), message: message.trim(), lang,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || tr(lang, 'err_enq_failed')); return }
      onSent()
    } catch { setErr(tr(lang, 'err_enq_failed')) }
    finally { setBusy(false) }
  }

  return (
    <div className="sga-form">
      <div className="sga-form-h">{tr(lang, 'enq_title')}</div>
      <label className="sga-field">
        <span>{tr(lang, 'form_name')}</span>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={120}
               autoComplete="name" disabled={busy} />
      </label>
      <label className="sga-field">
        <span>{tr(lang, 'form_email')}</span>
        <input value={email} onChange={e => setEmail(e.target.value)} maxLength={254}
               type="email" inputMode="email" autoComplete="email" disabled={busy} />
      </label>
      <label className="sga-field">
        <span>{tr(lang, 'form_phone')}</span>
        <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40}
               type="tel" inputMode="tel" autoComplete="tel" disabled={busy} />
      </label>
      <label className="sga-field">
        <span>{tr(lang, 'enq_message')}</span>
        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={1200}
                  rows={3} disabled={busy} />
      </label>

      {/* No news box on a sales enquiry. See the route. */}
      <p className="sga-terms">{tr(lang, 'enq_terms')}</p>

      {err && <p className="sga-err" role="alert">{err}</p>}

      <div className="sga-actions">
        <button className="sga-cta" onClick={submit} disabled={busy} style={{ borderBottomColor: accent }}>
          {busy ? <>{tr(lang, 'enq_submitting')}<Dots /></> : <>{tr(lang, 'enq_submit')}<span className="sga-go" aria-hidden="true"> →</span></>}
        </button>
        {!busy && <button className="sga-quiet" onClick={onCancel}>{tr(lang, 'form_cancel')}</button>}
      </div>
    </div>
  )
}

// ═══ THE STYLE ════════════════════════════════════════════════════════════
// Declared once and rendered by the banner; the lots inherit it. Values are
// the guide's own — see the header. The easing is the studio page's
// cubic-bezier(.16,.84,.44,1), used for everything that enters.
export function AuctionStyles({ accent }: { accent: string }) {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      /* ── THE HOUSE ENTRANCE, same curve and distance as /studio ─────── */
      @keyframes sga-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
      .sga-rise { animation: sga-rise .9s cubic-bezier(.16,.84,.44,1) both; }

      /* A FIGURE THAT HAS JUST CHANGED. It eases up into place and a hairline
         draws under it once — so a guest standing at the work SEES a bid land
         rather than noticing later that the number is different. */
      @keyframes sga-fig-in { from { opacity: 0; transform: translateY(7px) } to { opacity: 1; transform: none } }
      @keyframes sga-draw { from { transform: scaleX(0) } to { transform: scaleX(1) } }
      .sga-figure { position: relative; display: inline-block;
                    animation: sga-fig-in .5s cubic-bezier(.16,.84,.44,1) both; }
      .sga-draw { position: absolute; left: 0; right: 0; bottom: -4px; height: 1px;
                  transform-origin: left center;
                  animation: sga-draw .7s cubic-bezier(.16,.84,.44,1) .12s both; }

      /* THE THREE-DOT INDICATOR. The only busy affordance on the page. */
      @keyframes sga-dot { 0%, 100% { opacity: .22 } 50% { opacity: 1 } }
      .sga-dots { display: inline-flex; gap: 3px; margin-left: 6px; vertical-align: baseline; }
      .sga-dots i { width: 3px; height: 3px; border-radius: 50%; background: currentColor;
                    animation: sga-dot 1.1s ease-in-out infinite; }
      .sga-dots i:nth-child(2) { animation-delay: .18s }
      .sga-dots i:nth-child(3) { animation-delay: .36s }

      /* ── LOADING, AND FAILING, IN WORDS ─────────────────────────────── */
      .sga-loading { font-family: ${MONO}; font-size: 12px; letter-spacing: .04em;
                     opacity: .55; margin: 30px 0 0; }
      .sga-statefail { font-family: ${MONO}; font-size: 12.5px; line-height: 1.8; margin: 30px 0 0;
                       padding-left: 10px; border-left: 2px solid ${INK}; }

      /* ── THE BANNER ─────────────────────────────────────────────────
         Hairlines top and bottom rather than a box: the guide has no cards,
         and a boxed notice would be the only one on the page. */
      .sga-banner { margin: 30px 0 0; padding: 22px 0 20px;
                    border-top: 1px solid ${INK}26; border-bottom: 1px solid ${INK}26; }
      .sga-eyebrow { font-family: ${MONO}; font-size: 10px; letter-spacing: .22em;
                     text-transform: uppercase; opacity: .62; }
      .sga-lead { font-family: ${SERIF}; font-weight: 400; line-height: 1.12;
                  font-size: clamp(21px, 5.2vw, 30px); margin: 10px 0 0; }
      .sga-left { font-family: ${MONO}; font-size: 11.5px; letter-spacing: .12em;
                  text-transform: uppercase; opacity: .6; margin: 12px 0 0;
                  font-variant-numeric: tabular-nums; }
      /* The same quiet voice as the countdown, one notch further back: it is
         standing information, not something ticking. */
      .sga-sold { font-family: ${MONO}; font-size: 11.5px; letter-spacing: .12em;
                  text-transform: uppercase; opacity: .5; margin: 12px 0 0; }
      .sga-jumps { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; margin: 16px 0 0; }
      .sga-jump-label { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
                        text-transform: uppercase; opacity: .55; }
      .sga-jump { font-family: ${MONO}; font-size: 11.5px; color: ${INK};
                  text-decoration: none; border-bottom: 1px solid ${INK}59; padding-bottom: 2px; }
      .sga-jump:hover { border-bottom-color: ${INK}; }
      /* The same quiet-line setting as the guide credit on /studio. */
      .sga-credit { font-family: ${MONO}; font-size: 11px; line-height: 1.7; opacity: .55; margin: 16px 0 0; }
      .sga-credit a { color: inherit; text-decoration: none; border-bottom: 1px solid currentColor;
                      padding-bottom: 1px; opacity: .85; transition: opacity .2s ease; }
      .sga-credit a:hover { opacity: 1; }

      /* ── UNDER A WORK ───────────────────────────────────────────────── */
      .sga-saleblock { margin: 0; }
      .sga-sale { margin: 16px 0 0; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .sga-sale-label { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
                        text-transform: uppercase; opacity: .55; }
      .sga-sale-figure { font-family: ${SERIF}; font-size: clamp(20px, 5vw, 26px); }
      .sga-sale-note { font-family: ${MONO}; font-size: 11.5px; opacity: .6; }
      .sga-sold { font-family: ${SERIF}; font-size: clamp(20px, 5vw, 26px); text-transform: uppercase; opacity: .55; }

      .sga-lot { margin: 20px 0 0; padding: 16px 0 0; border-top: 2px solid ${INK}; }
      .sga-facts { display: flex; flex-wrap: wrap; gap: 14px 30px; margin: 0; }
      .sga-facts > div { margin: 0; }
      .sga-facts dt { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
                      text-transform: uppercase; opacity: .55; }
      .sga-facts dd { margin: 4px 0 0; font-family: ${SERIF}; font-size: clamp(19px, 4.6vw, 25px);
                      font-variant-numeric: tabular-nums; }
      .sga-high { font-weight: 400; }
      .sga-none { font-family: ${MONO}; font-size: 12.5px; opacity: .6; }
      .sga-when { font-family: ${MONO} !important; font-size: 12.5px !important; line-height: 1.6; opacity: .8; }
      .sga-left-inline { display: block; font-style: normal; font-size: 11px; opacity: .75;
                         letter-spacing: .1em; text-transform: uppercase; margin-top: 3px;
                         font-variant-numeric: tabular-nums; }

      .sga-reserve { font-family: ${MONO}; font-size: 11px; letter-spacing: .1em;
                     text-transform: uppercase; margin: 14px 0 0; opacity: .6; }
      .sga-reserve.is-met { opacity: 1; font-weight: 700; }

      /* WHERE THIS DEVICE STANDS. A hairline on the left, like the error line,
         because it is the same kind of thing: the page speaking to one guest. */
      .sga-standing { font-family: ${MONO}; font-size: 12px; line-height: 1.7; margin: 12px 0 0;
                      padding-left: 10px; border-left: 2px solid ${INK}59; opacity: .85; }
      .sga-standing.is-outbid { border-left-color: ${INK}; opacity: 1; }

      /* THE HOUSE CTA, measured off /studio: mono 12, .12em, uppercase, a 1px
         underline and an arrow that slides 7px. No button chrome anywhere on
         these pages. */
      .sga-cta { display: inline-block; margin: 16px 0 0; background: none; border: none; cursor: pointer;
                 color: ${INK}; font-family: ${MONO}; font-size: 12px; letter-spacing: .12em;
                 text-transform: uppercase; border-bottom: 1px solid ${INK}; padding: 0 0 6px;
                 text-decoration: none; }
      .sga-cta[disabled] { opacity: .45; cursor: default; }
      .sga-go { display: inline-block; transition: transform .35s ease; }
      .sga-cta:hover .sga-go { transform: translateX(7px); }
      .sga-quiet { background: none; border: none; cursor: pointer; color: ${INK}; opacity: .6;
                   font-family: ${MONO}; font-size: 11.5px; letter-spacing: .08em;
                   text-transform: uppercase; padding: 0 0 6px; }
      .sga-quiet:hover { opacity: 1; }
      .sga-actions { display: flex; align-items: baseline; gap: 22px; flex-wrap: wrap; }

      /* ── THE FORM. Underlined fields, the way the portal sets them —
         no boxes, nothing that looks like a dialog. ── */
      .sga-form { margin: 18px 0 0; animation: sga-rise .55s cubic-bezier(.16,.84,.44,1) both; }
      .sga-form-h { font-family: ${SERIF}; font-size: clamp(20px, 5vw, 26px); margin: 0 0 6px; }
      .sga-field { display: block; margin: 16px 0 0; }
      .sga-field > span { display: block; font-family: ${MONO}; font-size: 10px; letter-spacing: .16em;
                          text-transform: uppercase; opacity: .62; margin-bottom: 4px; }
      .sga-field input, .sga-field textarea {
                         width: 100%; box-sizing: border-box; background: none; color: ${INK};
                         border: none; border-bottom: 1px solid ${INK}4d; padding: 7px 2px;
                         font-family: ${MONO}; font-size: 15px; outline: none; border-radius: 0;
                         resize: vertical; }
      .sga-field input:focus, .sga-field textarea:focus {
                         border-bottom-color: ${INK}; border-bottom-width: 2px; padding-bottom: 6px; }
      .sga-field input:disabled, .sga-field textarea:disabled { opacity: .55; }
      .sga-hint { display: block; font-family: ${MONO}; font-size: 11px; font-style: normal;
                  opacity: .6; margin-top: 6px; }

      .sga-terms { font-family: ${MONO}; font-size: 12px; line-height: 1.85; margin: 20px 0 0; opacity: .85; }
      .sga-prevails { font-family: ${MONO}; font-size: 10.5px; line-height: 1.8; margin: 8px 0 0; opacity: .55; }

      .sga-check { display: flex; align-items: flex-start; gap: 10px; margin: 14px 0 0;
                   font-family: ${MONO}; font-size: 12px; line-height: 1.65; cursor: pointer; }
      .sga-check input { margin-top: 2px; }

      .sga-err { font-family: ${MONO}; font-size: 12px; line-height: 1.7; margin: 14px 0 0;
                 padding-left: 10px; border-left: 2px solid ${INK}; }

      .sga-closed { font-family: ${MONO}; font-size: 12.5px; line-height: 1.8; margin: 16px 0 0; opacity: .78; }

      /* THE CONFIRMATION. The amount is the biggest thing on the block, in the
         display face, and it arrives last. */
      .sga-done { margin: 16px 0 0; padding-left: 12px; border-left: 2px solid ${accent};
                  animation: sga-rise .6s cubic-bezier(.16,.84,.44,1) both; }
      .sga-done-h { font-family: ${SERIF}; font-size: clamp(20px, 5vw, 26px); }
      .sga-done-line { font-family: ${MONO}; font-size: 13.5px; line-height: 1.8; margin-top: 4px; }

      .sga-ok { margin: 18px 0 0; padding-left: 14px; border-left: 2px solid ${accent}; }
      .sga-ok-eyebrow { font-family: ${MONO}; font-size: 10px; letter-spacing: .22em;
                        text-transform: uppercase; opacity: .62;
                        animation: sga-rise .5s cubic-bezier(.16,.84,.44,1) both; }
      .sga-ok-amount { font-family: ${SERIF}; font-weight: 400; line-height: 1;
                       font-size: clamp(38px, 12vw, 64px); margin: 6px 0 0;
                       font-variant-numeric: tabular-nums;
                       animation: sga-rise .7s cubic-bezier(.16,.84,.44,1) .1s both; }
      .sga-ok-rule { display: block; height: 1px; margin: 12px 0 14px; transform-origin: left center;
                     animation: sga-draw .8s cubic-bezier(.16,.84,.44,1) .45s both; }
      .sga-ok-title { font-family: ${SERIF}; font-size: clamp(18px, 4.6vw, 23px);
                      animation: sga-rise .6s cubic-bezier(.16,.84,.44,1) .62s both; }
      .sga-ok-when { font-family: ${MONO}; font-size: 12px; line-height: 1.7; opacity: .7; margin-top: 4px;
                     animation: sga-rise .6s cubic-bezier(.16,.84,.44,1) .70s both; }
      .sga-ok-standing { font-family: ${MONO}; font-size: 13px; line-height: 1.75; margin-top: 10px;
                         animation: sga-rise .6s cubic-bezier(.16,.84,.44,1) .78s both; }
      .sga-ok-sub { font-family: ${MONO}; font-size: 11.5px; line-height: 1.8; opacity: .6; margin-top: 6px;
                    animation: sga-rise .6s cubic-bezier(.16,.84,.44,1) .86s both; }
      .sga-ok-actions { margin-top: 4px;
                        animation: sga-rise .6s cubic-bezier(.16,.84,.44,1) .94s both; }

      /* ⚠ REDUCED MOTION — EVERY STATE MUST STILL BE REACHABLE AND READABLE.
         An entrance that only fades in is invisible to anyone who has turned
         animation off, so each one is pinned to its FINAL state rather than
         simply switched off: full opacity, no offset, the hairlines drawn. */
      @media (prefers-reduced-motion: reduce) {
        .sga-rise, .sga-figure, .sga-form, .sga-done,
        .sga-ok-eyebrow, .sga-ok-amount, .sga-ok-title, .sga-ok-when,
        .sga-ok-standing, .sga-ok-sub, .sga-ok-actions {
          animation: none !important; opacity: 1 !important; transform: none !important; }
        .sga-draw, .sga-ok-rule { animation: none !important; transform: scaleX(1) !important; }
        .sga-dots i { animation: none !important; opacity: .7 !important; }
        .sga-go { transition: none; }
      }

      /* The auction sits inside the guide's 88% phone measure; its own blocks
         must not inherit the centring the prose has. */
      .sga-banner, .sga-lot, .sga-sale, .sga-saleblock, .sga-form,
      .sga-ok, .sga-done, .sga-loading, .sga-statefail { text-align: left; width: auto; }
    ` }} />
  )
}

export { SAGE, INK }
