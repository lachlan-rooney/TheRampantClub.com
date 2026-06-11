'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'

// Palate twins — discovery THROUGH whisky, truly double-blind. The system finds
// members whose palate echoes yours and surfaces them ANONYMOUSLY ("a member shares
// 87% of your palate"). Neither of you is named unless you both choose to meet.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Match { token: string; pct: number; shared_note: string }

export default function PalateTwins() {
  const [loading, setLoading] = useState(true)
  const [consented, setConsented] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [reason, setReason] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [sentTokens, setSentTokens] = useState<Set<string>>(new Set())
  const supabase = createBrowserSupabaseClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUid(user?.id ?? null)
    const r = await fetch('/api/social/palate-twins')
    if (r.ok) { const j = await r.json(); setConsented(!!j.consented); setMatches(j.matches || []); setReason(j.reason || null) }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const toggleConsent = async (on: boolean) => {
    if (!uid) return
    await supabase.from('member_consents').upsert({ member: uid, feature: 'palate_twin', enabled: on }, { onConflict: 'member,feature' })
    setLoading(true); load()
  }

  const express = useCallback(async (token: string) => {
    setSentTokens(s => new Set(s).add(token))
    await fetch('/api/social/palate-twins/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
  }, [])

  return (
    <MemberPage title="Palate Twins" subtitle="NHỮNG KHẨU VỊ ĐỒNG ĐIỆU" description="Members whose palate echoes yours — found by taste, named by no one until you both choose to meet.">
      {loading ? (
        <p style={muted}>Reading the room’s palates…</p>
      ) : !consented ? (
        <div style={optInCard}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', marginBottom: 10 }}>Discover your palate twins</div>
          <p style={{ ...muted, textAlign: 'left', marginBottom: 8 }}>
            Opt in and the club quietly compares your palate with other willing members. You’ll see strong matches as
            <em> anonymous</em> cards — “a member shares 87% of your palate”. Neither of you is named unless you both express interest.
            A decline is silent; no one is ever told no.
          </p>
          <button onClick={() => toggleConsent(true)} style={primaryBtn}>Find my palate twins</button>
        </div>
      ) : reason === 'no_vector' ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <p style={muted}>Your palate is still taking shape. Log a few <Link href="/members/notes" style={link}>tasting notes</Link> and your matches will sharpen.</p>
          <OptOut onOff={() => toggleConsent(false)} />
        </div>
      ) : matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <p style={muted}>No strong echoes just yet. The more you <Link href="/members/notes" style={link}>note what you taste</Link>, the truer the matches become.</p>
          <OptOut onOff={() => toggleConsent(false)} />
        </div>
      ) : (
        <>
          {matches.map(m => {
            const sent = sentTokens.has(m.token)
            return (
              <div key={m.token} style={matchCard}>
                <div style={pctRow}>
                  <span style={pctBig}>{m.pct}%</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98' }}>of your palate</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: '#E5D4C2', lineHeight: 1.6, margin: '6px 0 12px' }}>
                  A member you’ve not met shares {m.shared_note}.
                </div>
                <button onClick={() => express(m.token)} disabled={sent} style={{ ...meetBtn, opacity: sent ? 0.5 : 1 }}>
                  {sent ? 'Interest sent — you’ll know if they say yes' : 'I’d like to meet them'}
                </button>
              </div>
            )
          })}
          <OptOut onOff={() => toggleConsent(false)} />
        </>
      )}
    </MemberPage>
  )
}

function OptOut({ onOff }: { onOff: () => void }) {
  return <button onClick={onOff} style={optOut}>Stop matching me</button>
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.8, lineHeight: 1.75, textAlign: 'center' }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
const optInCard: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.3)', borderRadius: 14, background: 'linear-gradient(135deg, rgba(212,184,90,0.08), rgba(212,184,90,0.02))', padding: '22px 22px' }
const primaryBtn: React.CSSProperties = { marginTop: 8, background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '10px 20px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const matchCard: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.28)', borderRadius: 14, background: 'rgba(229,212,194,0.03)', padding: '18px 20px', marginBottom: 14 }
const pctRow: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 8 }
const pctBig: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 600, color: '#D4B85A' }
const meetBtn: React.CSSProperties = { background: 'rgba(212,184,90,0.12)', border: '1px solid rgba(212,184,90,0.4)', borderRadius: 20, padding: '8px 18px', fontFamily: MONO, fontSize: 11, color: '#D4B85A', cursor: 'pointer', letterSpacing: '0.04em' }
const optOut: React.CSSProperties = { display: 'block', margin: '20px auto 0', background: 'transparent', border: 'none', fontFamily: MONO, fontSize: 10, color: '#7E7864', textDecoration: 'underline', cursor: 'pointer' }
