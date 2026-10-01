'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// THE BACK BAR, AS THE BAR SEES IT.
//
// Two whisky screens already exist on these tablets and neither answers the
// bar's question. The finder is the member's — what should I drink. The
// stocktake is the counter's — an hour walking the shelf. Nobody could ask
// "how much of the Springbank is left" or "what runs out tonight".
//
// WHAT IS LOW OPENS FIRST, unasked. It is the only part of this worth pushing
// at somebody: a member finding an empty bottle at the self-pour shelf is the
// failure this exists to prevent. Everything else is a search.
//
// ── NOTHING HERE WRITES A FILL ────────────────────────────────────────────
// A level typed in while serving is how a stocktake stops meaning anything —
// every number in whisky_fill_history has a sitting and a name against it. The
// button goes to the stocktake, which does it properly.
//
// A bottle nobody has counted says so, rather than drawing a full bar. A
// confident wrong number is worse here than an absence.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GOLD = '#D4B85A'

type Bottle = {
  id: string; name: string; distillery: string | null; region: string | null
  age: string | null; abv: string | null; notes: string | null
  pick: boolean; on_shelf: boolean
  fill_pct: number | null; counted_at: string | null; counted_by: string | null
}
type Shelf = {
  totals: { open: number; counted: number; uncounted: number; low: number; empty: number; picks: number }
  last_counted: { at: string; by: string | null } | null
  low: Bottle[]; empty: Bottle[]; low_pct: number
}

