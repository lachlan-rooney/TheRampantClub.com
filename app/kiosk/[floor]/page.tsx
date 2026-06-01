'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { notFound } from 'next/navigation'

interface FloorConfig {
  slug: string
  floor: number | string
  name: string
  vn: string
  accent: string
  menuPdf?: string
  /** Feature widget shown on this floor's kiosk */
  feature?: {
    type: 'whisky' | 'static'
    eyebrow: string
    title?: string
    body?: string
  }
}

const FLOORS: Record<string, FloorConfig> = {
  'library-bar': {
    slug: 'library-bar', floor: 1, name: 'The Library Bar', vn: 'Quầy Bar Thư Viện',
    accent: '#D4B85A', menuPdf: '/documents/menus/library-bar.pdf',
    feature: {
      type: 'static',
      eyebrow: '◆ Bartender’s Pick',
      title: 'Ask the bar',
      body: 'Tell our team what you feel like and they’ll mix to it. No menu can match a good conversation.',
    },
  },
  'studio': {
    slug: 'studio', floor: 2, name: 'The Studio', vn: 'Phòng Nghệ Thuật',
    accent: '#B2AA98',
    feature: {
      type: 'static',
      eyebrow: '◆ Current installation',
      title: 'Terroir of Memories',
      body: 'A quarterly rotating sensory artwork — touch, taste, hear, and smell the installation around you.',
    },
  },
  'dining-room': {
    slug: 'dining-room', floor: 3, name: 'The Dining Room', vn: 'Phòng Ăn Riêng',
    accent: '#C27070',
    feature: {
      type: 'static',
      eyebrow: '◆ Tonight’s pick',
      title: 'Ask the kitchen',
      body: 'Tonight’s special is curated by our chef — speak with the maître d’ to hear what’s on.',
    },
  },
  'rampant-room': {
    slug: 'rampant-room', floor: 4, name: 'The Rampant Room', vn: 'Phòng Rampant',
    accent: '#D4B85A',
    feature: {
      type: 'whisky',
      eyebrow: '◆ Featured pour',
    },
  },
  'source-origin-lab': {
    slug: 'source-origin-lab', floor: 5, name: 'Source & Origin Lab', vn: 'Phòng Thí Nghiệm',
    accent: '#5E6650',
    feature: {
      type: 'static',
      eyebrow: '◆ This week’s experiment',
      title: 'Saigon Cellar Drops',
      body: 'A rotating set of experimental serves — short-batch, sometimes daft, occasionally brilliant. Ask to taste.',
    },
  },
}

interface FeaturedWhisky {
  id: string
  name: string
  region: string | null
  distillery: string | null
  abv: string | null
  age: string | null
  tasting_notes: string | null
}

interface MemberLookup {
  found: boolean
  member_number?: string
  display_name?: string | null
  credit_vnd?: number
  expires_at?: string | null
}

interface TonightData {
  dram?:  { label: string; note: string }
  vinyl?: { label: string; note: string }
  quote?: string
}

