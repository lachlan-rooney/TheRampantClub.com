'use client'

import { useEffect, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { PublicPage, Masthead, SectionHead, Rise, InkFloat, SERIF, MONO } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// PRESS — set to the /studio benchmark.
// ───────────────────────────────────────────────────────────────────────────
// Coverage reads as a magazine would print it: the outlet in mono in the
// margin, the words themselves set large in the display face. Releases and
// kits are a plain dated list. The copy and the data flow are untouched —
// press_items, published only, newest first.

type PressType = 'kit' | 'release' | 'mention'
interface PressItem {
  id: string
  type: PressType
  title: string
  outlet: string | null
  body: string | null
  link: string | null
  image_url: string | null
  published_at: string | null
}

const fmtDate = (d: string | null) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// The display face is all capitals, so only a SHORT line can stand as a
// pull-quote. A paragraph lifted from an article is set as an excerpt in mono,
// under its headline in the display face — the same words, readable.
const PULL_MAX = 220
const quoteSize = (s: string) => s.length < 90 ? 'clamp(30px, 4.4vw, 54px)' : 'clamp(26px, 3.3vw, 42px)'

// Some bodies arrive already in quotation marks; don't print a second pair.
const isQuoted = (s: string) => /^\s*[“"]/.test(s)

export default function PressPage() {
  const [items, setItems] = useState<PressItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('press_items')
      .select('id, type, title, outlet, body, link, image_url, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setItems(data as PressItem[])
        setLoading(false)
      })
  }, [])

  const kits     = items.filter(i => i.type === 'kit')
  const releases = items.filter(i => i.type === 'release')
  const mentions = items.filter(i => i.type === 'mention')

  return (
    <PublicPage>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        .pr-lede a { color: inherit; text-decoration: none; border-bottom: 1px solid currentColor; padding-bottom: 1px; }
        .pr-lede a:hover { border-bottom-width: 2px; }

        .pr-mast-art { width: 100%; max-width: 470px; margin-left: auto; }

        /* ── in the press: source in the margin, the words set large ── */
        .pr-quotes { margin-top: 72px; display: grid; gap: 88px; }
        .pr-quote { display: grid; grid-template-columns: 220px 1fr; gap: 40px; align-items: start; }
        .pr-source { font-family: ${MONO}; padding-top: 10px; }
        .pr-outlet { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; line-height: 1.7; }
        .pr-date { font-size: 11px; margin-top: 6px; opacity: .62; }
        .pr-words { font-family: ${SERIF}; font-weight: 400; line-height: 1.12; margin: 0; max-width: 900px;
                    white-space: pre-line; overflow-wrap: anywhere; }
        .pr-mark { display: inline-block; width: .5em; margin-left: -.5em; }
        .pr-title { font-family: ${MONO}; font-size: 12.5px; line-height: 1.9; margin: 22px 0 0; max-width: 620px; }
        .pr-headline { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 3.3vw, 42px); line-height: 1.04;
                       margin: 0; max-width: 900px; overflow-wrap: anywhere; }
        .pr-excerpt { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 22px 0 0; max-width: 680px;
                      white-space: pre-line; overflow-wrap: anywhere; }
        .pr-quote .pk-cta { margin-top: 18px; }

        /* ── releases and kits: a dated list ── */
        .pr-list { margin-top: 56px; }
        .pr-row { display: grid; grid-template-columns: 220px 1fr; gap: 40px; align-items: start;
                  padding: 30px 0 34px; border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
        .pr-row:last-child { border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
        .pr-row-date { font-family: ${MONO}; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; padding-top: 12px; }
        .pr-row-title { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 3.2vw, 42px); line-height: 1.02; margin: 0;
                        overflow-wrap: anywhere; }
        .pr-row-text { font-family: ${MONO}; font-size: 13px; line-height: 2; opacity: .86; margin: 18px 0 0; max-width: 680px;
                       white-space: pre-line; overflow-wrap: anywhere; }
        .pr-row .pk-cta { margin-top: 22px; }
        .pr-empty { font-family: ${MONO}; font-size: 13px; line-height: 2; font-style: italic; margin: 40px 0 0; }

        .pr-releases-art { margin-right: 8px; }

        .pr-fine { font-family: ${MONO}; font-size: 12.5px; line-height: 2; max-width: 600px; margin: 0; }

        @media (max-width: 860px) {
          .pr-mast-art { max-width: 300px; margin: 0 0 0 auto; }
          .pr-quotes { margin-top: 48px; gap: 64px; }
          .pr-quote, .pr-row { grid-template-columns: 1fr; gap: 14px; }
          .pr-source { padding-top: 0; }
          .pr-row-date { padding-top: 0; }
          .pr-mark { margin-left: 0; width: auto; }
          .pr-releases-art { margin: 8px 0 0 auto; }
        }
      ` }} />

      {/* ══ THE MASTHEAD ═══════════════════════════════════════════════ */}
      <Masthead
        eyebrow="Báo Chí · Newsroom"
        title="Press"
        lede={<span className="pr-lede">
          Press kits, releases, and selected coverage of The Rampant Club.
          For interviews, photography, or any other request, write to{' '}
          <a href="mailto:Press@TheRampantClub.com">Press@TheRampantClub.com</a>.
        </span>}
        art={<InkFloat name="newspaper" width="100%" rot={-7} dur={9} className="pr-mast-art" />}
      />

      {/* ══ IN THE PRESS ═══════════════════════════════════════════════ */}
      <section className="pk-wrap" style={{ paddingTop: 40 }}>
        <SectionHead eyebrow="Selected coverage" title="In the Press" />
        {loading ? (
          <p className="pr-empty">Loading…</p>
        ) : mentions.length === 0 ? (
          <p className="pr-empty">No coverage on file yet.</p>
        ) : (
          <div className="pr-quotes">
            {mentions.map(m => (
              <Rise key={m.id} as="article" className="pr-quote">
                <div className="pr-source">
                  {m.outlet && <div className="pr-outlet">{m.outlet}</div>}
                  {m.published_at && <div className="pr-date">{fmtDate(m.published_at)}</div>}
                </div>
                <div>
                  {m.body && m.body.length <= PULL_MAX ? (
                    <>
                      <p className="pr-words" style={{ fontSize: quoteSize(m.body) }}>
                        {isQuoted(m.body) ? m.body : <><span className="pr-mark">“</span>{m.body}”</>}
                      </p>
                      <p className="pr-title">{m.title}</p>
                    </>
                  ) : (
                    <>
                      <h3 className="pr-headline">{m.title}</h3>
                      {m.body && (
                        <p className="pr-excerpt">{isQuoted(m.body) ? m.body : <>“{m.body}”</>}</p>
                      )}
                    </>
                  )}
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noreferrer" className="pk-cta">
                      Read <span className="pk-go">→</span>
                    </a>
                  )}
                </div>
              </Rise>
            ))}
          </div>
        )}
      </section>

      {/* ══ PRESS RELEASES ═════════════════════════════════════════════ */}
      <section className="pk-wrap pk-section">
        <SectionHead eyebrow="Latest first" title="Press Releases"
          art={<InkFloat name="cigar" width="clamp(140px, 15vw, 210px)" rot={-8} dur={8.5} className="pr-releases-art" />} />
        {loading ? (
          <p className="pr-empty">Loading…</p>
        ) : releases.length === 0 ? (
          <p className="pr-empty">No releases yet.</p>
        ) : (
          <div className="pr-list">
            {releases.map(r => (
              <Rise key={r.id} as="article" className="pr-row">
                <div className="pr-row-date">{fmtDate(r.published_at)}</div>
                <div>
                  <h3 className="pr-row-title">{r.title}</h3>
                  {r.body && <p className="pr-row-text">{r.body}</p>}
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noreferrer" className="pk-cta">
                      Read the release <span className="pk-go">→</span>
                    </a>
                  )}
                </div>
              </Rise>
            ))}
          </div>
        )}
      </section>

      {/* ══ PRESS KITS ═════════════════════════════════════════════════ */}
      <section className="pk-wrap pk-section">
        <SectionHead eyebrow="Downloadable assets" title="Press Kits" />
        {loading ? (
          <p className="pr-empty">Loading…</p>
        ) : kits.length === 0 ? (
          <p className="pr-empty">No kits available yet.</p>
        ) : (
          <div className="pr-list">
            {kits.map(k => (
              <Rise key={k.id} as="article" className="pr-row">
                <div className="pr-row-date">{fmtDate(k.published_at)}</div>
                <div>
                  <h3 className="pr-row-title">{k.title}</h3>
                  {k.body && <p className="pr-row-text">{k.body}</p>}
                  {k.link && (
                    <a href={k.link} target="_blank" rel="noreferrer" className="pk-cta">
                      Download <span className="pk-go">→</span>
                    </a>
                  )}
                </div>
              </Rise>
            ))}
          </div>
        )}
      </section>

      {/* ══ THE FINE PRINT ═════════════════════════════════════════════ */}
      <section className="pk-wrap" style={{ paddingTop: 110, paddingBottom: 130 }}>
        <Rise>
          <p className="pr-fine">
            All press materials remain the intellectual property of The Rampant Club and are made available exclusively for editorial use.
            Unauthorised redistribution or alteration is prohibited.
          </p>
        </Rise>
      </section>
    </PublicPage>
  )
}
