'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'

// The Annual Dram — the member's year at the club, as a single elegant card built
// for sharing. TRC restraint (not a loud Wrapped). Real member-own data only;
// nothing private, nothing of others. Sparse → "your story is just beginning".

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Annual {
  ready: boolean; sparse: boolean; framing: 'year_end' | 'so_far'; year: number
  member_name: string; member_no: string; visits: number; distinct_drams: number
  top_dram: string | null; palette: string | null; standout_note: { note: string; whisky: string | null } | null
}

export default function AnnualDram() {
  const [d, setD] = useState<Annual | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/members/annual-dram').then(r => r.ok ? r.json() : null).then(j => { setD(j); setLoading(false) }) }, [])

  const title = d?.framing === 'year_end' ? `Your ${d.year}` : 'Your Year So Far'

  return (
    <MemberPage title="The Annual Dram" subtitle="LY RƯỢU CỦA NĂM" description="Your year at the club — yours to keep, yours to share.">
      {loading ? (
        <p style={muted}>Pouring your year…</p>
      ) : !d?.ready ? (
        <p style={muted}>Your year hasn’t begun in earnest yet — come in, and it will.</p>
      ) : (
        <>
          <div style={card}>
            <div style={cardGrain} />
            <div style={{ position: 'relative' }}>
              <div style={cardKicker}>The Rampant Club · {title}</div>

              {d.sparse ? (
                <>
                  <div style={cardHeadline}>Your story is just beginning.</div>
                  <div style={cardSub}>Every visit, every dram, every note from here becomes your year. We’re glad you’re with us, {d.member_name}.</div>
                </>
              ) : (
                <>
                  <div style={cardHeadline}>{d.member_name}</div>
                  {d.palette && <div style={cardPalette}>a {d.palette} palate</div>}

                  <div style={statRow}>
                    {d.visits > 0 && <Stat value={String(d.visits)} label={d.visits === 1 ? 'visit' : 'visits'} />}
                    {d.distinct_drams > 0 && <Stat value={String(d.distinct_drams)} label="distinct drams" />}
                  </div>

                  {d.top_dram && (
                    <div style={dramBlock}>
                      <div style={dramLabel}>Your dram of the year</div>
                      <div style={dramName}>{d.top_dram}</div>
                    </div>
                  )}

                  {d.standout_note && (
                    <div style={noteBlock}>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: '#E5D4C2', fontStyle: 'italic', lineHeight: 1.7 }}>“{d.standout_note.note}”</div>
                      {d.standout_note.whisky && <div style={{ fontFamily: MONO, fontSize: 10, color: '#C9A84C', marginTop: 6, letterSpacing: '0.06em' }}>— on {d.standout_note.whisky}</div>}
                    </div>
                  )}
                </>
              )}

              <div style={cardFooter}>
                <span>No. {d.member_no}</span>
                <span style={{ letterSpacing: '0.18em' }}>RAMPANT</span>
              </div>
            </div>
          </div>

          <p style={{ ...muted, fontSize: 11, marginTop: 16 }}>Yours to screenshot and share. <Link href="/members/journey" style={link}>See the whole journey →</Link></p>
        </>
      )}
    </MemberPage>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 38, fontWeight: 600, color: '#C9A84C', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 5 }}>{label}</div>
    </div>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.8, lineHeight: 1.7, textAlign: 'center' }
const link: React.CSSProperties = { color: '#C9A84C', textDecoration: 'none', borderBottom: '1px solid rgba(201,168,76,0.4)' }
const card: React.CSSProperties = { position: 'relative', borderRadius: 18, padding: '32px 28px 22px', overflow: 'hidden', background: 'linear-gradient(160deg, #0A3A28 0%, #052E20 55%, #04251A 100%)', border: '1px solid rgba(201,168,76,0.35)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }
const cardGrain: React.CSSProperties = { position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: '180px' }
const cardKicker: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#C9A84C', letterSpacing: '0.16em', textTransform: 'uppercase', textAlign: 'center', opacity: 0.9 }
const cardHeadline: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 600, color: '#E5D4C2', textAlign: 'center', margin: '14px 0 2px', letterSpacing: '0.02em' }
const cardSub: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', textAlign: 'center', lineHeight: 1.7, maxWidth: 360, margin: '8px auto 0' }
const cardPalette: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#C9A84C', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 18 }
const statRow: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 36, margin: '6px 0 20px' }
const dramBlock: React.CSSProperties = { textAlign: 'center', padding: '14px 0', borderTop: '1px solid rgba(201,168,76,0.18)', borderBottom: '1px solid rgba(201,168,76,0.18)' }
const dramLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#B2AA98', letterSpacing: '0.14em', textTransform: 'uppercase' }
const dramName: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', marginTop: 6 }
const noteBlock: React.CSSProperties = { marginTop: 18, textAlign: 'center' }
const cardFooter: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, fontFamily: MONO, fontSize: 10, color: '#7E8A7E', letterSpacing: '0.06em' }