export default function KioskPage({ params }: { params: Promise<{ floor: string }> }) {
  const { floor: slug } = use(params)
  const floor = FLOORS[slug]
  if (!floor) notFound()

  const [now, setNow] = useState<Date>(new Date())
  const [tonight, setTonight] = useState<TonightData | null>(null)
  const [temp, setTemp] = useState<number | null>(null)
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'unsupported' | 'denied' | 'error'>('idle')
  const [tappedUid, setTappedUid] = useState<string | null>(null)
  const [member, setMember] = useState<MemberLookup | null>(null)
  const [featuredWhisky, setFeaturedWhisky] = useState<FeaturedWhisky | null>(null)

  // Live clock — Saigon local time, ticks every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Tonight's pour + vinyl
  useEffect(() => {
    fetch('/api/tonight').then(r => r.json()).then(setTonight).catch(() => {})
    const id = setInterval(() => {
      fetch('/api/tonight').then(r => r.json()).then(setTonight).catch(() => {})
    }, 10 * 60_000) // refresh every 10 min
    return () => clearInterval(id)
  }, [])

  // Weather
  useEffect(() => {
    fetch('/api/weather').then(r => r.json()).then(d => setTemp(d?.temp ?? null)).catch(() => {})
    const id = setInterval(() => {
      fetch('/api/weather').then(r => r.json()).then(d => setTemp(d?.temp ?? null)).catch(() => {})
    }, 15 * 60_000)
    return () => clearInterval(id)
  }, [])

  // Featured whisky for the Rampant Room kiosk
  useEffect(() => {
    if (floor.feature?.type !== 'whisky') return
    fetch('/api/kiosk/featured-whisky')
      .then(r => r.json())
      .then(d => setFeaturedWhisky(d?.whisky ?? null))
      .catch(() => {})
  }, [floor.feature?.type])

  // Look up the member when a card is tapped, AND fire-and-forget the
  // Guardian Angel start. Idempotent on the server — if a visit is
  // already in flight today, the existing one is returned. Failures are
  // intentionally silent on the kiosk; staff see visits appear on the
  // Tonight wall as the source of truth.
  useEffect(() => {
    if (!tappedUid) {
      setMember(null)
      return
    }
    let cancelled = false
    fetch(`/api/kiosk/lookup?uid=${encodeURIComponent(tappedUid)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setMember(d) })
      .catch(() => { if (!cancelled) setMember({ found: false }) })
    // Fire the visit-start in parallel; we don't await or surface the result.
    fetch('/api/kiosk/start-visit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: tappedUid }),
    }).catch(() => { /* deliberately silent — staff has the Tonight wall */ })
    return () => { cancelled = true }
  }, [tappedUid])

  // NFC card tap — Web NFC API (Android/Chrome only)
  const startNfc = useCallback(async () => {
    if (typeof window === 'undefined' || !('NDEFReader' in window)) {
      setNfcStatus('unsupported')
      return
    }
    try {
      // @ts-expect-error — Web NFC types vary by TS lib version
      const reader = new window.NDEFReader()
      await reader.scan()
      setNfcStatus('scanning')
      reader.addEventListener('reading', (event: { serialNumber?: string }) => {
        const uid = event.serialNumber?.toUpperCase().replace(/:/g, '') || ''
        if (uid) {
          setTappedUid(uid)
          // Reset after 30s so the next member can tap
          setTimeout(() => setTappedUid(null), 30_000)
        }
      })
    } catch (e) {
      const msg = (e as Error).message || ''
      if (msg.includes('denied') || msg.includes('not allowed')) setNfcStatus('denied')
      else setNfcStatus('error')
    }
  }, [])

  // Auto-start NFC scan on page mount (Samsung/Android only)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      // Defer until user interaction — most browsers require a gesture before scan()
      const start = () => {
        startNfc()
        document.removeEventListener('click', start)
        document.removeEventListener('touchstart', start)
      }
      document.addEventListener('click', start, { once: true })
      document.addEventListener('touchstart', start, { once: true })
    } else {
      setNfcStatus('unsupported')
    }
  }, [startNfc])

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' })

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        html, body { margin: 0; padding: 0; background: #052E20; overflow-x: hidden; }
        body { font-family: 'Google Sans Code', monospace; color: #E5D4C2; }

        .kiosk { min-height: 100vh; padding: 28px 32px 40px; position: relative; }

        /* Top bar */
        .k-topbar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
        .k-floor-mark {
          display: inline-block; width: 8px; height: 8px;
          background: ${floor.accent}; transform: rotate(45deg);
          margin-bottom: 14px; opacity: 0.85;
        }
        .k-floor-name {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 38px; font-weight: 500; letter-spacing: 0.04em;
          line-height: 1; margin: 0 0 6px;
        }
        .k-floor-vn {
          font-size: 12px; letter-spacing: 0.10em; color: #B2AA98; opacity: 0.7;
        }
        .k-meta { text-align: right; font-size: 11px; color: #B2AA98; line-height: 1.6; }
        .k-meta .k-time {
          font-family: 'Rampant Sans', serif; font-size: 26px; color: #E5D4C2;
          letter-spacing: 0.06em; line-height: 1; margin-bottom: 6px;
        }
        .k-meta .k-date { letter-spacing: 0.06em; }
        .k-meta .k-temp { letter-spacing: 0.06em; color: ${floor.accent}; }

        /* Grid */
        .k-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          grid-template-rows: auto auto;
          gap: 18px;
          margin-bottom: 26px;
        }
        @media (max-width: 900px) {
          .k-grid { grid-template-columns: 1fr; }
        }

        /* Cards */
        .k-card {
          padding: 24px 26px;
          background: rgba(229,212,194,0.04);
          border: 1px solid rgba(229,212,194,0.10);
          border-radius: 14px;
          position: relative;
          backdrop-filter: blur(4px);
        }
        .k-card.is-accent { border-color: rgba(212,184,90,0.28); background: rgba(212,184,90,0.05); }

        .k-eyebrow {
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: ${floor.accent}; margin-bottom: 10px;
        }
        .k-card-title {
          font-family: 'Rampant Sans', serif;
          font-size: 22px; font-weight: 500; letter-spacing: 0.02em;
          margin: 0 0 6px;
        }
        .k-card-note { font-size: 12px; color: #B2AA98; opacity: 0.85; line-height: 1.7; }

        /* Now playing */
        .k-now-playing { min-height: 160px; }
        .k-now-playing .placeholder {
          font-size: 11px; color: #B2AA98; opacity: 0.5; font-style: italic;
          padding: 18px 0;
        }
        .k-now-controls { display: flex; gap: 10px; margin-top: 14px; }
        .k-now-btn {
          flex: 1; padding: 12px; background: rgba(229,212,194,0.06);
          border: 1px solid rgba(229,212,194,0.10);
          color: #E5D4C2; font-family: inherit;
          border-radius: 8px; font-size: 11px;
          letter-spacing: 0.10em; text-transform: uppercase;
          cursor: pointer; transition: background 0.2s;
        }
        .k-now-btn:hover { background: rgba(229,212,194,0.10); }

        /* Tap zone */
        .k-tap {
          grid-column: 1 / -1;
          padding: 28px;
          text-align: center;
          background: rgba(212,184,90,0.05);
          border: 1px dashed rgba(212,184,90,0.35);
          border-radius: 14px;
          transition: background 0.3s, border-color 0.3s;
        }
        .k-tap.is-scanning { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse {
          0%, 100% { background: rgba(212,184,90,0.05); border-color: rgba(212,184,90,0.35); }
          50% { background: rgba(212,184,90,0.10); border-color: rgba(212,184,90,0.55); }
        }
        .k-tap.is-tapped { background: rgba(94,102,80,0.18); border: 1px solid rgba(94,102,80,0.55); animation: none; }
        .k-tap-icon { font-size: 32px; color: ${floor.accent}; margin-bottom: 10px; }
        .k-tap-title {
          font-family: 'Rampant Sans', serif;
          font-size: 22px; font-weight: 500; margin: 0 0 4px; letter-spacing: 0.02em;
        }
        .k-tap-sub { font-size: 11px; color: #B2AA98; opacity: 0.7; letter-spacing: 0.04em; }
        .k-tap-uid {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: ${floor.accent}; margin-top: 8px;
          letter-spacing: 0.10em; opacity: 0.9;
        }

        /* Menu frame */
        .k-menu-section { margin-top: 26px; }
        .k-menu-heading {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 14px;
        }
        .k-menu-title {
          font-family: 'Rampant Sans', serif;
          font-size: 18px; font-weight: 500; letter-spacing: 0.04em;
        }
        .k-menu-actions { display: flex; gap: 10px; font-size: 11px; }
        .k-menu-actions a {
          color: ${floor.accent}; text-decoration: none;
          letter-spacing: 0.06em;
          border-bottom: 1px solid rgba(212,184,90,0.30);
          padding-bottom: 1px;
        }
        .k-menu-frame {
          width: 100%; height: 60vh; min-height: 480px;
          border: 1px solid rgba(229,212,194,0.10);
          border-radius: 12px;
          background: #1a1a1a;
        }
        .k-menu-empty {
          padding: 60px 24px; text-align: center;
          font-size: 12px; color: #B2AA98; opacity: 0.6;
          font-style: italic;
          background: rgba(229,212,194,0.03);
          border: 1px dashed rgba(229,212,194,0.10);
          border-radius: 12px;
        }

        /* Tablet portrait optimisations */
        @media (max-width: 900px) {
          .k-topbar { flex-direction: column; gap: 14px; }
          .k-meta { text-align: left; }
          .k-floor-name { font-size: 30px; }
          .k-menu-frame { height: 70vh; }
        }
      ` }} />

      <div className="kiosk">
        <div className="k-topbar">
          <div>
            <div className="k-floor-mark" />
            <h1 className="k-floor-name">{floor.name}</h1>
            <div className="k-floor-vn">{floor.vn} &middot; Floor {floor.floor}</div>
          </div>
          <div className="k-meta">
            <div className="k-time">{fmtTime(now)}</div>
            <div className="k-date">{fmtDate(now)}</div>
            {temp != null && <div className="k-temp">{temp}° Sài Gòn</div>}
          </div>
        </div>

        <div className="k-grid">
          {/* Now playing — placeholder until Spotify is wired */}
          <div className="k-card k-now-playing">
            <div className="k-eyebrow">♪ Now playing</div>
            <h2 className="k-card-title">Awaiting the turntable</h2>
            <p className="k-card-note">Spotify connect coming soon. The next time you visit, skip songs and queue tracks straight from here.</p>
            <div className="k-now-controls">
              <button className="k-now-btn" disabled>← Previous</button>
              <button className="k-now-btn" disabled>Pause</button>
              <button className="k-now-btn" disabled>Skip →</button>
            </div>
          </div>

          {/* Tonight panel */}
          <div className="k-card is-accent">
            <div className="k-eyebrow">◆ Tonight</div>
            {tonight?.dram && (
              <>
                <h2 className="k-card-title">{tonight.dram.label}</h2>
                <p className="k-card-note">{tonight.dram.note}</p>
              </>
            )}
            {tonight?.vinyl && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(229,212,194,0.10)' }}>
                <div className="k-eyebrow" style={{ marginBottom: 6 }}>On the turntable</div>
                <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{tonight.vinyl.label}</div>
                <div className="k-card-note">{tonight.vinyl.note}</div>
              </div>
            )}
          </div>

          {/* Per-floor feature widget */}
          {floor.feature && (
            <div className="k-card">
              <div className="k-eyebrow">{floor.feature.eyebrow}</div>
              {floor.feature.type === 'whisky' ? (
                featuredWhisky ? (
                  <>
                    <h2 className="k-card-title">{featuredWhisky.name}</h2>
                    <div style={{ fontSize: 11, color: '#B2AA98', letterSpacing: '0.06em', marginBottom: 12 }}>
                      {[featuredWhisky.distillery, featuredWhisky.region, featuredWhisky.age, featuredWhisky.abv].filter(Boolean).join(' · ')}
                    </div>
                    {featuredWhisky.tasting_notes && <p className="k-card-note">{featuredWhisky.tasting_notes}</p>}
                  </>
                ) : (
                  <p className="k-card-note" style={{ fontStyle: 'italic' }}>Selecting tonight&rsquo;s pour…</p>
                )
              ) : (
                <>
                  {floor.feature.title && <h2 className="k-card-title">{floor.feature.title}</h2>}
                  {floor.feature.body && <p className="k-card-note">{floor.feature.body}</p>}
                </>
              )}
            </div>
          )}

          {/* NFC tap zone */}
          <div
            className={`k-tap ${nfcStatus === 'scanning' ? 'is-scanning' : ''} ${tappedUid ? 'is-tapped' : ''}`}
          >
            <div className="k-tap-icon">▮</div>
            {member?.found ? (
              <>
                <h2 className="k-tap-title">
                  {member.display_name ? `Welcome, ${member.display_name.split(' ')[0]}.` : 'Welcome back.'}
                </h2>
                <p className="k-tap-sub" style={{ marginBottom: 4 }}>
                  {member.display_name || `Member ${member.member_number}`}
                </p>
                {member.credit_vnd != null && (
                  <p className="k-tap-sub">
                    Balance: <span style={{ color: floor.accent }}>{member.credit_vnd.toLocaleString('en-GB')} đ</span>
                  </p>
                )}
              </>
            ) : tappedUid && member && !member.found ? (
              <>
                <h2 className="k-tap-title">Card not recognised</h2>
                <p className="k-tap-sub">Speak to a member of staff to have it linked.</p>
                <div className="k-tap-uid">{tappedUid}</div>
              </>
            ) : tappedUid ? (
              <>
                <h2 className="k-tap-title">Card detected</h2>
                <p className="k-tap-sub">Looking you up…</p>
              </>
            ) : nfcStatus === 'scanning' ? (
              <>
                <h2 className="k-tap-title">Hold your card to the tablet</h2>
                <p className="k-tap-sub">Or tap anywhere to browse anonymously</p>
              </>
            ) : nfcStatus === 'unsupported' ? (
              <>
                <h2 className="k-tap-title">Browse the menu below</h2>
                <p className="k-tap-sub">Member sign-in unavailable on this device</p>
              </>
            ) : nfcStatus === 'denied' ? (
              <>
                <h2 className="k-tap-title">NFC blocked</h2>
                <p className="k-tap-sub">Allow NFC in browser settings to enable card sign-in</p>
              </>
            ) : (
              <>
                <h2 className="k-tap-title">Tap the screen to enable card sign-in</h2>
                <p className="k-tap-sub">Then hold your member card to the tablet</p>
              </>
            )}
          </div>
        </div>

        {/* Menu section */}
        <div className="k-menu-section">
          <div className="k-menu-heading">
            <div className="k-menu-title">The menu</div>
            {floor.menuPdf && (
              <div className="k-menu-actions">
                <a href={floor.menuPdf} target="_blank" rel="noopener noreferrer">Open ↗</a>
                <a href={floor.menuPdf} download>Download</a>
              </div>
            )}
          </div>
          {floor.menuPdf ? (
            <iframe src={floor.menuPdf} title={`${floor.name} menu`} className="k-menu-frame" />
          ) : (
            <div className="k-menu-empty">
              Menu for {floor.name} hasn&rsquo;t been added yet.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
