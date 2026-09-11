'use client'

import { useState } from 'react'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// THE CORK BOARD — the club's notices, pinned up the way a club pins them.
// ───────────────────────────────────────────────────────────────────────────
// A board of real cork in a dark wooden frame. Each notice is a sheet of
// paper at its own slight angle, held by a push-pin (a red one if the
// Committee has pinned it for good) or a strip of tape. Hover lifts a sheet
// and straightens it; click unfolds it in place to read the whole thing.
//
// Angles, pin colours and tape are chosen from the notice's id, so a sheet
// hangs the same way every visit rather than jumping about on each render —
// and SSR and the browser agree, so there is no hydration mismatch.
//
// Used full on /members/notices and `compact` on the member dashboard.

export interface BoardNotice {
  id: string
  title: string
  body: string
  category: string
  pinned: boolean
  author?: string | null
  created_at?: string | null
}

const CAT: Record<string, { en: string; vn: string }> = {
  committee: { en: 'Committee', vn: 'Hội đồng' }, fixture: { en: 'Fixture', vn: 'Thi đấu' },
  general: { en: 'General', vn: 'Chung' }, whisky: { en: 'Whisky', vn: 'Whisky' },
}
const PINS = ['#2F6B4F', '#D4B85A', '#3E5C8A', '#8A6A1F', '#5E6650']
const PAPERS = ['#FBF6EC', '#F6EEDC', '#FFF9EE', '#F3EBD7']

// A small, stable hash of the id → the sheet's personality.
function seed(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  const r = (n: number) => { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return ((h >>> 0) % 1000) / 1000 * n }
  return { tilt: r(5) - 2.5, pin: Math.floor(r(PINS.length)), paper: Math.floor(r(PAPERS.length)), tape: r(1) < .22, nudge: r(14) - 7 }
}

function ago(dateStr: string | null | undefined, t: (en: string, vn: string) => string) {
  if (!dateStr) return ''
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return t('just now', 'vừa xong')
  if (mins < 60) return t(`${mins} min ago`, `${mins} phút trước`)
  const h = Math.floor(mins / 60)
  if (h < 24) return t(`${h}h ago`, `${h} giờ trước`)
  const d = Math.floor(h / 24)
  if (d < 30) return t(`${d} day${d === 1 ? '' : 's'} ago`, `${d} ngày trước`)
  const m = Math.floor(d / 30)
  return t(`${m} month${m === 1 ? '' : 's'} ago`, `${m} tháng trước`)
}

