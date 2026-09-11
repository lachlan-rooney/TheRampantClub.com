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
  hero_path: string | null; film_url: string | null; signature_path: string | null; auction_on: string | null
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

  const sections = useMemo(() => ([
    ['The collaboration', c.collaboration_en],
    ['The event', c.event_en],
    ['The food', c.food_en],
    ['The drinks', c.drinks_en],
    [`About ${c.artist_name}`, c.bio_en],
  ] as const).filter(([, v]) => !!v && !!String(v).trim()) as [string, string][], [c])

  const pics = useMemo(() => [...images], [images])

  // Only a YouTube id is accepted. Anything else is ignored rather than framed,
  // because a broken frame is worse than no film — and frame-src already allows
  // YouTube, so nothing about the CSP changes.
  const filmId = useMemo(() => {
    const u = c.film_url || ''
    const m = u.match(/[?&]v=([\w-]{6,})/) || u.match(/youtu\.be\/([\w-]{6,})/) || u.match(/embed\/([\w-]{6,})/)
    return m ? m[1] : null
  }, [c.film_url])




  return (
    <main style={{ background: SAGE, minHeight: '100vh', color: INK }}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* One column on a phone; the label steps aside on a desk and stays with
           its prose as you scroll past it. */
        .ex-duo { display: grid; grid-template-columns: 1fr; gap: 26px; margin: 78px 0 0; }
        .ex-words p { max-width: 62ch; }
        @media (min-width: 900px) {
          .ex-duo { grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
          /* The swap. Ordering rather than reordering the markup, so the reading
             order stays words-then-picture for a screen reader either way. */
          .ex-duo.is-flipped .ex-words { order: 2; }
          .ex-duo.is-flipped .ex-pic   { order: 1; }
        }
      ` }} />
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

        {/* Back to the ROOM, not to the club homepage. An exhibition is a page
            inside The Studio, and the only way out was to the front door. */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/studio" style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
                                        textDecoration: 'none', borderBottom: `1px solid ${INK}`,
                                        paddingBottom: 3 }}>
            ← The Studio
          </Link>
        </div>


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
              {c.title_en && (
                <div style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 4vw, 34px)', marginTop: 16, opacity: .78 }}>
                  {c.artist_name}
                </div>
              )}
              {c.opening_from && (
                <div style={{ fontFamily: MONO, fontSize: 11.5, opacity: .62, marginTop: 12 }}>
                  Opening {dateRange(c.opening_from, c.opening_to)}
                </div>
              )}
            </div>

            {/* ══ LEAD — the first picture runs full width straight after the
                masthead, so the work arrives before the reading does. ═════ */}
            {pics[0] && <Figure im={pics[0]} wide />}

            {/* ══ THE BODY — text and picture side by side, and the sides SWAP
                each time. Read down the page it zig-zags rather than marching:
                words left / work right, then work left / words right. On a
                phone it is one column and the image follows its section, since
                two narrow columns would be worse than none. ════════════════ */}
            {sections.map(([label, body], i) => {
              const im = pics[i + 1]
              const flip = i % 2 === 1
              return (
                <div key={label} className={`ex-duo${flip ? ' is-flipped' : ''}`}>
                  <div className="ex-words">
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em',
                                  textTransform: 'uppercase', opacity: .5, marginBottom: 14 }}>{label}</div>
                    {body.split(/\n{2,}/).map((para, k) => (
                      <p key={k} style={{ fontFamily: MONO, fontSize: 14, lineHeight: 2, margin: '0 0 20px' }}>{para}</p>
                    ))}
                    {/* The signature closes the artist's OWN words. With no
                        "in the artist's words" section it closes his bio
                        instead — it was set for Rizal but never drawn, because
                        it only lived inside a section his page does not have. */}
                    {label === `About ${c.artist_name}` && !c.inspiration_en && c.signature_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.signature_path} alt="" aria-hidden="true"
                           style={{ display: 'block', width: 180, height: 'auto', marginTop: 12, opacity: .85 }} />
                    )}
                  </div>
                  {im && (
                    <figure className="ex-pic" style={{ margin: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={srcOf(im.storage_path)} alt={im.caption_en || ''} loading="lazy"
                           style={{ width: '100%', height: 'auto', maxHeight: '76vh', objectFit: 'contain',
                                    display: 'block', borderRadius: 14,
                                    boxShadow: '0 18px 44px rgba(5,46,32,0.20)' }} />
                      {im.caption_en && (
                        <figcaption style={{ fontFamily: MONO, fontSize: 10.5, opacity: .62, marginTop: 10 }}>
                          {im.caption_en}
                        </figcaption>
                      )}
                    </figure>
                  )}
                </div>
              )
            })}

            {/* ══ HER WORDS, on an inverted ground. The change of colour is the
                point — it stops the page reading as one long column. ═════ */}
            {c.inspiration_en && <Words body={c.inspiration_en} artist={c.artist_name} signature={c.signature_path} />}

            {/* ══ THE FILM ═════════════════════════════════════════════════ */}
            {filmId && (
              <div style={{ margin: '86px 0 0' }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em',
                              textTransform: 'uppercase', opacity: .5, marginBottom: 16 }}>The film</div>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 14,
                              overflow: 'hidden', boxShadow: '0 18px 44px rgba(5,46,32,0.20)' }}>
                  <iframe src={`https://www.youtube.com/embed/${filmId}?rel=0&playsinline=1`}
                          title="Process film" allowFullScreen
                          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
                </div>
              </div>
            )}

            {pics.slice(sections.length + 1).map(im => <Figure key={im.id} im={im} wide />)}

            {/* At the bottom as well: after a long page nobody scrolls back up
                to find the way out. */}
            <div style={{ marginTop: 96, paddingTop: 26, borderTop: `1px solid ${INK}22` }}>
              <Link href="/studio" style={{ fontFamily: MONO, fontSize: 12, color: INK,
                                            textDecoration: 'none', letterSpacing: '.1em',
                                            textTransform: 'uppercase' }}>
                ← Back to The Studio
              </Link>
            </div>
          </article>
        )}
      </div>
    </main>
  )
}

