'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE PUBLIC KIT — the homepage and /studio's vocabulary, in one place.
// ───────────────────────────────────────────────────────────────────────────
// Every public page is being brought up to the standard of the homepage and
// The Studio. These are the pieces that standard is made of, so the pages
// agree with each other instead of each reinventing a heading:
//
//   · left-aligned, max 1180, 24px sides (20 on a phone)
//   · a mono eyebrow, tracked out, over a display title set LARGE
//   · mono reading text at 13–14px, line-height 2, in ink — never faint grey
//   · no hairlines between sections, no boxed cards, no centred diamonds
//   · full-bleed pictures that fade into the ground, as on /studio
//   · the house's own ink drawings, drifting, as the character of the page
//   · CTAs as mono uppercase with an underline and a sliding arrow
//   · everything rises in once, gently; all of it honours reduced motion
//
// Colours: cream #E5D4C2 (the default ground), ink #052E20, sage #B0C18E
// (the Studio), gold #D4B85A (accent on green). Set a page's ground with
// <PublicPage ground="…">.

export const CREAM = '#E5D4C2'
export const INK   = '#052E20'
export const SAGE  = '#B0C18E'
export const GOLD  = '#D4B85A'
export const SERIF = "'Rampant Sans', serif"
export const MONO  = "'Google Sans Code', 'DM Mono', monospace"

// The ink drawings trimmed for the web (public/images/ink/*.webp).
export type Ink =
  | 'lion-lounging' | 'lion-bottle' | 'lion-suit' | 'lion-reclining' | 'butler-tray' | 'gent-toast'
  | 'girl-toast' | 'cigar' | 'glass-botanical' | 'tee-glass' | 'golf-club' | 'key' | 'newspaper'
  | 'golf-flag' | 'sunglasses' | 'glass'
  | 'floor-lab' | 'floor-rampant-room' | 'floor-dining' | 'floor-studio' | 'floor-library-bar'
export const inkSrc = (name: Ink) => `/images/ink/${name}.webp`

const KIT_CSS = `
  .pk { color: var(--pk-ink); }
  .pk-wrap { max-width: 1180px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }
  .pk-rise { opacity: 0; transform: translateY(22px); }
  .pk-rise.is-in { animation: pk-rise .9s cubic-bezier(.16,.84,.44,1) both; }
  @keyframes pk-rise { to { opacity: 1; transform: none } }

  .pk-eyebrow { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; opacity: .62; }
  .pk-h1 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(52px, 8.4vw, 118px); line-height: .92; margin: 16px 0 0; }
  .pk-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(38px, 6.4vw, 80px); line-height: .98; margin: 14px 0 0; }
  .pk-h3 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(22px, 2.4vw, 28px); line-height: 1.08; margin: 0; }
  .pk-sub { font-family: ${SERIF}; font-size: clamp(18px, 3vw, 28px); opacity: .55; margin-top: 12px; }
  .pk-lede { font-family: ${MONO}; font-size: 14px; line-height: 2; max-width: 560px; margin: 24px 0 0; }
  .pk-body { font-family: ${MONO}; font-size: 13px; line-height: 2; opacity: .86; margin: 0 0 18px; }
  .pk-meta { font-family: ${MONO}; font-size: 11px; opacity: .62; }

  .pk-cta { display: inline-block; margin-top: 26px; color: inherit; text-decoration: none; background: none; border: none;
            border-bottom: 1px solid currentColor; padding: 0 0 6px; cursor: pointer;
            font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  .pk-go { display: inline-block; transition: transform .35s ease; }
  .pk-cta:hover .pk-go, .pk-hover:hover .pk-go { transform: translateX(7px); }

  .pk-mast { display: grid; grid-template-columns: 1.1fr .9fr; gap: 48px; align-items: center; padding-top: 140px; padding-bottom: 80px; }
  .pk-mast.is-single { grid-template-columns: 1fr; }
  .pk-section { padding-top: 110px; }
  .pk-head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }

  .pk-float { position: relative; }
  .pk-float img { display: block; width: 100%; height: auto; transform: rotate(var(--rot, -4deg));
                  animation: pk-drift var(--dur, 8s) ease-in-out infinite alternate;
                  filter: drop-shadow(6px 10px 10px rgba(5,46,32,.14)); }
  @keyframes pk-drift { from { transform: rotate(var(--rot, -4deg)) translateY(0) }
                        to   { transform: rotate(calc(var(--rot, -4deg) + 3deg)) translateY(-10px) } }

  .pk-thumb { overflow: hidden; border-radius: 12px; box-shadow: 0 12px 30px rgba(5,46,32,.16); }
  .pk-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .7s cubic-bezier(.16,.84,.44,1); }
  .pk-thumb:hover img, .pk-hover:hover .pk-thumb img { transform: scale(1.05); }

  .pk-bleed { position: relative; width: 100%; height: min(70vh, 660px); overflow: hidden; }
  .pk-bleed img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }

  .pk-details { margin: 0; }
  .pk-details > div { display: grid; grid-template-columns: 140px 1fr; gap: 16px; padding: 12px 0;
                      border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
  .pk-details > div:last-child { border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
  .pk-details dt { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; opacity: .55; padding-top: 2px; }
  .pk-details dd { margin: 0; font-family: ${MONO}; font-size: 12.5px; line-height: 1.75; }

  @media (max-width: 860px) {
    .pk-wrap { padding-left: 20px; padding-right: 20px; }
    .pk-mast { grid-template-columns: 1fr; gap: 28px; padding-top: 104px; padding-bottom: 56px; }
    .pk-section { padding-top: 80px; }
    .pk-head { grid-template-columns: 1fr; }
    .pk-details > div { grid-template-columns: 100px 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pk-rise, .pk-rise.is-in { opacity: 1; transform: none; animation: none; }
    .pk-float img { animation: none; }
    .pk-go, .pk-thumb img { transition: none; }
  }
`

