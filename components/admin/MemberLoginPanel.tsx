'use client'

import { useEffect, useState, useCallback } from 'react'

// Admin panel on a member record: create + link their login (Phase 0b).
// Shows linked status; if unlinked, an admin can create the login with a
// generated temp password that is displayed ONCE here to relay to the member.
// The member is forced to change it on first login.

export default function MemberLoginPanel({ memberNo, defaultEmail }: { memberNo: string; defaultEmail: string | null }) {
  const [status, setStatus] = useState<'loading' | 'linked' | 'unlinked'>('loading')
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(defaultEmail || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    fetch(`/api/admin/members/create-login?member_no=${encodeURIComponent(memberNo)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setStatus(d.linked ? 'linked' : 'unlinked'); setLinkedEmail(d.email || null) })
      .catch(() => setStatus('unlinked'))
  }, [memberNo])
  useEffect(() => { refresh() }, [refresh])

  const create = useCallback(async () => {
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError('Enter a valid email.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/admin/members/create-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: memberNo, email: email.trim() }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not create the login.')
      setTempPassword(j.temp_password)   // shown once, here only
      setStatus('linked'); setLinkedEmail(j.email)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }, [email, memberNo])

  return (
    <div style={panel}>
      <div style={panelLabel}>Member login</div>

      {status === 'loading' && <div style={muted}>Checking…</div>}

      {status === 'linked' && !tempPassword && (
        <div style={linkedRow}>
          <span style={{ color: '#7AB07A' }}>✓ Linked</span>
          <span style={muted}>{linkedEmail || '—'}</span>
        </div>
      )}

      {/* One-time temp-password reveal */}
      {tempPassword && (
        <div style={revealBox}>
          <div style={{ color: '#7AB07A', fontSize: 11, marginBottom: 8 }}>✓ Login created for {linkedEmail}</div>
          <div style={muted}>Temporary password — shown once. Relay it securely; it is not stored anywhere. The member must change it on first sign-in.</div>
          <div style={pwRow}>
            <code style={pwCode}>{tempPassword}</code>
            <button style={copyBtn} onClick={() => { navigator.clipboard?.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button style={doneBtn} onClick={() => setTempPassword(null)}>Done — I’ve relayed it</button>
        </div>
      )}

      {status === 'unlinked' && !open && (
        <div style={linkedRow}>
          <span style={muted}>No login yet.</span>
          <button style={primaryBtn} onClick={() => setOpen(true)}>Create member login</button>
        </div>
      )}

      {status === 'unlinked' && open && (
        <div>
          <label style={fieldLabel}>Member’s email (their login)</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" style={input} />
          {error && <div style={errorText}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create login'}</button>
            <button style={ghostBtn} onClick={() => { setOpen(false); setError(null) }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

const panel: React.CSSProperties = { background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8, padding: '16px 18px', marginBottom: 20 }
const panelLabel: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }
const muted: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.8 }
const linkedRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'Google Sans Code', monospace", fontSize: 12, flexWrap: 'wrap' }
const fieldLabel: React.CSSProperties = { display: 'block', fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', maxWidth: 320, boxSizing: 'border-box', background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 6, padding: '9px 12px', fontFamily: "'Google Sans Code', monospace", fontSize: 12, outline: 'none' }
const primaryBtn: React.CSSProperties = { background: 'rgba(212,184,90,0.16)', color: '#D4B85A', border: '1px solid rgba(212,184,90,0.4)', borderRadius: 6, padding: '8px 14px', fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 6, padding: '8px 14px', fontFamily: "'Google Sans Code', monospace", fontSize: 11, cursor: 'pointer' }
const errorText: React.CSSProperties = { color: '#C27070', fontFamily: "'Google Sans Code', monospace", fontSize: 11, marginTop: 8 }
const revealBox: React.CSSProperties = { background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.30)', borderRadius: 6, padding: 14 }
const pwRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }
const pwCode: React.CSSProperties = { flex: 1, background: '#052E20', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 5, padding: '9px 12px', fontFamily: "'Google Sans Code', monospace", fontSize: 13, letterSpacing: '0.02em', wordBreak: 'break-all' }
const copyBtn: React.CSSProperties = { ...primaryBtn, padding: '9px 14px' }
const doneBtn: React.CSSProperties = { ...ghostBtn, marginTop: 4 }