// A picture, at its own shape. `contain` inside a generous box: a painting is
// never cropped to fit a grid, which is the one rule a gallery page cannot break.
// One of a pair. Fills its half without distorting; the full-size, uncropped
// version is what the lead and the closers are for.
function Plate({ im }: { im: CollabImage }) {
  return (
    <figure style={{ margin: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={srcOf(im.storage_path)} alt={im.caption_en || ''} loading="lazy"
           style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block',
                    borderRadius: 12, boxShadow: '0 14px 34px rgba(5,46,32,0.18)' }} />
      {im.caption_en && (
        <figcaption style={{ fontFamily: MONO, fontSize: 10.5, opacity: .62, marginTop: 10 }}>{im.caption_en}</figcaption>
      )}
    </figure>
  )
}

// The artist's own words, on the club's green. Inverting the ground mid-page is
// what breaks the column — and her sentence deserves the room.
function Words({ body, artist, signature }: { body: string; artist: string; signature?: string | null }) {
  const m = body.match(/[“"]([^”"]{40,})[”"]/)
  const quote = m ? m[1] : body.split(/\n{2,}/)[0]
  const rest = m ? body.replace(m[0], '').trim() : body.split(/\n{2,}/).slice(1).join('\n\n')
  return (
    <section style={{ background: INK, color: SAGE, borderRadius: 18, padding: 'clamp(34px, 6vw, 78px)',
                      margin: '92px 0 0' }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase',
                    opacity: .6 }}>In the artist’s words</div>
      <blockquote style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 4.4vw, 46px)', lineHeight: 1.24,
                           margin: '22px 0 0', maxWidth: 900 }}>{quote}</blockquote>
      <div style={{ fontFamily: MONO, fontSize: 11.5, opacity: .7, marginTop: 20 }}>— {artist}</div>
      {rest && rest.split(/\n{2,}/).map((p, i) => (
        <p key={i} style={{ fontFamily: MONO, fontSize: 13.5, lineHeight: 2, opacity: .85,
                            margin: '20px 0 0', maxWidth: 640 }}>{p}</p>
      ))}
      {/* His actual signature, at the foot of his own words — the way a signed
          work is signed. Once, small, nowhere else. It is a person's hand, not
          a motif, so it is not repeated and never used as decoration. */}
      {signature && (
        // eslint-disable-next-line @next/next/no-img-element
        // The file is inked in the club's green; on this green ground it would
        // vanish, so it is turned light here.
        <img src={signature} alt="" aria-hidden="true"
             style={{ display: 'block', width: 168, height: 'auto', marginTop: 30, opacity: .8,
                      filter: 'brightness(0) invert(1)' }} />
      )}
    </section>
  )
}

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
