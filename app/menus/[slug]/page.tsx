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
        .menu-frame iframe {
          width: 100%;
          height: 80vh;
          min-height: 600px;
          border: 1px solid rgba(5,46,32,0.12);
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 12px 32px rgba(5,46,32,0.10);
        }

        /* Fallback note for clients that can't render PDFs inline */
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
          .menu-frame iframe { height: 70vh; min-height: 400px; }
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
          <iframe src={menu.pdf} title={`${menu.name} menu`} />
          <p className="menu-fallback">
            Menu not displaying? <a href={menu.pdf} target="_blank" rel="noopener noreferrer">Open it directly →</a>
          </p>
        </div>
      </div>
    </>
  )
}
