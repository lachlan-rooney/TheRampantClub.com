'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE STUDIO — a hub for the room, not a page about one exhibition.
// ───────────────────────────────────────────────────────────────────────────
// The floor states itself first, then the artists. Choosing a name crossfades
// its hero and swaps the detail beneath it; the exhibition itself lives at
// /studio/[slug], so this stays a hub however many collaborations there are.
//
// The motion is all CSS — no library, nothing loaded from a CDN, so the CSP is
// untouched. Everything respects prefers-reduced-motion, because a gallery that
// makes someone queasy is not sophisticated.
const SAGE = '#B0C18E'
const INK  = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO  = "'Google Sans Code', 'DM Mono', monospace"

export interface Collaboration {
  id: string; slug: string; artist_name: string; artist_name_vn: string | null
  title_en: string | null; title_vn: string | null; status: string
  opens_on: string | null; closes_on: string | null
  opening_from: string | null; opening_to: string | null
  accent: string | null; hero_path: string | null
  [k: string]: unknown
}
export interface CollabImage {
  id: string; collaboration_id: string; storage_path: string
  caption_en: string | null; orientation: string; sort: number
}

// A .png here is a mark with transparency, not a photograph of the work.
const isMark = (p: string) => /\.png($|\?)/i.test(p)
const srcOf = (p: string) => (p.startsWith('/') || p.startsWith('http') ? p : `/api/entries/attachment/${p}`)
const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
export const tenseOf = (a: string | null, b: string | null) => {
  if (!a) return null
  const today = vnToday(); const end = b || a
  if (today < a) return 'Forthcoming'
  if (today > end) return 'Past'
  return 'On now'
}
const fmt = (d: string) => new Date(d + 'T12:00:00+07:00')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
export const dateRange = (a: string | null, b: string | null) =>
  !a ? null : (b && b !== a ? `${fmt(a)} — ${fmt(b)}` : fmt(a))