export default function StaffBar() {
  const { t } = useLang()
  const [shelf, setShelf] = useState<Shelf | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Bottle[] | null>(null)
  const [err, setErr] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/kiosk/staff/bar', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no'))))
      .then(setShelf)
      .catch(() => setErr(t('Could not read the shelf.', 'Không đọc được dữ liệu quầy.')))
  }, [t])

  const search = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 2) { setHits(null); return }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/kiosk/staff/bar?q=${encodeURIComponent(text.trim())}`, { cache: 'no-store' })
      if (r.ok) setHits((await r.json()).results || [])
    }, 260)
  }, [])

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <input
        value={q}
        onChange={e => { setQ(e.target.value); search(e.target.value) }}
        placeholder={t('A bottle, a distillery, a region', 'Tên chai, nhà chưng cất, vùng')}
        style={input} inputMode="search"
      />

      {err && <p className="sb-quiet">{err}</p>}

      {/* SEARCH REPLACES THE SHELF, it does not sit under it. Two lists on one
          tablet screen and the one you are reading is whichever you scrolled to. */}
      {hits && (
        <>
          <div className="sb-head">{t('Found', 'Kết quả')} · {hits.length}</div>
          {hits.length === 0 && <p className="sb-quiet">{t('No bottle by that name.', 'Không có chai nào như vậy.')}</p>}
          <ul className="sb-list">{hits.map(b => <Row key={b.id} b={b} t={t} />)}</ul>
        </>
      )}

      {!hits && shelf && (
        <>
          <div className="sb-sum">
            <Sum n={shelf.totals.open} label={t('open', 'đang mở')} />
            <Sum n={shelf.totals.low} label={t(`at or under ${shelf.low_pct}%`, `còn ≤ ${shelf.low_pct}%`)} gold={shelf.totals.low > 0} />
            <Sum n={shelf.totals.empty} label={t('empty', 'đã hết')} warn={shelf.totals.empty > 0} />
            <Sum n={shelf.totals.uncounted} label={t('never counted', 'chưa kiểm kê')} />
          </div>

          {/* THE DATE THE LOW LIST IS ONLY AS GOOD AS. */}
          <div className="sb-when">
            {shelf.last_counted
              ? t(`Last counted ${shelf.last_counted.at.slice(0, 10)}${shelf.last_counted.by ? ` by ${shelf.last_counted.by}` : ''}.`,
                  `Kiểm kê lần cuối ${shelf.last_counted.at.slice(0, 10)}${shelf.last_counted.by ? ` bởi ${shelf.last_counted.by}` : ''}.`)
              : t('The shelf has never been counted.', 'Quầy chưa từng được kiểm kê.')}
          </div>

          {shelf.low.length > 0 && (
            <>
              <div className="sb-head sb-gold">{t('Running out', 'Gần hết')}</div>
              <ul className="sb-list">{shelf.low.map(b => <Row key={b.id} b={b} t={t} />)}</ul>
            </>
          )}

          {shelf.empty.length > 0 && (
            <>
              <div className="sb-head sb-warn">{t('Empty on the shelf', 'Đã hết trên quầy')}</div>
              <ul className="sb-list">{shelf.empty.map(b => <Row key={b.id} b={b} t={t} />)}</ul>
            </>
          )}

          {shelf.low.length === 0 && shelf.empty.length === 0 && (
            <p className="sb-quiet">
              {t('Nothing is running low on the last count. Search for a bottle to see what is left in it.',
                 'Theo lần kiểm kê gần nhất không có chai nào gần hết. Tìm một chai để xem còn lại bao nhiêu.')}
            </p>
          )}

          <button onClick={() => { window.location.href = '/kiosk/stocktake' }} className="sb-count">
            {t('Count the shelf', 'Kiểm kê quầy')}
            <span className="sb-count-sub">
              {t('the only place a level gets written', 'nơi duy nhất ghi lại mức còn lại')}
            </span>
          </button>
        </>
      )}
    </div>
  )
}

function Row({ b, t }: { b: Bottle; t: (en: string, vn: string) => string }) {
  const pct = b.fill_pct
  return (
    <li className="sb-row">
      <div className="sb-main">
        <div className="sb-name">
          {b.name}
          {b.pick && <span className="sb-pick">{t('committee’s pick', 'lựa chọn của hội đồng')}</span>}
        </div>
        <div className="sb-meta">
          {[b.distillery, b.region, b.age, b.abv].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}
          {!b.on_shelf && <span className="sb-off">{t('not on the shelf', 'không còn trên quầy')}</span>}
        </div>
        {b.notes && <div className="sb-notes">{b.notes}</div>}
      </div>
      <div className="sb-fill">
        {pct == null ? (
          <span className="sb-nocount">{t('not counted', 'chưa kiểm kê')}</span>
        ) : (
          <>
            <span className="sb-pct" style={pct === 0 ? { color: '#C27070' } : pct <= 25 ? { color: GOLD } : undefined}>{pct}%</span>
            <span className="sb-bar"><span className="sb-bar-in" style={{ width: `${Math.max(2, pct)}%`, background: pct === 0 ? '#C27070' : pct <= 25 ? GOLD : 'rgba(229,212,194,.5)' }} /></span>
          </>
        )}
      </div>
    </li>
  )
}

function Sum({ n, label, gold, warn }: { n: number; label: string; gold?: boolean; warn?: boolean }) {
  return (
    <div>
      <div className="sb-sum-n" style={warn ? { color: '#C27070' } : gold ? { color: GOLD } : undefined}>{n}</div>
      <div className="sb-sum-l">{label}</div>
    </div>
  )
}

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(229,212,194,0.06)',
  border: '1px solid rgba(229,212,194,0.2)', borderRadius: 10, color: INK,
  fontFamily: SERIF, fontSize: 19, padding: '14px 16px', outline: 'none', marginBottom: 20,
}

const CSS = `
.sb-quiet { font-family: ${MONO}; font-size: 12px; line-height: 1.85; color: #B2AA98; opacity: .72; margin: 14px 0 0; max-width: 58ch; }
.sb-sum { display: flex; gap: 28px; flex-wrap: wrap; }
.sb-sum-n { font-family: ${SERIF}; font-size: 26px; color: ${INK}; line-height: 1; }
.sb-sum-l { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .13em; text-transform: uppercase;
            color: rgba(229,212,194,.45); margin-top: 6px; }
.sb-when { font-family: ${MONO}; font-size: 10.5px; color: rgba(229,212,194,.45); margin: 16px 0 0; }

.sb-head { font-family: ${MONO}; font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
           color: rgba(229,212,194,.45); margin: 28px 0 2px; }
.sb-gold { color: ${GOLD}; opacity: .85; }
.sb-warn { color: #C27070; opacity: .9; }

.sb-list { list-style: none; margin: 10px 0 0; padding: 0; }
.sb-row { display: flex; gap: 18px; align-items: flex-start; padding: 13px 2px;
          border-top: 1px solid rgba(229,212,194,.12); }
.sb-row:last-child { border-bottom: 1px solid rgba(229,212,194,.12); }
.sb-main { flex: 1 1 auto; min-width: 0; }
.sb-name { font-family: ${SERIF}; font-size: 18px; line-height: 1.3; color: ${INK}; }
.sb-pick { font-family: ${MONO}; font-size: 9px; letter-spacing: .12em; text-transform: uppercase;
           color: ${GOLD}; margin-left: 10px; }
.sb-meta { display: flex; gap: 12px; flex-wrap: wrap; font-family: ${MONO}; font-size: 9.5px;
           letter-spacing: .1em; text-transform: uppercase; color: rgba(229,212,194,.45); margin-top: 6px; }
.sb-off { color: #C27070; }
.sb-notes { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; color: rgba(229,212,194,.55);
            margin-top: 7px; max-width: 62ch; }
.sb-fill { flex: 0 0 96px; text-align: right; }
.sb-pct { font-family: ${SERIF}; font-size: 19px; color: ${INK}; }
.sb-bar { display: block; height: 3px; background: rgba(229,212,194,.12); border-radius: 2px; margin-top: 7px; }
.sb-bar-in { display: block; height: 3px; border-radius: 2px; }
.sb-nocount { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase;
              color: rgba(229,212,194,.35); }

.sb-count { display: block; width: 100%; text-align: left; margin-top: 30px; cursor: pointer;
            background: rgba(212,184,90,.07); border: 1px solid rgba(212,184,90,.3);
            border-radius: 12px; padding: 18px 20px; font-family: ${SERIF}; font-size: 19px; color: ${GOLD}; }
.sb-count-sub { display: block; font-family: ${MONO}; font-size: 10.5px; letter-spacing: .08em;
                text-transform: uppercase; color: rgba(229,212,194,.45); margin-top: 7px; }

@media (max-width: 560px) { .sb-fill { flex: 0 0 72px; } .sb-notes { display: none; } }
`
