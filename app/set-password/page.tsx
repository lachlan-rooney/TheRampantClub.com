'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// Forced first-login password change. A freshly-created member login lands here
// (middleware routes must_change_password accounts here) and cannot reach member
// pages until they set their own password. The server route clears the flag;
// we then refresh the session so the new JWT no longer carries must_change
// (otherwise the middleware would loop on the stale token).

export default function SetPasswordPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => setHasSession(!!data.user))
  }, [])

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setLoading(true)
    try {
      const r = await fetch('/api/members/set-initial-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not set your password.')
      // Refresh so the new JWT drops must_change_password, then hard-nav so the
      // middleware re-reads the refreshed cookie.
      const supabase = createBrowserSupabaseClient()
      await supabase.auth.refreshSession()
      window.location.href = '/members'
    } catch (e) {
      setError((e as Error).message); setLoading(false)
    }
  }, [password, confirm])

  return (
    <div style={page}>
      <div style={card}>
        <div style={eyebrow}>The Rampant Club</div>
        <h1 style={title}>Set your password</h1>
        {hasSession === false ? (
          <p style={hint}>Your session has expired. <a href="/login" style={{ color: '#D4B85A' }}>Sign in</a> with the temporary password you were given, then set a new one here.</p>
        ) : (
          <>
            <p style={hint}>Welcome. Choose a password to finish setting up your account — you’ll use this from now on.</p>
            {error && <div style={errorBox}>{error}</div>}
            <form onSubmit={submit}>
              <label style={label}>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" style={input} />
              <label style={label}>Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" style={input} />
              <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Saving…' : 'Set password & continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#052E20', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Google Sans Code', 'DM Mono', monospace" }
const card: React.CSSProperties = { width: '100%', maxWidth: 380, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 12, padding: '36px 32px' }
const eyebrow: React.CSSProperties = { fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }
const title: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 26, fontWeight: 500, color: '#E5D4C2', margin: '0 0 14px' }
const hint: React.CSSProperties = { fontSize: 12, color: '#B2AA98', lineHeight: 1.6, marginBottom: 20 }
const label: React.CSSProperties = { display: 'block', fontSize: 10, color: '#B2AA98', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '14px 0 5px' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 6, padding: '10px 12px', fontFamily: "'Google Sans Code', monospace", fontSize: 13, outline: 'none' }
const btn: React.CSSProperties = { width: '100%', marginTop: 22, background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '12px', fontFamily: "'Google Sans Code', monospace", fontSize: 12, letterSpacing: '0.08em', cursor: 'pointer' }
const errorBox: React.CSSProperties = { padding: '10px 12px', background: 'rgba(194,112,112,0.15)', border: '1px solid rgba(194,112,112,0.35)', borderRadius: 6, color: '#E5D4C2', fontSize: 11, marginBottom: 12 }
