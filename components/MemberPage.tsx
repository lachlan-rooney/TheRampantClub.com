'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/lang'
import { PublicPage, type Ink } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// ═══════════════════════════════════════════════════════════════════════════
// THE MEMBER PAGE — the shell nineteen portal pages stand in.
// ───────────────────────────────────────────────────────────────────────────
// It was a narrow centred column: a small title over a tiny grey subtitle, a
// centred diamond, a faint italic line. Now it is the public site's masthead
// on the portal's green — left-aligned, the title set LARGE, the subtitle in
// the display face beneath, the description as a lede you can actually read —
// and one of the house's ink drawings, re-inked cream, drifting in the empty
// half. The content column beneath is the site's 1180, left-aligned, so a
// page can breathe; a page that wants a narrower measure sets its own.
//
// The drawing is chosen by the page's address (INK_BY_PATH), so every page
// gets its character from this one file. A page can pass its own `art`, or
// `art={null}` for none; the old `icon` is used only where no drawing is set.

// Which drawing hangs beside which page's title.
const INK_BY_PATH: Record<string, Ink> = {
  '/members/rules': 'lion-suit',
  '/members/terms': 'newspaper',
  '/members/journal': 'newspaper',
  '/members/notices': 'newspaper',
  '/members/profile': 'key',
  '/members/visits': 'lion-reclining',
  '/members/contact': 'butler-tray',
  '/members/concierge': 'butler-tray',
  '/members/snug': 'cigar',
  '/members/messages': 'sunglasses',
  '/members/introductions': 'gent-toast',
  '/members/members': 'lion-lounging',
  '/members/notes': 'glass',
  '/members/taste': 'glass-botanical',
  '/members/journey': 'glass',        // a whisky journey — not the golf flag
  '/members/gifts': 'lion-bottle',
  '/members/gallery': 'girl-toast',
  '/members/whisky': 'lion-bottle',
  '/members/whisky/finder': 'glass-botanical',
}
const inkFor = (path: string): Ink | null =>
  INK_BY_PATH[path] ?? (path.startsWith('/members/whisky/') ? 'glass' : null)

// Wide drawings (the lions at rest, the sunglasses) read best a little bigger.
const WIDE: Ink[] = ['lion-lounging', 'lion-reclining', 'sunglasses', 'newspaper', 'cigar']

