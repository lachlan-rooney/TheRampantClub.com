'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang, pick } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// ═══════════════════════════════════════════════════════════════════════════
// THE SELF-GUIDED GALLERY GUIDE — a guest, their own phone, the room in order.
// ───────────────────────────────────────────────────────────────────────────
// Scanned from a booklet in The Studio. Someone is standing in front of the
// work holding this, so every decision below is made for that person and not
// for a desktop review of it:
//
// · SAGE, NOT THE CLUB'S BOTTLE GREEN. The Studio inverts the site on purpose
//   (see components/StudioExhibition) and the guide is a continuation of the
//   room, not a club page about the room. Same ground, same ink, same faces.
// · THE EXHIBITION'S OWN ACCENT. collaborations.accent is per-show — #3F5546
//   for Rizal Fathoni, #8C5A3C for Quỳnh Anh Lê — and it is what makes the
//   guide feel like THIS exhibition. Used for the rule and the piece number
//   only; never for body text, where a brown or a green on sage would be a
//   legibility problem in gallery lighting.
// · ONE PIECE PER SCREEN, UNHURRIED. No grid. A guide that shows three pieces
//   at once invites a guest to scroll past the one they are standing at.
// · "3 of 10" ON EVERY PIECE. A guest walking a room needs to know whether
//   they have missed something, and that is the one piece of information a
//   printed wall label cannot give them.
// · PHONE FIRST, 390px THE BAR. Images at one width, lazily loaded, decoded
//   async; no horizontal scroll at any width.
//
// ⚠ NOTHING HERE INVENTS CONTENT. Titles, artists, years, media, dimensions
//   and descriptions come from collaboration_pieces, which a human fills in at
//   /admin/studio. An empty guide says so, in both languages, rather than
//   dressing a placeholder as a gallery label.

const SAGE = '#B0C18E'
const INK  = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO  = "'Google Sans Code', 'DM Mono', monospace"

export interface GuideCollab {
  id: string; slug: string; artist_name: string; artist_name_vn: string | null
  title_en: string | null; title_vn: string | null; accent: string | null
  opens_on: string | null; closes_on: string | null
  bio_en: string | null; bio_vn: string | null
  food_en: string | null; food_vn: string | null
  drinks_en: string | null; drinks_vn: string | null
}
export interface GuidePiece {
  id: string; sort: number
  title_en: string | null; title_vn: string | null
  artist_name: string | null; year: string | null
  medium_en: string | null; medium_vn: string | null
  dimensions: string | null; image_path: string | null
  description_en: string | null; description_vn: string | null
  provenance: string | null
}

// One <p> per paragraph. A statement arrives with its blank lines intact (the
// admin route keeps them deliberately — see the PROSE set in its tidy()), and
// a single run of text in a <p> would throw that structure away at the last
// step after it survived every earlier one.
const paras = (text: string) => text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)

// THE CANAPÉS ARE WRITTEN AS LABELS. "Foie Gras Terrine | Mango | Brioche"
// is the same pipe-separated form as "2026 | 110 × 130 × 4 CM | ACRYLIC & OIL
// ON CANVAS", so they are set the same way: the pipe line in the display face,
// the paragraph under it in mono. A block with no pipe is just prose and is
// rendered as such, so a note or a closing line still works.
const asLabelled = (text: string) => {
  const out: { label?: string; body: string[] }[] = []
  for (const block of paras(text)) {
    const isLabel = block.includes(' | ') && block.length < 120 && !block.includes('. ')
    if (isLabel) out.push({ label: block, body: [] })
    else if (out.length && out[out.length - 1].body.length === 0 && out[out.length - 1].label) out[out.length - 1].body.push(block)
    else if (out.length && out[out.length - 1].label) out[out.length - 1].body.push(block)
    else out.push({ body: [block] })
  }
  return out
}

const dateRange = (a: string | null, b: string | null) => {
  if (!a) return null
  const f = (d: string) => new Date(d + 'T12:00:00+07:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
  return b && b !== a ? `${f(a)} — ${f(b)}` : f(a)
}

export default function StudioGuide({ collaboration: c, pieces }: {
  collaboration: GuideCollab; pieces: GuidePiece[]
}) {
  const { lang, t } = useLang()
  const accent = c.accent || INK
  const total = pieces.length

  // WHICH PIECE AM I LOOKING AT. The progress bar at the top needs to follow
  // the scroll, and an IntersectionObserver is the only way to know that
  // without listening to every scroll event on a phone's main thread.
  const [at, setAt] = useState(0)
  const marks = useRef<(HTMLElement | null)[]>([])
  useEffect(() => {
    if (!total) return
    const io = new IntersectionObserver(entries => {
      // The piece covering the MIDDLE of the screen is the one being read.
      const best = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (best) setAt(Number((best.target as HTMLElement).dataset.i))
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .25, .5, 1] })
    marks.current.forEach(el => el && io.observe(el))
    return () => io.disconnect()
  }, [total])

  const exhibitionTitle = pick(lang, c.title_en, c.title_vn)
  const artist = pick(lang, c.artist_name, c.artist_name_vn)

  return (
    <main style={{ background: SAGE, color: INK, minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sg { max-width: 760px; margin: 0 auto; padding: 0 20px 96px; }
        /* 20px gutters at 390px, which is the design bar. Nothing inside may
           exceed 100% — a wide label or a long dimension string is the usual
           cause of a sideways scroll on a phone. */
        .sg * { max-width: 100%; box-sizing: border-box; }
        /* ⚠ THE BLEED HAS TO OPT OUT OF THE GUARD ABOVE. That rule is what
           keeps a long dimension string from pushing the page sideways, but it
           also capped the full-bleed figure at the 350px content box, so the
           artwork stopped 20px short of the right edge and the bleed looked
           like a mistake instead of a decision. */
        .sg-fig, .sg-fig img { max-width: none; }

        .sg-bar { position: sticky; top: 0; z-index: 5; background: ${SAGE};
                  padding: 12px 0 10px; border-bottom: 1px solid ${INK}22; }
        .sg-bar-in { display: flex; align-items: center; gap: 12px; }
        .sg-count { font-family: ${MONO}; font-size: 11px; letter-spacing: .1em;
                    white-space: nowrap; color: ${INK}; opacity: .72; }
        .sg-track { flex: 1; height: 2px; background: ${INK}1f; border-radius: 2px; overflow: hidden; }
        .sg-fill { height: 100%; background: ${accent}; transition: width .35s ease; }

        .sg-head { padding: 34px 0 10px; }
        .sg-eyebrow { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .2em;
                      text-transform: uppercase; opacity: .64; }
        .sg-title { font-family: ${SERIF}; font-weight: 400; font-size: clamp(34px, 9vw, 56px);
                    line-height: 1.02; margin: 12px 0 0; }
        .sg-artist { font-family: ${SERIF}; font-size: clamp(19px, 5vw, 25px); margin: 8px 0 0; opacity: .82; }
        .sg-dates { font-family: ${MONO}; font-size: 11.5px; margin: 14px 0 0; opacity: .66; }
        .sg-intro { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 22px 0 0;
                    max-width: 56ch; }
        /* ── THE BIOGRAPHY IS FOLDED AWAY ────────────────────────────────
           collaborations.bio_en is nearly 3,000 characters. Rendered open it
           filled seven phone screens before piece one — and this is read by
           somebody standing in front of piece one. It is the artist's own
           text, so none of it is cut; it is one tap away instead, and the
           work comes first. */
        .sg-bio { margin: 20px 0 0; }
        .sg-bio summary { font-family: ${MONO}; font-size: 11px; letter-spacing: .14em;
                          text-transform: uppercase; cursor: pointer; padding: 10px 0;
                          border-top: 1px solid ${INK}26; border-bottom: 1px solid ${INK}26;
                          list-style: none; opacity: .75; }
        .sg-bio summary::-webkit-details-marker { display: none; }
        .sg-bio summary::after { content: ' +'; }
        .sg-bio[open] summary::after { content: ' −'; }
        .sg-bio p { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 20px 0 0;
                    max-width: 56ch; }
        .sg-rule { height: 1px; background: ${INK}26; margin: 34px 0 0; border: 0; }

        /* ── A PIECE ───────────────────────────────────────────────────────
           The image is the hero and it is never cropped: a painting decides
           its own aspect ratio, so the frame takes whatever shape the work is.
           That is the Studio's rule on /studio/[slug] and it holds here. */
        .sg-piece { padding: 52px 0 0; scroll-margin-top: 76px; }
        .sg-no { font-family: ${MONO}; font-size: 11px; letter-spacing: .16em;
                 color: ${accent}; font-weight: 700; }
        /* FULL BLEED. In the booklet the work runs edge to edge off the page
           and the text sits under it. The reading column is 760px and the
           image breaks out of it — the 20px gutter is cancelled on both sides
           rather than the column widened, so the type keeps its measure. */
        .sg-fig { margin: 16px -20px 0; }
        .sg-fig img { display: block; width: 100%; height: auto; background: ${INK}0f; }
        @media (min-width: 800px) { .sg-fig { margin-left: 0; margin-right: 0; } }
        .sg-nofig { margin: 16px 0 0; border: 1px dashed ${INK}3d; aspect-ratio: 4 / 3;
                    display: grid; place-items: center; font-family: ${MONO};
                    font-size: 11px; opacity: .55; text-align: center; padding: 20px; }
        /* THE GALLERY LABEL, set as a gallery sets one: the title in the
           display face, everything factual beneath it in mono, each fact on
           its own line. A run-on label is unreadable at arm's length. */
        /* ── THE LABEL, SET THE WAY THE BOOKLET SETS IT ──────────────────
           Title on its own line, then the facts pipe-separated on the next:
              A SERIES OF BODY
              2026 | 15.5 × 53 CM | ACRYLIC & OIL ON COTTON PAPER
           Both uppercase, both in the display face, both the same weight —
           the booklet gives the facts the same voice as the title rather than
           demoting them to small print, and that is what makes it read as a
           gallery and not a catalogue. */
        .sg-label { margin: 20px 0 0; }
        .sg-pt { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 7vw, 38px);
                 line-height: 1.06; margin: 0; text-transform: uppercase; }
        .sg-pf { font-family: ${SERIF}; font-weight: 400; font-size: clamp(17px, 4.6vw, 24px);
                 line-height: 1.22; margin: 6px 0 0; text-transform: uppercase; opacity: .9; }
        /* Only where a piece is not by the exhibition's own artist. On the
           booklet's pages it never appears, because it never needs to. */
        .sg-pa { font-family: ${MONO}; font-size: 12px; margin: 8px 0 0; opacity: .78; }
        /* MONO 14 / LINE-HEIGHT 2, the measurements StudioExhibition uses for
           an artist's statement. The guide is a continuation of that page and
           must read like it, not approximately like it. Real paragraphs with
           a 20px gap rather than white-space: pre-line — pre-line gives a
           blank LINE between paragraphs, which at line-height 2 is a 28px
           hole, and it cannot be tuned separately from the leading. */
        .sg-desc { margin: 18px 0 0; max-width: 60ch; }
        .sg-desc p { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 0 0 20px; }
        /* THE ONE BOOKLET PROPERTY THAT DOES NOT SURVIVE THE FORMAT.
           The printed page justifies its statements, at a fixed measure wide
           enough to carry it. At 390px a mono line holds about 34 characters,
           and justifying that opens rivers of white down the middle of every
           paragraph. So it justifies only where there is measure for it. */
        @media (min-width: 700px) { .sg-desc p { text-align: justify; } }
        .sg-desc p:last-child { margin-bottom: 0; }
        .sg-prov { font-family: ${MONO}; font-size: 11px; line-height: 1.7; margin: 14px 0 0;
                   padding-top: 12px; border-top: 1px solid ${INK}1f; opacity: .6; max-width: 60ch; }

        .sg-menu { margin: 76px 0 0; padding-top: 28px; border-top: 1px solid ${INK}26; }
        .sg-menu-h { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 7vw, 38px);
                     text-transform: uppercase; margin: 0 0 6px; line-height: 1.06; }
        .sg-menu-item { margin: 26px 0 0; }
        .sg-empty { padding: 60px 0; font-family: ${MONO}; font-size: 13px; line-height: 1.9;
                    max-width: 52ch; opacity: .78; }
        .sg-lion { display: block; width: 74px; height: auto; margin: 26px 0 0; }
        .sg-foot { margin: 80px 0 0; padding-top: 28px; border-top: 1px solid ${INK}26;
                   font-family: ${MONO}; font-size: 11.5px; line-height: 1.9; }
        .sg-foot a { color: ${INK}; display: inline-block; margin-top: 18px; }
        .sg-credit-label { font-family: ${MONO}; font-size: 10px; letter-spacing: .22em;
                           text-transform: uppercase; opacity: .6; }
        .sg-credits { display: flex; flex-direction: column; gap: 4px; margin: 10px 0 0; }
        .sg-credits span { font-family: ${SERIF}; font-size: 19px; text-transform: uppercase;
                           line-height: 1.3; }
        .sg-foot-line { margin: 22px 0 0; opacity: .62; }

        @media (prefers-reduced-motion: reduce) { .sg-fill { transition: none; } }
      ` }} />

      <div className="sg">
        {/* The switch first, because a Vietnamese guest should not have to read
            an English page to find out the page has Vietnamese. */}
        <div className="sg-bar">
          <div className="sg-bar-in">
            <LangToggle compact tone="light" />
            {total > 0 && (
              <>
                <div className="sg-track" aria-hidden="true">
                  <div className="sg-fill" style={{ width: `${((at + 1) / total) * 100}%` }} />
                </div>
                <div className="sg-count">
                  {t(`${at + 1} of ${total}`, `${at + 1} / ${total}`)}
                </div>
              </>
            )}
          </div>
        </div>

        <header className="sg-head">
          {/* The lion, cream on sage, as on the booklet's cover. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/cup/rampant-lion-cream.webp" alt="" aria-hidden="true" className="sg-lion" />
          <div className="sg-eyebrow">{t('Gallery guide · The Studio', 'Hướng dẫn tham quan · The Studio')}</div>
          {exhibitionTitle && <h1 className="sg-title">{exhibitionTitle}</h1>}
          <div className="sg-artist">{artist}</div>
          {dateRange(c.opens_on, c.closes_on) && (
            <div className="sg-dates">{dateRange(c.opens_on, c.closes_on)}</div>
          )}
          {pick(lang, c.bio_en, c.bio_vn) && (
            <details className="sg-bio">
              <summary>{t('About the artist', 'Về nghệ sĩ')}</summary>
              {paras(pick(lang, c.bio_en, c.bio_vn)).map((para, i) => <p key={i}>{para}</p>)}
            </details>
          )}
          <p className="sg-intro" style={{ opacity: .62 }}>
            {total > 0
              ? t(`${total} pieces, in the order you will walk past them. Take your time.`,
                   `${total} tác phẩm, theo thứ tự bạn sẽ đi qua. Hãy thong thả.`)
              : ''}
          </p>
          <hr className="sg-rule" />
        </header>

        {total === 0 ? (
          // HONEST, AND IN BOTH LANGUAGES. The alternative — placeholder labels
          // under a real artist's name on a public URL — would be a lie told in
          // a gallery's voice.
          <div className="sg-empty">
            {t('The guide for this exhibition is being written. The pieces will appear here as they are catalogued.',
               'Phần hướng dẫn cho triển lãm này đang được soạn. Các tác phẩm sẽ xuất hiện ở đây khi được ghi chú xong.')}
          </div>
        ) : pieces.map((p, i) => {
          const title = pick(lang, p.title_en, p.title_vn)
          const medium = pick(lang, p.medium_en, p.medium_vn)
          const desc = pick(lang, p.description_en, p.description_vn)
          // The piece's own artist where a group show gives it one; the
          // exhibition's artist otherwise. A label never says nothing.
          const by = p.artist_name || artist
          return (
            <section key={p.id} id={`piece-${i + 1}`} data-i={i} className="sg-piece"
                     ref={el => { marks.current[i] = el }}
                     aria-label={`${i + 1} of ${total}${title ? ` — ${title}` : ''}`}>
              <div className="sg-no">{String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>

              {p.image_path ? (
                <figure className="sg-fig">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_path} alt={title || t('Artwork', 'Tác phẩm')}
                       loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                       sizes="(max-width: 760px) 100vw, 720px" />
                </figure>
              ) : (
                <div className="sg-nofig">{t('Image to come', 'Hình ảnh sẽ được bổ sung')}</div>
              )}

              <div className="sg-label">
                {title && <h2 className="sg-pt">{title}</h2>}
                {/* Pipe-separated, and only the parts that exist — an empty
                    medium must not leave " | | " hanging on the label. */}
                {[p.year, p.dimensions, medium].some(Boolean) && (
                  <div className="sg-pf">
                    {[p.year, p.dimensions, medium].filter(Boolean).join(' | ')}
                  </div>
                )}
                {/* Named only when it is NOT the exhibition's own artist. */}
                {p.artist_name && p.artist_name !== artist && (
                  <div className="sg-pa">{p.artist_name}</div>
                )}
              </div>

              {desc && (
                <div className="sg-desc">
                  {paras(desc).map((para, j) => <p key={j}>{para}</p>)}
                </div>
              )}
              {p.provenance && <p className="sg-prov">{p.provenance}</p>}
            </section>
          )
        })}

        {/* ══ THE CANAPÉS ══════════════════════════════════════════════════
            They belong in the guide because they are part of the argument:
            the food is written in the same register as the work, naming the
            same appetite. Pulled from collaborations.food_en, which the
            exhibition page already renders and /admin/studio already edits —
            one place to change it, not two. */}
        {pick(lang, c.food_en, c.food_vn) && (
          <section className="sg-menu">
            <h2 className="sg-menu-h">{t('The canapés', 'Món khai vị')}</h2>
            {asLabelled(pick(lang, c.food_en, c.food_vn)).map((item, i) => (
              <div key={i} className="sg-menu-item">
                {item.label && <div className="sg-pf">{item.label}</div>}
                <div className="sg-desc">{item.body.map((b, j) => <p key={j}>{b}</p>)}</div>
              </div>
            ))}
          </section>
        )}

        {/* ══ THE CREDITS ══════════════════════════════════════════════════
            The booklet's back matter, as names rather than marks. Of the five
            marks it carries only Duncan Taylor's crest is in this repo, and it
            is gold on transparent — drawn for a dark ground, and on sage it
            all but disappears (tried, measured, removed). Two logos reproduced
            and three set as type would also read as an oversight about the
            three. So all of them are type, in the display face, which on this
            ground is the legible answer and the consistent one. Drop sage- or
            ink-ready marks into public/images/brand and they can have the
            treatment instead.

            The booklet's acknowledgement page is deliberately NOT here. It
            thanks people for "every element of the evening", and this guide
            is read for three months after that evening. */}
        <footer className="sg-foot">
          <div className="sg-credit-label">{t('Powered by', 'Được hỗ trợ bởi')}</div>
          <div className="sg-credits">
            <span>Lactone Labs</span>
            <span>LR Growth Solutions</span>
            <span>Duncan Taylor Scotch Whisky</span>
          </div>
          <div className="sg-foot-line">
            {t('The Studio @ The Rampant Club · Floor 2 · 74A/2 Hai Bà Trưng',
               'The Studio @ The Rampant Club · Tầng 2 · 74A/2 Hai Bà Trưng')}
          </div>
          <Link href={`/studio/${c.slug}`}>
            {t('More about this exhibition', 'Tìm hiểu thêm về triển lãm này')} →
          </Link>
        </footer>
      </div>
    </main>
  )
}
