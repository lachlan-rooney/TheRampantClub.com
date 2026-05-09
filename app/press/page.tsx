'use client'

import { useEffect, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

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

export default function PressPage() {
  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState<PressItem[]>([])
  useEffect(() => {
    setTimeout(() => setVisible(true), 150)
    const supabase = createBrowserSupabaseClient()
    supabase.from('press_items')
      .select('id, type, title, outlet, body, link, image_url, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .then(({ data }) => { if (data) setItems(data as PressItem[]) })
  }, [])

  const kits     = items.filter(i => i.type === 'kit')
  const releases = items.filter(i => i.type === 'release')
  const mentions = items.filter(i => i.type === 'mention')

  return (
    <>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #E5D4C2 !important; margin: 0; padding: 0; }

        .pr-container {
          max-width: 720px; width: 100%;
          margin: 0 auto; padding: 120px 24px 100px;
        }
        .pr-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: #5E6650; letter-spacing: 0.06em;
          text-align: center; margin-bottom: 16px;
        }
        .pr-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 500; color: #052E20;
          text-align: center; letter-spacing: 0.02em;
          margin: 0 0 24px;
        }
        .pr-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; line-height: 1.85;
          color: #5E6650; opacity: 0.85;
          text-align: center; max-width: 520px; margin: 0 auto;
          letter-spacing: 0.04em;
        }
        .pr-sub a { color: #052E20; }

        .pr-section { margin-top: 56px; }
        .pr-h2 {
          font-family: 'Rampant Sans', serif;
          font-size: 22px; font-weight: 500;
          color: #052E20; letter-spacing: 0.02em;
          margin-bottom: 8px;
        }
        .pr-h2-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #5E6650; opacity: 0.6;
          letter-spacing: 0.18em; text-transform: uppercase;
          margin-bottom: 20px;
        }
        .pr-rule {
          height: 1px; background: rgba(94,102,80,0.18);
          margin: 0 0 18px;
        }

        /* Kit / release row — pure typography */
        .pr-row {
          padding: 16px 0;
          border-bottom: 1px solid rgba(94,102,80,0.10);
          display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap;
        }
        .pr-row-date {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #5E6650; opacity: 0.55;
          letter-spacing: 0.06em; min-width: 110px; padding-top: 4px;
        }
        .pr-row-body { flex: 1; min-width: 240px; }
        .pr-row-title {
          font-family: 'Rampant Sans', serif;
          font-size: 17px; font-weight: 600;
          color: #052E20; margin: 0 0 6px;
          letter-spacing: 0.02em;
        }
        .pr-row-text {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; line-height: 1.75;
          color: #5E6650; margin: 0 0 8px;
        }
        .pr-link {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #052E20;
          letter-spacing: 0.04em; text-decoration: none;
          border-bottom: 1px solid rgba(5,46,32,0.25);
          padding-bottom: 1px;
          transition: border-color 0.2s;
        }
        .pr-link:hover { border-color: #052E20; }

        /* In-the-press card with quote and outlet */
        .pr-clip {
          padding: 22px 24px;
          margin-bottom: 12px;
          background: rgba(5,46,32,0.04);
          border: 1px solid rgba(5,46,32,0.10);
          border-left: 3px solid rgba(212,184,90,0.5);
          border-radius: 8px;
          transition: background 0.2s, border-color 0.2s, transform 0.3s;
        }
        .pr-clip:hover { background: rgba(5,46,32,0.07); transform: translateY(-2px); }
        .pr-clip-outlet {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px; color: #5E6650;
          letter-spacing: 0.18em; text-transform: uppercase;
          margin-bottom: 6px;
        }
        .pr-clip-quote {
          font-family: 'Rampant Sans', serif;
          font-size: 18px; font-weight: 500; line-height: 1.45;
          font-style: italic; color: #052E20;
          margin: 0 0 12px; letter-spacing: 0.01em;
        }
        .pr-clip-foot {
          display: flex; justify-content: space-between; align-items: center;
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #5E6650; opacity: 0.7;
          letter-spacing: 0.06em;
        }
        .pr-clip-link {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #052E20;
          text-decoration: none; letter-spacing: 0.06em;
          border-bottom: 1px solid rgba(5,46,32,0.25);
        }
        .pr-clip-link:hover { border-color: #052E20; }

        .pr-empty {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #5E6650; opacity: 0.55;
          font-style: italic;
        }
      ` }} />

      {/* Grain overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat', backgroundSize: '300px',
      }} />

      <div style={{
        minHeight: '100vh',
        background: '#E5D4C2',
      }}>
        <div className="pr-container" style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <div className="pr-eyebrow">Báo Chí · Newsroom</div>
          <h1 className="pr-title">Press</h1>
          <p className="pr-sub">
            Press kits, releases, and selected coverage of The Rampant Club.
            For interviews, photography, or any other request, write to{' '}
            <a href="mailto:Press@TheRampantClub.com">Press@TheRampantClub.com</a>.
          </p>

          {/* In the Press */}
          <section className="pr-section">
            <div className="pr-h2">In the Press</div>
            <div className="pr-h2-sub">Selected coverage</div>
            <div className="pr-rule" />
            {mentions.length === 0 ? (
              <div className="pr-empty">No coverage on file yet.</div>
            ) : mentions.map(m => (
              <div key={m.id} className="pr-clip">
                {m.outlet && <div className="pr-clip-outlet">{m.outlet}</div>}
                {m.body && <p className="pr-clip-quote">“{m.body}”</p>}
                <div className="pr-clip-foot">
                  <span>{m.title}{m.published_at ? ' · ' + fmtDate(m.published_at) : ''}</span>
                  {m.link && <a href={m.link} target="_blank" rel="noreferrer" className="pr-clip-link">Read →</a>}
                </div>
              </div>
            ))}
          </section>

          {/* Press Releases */}
          <section className="pr-section">
            <div className="pr-h2">Press Releases</div>
            <div className="pr-h2-sub">Latest first</div>
            <div className="pr-rule" />
            {releases.length === 0 ? (
              <div className="pr-empty">No releases yet.</div>
            ) : releases.map(r => (
              <div key={r.id} className="pr-row">
                <div className="pr-row-date">{fmtDate(r.published_at)}</div>
                <div className="pr-row-body">
                  <h3 className="pr-row-title">{r.title}</h3>
                  {r.body && <p className="pr-row-text">{r.body}</p>}
                  {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="pr-link">Read the release →</a>}
                </div>
              </div>
            ))}
          </section>

          {/* Press Kits */}
          <section className="pr-section">
            <div className="pr-h2">Press Kits</div>
            <div className="pr-h2-sub">Downloadable assets</div>
            <div className="pr-rule" />
            {kits.length === 0 ? (
              <div className="pr-empty">No kits available yet.</div>
            ) : kits.map(k => (
              <div key={k.id} className="pr-row">
                <div className="pr-row-date">{fmtDate(k.published_at)}</div>
                <div className="pr-row-body">
                  <h3 className="pr-row-title">{k.title}</h3>
                  {k.body && <p className="pr-row-text">{k.body}</p>}
                  {k.link && <a href={k.link} target="_blank" rel="noreferrer" className="pr-link">Download →</a>}
                </div>
              </div>
            ))}
          </section>

          <div style={{
            width: 6, height: 6,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.18,
            margin: '64px auto 28px',
          }} />

          <p style={{
            fontFamily: "'Google Sans Code', monospace",
            fontSize: 10, color: '#5E6650', opacity: 0.55,
            textAlign: 'center', lineHeight: 1.8,
            maxWidth: 520, margin: '0 auto', letterSpacing: '0.02em',
          }}>
            All press materials remain the intellectual property of The Rampant Club and are made available exclusively for editorial use.
            Unauthorised redistribution or alteration is prohibited.
          </p>
        </div>
      </div>
    </>
  )
}
