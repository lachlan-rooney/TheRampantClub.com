'use client'

import { use } from 'react'
import Link from 'next/link'
import NavOverlay from '@/components/NavOverlay'
import { notFound } from 'next/navigation'

interface FloorMenu {
  slug: string
  floor: number
  name: string
  vn: string
  kind: string
  pdf: string
}

const MENUS: Record<string, FloorMenu> = {
  'library-bar': {
    slug: 'library-bar',
    floor: 1,
    name: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    kind: 'Cocktails & Spirits',
    pdf: '/documents/menus/library-bar.pdf',
  },
  // Others to come — drop a PDF in /public/documents/menus/<slug>.pdf and add the entry here.
}

export default function FloorMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const menu = MENUS[slug]
  if (!menu) notFound()

  return (
    <>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #E5D4C2 !important; margin: 0; padding: 0; }

        .menu-page { min-height: 100vh; display: flex; flex-direction: column; }

        .menu-head {
          padding: 100px 24px 24px;
          text-align: center;
          max-width: 880px;
          width: 100%;
          margin: 0 auto;
        }
        .menu-back {
          display: inline-block;
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #5E6650;
          letter-spacing: 0.06em; text-decoration: none;
          opacity: 0.65;
          margin-bottom: 24px;
          transition: opacity 0.2s;
        }
        .menu-back:hover { opacity: 1; }

        .menu-floor {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 14px; font-weight: 600;
          color: #052E20; opacity: 0.3;
          letter-spacing: 0.18em;
          margin-bottom: 8px;
        }
        .menu-name {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(28px, 4.5vw, 40px);
          font-weight: 500; color: #052E20;
          letter-spacing: 0.02em;
          margin: 0 0 6px;
        }
        .menu-vn {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; color: #5E6650;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }
        .menu-kind {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #5E6650; opacity: 0.7;
          letter-spacing: 0.06em;
          margin-bottom: 24px;
        }

        .menu-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .menu-action {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s;
        }
        .menu-action.primary {
          background: #052E20;
          color: #E5D4C2;
        }
        .menu-action.primary:hover { background: #0a3d2b; transform: translateY(-1px); }
        .menu-action.ghost {
          color: #052E20;
          border: 1px solid rgba(5,46,32,0.25);
        }
        .menu-action.ghost:hover { background: rgba(5,46,32,0.05); }

        .menu-frame {
          flex: 1;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 16px 60px;
        }
        /* Inline PDF (desktop). <object> renders reliably on desktop browsers;
           its inner fallback covers any that can't. */
        .menu-embed {
          width: 100%;
          height: 80vh;
          min-height: 600px;
          border: 1px solid rgba(5,46,32,0.12);
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 12px 32px rgba(5,46,32,0.10);
          display: block;
        }
        .menu-cta {
          text-align: center;
          padding: 48px 20px;
        }
        .menu-cta-text {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; color: #5E6650; opacity: 0.8;
          margin: 0 0 18px; letter-spacing: 0.04em;
        }
        /* Mobile browsers don't render PDFs inline — show a clean card + button
           instead of a broken embed box. */
        .menu-mobile {
          display: none;
          background: #fff;
          border: 1px solid rgba(5,46,32,0.12);
          border-radius: 8px;
          box-shadow: 0 12px 32px rgba(5,46,32,0.10);
          text-align: center;
          padding: 48px 24px;
        }
        .menu-fallback {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #5E6650; opacity: 0.7;
          text-align: center; margin-top: 14px;
        }
        .menu-fallback a {
          color: #052E20;
          border-bottom: 1px solid rgba(5,46,32,0.25);
          text-decoration: none;
          padding-bottom: 1px;
        }

        @media (max-width: 768px) {
          .menu-head { padding-top: 80px; }
          .menu-embed { display: none; }
          .menu-mobile { display: block; }
        }
      ` }} />

      <div className="menu-page">
        <div className="menu-head">
          <Link href="/menus" className="menu-back">← All menus</Link>
          <div className="menu-floor">FLOOR {menu.floor}</div>
          <h1 className="menu-name">{menu.name}</h1>
          <div className="menu-vn">{menu.vn}</div>
          <div className="menu-kind">{menu.kind}</div>

          <div className="menu-actions">
            <a href={menu.pdf} target="_blank" rel="noopener noreferrer" className="menu-action primary">
              Open in new tab
            </a>
            <a href={menu.pdf} download className="menu-action ghost">
              Download PDF
            </a>
          </div>
        </div>

        <div className="menu-frame">
          <object data={menu.pdf} type="application/pdf" className="menu-embed" aria-label={`${menu.name} menu`}>
            <div className="menu-cta">
              <p className="menu-cta-text">The menu opens best in your PDF viewer.</p>
              <a href={menu.pdf} target="_blank" rel="noopener noreferrer" className="menu-action primary">View the menu →</a>
            </div>
          </object>
          <div className="menu-mobile">
            <p className="menu-cta-text">Tap to view the full menu.</p>
            <a href={menu.pdf} target="_blank" rel="noopener noreferrer" className="menu-action primary">View the menu →</a>
          </div>
        </div>
      </div>
    </>
  )
}