export default function StudioIndex({ collaborations, images }: {
  collaborations: Collaboration[]; images: CollabImage[]
}) {
  // On now or forthcoming opens first — the hub should show what is happening.
  const startAt = Math.max(0, collaborations.findIndex(
    c => ['On now', 'Forthcoming'].includes(tenseOf(c.opens_on, c.closes_on) || '')))
  const [active, setActive] = useState(startAt)
  const [entered, setEntered] = useState(false)
  const tabRef = useRef<Record<string, HTMLButtonElement | null>>({})
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const t = setTimeout(() => setEntered(true), 60); return () => clearTimeout(t) }, [])
  const c = collaborations[active]
  // scrollIntoView walks UP to the nearest scrollable ancestor — and <main>
  // has overflow-x: hidden, which makes it scrollable even though no scrollbar
  // shows. So centring a tab slid the WHOLE PAGE sideways, further for the
  // second artist than the first, which is why it looked like Rizal's content
  // was pushed off the edge. Scroll the strip itself and nothing else can move.
  useEffect(() => {
    const el = c ? tabRef.current[c.id] : null
    const strip = stripRef.current
    if (!el || !strip) return
    strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: 'smooth' })
  }, [c])

  const heroOf = (x: Collaboration) =>
    x.hero_path || images.find(i => i.collaboration_id === x.id)?.storage_path || null

  // THE DUPLICATE. The hero is shown large at the top AND every artist gets a
  // card in "Every exhibition" below — so the artist currently selected had the
  // same picture on screen twice. Not a duplicate ROW: the data was clean, the
  // page rendered one image in two places. A card therefore prefers a picture
  // from the set and only falls back to the hero when there is nothing else.
  const cardOf = (x: Collaboration) =>
    images.find(i => i.collaboration_id === x.id && i.storage_path !== x.hero_path)?.storage_path
    || heroOf(x)
  const stripOf = useMemo(() =>
    (x: Collaboration) => images.filter(i => i.collaboration_id === x.id).slice(0, 4), [images])

  if (!collaborations.length) {
    return (
      <main style={{ background: SAGE, minHeight: '100vh', color: INK, padding: '120px 24px' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(48px, 12vw, 130px)', margin: 0 }}>The Studio</h1>
        <p style={{ fontFamily: MONO, fontSize: 13, opacity: .7 }}>The next exhibition is being prepared.</p>
      </main>
    )
  }

  return (
    <main style={{ background: SAGE, minHeight: '100vh', color: INK, overflowX: 'hidden', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        .st-rise { animation: rise .9s cubic-bezier(.16,.84,.44,1) both; }
        .st-hero img { transition: opacity .85s ease, transform 8s ease-out; }
        .st-hero:hover img.is-on { transform: scale(1.04); }
        .st-tab { position: relative; }
        .st-tab::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
          background: ${INK}; transform: scaleX(0); transform-origin: left;
          transition: transform .45s cubic-bezier(.16,.84,.44,1);
        }
        .st-tab.is-on::after { transform: scaleX(1); }
        .st-tab:hover::after { transform: scaleX(1); opacity: .4; }
        .st-thumb { overflow: hidden; }
        .st-thumb img { transition: transform .7s cubic-bezier(.16,.84,.44,1); }
        .st-card:hover .st-thumb img { transform: scale(1.05); }
        .st-go { display: inline-block; transition: transform .35s ease; }
        .st-card:hover .st-go, .st-cta:hover .st-go { transform: translateX(7px); }
        @keyframes drift { from { transform: rotate(6deg) translateY(0) } to { transform: rotate(4deg) translateY(-16px) } }
        /* On a DESK it sits beside the masthead, in the empty half. It is
           positioned from the RIGHT EDGE OF THE TEXT COLUMN rather than the
           viewport, so it cannot creep over the words as the copy grows — and
           it will grow: Miss Châu's Vietnamese runs longer than the English. */
        .st-lion {
          position: absolute; top: 30px; right: -70px;
          width: clamp(260px, 34vw, 520px);
          opacity: .92; pointer-events: none; z-index: 0;
          animation: drift 7s ease-in-out infinite alternate;
        }
        /* On a PHONE there is no empty half, so it stops being a background at
           all and takes a band of its own below the copy — clear of every word
           rather than faded behind them. A lion at 15% behind a paragraph is
           still a lion behind a paragraph. */
        @media (max-width: 900px) {
          .st-lion {
            position: static; display: block;
            width: 78vw; max-width: 360px;
            margin: 26px -18vw 0 auto;   /* runs off the right edge, clear of text */
            opacity: .95; animation: none;
            transform: rotate(5deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .st-lion { animation: none !important; }
          .st-rise, .st-hero img, .st-thumb img, .st-tab::after, .st-go { animation: none !important; transition: none !important; }
        }
      ` }} />

      {/* ══ THE ROOM ═══════════════════════════════════════════════════ */}
      {/* ══ THE LION, PASTED ═══════════════════════════════════════════
          Toni's painting inside the club's rampant mark. It lives here
          permanently rather than belonging to his exhibition — the room keeps
          it. Off the right edge and slightly askew, like something stuck to a
          studio wall, and it drifts a little as the page scrolls. Behind
          everything and unselectable, so it never gets in the way of reading. */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1180, margin: '0 auto', padding: '96px 24px 0' }}>
        <div className={entered ? 'st-rise' : ''} style={{ animationDelay: '.05s' }}>

          {/* The Studio's own wordmark, with the set name as the accessible
              heading behind it. */}
          <h1 style={{ margin: '10px 0 0' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/studio/studio-wordmark.png" alt="The Studio"
                 style={{ width: 'min(560px, 78vw)', height: 'auto', display: 'block' }} />
          </h1>
          <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 3.4vw, 30px)', opacity: .5, marginTop: 12 }}>
            Phòng Studio
          </div>
        </div>
        <p className={entered ? 'st-rise' : ''} style={{ animationDelay: '.18s', fontFamily: MONO, fontSize: 14,
                     lineHeight: 2, maxWidth: 600, margin: '34px 0 0' }}>
          A quarterly rotating art space. Each exhibition is made <em>with</em> the artist rather than
          borrowed from them — an immersive installation, a room built around the work, and a whisky
          created for it that exists nowhere else.
        </p>

        {/* Toni's painting inside the club's mark. On a desk it sits absolutely
            in the empty half beside the masthead; on a phone the rule above
            turns it into a block in the flow here, running off the right edge —
            clear of every word rather than faded behind them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/studio/rizal/00-lion.png" alt="" aria-hidden="true" className="st-lion" />
      </div>

      {/* ══ THE ARTISTS ════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 1180, margin: '58px auto 0', padding: '0 24px' }}>
        <div ref={stripRef} style={{ display: 'flex', gap: 30, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {collaborations.map((x, i) => (
            <button key={x.id} ref={el => { tabRef.current[x.id] = el }} onClick={() => setActive(i)}
              className={`st-tab ${i === active ? 'is-on' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                       padding: '0 0 12px', textAlign: 'left', fontFamily: SERIF,
                       fontSize: 'clamp(19px, 3.6vw, 27px)', color: INK,
                       opacity: i === active ? 1 : .4, transition: 'opacity .35s ease' }}>
              {x.artist_name}
              {tenseOf(x.opens_on, x.closes_on) === 'Forthcoming' &&
                <span style={{ fontFamily: MONO, fontSize: 10, opacity: .75 }}> · soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ══ THE HERO — crossfades between artists ══════════════════════ */}
      <div className="st-hero" style={{ position: 'relative', width: '100%',
                                        height: 'min(70vh, 660px)', overflow: 'hidden', marginTop: 30 }}>
        {collaborations.map((x, i) => {
          const src = heroOf(x)
          return src ? (
            // Every hero is mounted and faded rather than swapped, so switching
            // artists never shows a blank frame while an image loads.
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={x.id} src={srcOf(src)} alt="" className={i === active ? 'is-on' : ''}
                 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                          // A MARK IS NOT A PHOTOGRAPH. A transparent PNG hero —
                          // an artist's logo rather than a picture of the work —
                          // gets contained and inset. `cover` blew the lion up to
                          // a crop of one paw.
                          objectFit: isMark(src) ? 'contain' : 'cover',
                          padding: isMark(src) ? 'clamp(18px, 4vw, 54px)' : 0,
                          opacity: i === active ? 1 : 0 }} />
          ) : null
        })}
        <div style={{ position: 'absolute', inset: 0,
                      background: `linear-gradient(to bottom, transparent 58%, ${SAGE} 100%)` }} />
      </div>

      {/* ══ THE SELECTED ARTIST ════════════════════════════════════════ */}
      {c && (
        <div key={c.id} className="st-rise" style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 24px 0' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase',
                        opacity: .62 }}>
            {[tenseOf(c.opens_on, c.closes_on), dateRange(c.opens_on, c.closes_on)].filter(Boolean).join('  ·  ')}
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(34px, 8vw, 88px)', lineHeight: .98, margin: '14px 0 0' }}>
            {c.title_en || c.artist_name}
          </h2>
          {c.title_en && (
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 3vw, 27px)', opacity: .62, marginTop: 10 }}>
              {c.artist_name}
            </div>
          )}

          {/* a glimpse of the work — the door, not the room */}
          {stripOf(c).length > 0 && (
            <div style={{ display: 'grid', gap: 12, marginTop: 30,
                          gridTemplateColumns: `repeat(${Math.min(4, stripOf(c).length)}, 1fr)` }}>
              {stripOf(c).map(im => (
                <div key={im.id} className="st-thumb" style={{ aspectRatio: '3 / 4', borderRadius: 12,
                                boxShadow: '0 12px 30px rgba(5,46,32,0.16)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={srcOf(im.storage_path)} alt="" loading="lazy"
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          )}

          <Link href={`/studio/${c.slug}`} className="st-cta"
                style={{ display: 'inline-block', marginTop: 30, textDecoration: 'none', color: INK,
                         fontFamily: MONO, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase',
                         borderBottom: `1px solid ${INK}`, paddingBottom: 6 }}>
            See the exhibition <span className="st-go">→</span>
          </Link>
        </div>
      )}

      {/* ══ EVERY EXHIBITION ═══════════════════════════════════════════ */}
      <div style={{ maxWidth: 1180, margin: '96px auto 0', padding: '0 24px 130px' }}>
        <div style={{ height: 1, background: INK, opacity: .15 }} />
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase',
                      margin: '26px 0 30px', opacity: .55 }}>Every exhibition</div>
        <div style={{ display: 'grid', gap: 40, gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
          {collaborations.map(x => (
            <Link key={x.id} href={`/studio/${x.slug}`} className="st-card"
                  style={{ textDecoration: 'none', color: INK, display: 'block' }}>
              {cardOf(x) && (
                <div className="st-thumb" style={{ width: '100%', aspectRatio: '4 / 5', borderRadius: 14,
                              boxShadow: '0 16px 38px rgba(5,46,32,0.18)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={srcOf(cardOf(x)!)} alt="" loading="lazy"
                       style={{ width: '100%', height: '100%', display: 'block',
                                objectFit: isMark(cardOf(x)!) ? 'contain' : 'cover',
                                padding: isMark(cardOf(x)!) ? 18 : 0 }} />
                </div>
              )}
              {/* An untitled exhibition falls back to the artist's name — so the
                  line beneath must not print it a second time. */}
              <div style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.15, marginTop: 14 }}>
                {x.title_en || x.artist_name}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, opacity: .62, marginTop: 6 }}>
                {[x.title_en ? x.artist_name : null, tenseOf(x.opens_on, x.closes_on)]
                  .filter(Boolean).join('  ·  ')}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, marginTop: 10 }}>
                View <span className="st-go">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
