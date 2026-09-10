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
  opening_from: string | null; opening_to: string | null
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

export default function StudioExhibition({ collaboration, images }: {
  collaboration: Collaboration; images: CollabImage[]
}) {
  const c = collaboration


  const mine = images.filter(i => i.collaboration_id === c?.id)

  // ══ THE INTERLEAVE ═══════════════════════════════════════════════════════
  // Prose and pictures alternate rather than prose-then-appendix, so the page
  // reads as a room. Built from whatever the row happens to have: a
  // collaboration with one section and two images lays out the same way as one
  // with six and nine. Nothing here knows an artist's name.
  type Block =
    | { kind: 'text'; title: string; body: string | null; quote?: boolean }
    | { kind: 'img'; im: CollabImage; wide?: boolean }
  const blocks = useMemo<Block[]>(() => {
    if (!c) return []
    const texts: Block[] = ([
      ['The collaboration', c.collaboration_en, false],
      ['In the artist’s words', c.inspiration_en, true],
      ['The event', c.event_en, false],
      ['The food', c.food_en, false],
      ['The drinks', c.drinks_en, false],
      [`About ${c.artist_name}`, c.bio_en, false],
    ] as const)
      .filter(([, body]) => !!body && !!String(body).trim())
      .map(([title, body, quote]) => ({ kind: 'text', title, body: body as string, quote }))

    const pics = [...mine]
    const out: Block[] = []
    texts.forEach((t, i) => {
      out.push(t)
      // A landscape gets the full width; a portrait sits in the column. The
      // first picture after the opening section runs wide, because that is the
      // one doing the work of showing what the exhibition looked like.
      const im = pics.shift()
      if (im) out.push({ kind: 'img', im, wide: im.orientation === 'landscape' || i === 0 })
    })
    // Anything left over closes the page rather than being dropped.
    for (const im of pics) out.push({ kind: 'img', im, wide: im.orientation === 'landscape' })
    return out
  }, [c, mine])


  return (
    <main style={{ background: SAGE, minHeight: '100vh', color: INK }}>
      {/* ══ HERO ═══════════════════════════════════════════════════════════
          Full-bleed, and the title sits UNDER it rather than over it. Type over
          a painting is type competing with a painting, and on this page the work
          leads. The image is never cropped tighter than 16/10 on a phone. */}
      {c?.hero_path && (
        <div style={{ width: '100%', height: 'min(78vh, 720px)', overflow: 'hidden', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={srcOf(c.hero_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0,
                        background: `linear-gradient(to bottom, transparent 55%, ${SAGE} 100%)` }} />
        </div>
      )}

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: c?.hero_path ? '0 24px 140px' : '96px 24px 140px' }}>

        <Link href="/" style={{ fontFamily: MONO, fontSize: 11, color: INK, opacity: .6,
                                textDecoration: 'none', display: 'inline-block', marginTop: 28 }}>
          ← The Rampant Club
        </Link>


        {c && (
          <article>
            {/* ══ THE MASTHEAD. This is where the type does the work. ═══════ */}
            <div style={{ padding: '52px 0 0' }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.2em',
                            textTransform: 'uppercase', opacity: .65 }}>
                {[tenseOf(c.opens_on, c.closes_on), dateRange(c.opens_on, c.closes_on)]
                  .filter(Boolean).join('  ·  ')}
              </div>
              {c.title_en && (
                <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(42px, 11vw, 132px)', lineHeight: .92,
                             letterSpacing: '-.01em', margin: '14px 0 0' }}>{c.title_en}</h1>
              )}
              <div style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 4vw, 34px)', marginTop: 16, opacity: .78 }}>
                {c.artist_name}
              </div>
              {c.opening_from && (
                <div style={{ fontFamily: MONO, fontSize: 11.5, opacity: .62, marginTop: 12 }}>
                  Opening {dateRange(c.opening_from, c.opening_to)}
                </div>
              )}
            </div>

            {/* ══ BLOCKS. Prose and pictures alternate, so the page reads as a
                room rather than as a document with an appendix of photographs.
                Built from whatever exists — a collaboration with two images and
                one section lays out the same way as one with nine. ═════════ */}
            {blocks.map((b, i) =>
              b.kind === 'text' ? (
                <Section key={`t${i}`} title={b.title!} body={b.body!} quote={b.quote} />
              ) : b.wide ? (
                <Figure key={`i${i}`} im={b.im!} wide />
              ) : (
                <Figure key={`i${i}`} im={b.im!} />
              )
            )}
          </article>
        )}
      </div>
    </main>
  )
}

// A picture, at its own shape. `contain` inside a generous box: a painting is
// never cropped to fit a grid, which is the one rule a gallery page cannot break.
function Figure({ im, wide }: { im: CollabImage; wide?: boolean }) {
  return (
    // CAPPED AND ROUNDED. Uncapped, a portrait at full column width ran past a
    // thousand pixels tall and filled the screen. And squared-off photographs
    // are not this site's language — the floor panels on /spaces are rounded
    // with a soft shadow, so these match rather than inventing a third look.
    <figure style={{ margin: wide ? '64px 0' : '56px 0', maxWidth: wide ? 1000 : 680 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={srcOf(im.storage_path)} alt={im.caption_en || ''} loading="lazy"
           style={{ maxWidth: '100%', maxHeight: '74vh', width: 'auto', height: 'auto', display: 'block',
                    borderRadius: 14, boxShadow: '0 18px 44px rgba(5,46,32,0.20)' }} />
      {im.caption_en && (
        <figcaption style={{ fontFamily: MONO, fontSize: 11, opacity: .68, marginTop: 12, maxWidth: 560 }}>
          {im.caption_en}
        </figcaption>
      )}
    </figure>
  )
}

function Section({ title, body, quote }: { title: string; body: string | null; quote?: boolean }) {
  if (!body || !body.trim()) return null      // absent, not empty
  // The artist's own words get set as a pull-quote in the display face. Her
  // sentence about the threshold is the best writing on the page and it should
  // not be set at the same size as a list of canapés.
  const [lead, ...rest] = quote ? splitQuote(body) : [null, body]
  return (
    <section style={{ marginTop: 56, maxWidth: 700 }}>
      <h3 style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase',
                   opacity: .55, margin: '0 0 16px' }}>{title}</h3>
      {lead && (
        <blockquote style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3.6vw, 34px)', lineHeight: 1.32,
                             margin: '0 0 26px', maxWidth: 860 }}>
          {lead}
        </blockquote>
      )}
      {rest.filter(Boolean).map((para, i) => (
        <p key={i} style={{ fontFamily: MONO, fontSize: 13.5, lineHeight: 2, margin: '0 0 18px',
                            whiteSpace: 'pre-line' }}>{para}</p>
      ))}
    </section>
  )
}

// Pulls the quoted sentence out of a section so it can be set large. Falls back
// to leaving the prose alone when there is nothing in quotation marks.
function splitQuote(body: string): (string | null)[] {
  const m = body.match(/[“"]([^”"]{40,})[”"]/)
  if (!m) return [null, body]
  const before = body.slice(0, m.index).trim()
  const after = body.slice((m.index || 0) + m[0].length).trim()
  return [m[1], before || null, after || null]
}
