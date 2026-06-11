'use client'

import { useEffect, useState } from 'react'

// Shows who's acting on a shared staff login + a one-tap switch. Renders nothing
// for personal admin accounts (required=false) or before a pick.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function ActingChip() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/acting').then(r => r.ok ? r.json() : null).then(j => {
      if (j?.required) setName(j.staff?.display_name || null)
    }).catch(() => { /* ignore */ })
  }, [])

  if (!name) return null
  const switchUser = async () => {
    await fetch('/api/admin/acting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    window.location.href = '/admin/who'
  }
  return (
    <div style={chip}>
      <span style={{ color: '#B2AA98' }}>Acting as</span>
      <span style={{ color: '#E5D4C2', fontWeight: 600 }}>{name}</span>
      <button onClick={switchUser} style={btn}>Switch</button>
    </div>
  )
}

const chip: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.22)', borderRadius: 18, padding: '5px 12px' }
const btn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#D4B85A', fontFamily: MONO, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }
