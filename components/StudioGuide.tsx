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
        .sg-intro { font-family: ${MONO}; font-size: 13.5px; line-height: 1.85; margin: 22px 0 0;
                    max-width: 56ch; }
        .sg-rule { height: 1px; background: ${INK}26; margin: 34px 0 0; border: 0; }

        /* ── A PIECE ───────────────────────────────────────────────────────
           The image is the hero and it is never cropped: a painting decides
           its own aspect ratio, so the frame takes whatever shape the work is.
           That is the Studio's rule on /studio/[slug] and it holds here. */
        .sg-piece { padding: 52px 0 0; scroll-margin-top: 76px; }
        .sg-no { font-family: ${MONO}; font-size: 11px; letter-spacing: .16em;
                 color: ${accent}; font-weight: 700; }
        .sg-fig { margin: 16px 0 0; }
        .sg-fig img { display: block; width: 100%; height: auto; background: ${INK}0f; }
        .sg-nofig { margin: 16px 0 0; border: 1px dashed ${INK}3d; aspect-ratio: 4 / 3;
                    display: grid; place-items: center; font-family: ${MONO};
                    font-size: 11px; opacity: .55; text-align: center; padding: 20px; }
        /* THE GALLERY LABEL, set as a gallery sets one: the title in the
           display face, everything factual beneath it in mono, each fact on
           its own line. A run-on label is unreadable at arm's length. */
        .sg-label { margin: 18px 0 0; }
        .sg-pt { font-family: ${SERIF}; font-weight: 400; font-size: clamp(22px, 5.6vw, 30px);
                 line-height: 1.14; margin: 0; }
        .sg-pa { font-family: ${MONO}; font-size: 12px; margin: 8px 0 0; opacity: .78; }
        .sg-pf { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; margin: 4px 0 0; opacity: .66; }
        .sg-desc { font-family: ${MONO}; font-size: 13.5px; line-height: 1.9; margin: 18px 0 0;
                   max-width: 60ch; white-space: pre-line; }
        .sg-prov { font-family: ${MONO}; font-size: 11px; line-height: 1.7; margin: 14px 0 0;
                   padding-top: 12px; border-top: 1px solid ${INK}1f; opacity: .6; max-width: 60ch; }

        .sg-empty { padding: 60px 0; font-family: ${MONO}; font-size: 13px; line-height: 1.9;
                    max-width: 52ch; opacity: .78; }
        .sg-foot { margin: 72px 0 0; padding-top: 24px; border-top: 1px solid ${INK}26;
                   font-family: ${MONO}; font-size: 11.5px; line-height: 1.9; opacity: .66; }
        .sg-foot a { color: ${INK}; }

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
          <div className="sg-eyebrow">{t('Gallery guide · The Studio', 'Hướng dẫn tham quan · The Studio')}</div>
          {exhibitionTitle && <h1 className="sg-title">{exhibitionTitle}</h1>}
          <div className="sg-artist">{artist}</div>
          {dateRange(c.opens_on, c.closes_on) && (
            <div className="sg-dates">{dateRange(c.opens_on, c.closes_on)}</div>
          )}
          {pick(lang, c.bio_en, c.bio_vn) && (
            <p className="sg-intro">{pick(lang, c.bio_en, c.bio_vn)}</p>
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
                <div className="sg-pa">{by}{p.year ? `, ${p.year}` : ''}</div>
                {(medium || p.dimensions) && (
                  <div className="sg-pf">
                    {medium}{medium && p.dimensions ? <br /> : null}{p.dimensions}
                  </div>
                )}
              </div>

              {desc && <p className="sg-desc">{desc}</p>}
              {p.provenance && <p className="sg-prov">{p.provenance}</p>}
            </section>
          )
        })}

        <footer className="sg-foot">
          {t('The Studio · Floor 2 · The Rampant Club · 74A/2 Hai Bà Trưng',
             'The Studio · Tầng 2 · The Rampant Club · 74A/2 Hai Bà Trưng')}
          <br />
          <Link href={`/studio/${c.slug}`}>
            {t('More about this exhibition', 'Tìm hiểu thêm về triển lãm này')} →
          </Link>
        </footer>
      </div>
    </main>
  )
}