// ── The page ──────────────────────────────────────────────────────────────
// Paints the ground edge to edge (html/body too, so overscroll and short pages
// match) and carries the kit's CSS once.
export function PublicPage({ ground = CREAM, ink = INK, children, style }: {
  ground?: string; ink?: string; children: ReactNode; style?: CSSProperties
}) {
  return (
    <main className="pk" style={{ background: ground, ['--pk-ink' as string]: ink, minHeight: '100vh', overflowX: 'clip', ...style }}>
      <style dangerouslySetInnerHTML={{ __html: `html, body { background: ${ground} !important; }` + KIT_CSS }} />
      {children}
    </main>
  )
}

// ── Rise on arrival ───────────────────────────────────────────────────────
export function useInView<T extends Element>(threshold = .12) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, seen }
}

export function Rise({ children, delay = 0, as: Tag = 'div', className = '', style }: {
  children: ReactNode; delay?: number; as?: 'div' | 'section' | 'header' | 'article' | 'li'; className?: string; style?: CSSProperties
}) {
  const { ref, seen } = useInView<HTMLDivElement>()
  const T = Tag as 'div'
  return (
    <T ref={ref} className={`pk-rise ${seen ? 'is-in' : ''} ${className}`} style={{ animationDelay: `${delay}s`, ...style }}>
      {children}
    </T>
  )
}

// ── Type ──────────────────────────────────────────────────────────────────
export const Eyebrow = ({ children, style }: { children: ReactNode; style?: CSSProperties }) =>
  <div className="pk-eyebrow" style={style}>{children}</div>

// ── A call to action: mono, underlined, the arrow slides ──────────────────
export function Cta({ href, children, onClick, style, external }: {
  href?: string; children: ReactNode; onClick?: () => void; style?: CSSProperties; external?: boolean
}) {
  const inner = <>{children} <span className="pk-go">→</span></>
  if (!href) return <button type="button" className="pk-cta" onClick={onClick} style={style}>{inner}</button>
  if (external || href.startsWith('mailto:') || href.startsWith('http'))
    return <a className="pk-cta" href={href} style={style} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{inner}</a>
  return <Link className="pk-cta" href={href} style={style}>{inner}</Link>
}

// ── A drifting ink drawing ────────────────────────────────────────────────
export function InkFloat({ name, width, rot = -4, dur = 8, style, className = '' }: {
  name: Ink; width: string | number; rot?: number; dur?: number; style?: CSSProperties; className?: string
}) {
  return (
    <div className={`pk-float ${className}`} aria-hidden="true"
         style={{ width, ['--rot' as string]: `${rot}deg`, ['--dur' as string]: `${dur}s`, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={inkSrc(name)} alt="" />
    </div>
  )
}

// ── The masthead: words left, the page's character right ─────────────────
export function Masthead({ eyebrow, title, sub, lede, children, art }: {
  eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; lede?: ReactNode
  children?: ReactNode   // CTAs etc., under the lede
  art?: ReactNode        // the right half: ink drawings, a picture, a still life
}) {
  return (
    <header className={`pk-wrap pk-mast ${art ? '' : 'is-single'}`}>
      <div>
        {eyebrow && <Rise><Eyebrow>{eyebrow}</Eyebrow></Rise>}
        <Rise delay={.06}><h1 className="pk-h1">{title}</h1></Rise>
        {sub && <Rise delay={.12}><div className="pk-sub">{sub}</div></Rise>}
        {lede && <Rise delay={.18}><p className="pk-lede">{lede}</p></Rise>}
        {children && <Rise delay={.24}>{children}</Rise>}
      </div>
      {art && <Rise delay={.15}>{art}</Rise>}
    </header>
  )
}

// ── A section head: eyebrow, title, and an optional drawing at the right ──
export function SectionHead({ eyebrow, title, children, art, id }: {
  eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; art?: ReactNode; id?: string
}) {
  return (
    <div className="pk-head" id={id} style={{ scrollMarginTop: 90 }}>
      <div>
        {eyebrow && <Rise><Eyebrow>{eyebrow}</Eyebrow></Rise>}
        <Rise delay={.06}><h2 className="pk-h2">{title}</h2></Rise>
        {children && <Rise delay={.12}>{children}</Rise>}
      </div>
      {art && <Rise delay={.14}>{art}</Rise>}
    </div>
  )
}

// ── A full-bleed picture fading into the ground (the /studio hero) ───────
export function BleedImage({ src, alt = '', ground = CREAM, position = '50% 50%', srcSet, sizes }: {
  src: string; alt?: string; ground?: string; position?: string; srcSet?: string; sizes?: string
}) {
  return (
    <div className="pk-bleed">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} loading="lazy" style={{ objectPosition: position }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 58%, ${ground} 100%)` }} />
    </div>
  )
}

// ── Particulars as a hairline list, never a box ───────────────────────────
export function Details({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="pk-details">
      {rows.map(r => <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
    </dl>
  )
}