export default function CorkBoard({ notices, compact = false, empty }: {
  notices: BoardNotice[]
  compact?: boolean
  empty?: React.ReactNode
}) {
  const { t } = useLang()
  const [open, setOpen] = useState<string | null>(null)
  const shown = compact ? notices.slice(0, 3) : notices

  return (
    <div className={`cb ${compact ? 'is-compact' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* the frame, then the cork */
        .cb { position: relative; border-radius: 6px; padding: 14px;
              background: linear-gradient(135deg, #3B2616, #2A1A0E 45%, #3E2918);
              box-shadow: 0 30px 70px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.08), inset 0 -2px 0 rgba(0,0,0,.4); }
        .cb-cork { position: relative; border-radius: 3px; min-height: 260px; padding: 40px 30px 34px;
                   background-color: #B68A56;
                   background-image:
                     radial-gradient(ellipse at 30% 20%, rgba(255,230,190,.18), transparent 60%),
                     radial-gradient(ellipse at 80% 90%, rgba(60,30,10,.25), transparent 55%),
                     url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35  0 0 0 0 .2  0 0 0 0 .08  0 0 0 1.1 -.35'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23c)'/%3E%3C/svg%3E");
                   box-shadow: inset 0 0 40px rgba(50,25,8,.55), inset 0 2px 6px rgba(0,0,0,.35);
                   columns: 3 250px; column-gap: 28px; }
        .cb.is-compact .cb-cork { columns: 3 190px; column-gap: 20px; padding: 30px 22px 24px; min-height: 0; }

        /* a sheet of paper */
        .cb-note { all: unset; box-sizing: border-box; display: block; width: 100%; break-inside: avoid; margin: 0 0 30px;
                   position: relative; cursor: pointer; text-align: left; color: #052E20;
                   padding: 26px 20px 16px; border-radius: 2px;
                   box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 10px 18px rgba(40,20,5,.35), 0 2px 4px rgba(40,20,5,.2);
                   transform: rotate(var(--tilt)) translateX(var(--nudge));
                   transition: transform .45s cubic-bezier(.16,.84,.44,1), box-shadow .45s ease; }
        .cb.is-compact .cb-note { margin-bottom: 20px; padding: 22px 16px 12px; }
        .cb-note::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: 2px;
                          background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 30%, rgba(120,90,40,.06)); }
        .cb-note:hover, .cb-note:focus-visible { transform: rotate(0deg) translateY(-4px) scale(1.02);
                          box-shadow: 0 2px 2px rgba(0,0,0,.18), 0 22px 36px rgba(40,20,5,.42); z-index: 2; }
        .cb-note:focus-visible { outline: 2px solid #D4B85A; outline-offset: 4px; }
        .cb-note.is-open { transform: rotate(0deg) scale(1.01); z-index: 3; }

        /* the push-pin: a domed head with a glint, and its shadow on the paper */
        .cb-pin { position: absolute; top: 8px; left: 50%; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%;
                  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.75), transparent 28%), var(--pin);
                  box-shadow: 2px 4px 5px rgba(0,0,0,.4), inset -2px -3px 4px rgba(0,0,0,.3); z-index: 2; }
        /* tape instead of a pin, now and then */
        .cb-tape { position: absolute; top: -9px; left: 50%; width: 86px; height: 22px; margin-left: -43px;
                   background: rgba(236, 226, 196, .72); transform: rotate(-3deg);
                   box-shadow: 0 1px 2px rgba(0,0,0,.15); z-index: 2; }

        .cb-cat { font-family: 'Google Sans Code', monospace; font-size: 9.5px; letter-spacing: .2em; text-transform: uppercase; opacity: .55; }
        .cb-stamp { position: absolute; top: 14px; right: 12px; font-family: 'Google Sans Code', monospace; font-size: 9px;
                    letter-spacing: .18em; text-transform: uppercase; color: #A33A2B; border: 1.5px solid #A33A2B; border-radius: 3px;
                    padding: 3px 6px 2px; transform: rotate(6deg); opacity: .8; }
        .cb-title { font-family: 'Rampant Sans', serif; font-size: 21px; line-height: 1.08; margin: 8px 0 0; }
        .cb.is-compact .cb-title { font-size: 17px; }
        .cb-body { font-family: 'Google Sans Code', monospace; font-size: 12px; line-height: 1.75; margin: 10px 0 0; white-space: pre-line;
                   display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
        .cb.is-compact .cb-body { -webkit-line-clamp: 3; font-size: 11.5px; }
        .cb-note.is-open .cb-body { -webkit-line-clamp: unset; display: block; }
        .cb-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 12px; padding-top: 8px;
                   border-top: 1px dashed rgba(5,46,32,.2);
                   font-family: 'Google Sans Code', monospace; font-size: 10px; opacity: .6; }
        .cb-more { font-family: 'Google Sans Code', monospace; font-size: 10px; letter-spacing: .08em; }

        .cb-empty { column-span: all; color: #FBF6EC; text-align: center; padding: 30px 10px; }
        @media (max-width: 640px) {
          .cb { padding: 10px; }
          .cb-cork { columns: 1; padding: 30px 18px 20px; }
          .cb.is-compact .cb-cork { columns: 1; }
        }
        @media (prefers-reduced-motion: reduce) { .cb-note { transition: none; } }
      ` }} />
      <div className="cb-cork">
        {shown.length === 0 && <div className="cb-empty">{empty}</div>}
        {shown.map(n => {
          const s = seed(n.id)
          const isOpen = open === n.id
          const cat = CAT[n.category]
          return (
            <button key={n.id} type="button" className={`cb-note ${isOpen ? 'is-open' : ''}`}
                    aria-expanded={isOpen}
                    style={{ background: PAPERS[s.paper], ['--tilt' as string]: `${s.tilt.toFixed(2)}deg`,
                             ['--nudge' as string]: `${compact ? 0 : s.nudge.toFixed(1)}px`,
                             ['--pin' as string]: n.pinned ? '#B23A2A' : PINS[s.pin] }}
                    onClick={() => setOpen(o => (o === n.id ? null : n.id))}>
              {s.tape && !n.pinned ? <span className="cb-tape" aria-hidden="true" /> : <span className="cb-pin" aria-hidden="true" />}
              {n.pinned && <span className="cb-stamp">{t('Pinned', 'Đã ghim')}</span>}
              <div className="cb-cat">{cat ? t(cat.en, cat.vn) : n.category}</div>
              <div className="cb-title">{n.title}</div>
              <p className="cb-body">{n.body}</p>
              {!compact && (
                <div className="cb-foot">
                  <span>{[n.author, ago(n.created_at, t)].filter(Boolean).join(' · ')}</span>
                  <span className="cb-more">{isOpen ? t('Fold ↑', 'Thu gọn ↑') : t('Read ↓', 'Đọc ↓')}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
