'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// "WHAT ARE YOU DRINKING?" — on the tablet, with the glass in their hand.
//
// The club has ZERO tasting notes. Not few — none. Every palate surface in the
// building derives from them: the radar, the drift, the journey, the
// palate-twins. All empty, because the only place that ever asked was a page in
// the portal, visited at home days later with nothing to taste.
//
// This asks where the whisky is.
//
// ── ONE TAP IS THE WHOLE DESIGN ───────────────────────────────────────────
// Search, tap the bottle, done. The flavour families come from the WHISKY, not
// from the member, so a note with no words still teaches the system everything
// it needs — and the first note is the one that turns an empty radar into
// theirs. A form with a rating, tags and a photo would collect better notes
// from the handful of people who fill it in and nothing from everybody else.
// The optional line is there for the member who wants it, after the tap, never
// before.
//
// ── AND IT SHOWS THE LOOP CLOSING ─────────────────────────────────────────
// The reply carries the new source_count, so the screen can say the palate just
// moved. That is the only reward worth offering for a tap: evidence that it
// did something. onLogged lets the page re-fetch so the radar beside this fills
// in while they are still standing there.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GOLD = '#D4B85A'

interface Dram { id: string; name: string; distillery: string | null; region: string | null; age: string | null; abv: string | null }

