'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang, type Lang } from '@/lib/lang'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'
import { typeLabel } from '@/lib/fixtures'

// ASK THE PEOPLE WHO WERE THERE.
//
// The Event Gallery works and holds 14 contributions, every one of them put
// there by somebody who thought of it unprompted. This is the thing that
// prompts: one member, one evening they were actually signed up to, once.
//
// ── IT RENDERS NOTHING FAR MORE OFTEN THAN IT RENDERS ─────────────────────
// No finished fixture in the last month, or already asked, or they already
// posted → nothing. Same contract as ReturnCard beside it. A card that is
// always there is furniture, and furniture does not get tapped.
//
// ── NOT THIS TIME IS A REAL ANSWER, AND IT IS SERVER-SIDE ─────────────────
// ReturnCard dismisses into localStorage, which is right for a cosmetic recap:
// it costs nothing if it is lost. This one is a QUESTION PUT TO A PERSON. Losing
// the answer means asking again on their phone, and again on the tablet, which
// is how a polite ask turns into nagging. So it writes to gallery_prompts and
// the answer follows them.
//
// ── AND SAYING YES RECORDS NOTHING ────────────────────────────────────────
// Tapping through opens the album and leaves the prompt OPEN; it is answered
// when a photograph actually arrives. So somebody who opens it and gives up is
// asked once more, which is correct — the ask is still outstanding. See the note
// in app/api/members/gallery/nudge/route.ts.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Ask {
  fixture_id: string
  event_id: string | null
  title: string
  type: string
  date: string
  location: string | null
  already: number
}

type T = (en: string, vn: string) => string

function dateLabel(iso: string, t: T, lang: Lang): string {
  const d = new Date(iso + 'T00:00:00')
  const days = Math.round((new Date(new Date().toDateString()).getTime() - d.getTime()) / 86_400_000)
  if (days === 1) return t('yesterday', 'hôm qua')
  if (days < 7) return t(`${days} days ago`, `${days} ngày trước`)
  const date = d.toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long' })
  return t(`on ${date}`, `ngày ${date}`)
}

export default function GalleryNudge() {
  const { t, lang } = useLang()
  const router = useRouter()
  const [ask, setAsk] = useState<Ask | null>(null)
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    fetch('/api/members/gallery/nudge', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j?.ask) setAsk(j.ask) })
      .catch(() => { /* the card simply does not render */ })
  }, [])

  if (!ask || gone) return null

  const send = async (action: 'open' | 'dismiss') => {
    setBusy(true)
    try {
      const r = await fetch('/api/members/gallery/nudge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, fixture_id: ask.fixture_id }),
      })
      const j = await r.json().catch(() => ({}))
      if (action === 'dismiss') { setGone(true); return }
      // Straight into the album, landing on the two + buttons (#add). If the
      // album could not be opened the card stays put rather than pretending.
      if (r.ok && j.event_id) router.push(`/members/gallery/${j.event_id}#add`)
      else setBusy(false)
    } catch { setBusy(false) }
  }

  const when = dateLabel(ask.date, t, lang)
  const kind = typeLabel(ask.type, lang === 'vn' ? 'vn' : 'en')

  return (
    <div className="gn" style={card}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <CreamInkDefs />
      <button onClick={() => send('dismiss')} aria-label={t('Not this time', 'Lần này thì không')} style={closeBtn}>×</button>
      <div style={{ minWidth: 0 }}>
        <div style={kicker}>{t('You were there', 'Bạn đã có mặt')}</div>
        <div style={headline}>{ask.title}</div>
        <div style={detail}>
          {[kind, when, ask.location].filter(Boolean).join(' · ')}
        </div>
        <div style={line}>
          {ask.already > 0
            ? t(`${ask.already} ${ask.already === 1 ? 'photograph is' : 'photographs are'} up already. Add yours?`,
                `Đã có ${ask.already} ảnh. Bạn thêm ảnh của mình nhé?`)
            : t('Nobody has put up a photograph yet. Yours would be the first.',
                'Chưa ai đăng ảnh nào. Ảnh của bạn sẽ là đầu tiên.')}
        </div>
        <div className="gn-acts">
          <button onClick={() => send('open')} disabled={busy} className="gn-cta">
            {t('Add your photos', 'Thêm ảnh của bạn').replace(/\s*→\s*$/, '')}
            {' '}<span className="gn-go" aria-hidden="true">→</span>
          </button>
          <button onClick={() => send('dismiss')} disabled={busy} className="gn-no">
            {t('Not this time', 'Lần này thì không')}
          </button>
        </div>
      </div>
      <div className="gn-art" aria-hidden="true">
        <CreamInk name="girl-toast" width="100%" rot={-5} dur={8.5} />
      </div>
    </div>
  )
}

const CSS = `
  .gn { display: grid; grid-template-columns: minmax(0, 1fr) 96px; gap: 28px; align-items: center; }
  .gn-art { width: 96px; margin-right: 40px; }
  .gn-acts { display: flex; gap: 26px; flex-wrap: wrap; align-items: baseline; margin-top: 22px; }
  .gn-cta { background: none; border: none; padding: 0 0 6px; cursor: pointer; color: #E5D4C2;
            border-bottom: 1px solid rgba(229,212,194,.6);
            font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  .gn-go { display: inline-block; transition: transform .35s ease; }
  .gn-cta:hover .gn-go { transform: translateX(7px); }
  .gn-no { background: none; border: none; padding: 0; cursor: pointer; color: #E5D4C2; opacity: .5;
           font-family: ${MONO}; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
  .gn-no:hover { opacity: .8; }
  @media (max-width: 560px) { .gn { grid-template-columns: minmax(0, 1fr) 64px; gap: 16px; align-items: start; }
                              .gn-art { width: 64px; margin: 36px 0 0; } }
  @media (prefers-reduced-motion: reduce) { .gn-go { transition: none; } }
`

const card: React.CSSProperties = { position: 'relative', borderTop: '1px solid rgba(229,212,194,0.18)', padding: '28px 0', color: '#E5D4C2' }
const closeBtn: React.CSSProperties = { position: 'absolute', top: 14, right: 0, background: 'transparent', border: 'none', color: '#E5D4C2', fontSize: 22, lineHeight: 1, cursor: 'pointer', opacity: 0.7, padding: 4 }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#B0C18E' }
const headline: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(30px, 4.4vw, 52px)', lineHeight: 0.98, color: '#E5D4C2', margin: '14px 0 12px' }
const detail: React.CSSProperties = { fontFamily: MONO, fontSize: 13.5, color: '#E5D4C2', opacity: 0.88, lineHeight: 1.8 }
const line: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#D4B85A', marginTop: 6, lineHeight: 1.8 }
