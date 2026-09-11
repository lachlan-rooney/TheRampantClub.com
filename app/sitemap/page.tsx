'use client'

import Link from 'next/link'
import NavOverlay from '@/components/NavOverlay'
import { PublicPage, Masthead, Rise, Eyebrow, InkFloat, MONO, SERIF } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// SITEMAP — set to the /studio benchmark.
// ───────────────────────────────────────────────────────────────────────────
// An index, set large: each group's name in mono in the margin, every page in
// the display face with its address beside it, the arrow sliding on hover.
// The links are exactly as they were (the owner is deciding /membership
// separately — keep it here until told otherwise).

const SECTIONS = [
  {
    title: 'The Club',
    links: [
      { href: '/', label: 'Home' },
      { href: '/membership', label: 'Membership' },
      { href: '/sports', label: 'The Sports Club' },
      { href: '/kitchen', label: 'The Kitchen' },
      { href: '/press', label: 'Press' },
      { href: '/vacancies', label: 'Staff & Vacancies' },
    ],
  },
  {
    title: 'Members',
    links: [
      { href: '/members', label: 'Dashboard' },
      { href: '/members/events', label: 'Events' },
      { href: '/members/spaces', label: 'Spaces & Menus' },
      { href: '/members/notices', label: 'The Notice Board' },
      { href: '/members/whisky', label: 'The Whisky Library' },
      { href: '/members/fixtures', label: 'T.R.C Sports Fixtures' },
      { href: '/members/profile', label: 'My Membership' },
      { href: '/members/rules', label: 'House Rules' },
      { href: '/members/terms', label: 'Rules of Membership' },
      { href: '/members/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/cookies', label: 'Cookies' },
    ],
  },
]

export default function SitemapPage() {
  return (
    <PublicPage>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        .sm-key { width: 100%; max-width: 250px; margin: 0 12% 0 auto; }

        .sm-group { display: grid; grid-template-columns: 240px 1fr; gap: 40px; align-items: start; }
        .sm-group + .sm-group { margin-top: 96px; }
        .sm-group-head { padding-top: 22px; }
        .sm-group-n { font-family: ${SERIF}; font-size: clamp(38px, 4.4vw, 60px); line-height: 1; margin-top: 12px; opacity: .9; }

        .sm-links { display: grid; grid-template-columns: 1fr 1fr; column-gap: 40px; }
        .sm-link { display: flex; flex-direction: column; gap: 8px;
                   padding: 20px 0 18px; color: inherit; text-decoration: none;
                   border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
        .sm-label { font-family: ${SERIF}; font-size: clamp(26px, 2.9vw, 38px); line-height: 1.05; }
        .sm-path { font-family: ${MONO}; font-size: 11px; opacity: .62; white-space: nowrap; }
        .sm-link .pk-go { font-family: ${MONO}; font-size: 13px; margin-left: 10px; }
        .sm-link:hover .sm-path { opacity: 1; }

        @media (max-width: 1000px) {
          .sm-links { grid-template-columns: 1fr; }
        }
        @media (max-width: 860px) {
          .sm-key { max-width: 170px; margin: 0 8% 0 auto; }
          .sm-group { grid-template-columns: 1fr; gap: 10px; }
          .sm-group + .sm-group { margin-top: 72px; }
          .sm-group-head { padding-top: 0; display: flex; align-items: baseline; gap: 14px; }
          .sm-group-n { font-size: 30px; margin-top: 0; order: -1; }
          .sm-link { padding: 16px 0 14px; }
        }
      ` }} />

      {/* ══ THE MASTHEAD ═══════════════════════════════════════════════ */}
      <Masthead
        title="Sitemap"
        art={<InkFloat name="key" width="100%" rot={-14} dur={7.5} className="sm-key" />}
      />

      {/* ══ THE INDEX ══════════════════════════════════════════════════ */}
      <section className="pk-wrap" style={{ paddingBottom: 140 }}>
        {SECTIONS.map((section, gi) => (
          <div key={section.title} className="sm-group">
            <Rise className="sm-group-head">
              <Eyebrow style={{ opacity: 1 }}><h2 style={{ font: 'inherit', margin: 0 }}>{section.title}</h2></Eyebrow>
              <div className="sm-group-n" aria-hidden="true">{String(gi + 1).padStart(2, '0')}</div>
            </Rise>
            <div className="sm-links">
              {section.links.map((link, li) => (
                <Rise key={link.href} delay={Math.min(li, 6) * .04}>
                  <Link href={link.href} className="sm-link pk-hover">
                    <span className="sm-label">{link.label}</span>
                    <span className="sm-path">{link.href}<span className="pk-go">→</span></span>
                  </Link>
                </Rise>
              ))}
            </div>
          </div>
        ))}
      </section>
    </PublicPage>
  )
}