export default function MemberPage({
  title, subtitle, description, icon, art, children,
}: {
  title: string
  subtitle: string
  description?: string
  icon?: string
  /** The masthead's drawing. Omit for the page's own ink; `null` for none. */
  art?: ReactNode | null
  children: ReactNode
}) {
  const { lang, t } = useLang()
  const pathname = usePathname() || ''
  // ── ONLY SWAP WHEN THE SUBTITLE IS ACTUALLY VIETNAMESE ───────────────────
  // Most pages pair an English title with a Vietnamese subtitle, but not all:
  // The Snug's is "THE CLUB, IN CONVERSATION" and the concierge's is "A LINE TO
  // THE CLUB". Promoting those gives a Vietnamese reader an English heading over
  // an English subtitle — worse than not switching at all.
  //
  // DETECTED BY COMBINING MARKS, not by a hand-written alphabet. The first
  // version listed accented characters and missed the UPPERCASE forms, so it
  // declared "TIN NHẮN" and "HÀNH TRÌNH CỦA BẠN" to be English. Decomposing to
  // NFD and looking for any tone mark catches every case regardless of case,
  // and `đ` is checked separately because it carries no combining mark.
  const isVietnamese = (s: string) =>
    /[\u0300-\u0323]/.test(s.normalize('NFD')) || /[đĐ]/.test(s)
  // …and ONLY WHEN THE TITLE IS STILL ENGLISH. A page that translates its own
  // title (title={t('The Concierge', 'Quản Gia')}, subtitle={t(tagline, vnTagline)})
  // is already Vietnamese in both lines; swapping it would put the tagline above
  // the name.
  const showVn = lang === 'vn' && !!subtitle && isVietnamese(subtitle) && !isVietnamese(title)

  // ── WHAT THE EN/VN SWITCH ACTUALLY DOES ─────────────────────────────────
  // Member pages were already bilingual by STACKING: an English title with a
  // Vietnamese subtitle under it, both always shown. So a toggle had nothing to
  // toggle — on a laptop it changed nothing at all, because the only wired
  // surface was the mobile tab bar. Switching to VN now promotes the Vietnamese
  // to the heading and demotes the English, on every page that uses this
  // component, from one edit. If a page has no Vietnamese subtitle it keeps the
  // English in both slots rather than rendering an empty heading.
  const heading = showVn ? subtitle : title
  const under = showVn ? title : subtitle
  // A bottle's full name is a sentence, not a title — set it a size down.
  const long = heading.length > 26

  // The arrow is part of the translated string; lift it out so it can slide.
  const back = t('← Back to dashboard', '← Về Trang Chính')
  const backWords = back.replace(/^←\s*/, '')

  const ink = inkFor(pathname)
  const drawing: ReactNode =
    art !== undefined ? art
    : ink ? <CreamInk name={ink} width="100%" rot={WIDE.includes(ink) ? -3 : -6} dur={9} />
    // eslint-disable-next-line @next/next/no-img-element
    : icon ? <img src={icon} alt="" className="mp-icon" />
    : null

  // The body fades in once, then drops its animation: while an animation is
  // attached the wrapper is a stacking context, and a page's own fixed layer
  // (a sheet, a toast) would be held beneath the tab bar. Opacity only — never
  // a transform, which re-bases position:fixed descendants (the banked modal bug).
  const [settled, setSettled] = useState(false)

  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style dangerouslySetInnerHTML={{ __html: `
        .member-shell { position: relative; }
        /* the fixed lion (NavOverlay) sits at the right edge, mid-height, on a
           desk wider than 1024 — keep the column clear of it at any width */
        .mp-wrap { max-width: 1180px; margin: 0 auto; box-sizing: border-box;
                   padding-left: 24px; padding-right: max(24px, calc(150px - (100vw - 1180px) / 2)); }

        .mp-mast { display: grid; grid-template-columns: minmax(0, 1fr) clamp(150px, 19vw, 250px);
                   gap: 48px; align-items: end; padding-top: 118px; padding-bottom: 56px; }
        .mp-mast.is-bare { grid-template-columns: minmax(0, 1fr); }

        .mp-back { display: inline-flex; align-items: baseline; gap: 10px; color: #E5D4C2; text-decoration: none;
                   font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 11.5px; letter-spacing: .12em;
                   text-transform: uppercase; border-bottom: 1px solid rgba(229,212,194,.45); padding-bottom: 5px;
                   opacity: .9; transition: opacity .2s ease, border-color .2s ease; }
        .mp-back:hover { opacity: 1; border-bottom-color: #D4B85A; }
        .mp-back .mp-go { display: inline-block; transition: transform .35s ease; }
        .mp-back:hover .mp-go { transform: translateX(-7px); }

        .mp-title { font-family: 'Rampant Sans', serif; font-weight: 400; color: #E5D4C2;
                    font-size: clamp(46px, 7.6vw, 104px); line-height: .96; margin: 34px 0 0;
                    overflow-wrap: anywhere; }
        .mp-title.is-long { font-size: clamp(34px, 5vw, 68px); line-height: .98; }
        .mp-sub { font-family: 'Rampant Sans', serif; font-size: clamp(18px, 2.6vw, 28px); line-height: 1.15;
                  color: #E5D4C2; opacity: .6; margin-top: 14px; }
        .mp-lede { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 14px; line-height: 1.95;
                   color: #E5D4C2; opacity: .88; max-width: 600px; margin: 24px 0 0; }

        .mp-art { align-self: end; padding-bottom: 6px; }
        /* The drawings are every shape from 1:2 to 3:2, so the box is set by
           HEIGHT and each one fits inside it, sitting on the baseline at the right. */
        .mp-art .pk-float { height: clamp(170px, 20vw, 270px); display: flex; align-items: flex-end; justify-content: flex-end; }
        .mp-art .pk-float img { width: auto; height: auto; max-width: 100%; max-height: 100%; }
        .mp-icon { display: block; width: 100%; max-width: 150px; height: auto; margin-left: auto; transform: rotate(-4deg); }

        .mp-body { padding-bottom: 120px; }
        .mp-body.is-arriving { animation: mp-fade .7s ease .15s both; }
        @keyframes mp-fade { from { opacity: 0 } to { opacity: 1 } }

        .mp-rise { opacity: 0; transform: translateY(22px); animation: pk-rise .9s cubic-bezier(.16,.84,.44,1) both; }

        @media (max-width: 860px) {
          .mp-wrap { padding-left: 20px; padding-right: 20px; }
          /* A phone has no empty half: the drawing hangs at the top right,
             level with the way back, and the title runs the full width below. */
          /* 118px: clear of the EN/VN switch, which the layout pins 72px down */
          .mp-mast, .mp-mast.is-bare { display: block; padding-top: 118px; padding-bottom: 40px; position: relative; }
          .mp-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
          .mp-art { width: 120px; flex: 0 0 auto; padding-bottom: 0; margin-right: -4px; }
          .mp-art .pk-float { height: 100px; }
          .mp-title { margin-top: 26px; font-size: clamp(40px, 12vw, 64px); }
          .mp-title.is-long { font-size: clamp(30px, 8.4vw, 44px); }
          .mp-lede { font-size: 13.5px; line-height: 1.9; }
          .mp-body { padding-bottom: 96px; }
        }
        @media (min-width: 861px) {
          .mp-top { display: contents; }
          .mp-top .mp-art { display: none; }
        }
        @media (max-width: 860px) { .mp-mast > .mp-art { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .mp-rise, .mp-body.is-arriving { opacity: 1; transform: none; animation: none; }
          .mp-back .mp-go { transition: none; }
        }
      ` }} />
      <CreamInkDefs />

      <div className="member-shell">
        <header className={`mp-wrap mp-mast ${drawing ? '' : 'is-bare'}`}>
          <div>
            <div className="mp-top">
              <Link href="/members" className="mp-back mp-rise">
                <span className="mp-go" aria-hidden="true">←</span>{backWords}
              </Link>
              {drawing && <div className="mp-art mp-rise" style={{ animationDelay: '.2s' }}>{drawing}</div>}
            </div>
            <h1 className={`mp-title mp-rise ${long ? 'is-long' : ''}`} style={{ animationDelay: '.06s' }}>{heading}</h1>
            {under && <div className="mp-sub mp-rise" style={{ animationDelay: '.12s' }}>{under}</div>}
            {description && <p className="mp-lede mp-rise" style={{ animationDelay: '.18s' }}>{description}</p>}
          </div>
          {drawing && <div className="mp-art mp-rise" style={{ animationDelay: '.2s' }}>{drawing}</div>}
        </header>

        <div className={`mp-wrap mp-body ${settled ? '' : 'is-arriving'}`}
             onAnimationEnd={e => { if (e.target === e.currentTarget) setSettled(true) }}>
          {children}
        </div>
      </div>
    </PublicPage>
  )
}
