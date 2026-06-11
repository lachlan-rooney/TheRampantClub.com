'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import MemberModal from '@/components/MemberModal'
import { paletteSignature } from '@/lib/whisky/palate-signature'

// The opt-in directory — discreet, whisky-framed. Only members who hold the
// 'discoverable' consent appear (the function gates it; an opted-out member is
// simply not returned). Each shows name + a palate signature ONLY — no contact,
// no visits, no member number. From here a member requests an introduction; the
// club hosts the rest.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Entry { member_id: string; display_name: string; vector: Record<string, number> }

export default function Directory() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [discoverable, setDiscoverable] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [target, setTarget] = useState<Entry | null>(null)
  const [context, setContext] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')

  const supabase = createBrowserSupabaseClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUid(user?.id ?? null)
    const { data } = await supabase.rpc('member_directory')
    setEntries((data as Entry[]) || [])
    const { data: c } = await supabase.from('member_consents').select('enabled').eq('feature', 'discoverable').maybeSingle()
    setDiscoverable(!!c?.enabled)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const toggleDiscoverable = async () => {
    if (!uid) return
    const next = !discoverable
    setDiscoverable(next)
    await supabase.from('member_consents').upsert({ member: uid, feature: 'discoverable', enabled: next }, { onConflict: 'member,feature' })
    load()
  }

  const request = useCallback(async () => {
    if (!target || sending) return
    setSending(true); setErr('')
    try {
      const r = await fetch('/api/social/introductions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: target.member_id, context: context.trim() || undefined }),
      })
      if (r.ok) { setSentTo(s => new Set(s).add(target.member_id)); setTarget(null); setContext('') }
      else setErr((await r.json().catch(() => ({})))?.error || 'Could not send.')
    } finally { setSending(false) }
  }, [target, context, sending])

  return (
    <MemberPage title="The Members" subtitle="NHỮNG THÀNH VIÊN" description="Fellow members who’ve chosen to be found. A name and a palate — the club makes the introduction.">
      <div style={toggleRow}>
        <div>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>Appear in the directory</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', opacity: 0.7, marginTop: 2 }}>Others see your name + palate only. Off by default.</div>
        </div>
        <button onClick={toggleDiscoverable} style={{ ...toggle, ...(discoverable ? toggleOn : null) }}>
          <span style={{ ...knob, transform: discoverable ? 'translateX(20px)' : 'translateX(0)' }} />
        </button>
      </div>

      {loading ? (
        <p style={muted}>Looking who’s about…</p>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <p style={muted}>No one’s listed in the directory yet. {discoverable ? 'You’re listed — others will appear as they opt in.' : 'Flip the switch above to be found.'}</p>
        </div>
      ) : entries.map(e => {
        const requested = sentTo.has(e.member_id)
        return (
          <div key={e.member_id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={sigil}>{(e.display_name || '?').charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>{e.display_name}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: '#D4B85A', opacity: 0.85, marginTop: 2 }}>{paletteSignature(e.vector)}</div>
              </div>
              <button onClick={() => { setTarget(e); setContext(''); setErr('') }} disabled={requested} style={{ ...reqBtn, opacity: requested ? 0.4 : 1 }}>
                {requested ? 'Requested' : 'Introduce me'}
              </button>
            </div>
          </div>
        )
      })}

      <MemberModal open={!!target} onClose={() => setTarget(null)} title="Request an introduction" subtitle={target ? `TO ${target.display_name.toUpperCase()}` : ''}>
        {err && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 8 }}>{err}</div>}
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, marginBottom: 12 }}>
          A line on why, if you like — the club passes it along. They’ll see it; you’ll simply see “pending”.
        </div>
        <textarea value={context} onChange={e => setContext(e.target.value.slice(0, 280))} rows={3} placeholder="We both seem to love the sherried Speysiders…" style={textarea} />
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', textAlign: 'right', marginTop: 4 }}>{context.length}/280</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button onClick={() => setTarget(null)} style={cancelBtn}>Cancel</button>
          <button onClick={request} disabled={sending} style={{ ...sendBtn, opacity: sending ? 0.5 : 1 }}>{sending ? 'Sending…' : 'Request introduction'}</button>
        </div>
      </MemberModal>
    </MemberPage>
  )
}

const toggleRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid rgba(212,184,90,0.2)', borderRadius: 12, background: 'rgba(229,212,194,0.03)', padding: '14px 16px', marginBottom: 22 }
const toggle: React.CSSProperties = { position: 'relative', width: 44, height: 24, borderRadius: 12, border: '1px solid rgba(178,170,152,0.4)', background: 'rgba(178,170,152,0.15)', cursor: 'pointer', flexShrink: 0, padding: 0 }
const toggleOn: React.CSSProperties = { background: 'rgba(212,184,90,0.4)', border: '1px solid #D4B85A' }
const knob: React.CSSProperties = { position: 'absolute', top: 1, left: 1, width: 20, height: 20, borderRadius: '50%', background: '#E5D4C2', transition: 'transform 0.2s ease' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', textAlign: 'center', opacity: 0.7, lineHeight: 1.7 }
const card: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.1)', borderRadius: 12, background: 'rgba(229,212,194,0.03)', padding: '14px 16px', marginBottom: 10 }
const sigil: React.CSSProperties = { width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(212,184,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#D4B85A', background: 'rgba(212,184,90,0.08)' }
const reqBtn: React.CSSProperties = { flexShrink: 0, background: 'rgba(212,184,90,0.12)', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 18, padding: '6px 14px', fontFamily: MONO, fontSize: 10, color: '#D4B85A', cursor: 'pointer', letterSpacing: '0.04em' }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.6, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const cancelBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 12, color: '#B2AA98', cursor: 'pointer' }
const sendBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
