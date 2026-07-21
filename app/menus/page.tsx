'use client'

import Link from 'next/link'
import NavOverlay from '@/components/NavOverlay'

interface FloorMenu {
  slug: string
  floor: number | string
  name: string
  vn: string
  kind: string
  vnKind: string
  available: boolean
  href: string
}

const MENUS: FloorMenu[] = [
  {
    slug: 'library-bar',
    floor: 1,
    name: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    kind: 'Cocktails & Spirits',
    vnKind: 'Cocktail & Rượu Mạnh',
    available: true,
    href: '/menus/library-bar',
  },
  {
    slug: 'dining-room',
    floor: 3,
    name: 'The Dining Room',
    vn: 'Phòng Ăn Riêng',
    kind: 'Food & Wine',
    vnKind: 'Món Ăn & Rượu Vang',
    available: false,
    href: '/menus/dining-room',
  },
  {
    slug: 'rampant-room',
    floor: 4,
    name: 'The Rampant Room',
    vn: 'Phòng Rampant',
    kind: 'Whisky List',
    vnKind: 'Danh Sách Whisky',
    available: false,
    href: '/members/whisky',
  },
  {
    slug: 'source-origin-lab',
    floor: 5,
    name: 'Source & Origin Lab',
    vn: 'Phòng Thí Nghiệm',
    kind: 'Experimental Pours',
    vnKind: 'Thử Nghiệm',
    available: false,
    href: '/menus/source-origin-lab',
  },
]

export default function MenusIndex() {
  return (
    <>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #E5D4C2 !important; margin: 0; padding: 0; }

        .menus-container { max-width: 880px; margin: 0 auto; padding: 120px 24px 80px; }

        .menus-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #5E6650;
          letter-spacing: 0.06em; text-align: center; margin-bottom: 16px;
        }
        .menus-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 500; color: #052E20;
          text-align: center; letter-spacing: 0.02em;
          margin: 0 0 12px;
        }
        .menus-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; line-height: 1.85;
          color: #5E6650; opacity: 0.85;
          text-align: center; max-width: 520px; margin: 0 auto 64px;
          letter-spacing: 0.04em;
        }

        .menus-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (max-width: 640px) {
          .menus-grid { grid-template-columns: 1fr; }
        }

        .menu-card {
          display: block;
          padding: 32px 28px;
          background: rgba(5,46,32,0.04);
          border: 1px solid rgba(5,46,32,0.10);
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
          transition: background 0.25s, border-color 0.25s, transform 0.25s, box-shadow 0.25s;
          position: relative;
          overflow: hidden;
        }
        .menu-card:hover {
          background: rgba(5,46,32,0.07);
          border-color: rgba(212,184,90,0.45);
          transform: translateY(-3px);
          box-shadow: 0 12px 24px rgba(5,46,32,0.10);
        }
        .menu-card.is-disabled {
          pointer-events: none;
          opacity: 0.5;
        }

        .menu-card-floor {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 14px; font-weight: 600;
          color: #052E20; opacity: 0.3;
          letter-spacing: 0.18em;
          margin-bottom: 12px;
        }
        .menu-card-name {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 22px; font-weight: 500;
          color: #052E20;
          letter-spacing: 0.02em;
          margin: 0 0 4px;
        }
        .menu-card-vn {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #5E6650;
          letter-spacing: 0.04em;
          margin-bottom: 18px;
        }
        .menu-card-kind {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; color: #5E6650;
          opacity: 0.85;
          letter-spacing: 0.02em;
        }
        .menu-card-status {
          margin-top: 18px;
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
        }
        .menu-card-status.available {
          background: rgba(94,102,80,0.18);
          color: #052E20;
        }
        .menu-card-status.coming {
          background: rgba(212,184,90,0.20);
          color: #6e5a1b;
        }

        .menu-card-arrow {
          position: absolute;
          right: 24px;
          bottom: 24px;
          font-family: 'Rampant Sans', serif;
          font-size: 20px;
          color: #052E20;
          opacity: 0.4;
          transition: opacity 0.25s, transform 0.25s;
        }
        .menu-card:hover .menu-card-arrow {
          opacity: 0.85;
          transform: translateX(3px);
        }
      ` }} />

      <div className="menus-container">
        <div className="menus-eyebrow">Thực Đơn · Menus</div>
        <h1 className="menus-title">The Menus</h1>
        <p className="menus-sub">
          Each floor has its own offering. Cocktails by the Library Bar, bottle-share in the Rampant Room, private dining on the third, experimental work in the Source &amp; Origin Lab.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, margin: '4px 0 36px' }}>
          {['cocktails', 'gala-table', 'whisky-lounge'].map(s => (
            <div key={s} style={{ width: 176, borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 30px rgba(5,46,32,0.14)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/social/${s}.webp`} alt="" style={{ display: 'block', width: '100%', height: 132, objectFit: 'cover' }} />
            </div>
          ))}
        </div>

        <div className="menus-grid">
          {MENUS.map(m => {
            const Tag = (m.available ? Link : 'div') as React.ElementType
            return (
              <Tag
                key={m.slug}
                {...(m.available ? { href: m.href } : {})}
                className={`menu-card${m.available ? '' : ' is-disabled'}`}
              >
                <div className="menu-card-floor">FLOOR {m.floor}</div>
                <h2 className="menu-card-name">{m.name}</h2>
                <div className="menu-card-vn">{m.vn}</div>
                <div className="menu-card-kind">{m.kind} &middot; {m.vnKind}</div>
                <div className={`menu-card-status ${m.available ? 'available' : 'coming'}`}>
                  {m.available ? 'View menu' : 'Coming soon'}
                </div>
                {m.available && <div className="menu-card-arrow">→</div>}
              </Tag>
            )
          })}
        </div>
      </div>
    </>
  )
}