export default function MemberPour({ onLogged }: { onLogged?: () => void }) {
  const { t, lang } = useLang()
  const [shelf, setShelf] = useState<Dram[] | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<{ name: string; already: boolean } | null>(null)
  const [err, setErr] = useState('')
  const boxRef = useRef<HTMLDivElement | null>(null)

  // The shelf is fetched once, when they ask. It is a few hundred bottles of
  // name and region — small enough to filter in the hand, and filtering here
  // means no request per keystroke on a tablet's wifi.
  const load = useCallback(async () => {
    if (shelf) return
    try {
      const r = await fetch('/api/kiosk/whiskies', { cache: 'no-store' })
      if (r.ok) setShelf((await r.json()).whiskies || [])
    } catch { setErr(t('Could not read the shelf.', 'Không đọc được danh sách.')) }
  }, [shelf, t])

  useEffect(() => { if (open) { load(); boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } }, [open, load])

  const hits = (() => {
    const s = q.trim().toLowerCase()
    if (!shelf) return []
    if (s.length < 2) return []
    return shelf.filter(d =>
      d.name.toLowerCase().includes(s) ||
      (d.distillery || '').toLowerCase().includes(s) ||
      (d.region || '').toLowerCase().includes(s),
    ).slice(0, 7)
  })()

  const log = async (d: Dram) => {
    setBusy(d.id); setErr('')
    try {
      const r = await fetch('/api/kiosk/member/note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // The language goes with it: with no words typed the server writes
        // what happened ("Poured in The Library Bar"), and it should be in the
        // member's own language in their own notes list.
        body: JSON.stringify({ whisky_id: d.id, lang }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || t('Could not save that.', 'Không lưu được.')); return }
      setDone({ name: j.name || d.name, already: !!j.already })
      setQ(''); setOpen(false)
      onLogged?.()
    } catch { setErr(t('Could not save that.', 'Không lưu được.')) }
    finally { setBusy(null) }
  }

  return (
    <div ref={boxRef} style={{ marginTop: 'clamp(14px,3vh,30px)' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {done ? (
        <div className="mp-done">
          <div className="mp-done-t">
            {done.already
              ? t(`Already noted — ${done.name}.`, `Đã ghi nhận — ${done.name}.`)
              : t(`Noted — ${done.name}.`, `Đã ghi — ${done.name}.`)}
          </div>
          <div className="mp-done-s">
            {done.already
              ? t('You logged this one earlier tonight.', 'Bạn đã ghi ly này tối nay rồi.')
              : t('Your palate just moved. Only you can see this.', 'Khẩu vị của bạn vừa được cập nhật. Chỉ bạn thấy điều này.')}
          </div>
          <button onClick={() => { setDone(null); setOpen(true) }} className="mp-again">
            {t('Note another', 'Ghi ly khác')}
          </button>
        </div>
      ) : !open ? (
        <button onClick={() => setOpen(true)} className="mp-ask">
          {t('What are you drinking?', 'Bạn đang uống gì?')}
          <span className="mp-ask-s">{t('one tap · only you see it', 'một lần chạm · chỉ bạn thấy')}</span>
        </button>
      ) : (
        <>
          <input
            value={q} autoFocus
            onChange={e => setQ(e.target.value)}
            placeholder={t('A bottle, a distillery, a region', 'Tên chai, nhà chưng cất, vùng')}
            className="mp-field" inputMode="search"
          />
          {!shelf && <p className="mp-quiet">{t('Reading the shelf…', 'Đang đọc danh sách…')}</p>}
          {shelf && q.trim().length >= 2 && hits.length === 0 && (
            <p className="mp-quiet">{t('Nothing by that name. Ask whoever is pouring.', 'Không có chai nào như vậy. Hãy hỏi người đang phục vụ.')}</p>
          )}
          <ul className="mp-list">
            {hits.map(d => (
              <li key={d.id}>
                <button onClick={() => log(d)} disabled={!!busy} className="mp-hit">
                  <span className="mp-hit-n">{d.name}</span>
                  <span className="mp-hit-m">{[d.region, d.age, d.abv].filter(Boolean).join(' · ')}</span>
                  {busy === d.id && <span className="mp-spin" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => { setOpen(false); setQ('') }} className="mp-cancel">{t('Not now', 'Để sau')}</button>
        </>
      )}
      {err && <div className="mp-err">{err}</div>}
    </div>
  )
}

const CSS = `
  .mp-ask { display: block; width: 100%; text-align: left; cursor: pointer;
            background: rgba(212,184,90,.08); border: 1px solid rgba(212,184,90,.32);
            border-radius: 10px; padding: 15px 18px; font-family: ${SERIF}; font-size: 19px; color: ${GOLD}; }
  .mp-ask-s { display: block; font-family: ${MONO}; font-size: 10px; letter-spacing: .1em;
              text-transform: uppercase; color: rgba(229,212,194,.45); margin-top: 7px; }

  .mp-field { width: 100%; box-sizing: border-box; background: rgba(229,212,194,.07);
              border: 1px solid rgba(229,212,194,.22); border-radius: 8px; color: ${INK};
              font-family: ${SERIF}; font-size: 18px; padding: 13px 15px; outline: none; }
  .mp-quiet { font-family: ${MONO}; font-size: 11.5px; line-height: 1.8; color: rgba(229,212,194,.55); margin: 12px 0 0; }
  .mp-err { font-family: ${MONO}; font-size: 11.5px; color: #C27070; margin-top: 12px; line-height: 1.7; }

  .mp-list { list-style: none; margin: 10px 0 0; padding: 0; }
  .mp-list li { border-top: 1px solid rgba(229,212,194,.12); }
  .mp-hit { position: relative; display: block; width: 100%; text-align: left; background: none;
            border: none; cursor: pointer; padding: 13px 2px; color: inherit;
            -webkit-tap-highlight-color: transparent; }
  .mp-hit-n { display: block; font-family: ${SERIF}; font-size: 17px; color: ${INK}; line-height: 1.3; }
  .mp-hit-m { display: block; font-family: ${MONO}; font-size: 10px; letter-spacing: .1em;
              text-transform: uppercase; color: rgba(229,212,194,.45); margin-top: 5px; }
  .mp-spin { position: absolute; right: 4px; top: 50%; width: 12px; height: 12px; margin-top: -6px;
             border: 2px solid rgba(229,212,194,.25); border-top-color: ${GOLD};
             border-radius: 50%; animation: mp-turn .75s linear infinite; }
  @keyframes mp-turn { to { transform: rotate(360deg); } }

  .mp-cancel { background: none; border: none; cursor: pointer; margin-top: 14px; padding: 8px 0;
               font-family: ${MONO}; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase;
               color: rgba(229,212,194,.45); }

  .mp-done-t { font-family: ${SERIF}; font-size: 20px; color: #8FC48F; line-height: 1.3; }
  .mp-done-s { font-family: ${MONO}; font-size: 11.5px; line-height: 1.8; color: rgba(229,212,194,.6); margin-top: 8px; max-width: 34ch; }
  .mp-again { background: none; border: none; cursor: pointer; margin-top: 12px; padding: 8px 0;
              font-family: ${MONO}; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: ${GOLD}; }

  @media (pointer: coarse) { .mp-hit { padding: 16px 2px; } .mp-ask { padding: 18px; } }
  @media (prefers-reduced-motion: reduce) { .mp-spin { display: none; } }
`
