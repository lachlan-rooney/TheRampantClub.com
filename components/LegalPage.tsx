'use client'

import { Children, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import NavOverlay from '@/components/NavOverlay'
import { PublicPage, Rise, InkFloat, MONO, SERIF } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// THE LEGAL PAGES (/privacy, /terms, /cookies) — set to the /studio benchmark.
// ───────────────────────────────────────────────────────────────────────────
// A calm long read: the title set large with the lion at his book beside it,
// then one left-aligned column of mono at reading size, each clause under its
// own display heading. On a desk the clauses are listed in the margin and the
// one being read is marked. The words themselves are exactly as written — only
// their setting changed. The interface (LegalPage, Section, P) is unchanged,
// so the three pages pass their text in as they always have.

interface LegalPageProps {
  title: string
  subtitle: string
  /** The whole meta line, label included — e.g. "Last updated: March 2026" or
   *  "In effect from 9 September 2026 · v1.1". */
  lastUpdated: string
  children?: ReactNode
  // ── A DOCUMENT FROM THE REGISTER (2026-10-01) ──────────────────────────
  // /privacy used to pass its clauses in as <Section>s written in the page. The
  // real Privacy Notice lives in terms_versions, in both languages, and is the
  // one members consented to — so that page now hands over rendered markdown
  // instead and this shell sets it the same way.
  //
  // The clause list is read from the h2s in the HTML rather than from the
  // children, so the margin, the mark-as-you-read and the anchors behave
  // identically. /terms and /cookies still pass <Section>s and are untouched.
  html?: string
  // The EN/VN switch, when the page has two languages to offer. Placed by the
  // shell so every legal page puts it in the same spot.
  lang?: ReactNode
}

const slug = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const LEGAL_CSS = `
  @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

  .lg-meta { font-family: ${MONO}; font-size: 12px; letter-spacing: .04em; margin-top: 22px; }
  .lg-art { width: 100%; max-width: 330px; margin: 0 8% 0 auto; }

  .lg-body { display: grid; grid-template-columns: 220px minmax(0, 680px); gap: 72px; align-items: start;
             padding-bottom: 130px; }

  /* the clauses, in the margin */
  .lg-toc-wrap { position: sticky; top: 110px; }
  .lg-toc { list-style: none; margin: 0; padding: 0; counter-reset: lgt; }
  .lg-toc li { counter-increment: lgt; }
  .lg-toc a { display: grid; grid-template-columns: 30px 1fr; gap: 6px; padding: 7px 0; color: inherit; text-decoration: none;
              font-family: ${MONO}; font-size: 12px; line-height: 1.55; opacity: .62; transition: opacity .3s ease; }
  .lg-toc a::before { content: counter(lgt, decimal-leading-zero); font-size: 10.5px; letter-spacing: .1em; padding-top: 1px; }
  .lg-toc a:hover, .lg-toc a.is-on { opacity: 1; }
  .lg-toc a span { background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
                   transition: background-size .45s cubic-bezier(.16,.84,.44,1); padding-bottom: 2px; }
  .lg-toc a.is-on span { background-size: 100% 1px; }

  /* the reading column */
  .lg-text { counter-reset: lgs; }
  .lg-sec { counter-increment: lgs; scroll-margin-top: 100px; }
  .lg-sec + .lg-sec { margin-top: 72px; }
  .lg-sec-n { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .22em; opacity: .62; }
  .lg-sec-n::before { content: counter(lgs, decimal-leading-zero); }
  .lg-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.2vw, 40px); line-height: 1.04; margin: 12px 0 22px; }
  .lg-p { font-family: ${MONO}; font-size: 13.5px; line-height: 2; margin: 0 0 20px; opacity: .88; }
  .lg-p:last-child { margin-bottom: 0; }

  /* A REGISTER DOCUMENT. Markdown, so the elements are plain h1/h2/h3/p/ul —
     set to match the hand-written clauses above rather than given their own
     look, because they are the same kind of reading. The document's own h1 is
     dropped: the masthead already prints the title, and twice is a mistake the
     members' copy made first. */
  .lg-doc h1 { display: none; }
  .lg-doc h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.2vw, 40px);
               line-height: 1.04; margin: 72px 0 22px; scroll-margin-top: 100px; }
  .lg-doc > h2:first-of-type { margin-top: 12px; }
  .lg-doc h3 { font-family: ${MONO}; font-weight: 400; font-size: 11px; letter-spacing: .18em;
               text-transform: uppercase; opacity: .66; margin: 36px 0 14px; }
  .lg-doc p, .lg-doc li { font-family: ${MONO}; font-size: 13.5px; line-height: 2; opacity: .88; }
  .lg-doc p { margin: 0 0 20px; }
  .lg-doc ul, .lg-doc ol { margin: 0 0 20px; padding-left: 20px; }
  .lg-doc li { margin-bottom: 10px; }
  .lg-doc strong { font-weight: 400; opacity: 1; border-bottom: 1px solid currentColor; padding-bottom: 1px; }
  .lg-doc em { font-style: italic; }
  .lg-doc a { color: inherit; }
  .lg-doc hr { border: none; border-top: 1px solid currentColor; opacity: .18; margin: 56px 0; }
  .lg-doc table { width: 100%; border-collapse: collapse; margin: 0 0 24px;
                  font-family: ${MONO}; font-size: 12.5px; }
  .lg-doc th, .lg-doc td { text-align: left; padding: 10px 12px 10px 0; vertical-align: top;
                           border-bottom: 1px solid currentColor; }
  .lg-doc th { font-weight: 400; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; opacity: .6; }

  .lg-lang { display: flex; justify-content: flex-start; margin: 0 0 40px; }

  .lg-address { font-family: ${SERIF}; font-size: clamp(22px, 2.4vw, 28px); line-height: 1.3; margin: 110px 0 0; }

  @media (max-width: 960px) {
    .lg-body { grid-template-columns: 1fr; gap: 0; padding-bottom: 100px; }
    .lg-toc-wrap { display: none; }
    .lg-art { max-width: 220px; margin: 0 6% 0 auto; }
    .lg-sec + .lg-sec { margin-top: 60px; }
    .lg-p { font-size: 13.5px; }
    .lg-doc h2 { margin-top: 60px; }
    .lg-address { margin-top: 84px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lg-toc a, .lg-toc a span { transition: none; }
  }
`

export default function LegalPage({ title, subtitle, lastUpdated, children, html, lang }: LegalPageProps) {
  // The clause titles: from the <Section>s a page passes in, or from the h2s of
  // a register document. Entities are decoded by letting the browser do it —
  // a hand-rolled unescape is how "Who&rsquo;s" ends up in a margin.
  const fromSections = Children.toArray(children)
    .filter((c): c is ReactElement<{ title: string }> => isValidElement(c) && c.type === Section)
    .map(c => c.props.title)
  const [fromHtml, setFromHtml] = useState<string[]>([])
  useEffect(() => {
    if (!html) { setFromHtml([]); return }
    const d = document.createElement('div')
    d.innerHTML = html
    setFromHtml([...d.querySelectorAll('h2')].map(h => h.textContent || '').filter(Boolean))
  }, [html])
  const titles = html ? fromHtml : fromSections
  const key = titles.join('|')

  // Mark the clause being read.
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const els = key.split('|').map(t => document.getElementById(slug(t))).filter((e): e is HTMLElement => !!e)
    if (!els.length) return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) })
    }, { rootMargin: '-18% 0px -70% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [key])

  return (
    <PublicPage>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: LEGAL_CSS }} />

      {/* ══ THE MASTHEAD ═══════════════════════════════════════════════ */}
      <header className="pk-wrap pk-mast">
        <div>
          <Rise><h1 className="pk-h1">{title}</h1></Rise>
          <Rise delay={.08}><div className="pk-sub">{subtitle}</div></Rise>
          {/* The WHOLE line, label included, comes from the page. A hardcoded
              "Last updated:" here was wrong for a register document, which has
              an effective date — a different claim — and could not be said in
              Vietnamese at all. */}
          <Rise delay={.14}><p className="lg-meta">{lastUpdated}</p></Rise>
        </div>
        <Rise delay={.15}>
          <InkFloat name="lion-suit" width="100%" rot={4} dur={9} className="lg-art" />
        </Rise>
      </header>

      {/* ══ THE TEXT ═══════════════════════════════════════════════════ */}
      <div className="pk-wrap lg-body">
        <nav className="lg-toc-wrap" aria-label={title}>
          {titles.length > 0 && (
            <ol className="lg-toc">
              {titles.map(t => (
                <li key={t}>
                  <a href={`#${slug(t)}`} className={active === slug(t) ? 'is-on' : ''}><span>{t}</span></a>
                </li>
              ))}
            </ol>
          )}
        </nav>

        <div>
          {lang && <div className="lg-lang">{lang}</div>}
          {html ? (
            // ids are added after mount, from the same slug() the margin uses,
            // so the anchors and the mark-as-you-read agree without the
            // markdown having to carry them.
            <div className="lg-text lg-doc" ref={el => {
              if (!el) return
              el.querySelectorAll('h2').forEach(h => { h.id = slug(h.textContent || ''); h.classList.add('lg-sec-h') })
            }} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="lg-text">
              {children}
            </div>
          )}

          <Rise>
            <p className="lg-address">
              74A/2 Hai Bà Trưng<br />
              TP. HCM, Việt Nam
            </p>
          </Rise>
        </div>
      </div>
    </PublicPage>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={slug(title)} className="lg-sec">
      <Rise>
        <div className="lg-sec-n" aria-hidden="true" />
        <h2 className="lg-h2">{title}</h2>
        {children}
      </Rise>
    </section>
  )
}

export function P({ children }: { children: ReactNode }) {
  return <p className="lg-p">{children}</p>
}
