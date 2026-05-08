'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import NavOverlay from '@/components/NavOverlay'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ATLAS_REGIONS, type AtlasRegion } from '@/lib/whisky-atlas-data'

const AtlasGlobe = dynamic(() => import('./AtlasGlobe'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Google Sans Code', monospace", fontSize: 11,
      color: 'rgba(5,46,32,0.4)', letterSpacing: '0.06em',
    }}>
      Loading the globe…
    </div>
  ),
})

export default function AtlasPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [active, setActive] = useState<AtlasRegion | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('whiskies')
      .select('region, in_stock')
      .then(({ data }) => {
        if (!data) return
        const c: Record<string, number> = {}
        for (const w of data as { region: string | null; in_stock: boolean }[]) {
          if (!w.in_stock || !w.region) continue
          c[w.region] = (c[w.region] || 0) + 1
        }
        setCounts(c)
      })
  }, [])

  // Lock scroll while modal open
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        :root {
          --atl-cream: #E5D4C2;
          --atl-cream-dim: #B2AA98;
          --atl-green-deep: #052E20;
          --atl-green-mid: #28483C;
          --atl-green-accent: #5E6650;
          --atl-gold: #D4B85A;
        }
        body { background: var(--atl-cream); }

        .atl-hero {
          padding: 140px 24px 60px;
          text-align: center;
          background: linear-gradient(180deg, #F2E5D2 0%, var(--atl-cream) 100%);
        }
        .atl-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: var(--atl-cream-dim);
          letter-spacing: 0.06em;
          margin-bottom: 16px;
        }
        .atl-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 500;
          color: var(--atl-green-deep);
          letter-spacing: 0.02em;
          margin: 0 0 24px;
        }
        .atl-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; line-height: 1.8;
          color: var(--atl-cream-dim);
          letter-spacing: 0.04em;
          max-width: 540px; margin: 0 auto;
        }

        .atl-globe-wrap {
          position: relative;
          background: radial-gradient(ellipse at center, #0a3a28 0%, #052E20 70%, #021810 100%);
          padding: 24px 0 32px;
          margin-top: 24px;
        }
        .atl-globe-hint {
          text-align: center;
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: rgba(229,212,194,0.45);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-top: 12px;
        }

        .atl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          padding: 60px 32px 120px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .atl-card {
          background: rgba(5, 46, 32, 0.04);
          border: 1px solid rgba(5, 46, 32, 0.08);
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      background 0.35s ease,
                      border-color 0.35s ease,
                      box-shadow 0.35s ease;
        }
        .atl-card:hover {
          transform: translateY(-4px);
          background: rgba(5, 46, 32, 0.07);
          border-color: rgba(212, 184, 90, 0.4);
          box-shadow: 0 18px 36px rgba(5, 46, 32, 0.12);
        }
        .atl-card-header {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 14px;
        }
        .atl-flag { font-size: 28px; line-height: 1; }
        .atl-card-name {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 500;
          color: var(--atl-green-deep);
          letter-spacing: 0.02em;
        }
        .atl-card-native {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: var(--atl-cream-dim);
          letter-spacing: 0.06em;
          margin-top: 2px;
        }
        .atl-card-blurb {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          line-height: 1.7;
          color: var(--atl-green-accent);
          opacity: 0.85;
          margin-bottom: 14px;
          min-height: 60px;
        }
        .atl-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
        .atl-chip {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          letter-spacing: 0.06em;
          padding: 4px 10px;
          border-radius: 12px;
          background: rgba(212, 184, 90, 0.12);
          color: var(--atl-green-mid);
        }
        .atl-card-footer {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: var(--atl-green-accent);
          opacity: 0.7;
          padding-top: 12px;
          border-top: 1px solid rgba(5, 46, 32, 0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .atl-card-count {
          color: var(--atl-gold);
          font-weight: 600;
          font-size: 11px;
          letter-spacing: 0.04em;
        }

        /* ── Modal ─────────────────────────────────────────────── */
        .atl-modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(5, 46, 32, 0.55);
          backdrop-filter: blur(6px);
          z-index: 9990;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: atl-fade 0.25s ease;
        }
        @keyframes atl-fade { from { opacity: 0 } to { opacity: 1 } }
        .atl-modal {
          background: var(--atl-cream);
          border-radius: 16px;
          max-width: 680px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 40px;
          position: relative;
          box-shadow: 0 30px 80px rgba(5, 46, 32, 0.45);
          animation: atl-rise 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes atl-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .atl-modal-close {
          position: absolute; top: 16px; right: 16px;
          background: transparent; border: none;
          font-family: 'Google Sans Code', monospace;
          font-size: 16px; color: var(--atl-green-accent);
          cursor: pointer;
          width: 36px; height: 36px;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .atl-modal-close:hover { background: rgba(5, 46, 32, 0.06); }

        @media (max-width: 720px) {
          .atl-hero { padding: 100px 20px 40px; }
          .atl-grid { padding: 40px 20px 80px; gap: 16px; }
          .atl-modal { padding: 32px 24px; }
        }
      `}} />

      <NavOverlay variant="public" />

      <main>
        <section className="atl-hero">
          <div className="atl-eyebrow">Bản Đồ Whisky · The Atlas</div>
          <h1 className="atl-title">A whisky map of the world.</h1>
          <p className="atl-sub">
            Every region the cabinet draws from — its character, its distilleries, and how many bottles
            we currently keep on the shelf.
          </p>
        </section>

        <section className="atl-globe-wrap">
          <AtlasGlobe counts={counts} onSelect={setActive} />
          <div className="atl-globe-hint">
            Drag to spin · scroll to zoom · tap a marker
          </div>
        </section>

        <section className="atl-grid">
          {ATLAS_REGIONS.map(r => (
            <div key={r.key} className="atl-card" onClick={() => setActive(r)}>
              <div className="atl-card-header">
                <span className="atl-flag" aria-hidden>{r.flag}</span>
                <div>
                  <div className="atl-card-name">{r.name}</div>
                  {r.native && r.native !== r.name && (
                    <div className="atl-card-native">{r.native}</div>
                  )}
                </div>
              </div>
              <div className="atl-card-blurb">{r.blurb}</div>
              <div className="atl-chips">
                {r.character.slice(0, 4).map(c => (
                  <span key={c} className="atl-chip">{c}</span>
                ))}
              </div>
              <div className="atl-card-footer">
                <span>{r.country}</span>
                {counts[r.key] > 0 && (
                  <span className="atl-card-count">
                    {counts[r.key]} {counts[r.key] === 1 ? 'bottle' : 'bottles'} in cabinet
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* Region detail modal */}
      {active && (
        <div className="atl-modal-backdrop" onClick={() => setActive(null)}>
          <div className="atl-modal" onClick={e => e.stopPropagation()}>
            <button className="atl-modal-close" onClick={() => setActive(null)}>×</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <span className="atl-flag" style={{ fontSize: 36 }} aria-hidden>{active.flag}</span>
              <div>
                <h2 style={{
                  fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                  fontSize: 28, fontWeight: 500, color: 'var(--atl-green-deep)',
                  letterSpacing: '0.02em', margin: 0,
                }}>{active.name}</h2>
                {active.native && active.native !== active.name && (
                  <div style={{
                    fontFamily: "'Google Sans Code', monospace", fontSize: 11,
                    color: 'var(--atl-cream-dim)', letterSpacing: '0.06em', marginTop: 4,
                  }}>{active.native}</div>
                )}
              </div>
            </div>

            <p style={{
              fontFamily: "'Google Sans Code', monospace", fontSize: 13, lineHeight: 1.85,
              color: 'var(--atl-green-accent)', opacity: 0.9, marginBottom: 24,
            }}>
              {active.blurb}
            </p>

            <Section title="Character">
              <div className="atl-chips" style={{ marginBottom: 0 }}>
                {active.character.map(c => (
                  <span key={c} className="atl-chip">{c}</span>
                ))}
              </div>
            </Section>

            <Section title="Notable distilleries">
              <ul style={{
                margin: 0, paddingLeft: 18,
                fontFamily: "'Google Sans Code', monospace", fontSize: 12,
                lineHeight: 1.9, color: 'var(--atl-green-accent)', opacity: 0.85,
              }}>
                {active.distilleries.map(d => <li key={d}>{d}</li>)}
              </ul>
            </Section>

            {counts[active.key] > 0 && (
              <Section title="In the cabinet">
                <div style={{
                  fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                  fontSize: 22, fontWeight: 500, color: 'var(--atl-gold)',
                  letterSpacing: '0.02em',
                }}>
                  {counts[active.key]} {counts[active.key] === 1 ? 'bottle' : 'bottles'}
                </div>
                <div style={{
                  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
                  color: 'var(--atl-cream-dim)', letterSpacing: '0.04em', marginTop: 4,
                }}>
                  Members can browse the full list in the Whisky Library.
                </div>
              </Section>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontFamily: "'Google Sans Code', monospace", fontSize: 9,
        color: 'var(--atl-cream-dim)', letterSpacing: '0.14em',
        textTransform: 'uppercase', marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  )
}
