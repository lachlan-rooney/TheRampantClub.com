'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'

// Introductions. Incoming: requests addressed to me (name + palate + context) with
// a gracious accept / a quiet decline (one tap, no drama). Sent: my own requests —
// always shown as 'pending' until accepted (a decline is masked, by design; the
// requester is never told no).

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Incoming { id: string; via: string; from_name?: string; from_sig?: string; context?: string | null; match_pct?: number; shared_note?: string; created_at: string }
interface Sent { id: string; via: string; to_name: string | null; status: string; context?: string | null; created_at: string }

export default function Introductions() {
  const [incoming, setIncoming] = useState<Incoming[]>([])
  const [sent, setSent] = useState<Sent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/social/introductions')
    if (r.ok) { const j = await r.json(); setIncoming(j.incoming || []); setSent(j.sent || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const act = useCallback(async (id: string, action: 'accept' | 'decline') => {
    setBusy(id)
    try {
      await fetch(`/api/social/introductions/${id}/${action}`, { method: 'POST' })
      await load()
    } finally { setBusy(null) }
  }, [load])

  return (
    <MemberPage title="Introductions" subtitle="LỜI GIỚI THIỆU" description="The club makes the introduction — you decide. A decline is quiet; no one is ever told no.">
      {loading ? (
        <p style={muted}>Reading the room…</p>
      ) : (
        <>
          <div style={sectionLabel}>Awaiting your word</div>
          {incoming.length === 0 ? (
            <p style={{ ...muted, marginBottom: 28 }}>No introductions awaiting you just now.</p>
          ) : incoming.map(i => (
            <div key={i.id} style={card}>
              {i.via === 'palate_match' ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, fontWeight: 600, color: '#D4B85A' }}>{i.match_pct}%</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98' }}>palate match</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: '#E5D4C2', lineHeight: 1.6, marginTop: 6 }}>
                    A member whose palate is {i.match_pct}% yours would like to meet — you share {i.shared_note}. Accept to see who.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i.context ? 8 : 10 }}>
                    <div style={sigil}>{(i.from_name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>{i.from_name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: '#D4B85A', opacity: 0.85, marginTop: 2 }}>{i.from_sig}</div>
                    </div>
                  </div>
                  {i.context && <div style={contextLine}>“{i.context}”</div>}
                </>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={() => act(i.id, 'accept')} disabled={busy === i.id} style={acceptBtn}>Accept · open a thread</button>
                <button onClick={() => act(i.id, 'decline')} disabled={busy === i.id} style={declineBtn}>Not now</button>
              </div>
            </div>
          ))}

          <div style={{ ...sectionLabel, marginTop: 32 }}>Your requests</div>
          {sent.length === 0 ? (
            <p style={muted}>You haven’t requested any introductions yet — find someone in <Link href="/members/members" style={link}>the directory</Link>.</p>
          ) : sent.map(s => (
            <div key={s.id} style={{ ...card, opacity: 0.92 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>
                  {s.to_name || (s.via === 'palate_match' ? 'A palate match' : 'A member')}
                </span>
                {s.status === 'accepted'
                  ? <Link href="/members/messages" style={connectedPill}>Connected — open messages →</Link>
                  : <span style={pendingPill}>Pending</span>}
              </div>
              {s.context && <div style={{ ...contextLine, marginTop: 6 }}>“{s.context}”</div>}
            </div>
          ))}
        </>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.75, lineHeight: 1.7 }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#D4B85A', opacity: 0.8, marginBottom: 12 }
const card: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.1)', borderRadius: 12, background: 'rgba(229,212,194,0.03)', padding: '14px 16px', marginBottom: 12 }
const sigil: React.CSSProperties = { width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(212,184,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#D4B85A', background: 'rgba(212,184,90,0.08)' }
const contextLine: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', fontStyle: 'italic', lineHeight: 1.6 }
const acceptBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const declineBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 11, color: '#B2AA98', cursor: 'pointer' }
const pendingPill: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 10, padding: '3px 10px', letterSpacing: '0.04em' }
const connectedPill: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#7AB07A', textDecoration: 'none', border: '1px solid rgba(122,176,122,0.4)', borderRadius: 10, padding: '3px 10px', letterSpacing: '0.04em' }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
