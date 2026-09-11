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
  lastUpdated: string
  children: ReactNode
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

  .lg-address { font-family: ${SERIF}; font-size: clamp(22px, 2.4vw, 28px); line-height: 1.3; margin: 110px 0 0; }

  @media (max-width: 960px) {
    .lg-body { grid-template-columns: 1fr; gap: 0; padding-bottom: 100px; }
    .lg-toc-wrap { display: none; }
    .lg-art { max-width: 220px; margin: 0 6% 0 auto; }
    .lg-sec + .lg-sec { margin-top: 60px; }
    .lg-p { font-size: 13.5px; }
    .lg-address { margin-top: 84px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lg-toc a, .lg-toc a span { transition: none; }
  }
`

export default function LegalPage({ title, subtitle, lastUpdated, children }: LegalPageProps) {
  // The clause titles, read from the <Section>s the page passes in.
  const titles = Children.toArray(children)
    .filter((c): c is ReactElement<{ title: string }> => isValidElement(c) && c.type === Section)
    .map(c => c.props.title)
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
          <Rise delay={.14}><p className="lg-meta">Last updated: {lastUpdated}</p></Rise>
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
          <div className="lg-text">
            {children}
          </div>

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
