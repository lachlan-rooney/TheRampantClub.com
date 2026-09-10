'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE STUDIO — a gallery page, not another room panel.
// ───────────────────────────────────────────────────────────────────────────
// SAGE, NOT BOTTLE GREEN. Inverting the site is what makes this read as
// somewhere else rather than another section, and it solves three things at
// once: the type gets real contrast in club green, paintings photographed
// against white studio walls sit properly on it, and the club's green line art
// becomes usable where cream would have been needed on the dark site.
//
// NOTHING OVERLAYS THE ARTWORK. The Spaces panels needed a scrim tuned to one
// photograph and it failed on the next; here the work sits in its own frame ON
// the ground, so there is no overlay to tune per image and no painting is
// cropped to fit a panel.
const SAGE = '#B0C18E'
const INK  = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO  = "'Google Sans Code', 'DM Mono', monospace"

export interface Collaboration {
  id: string; slug: string; artist_name: string; artist_name_vn: string | null
  title_en: string | null; title_vn: string | null; status: string
  opens_on: string | null; closes_on: string | null; accent: string | null
  hero_path: string | null; auction_on: string | null
  bio_en: string | null; bio_vn: string | null
  collaboration_en: string | null; collaboration_vn: string | null
  event_en: string | null; event_vn: string | null
  food_en: string | null; food_vn: string | null
  drinks_en: string | null; drinks_vn: string | null
  inspiration_en: string | null; inspiration_vn: string | null
}
export interface CollabImage {
  id: string; collaboration_id: string; storage_path: string
  caption_en: string | null; caption_vn: string | null; orientation: string; sort: number
}

// A storage_path beginning with "/" is already a public asset; anything else is
// a key in the attachments bucket. One rule, so images can be seeded from the
// repo before anyone uploads through the admin.
const srcOf = (p: string) =>
  p.startsWith('/') || p.startsWith('http') ? p : `/api/entries/attachment/${p}`

// ═══ TENSE COMES FROM THE DATES, NOT FROM A STORED WORD ════════════════════
// "Now Showing" went stale on /spaces because a human had to remember to change
// it. Storing 'live' for a forthcoming exhibition would make the same mistake in
// reverse — the page would announce something as current before it opened.
// `status` decides VISIBILITY; the dates decide how it reads.
const tenseOf = (a: string | null, b: string | null) => {
  if (!a) return null
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)  // Vietnam
  const end = b || a
  if (today < a)   return 'Forthcoming'
  if (today > end) return 'Past'
  return 'On now'
}

const dateRange = (a: string | null, b: string | null) => {
  if (!a) return null
  const f = (d: string) => new Date(d + 'T12:00:00+07:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
  return b && b !== a ? `${f(a)} — ${f(b)}` : f(a)
}

export default function StudioShowcase({ collaborations, images }: {
  collaborations: Collaboration[]; images: CollabImage[]
}) {
  const live = collaborations.filter(c => c.status === 'live')
  const past = collaborations.filter(c => c.status === 'past')
  const [active, setActive] = useState(0)
  const chip = useRef<Record<string, HTMLButtonElement | null>>({})
  const ordered = useMemo(() => [...live, ...past], [collaborations]) // eslint-disable-line react-hooks/exhaustive-deps
  const c = ordered[active]

  // The names index scrolls the current one into view — the day-chips pattern,
  // which is the one already proven on a phone.
  useEffect(() => {
    if (c) chip.current[c.id]?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [c])

  const mine = images.filter(i => i.collaboration_id === c?.id)

  if (!ordered.length) {
    return (
      <main style={{ background: SAGE, minHeight: '100vh', padding: '120px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 44, color: INK, margin: 0 }}>The Studio</h1>
          <p style={{ fontFamily: MONO, fontSize: 13, color: INK, opacity: .75, marginTop: 14 }}>
            The next exhibition is being prepared.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: SAGE, minHeight: '100vh', color: INK }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '96px 24px 120px' }}>

        <Link href="/" style={{ fontFamily: MONO, fontSize: 11, color: INK, opacity: .7, textDecoration: 'none' }}>
          ← The Rampant Club
        </Link>

        <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(40px, 9vw, 76px)', lineHeight: 1.02,
                     margin: '26px 0 4px', letterSpacing: '.01em' }}>The Studio</h1>
        <div style={{ fontFamily: MONO, fontSize: 13, opacity: .72 }}>Phòng Studio</div>
        <p style={{ fontFamily: MONO, fontSize: 13.5, lineHeight: 1.85, maxWidth: 560, marginTop: 20, opacity: .88 }}>
          A quarterly rotating art space on the second floor. Each exhibition is made with
          the artist, and each one leaves a whisky behind.
        </p>

        {/* ── THE NAMES. An index, not a tab bar — a gallery names its
            exhibitions, two of them is not navigation, and eight of them wraps
            to a second line and still reads as a list. ─────────────────── */}
        <div style={{ display: 'flex', gap: 26, overflowX: 'auto', margin: '44px 0 0',
                      paddingBottom: 10, scrollbarWidth: 'none' }}>
          {ordered.map((x, i) => (
            <button key={x.id} ref={el => { chip.current[x.id] = el }} onClick={() => setActive(i)}
              style={{ background: 'none', border: 'none', padding: '0 0 8px', cursor: 'pointer',
                       flexShrink: 0, textAlign: 'left',
                       fontFamily: SERIF, fontSize: 'clamp(19px, 3.6vw, 25px)',
                       color: INK, opacity: i === active ? 1 : 0.42,
                       borderBottom: i === active ? `2px solid ${INK}` : '2px solid transparent' }}>
              {x.artist_name}
              {tenseOf(x.opens_on, x.closes_on) === 'Forthcoming' && (
                <span style={{ fontFamily: MONO, fontSize: 10, opacity: .7 }}> · soon</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ height: 1, background: INK, opacity: .18 }} />

        {c && (
          <article style={{ marginTop: 46 }}>
            {c.title_en && (
              <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 6vw, 46px)', lineHeight: 1.08, margin: 0 }}>
                {c.title_en}
              </h2>
            )}
            <div style={{ fontFamily: MONO, fontSize: 12, opacity: .72, marginTop: 8 }}>
              {[c.artist_name, dateRange(c.opens_on, c.closes_on)].filter(Boolean).join('  ·  ')}
            </div>
            {tenseOf(c.opens_on, c.closes_on) && (
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.16em',
                            textTransform: 'uppercase', marginTop: 10, opacity: .9 }}>
                {tenseOf(c.opens_on, c.closes_on)}
              </div>
            )}

            {/* The hero sits in a FIXED-RATIO FRAME on the ground, never behind
                text. That is why there is no scrim: nothing is laid over the
                work, so nothing needs tuning for the next photograph. */}
            {c.hero_path && (
              <figure style={{ margin: '34px 0 0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={srcOf(c.hero_path)} alt={c.title_en || c.artist_name}
                     style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 3 }} />
              </figure>
            )}

            <Section title="The collaboration" body={c.collaboration_en} />

            {/* The auction date is rendered from a COLUMN, never written into the
                prose. "Later this year" was true when it was typed and would have
                been quietly wrong by March, with nothing to prompt anyone. */}
            {c.auction_on && (
              <div style={{ fontFamily: MONO, fontSize: 12, opacity: .8, marginTop: 18, maxWidth: 620 }}>
                The hand-painted bottle goes to charity auction on{' '}
                {new Date(c.auction_on + 'T12:00:00+07:00').toLocaleDateString('en-GB',
                  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}.
              </div>
            )}
            <Section title="The inspiration"   body={c.inspiration_en} />
            <Section title="The event"         body={c.event_en} />
            <Section title="The food"          body={c.food_en} />
            <Section title="The drinks"        body={c.drinks_en} />

            {/* THE BIOGRAPHY IS OMITTED WHEN ABSENT — not rendered as an empty
                heading. Quỳnh Anh Lê's approved bio does not yet exist, and an
                unapproved one is a discourtesy to the artist as well as a
                factual risk. The section appears the day she supplies it. */}
            <Section title={`About ${c.artist_name}`} body={c.bio_en} />

            {/* ── THE WORK. Minimal crop: each image keeps its own shape and is
                given room, rather than being forced through one ratio. ──── */}
            {mine.length > 0 && (
              <div style={{ display: 'grid', gap: 40, marginTop: 56,
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {mine.map(im => (
                  <figure key={im.id} style={{ margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={srcOf(im.storage_path)} alt={im.caption_en || ''} loading="lazy"
                         style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 2 }} />
                    {im.caption_en && (
                      <figcaption style={{ fontFamily: MONO, fontSize: 11, opacity: .72, marginTop: 10 }}>
                        {im.caption_en}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </article>
        )}
      </div>
    </main>
  )
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body || !body.trim()) return null      // absent, not empty
  return (
    <section style={{ marginTop: 44, maxWidth: 620 }}>
      <h3 style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase',
                   opacity: .65, margin: '0 0 12px' }}>{title}</h3>
      <p style={{ fontFamily: MONO, fontSize: 13.5, lineHeight: 1.95, margin: 0, whiteSpace: 'pre-line' }}>
        {body}
      </p>
    </section>
  )
}
