'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { PublicPage, Rise } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

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
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style dangerouslySetInnerHTML={{ __html: `
        /* A welcome, then the one thing to do: words and a toast on the left,
           two underlined fields on the right. No card. */
        .sp { display: grid; grid-template-columns: 1.05fr .95fr; gap: 72px; align-items: center;
              padding-top: 110px; padding-bottom: 110px; min-height: 100vh; min-height: 100svh; box-sizing: border-box; }
        .sp-words { position: relative; }
        .sp-eyebrow { color: #D4B85A; opacity: 1; }
        .sp-art { width: clamp(170px, 18vw, 250px); margin: 36px 0 0 clamp(40px, 8vw, 120px); }
        .sp-panel { width: 100%; max-width: 440px; justify-self: end; }
        .sp-hint { font-family: ${MONO}; font-size: 13.5px; line-height: 2; margin: 0 0 30px; }
        .sp-hint a { color: #D4B85A; text-underline-offset: 4px; }
        .sp-label { display: block; font-family: ${MONO}; font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase;
                    color: #D4B85A; margin: 0; }
        .sp-input { display: block; width: 100%; box-sizing: border-box; background: transparent; color: #E5D4C2;
                    border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; outline: none;
                    padding: 12px 0; margin: 4px 0 26px; font-family: ${MONO}; font-size: 14px;
                    transition: border-color .25s; }
        .sp-input:focus { border-bottom-color: #D4B85A; }
        .sp-input:-webkit-autofill, .sp-input:-webkit-autofill:hover, .sp-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #052E20 inset !important; -webkit-text-fill-color: #E5D4C2 !important;
          transition: background-color 5000s ease-in-out 0s; }
        .sp-btn { display: inline-block; margin-top: 6px; background: none; color: #D4B85A; border: none;
                  border-bottom: 1px solid #D4B85A; border-radius: 0; padding: 6px 0 7px; cursor: pointer;
                  font-family: ${MONO}; font-size: 12.5px; letter-spacing: .12em; text-transform: uppercase; }
        .sp-btn:hover:not(:disabled) .pk-go { transform: translateX(7px); }
        .sp-btn:disabled { cursor: not-allowed; }
        .sp-error { font-family: ${MONO}; font-size: 12px; line-height: 1.8; color: #E89B9B; margin: 0 0 18px; }

        @media (max-width: 860px) {
          .sp { grid-template-columns: 1fr; align-content: start; gap: 28px; align-items: start; padding-top: 72px; padding-bottom: 96px; }
          .sp-art { position: absolute; top: -8px; right: -12px; width: 92px; margin: 0; }
          .sp-words > :first-child, .sp-words > :nth-child(2) { max-width: 72%; }
          .sp-panel { justify-self: start; max-width: none; }
          .sp-input { font-size: 16px; }
        }
      ` }} />
      <CreamInkDefs />

      <div className="pk-wrap sp">
        <div className="sp-words">
          <Rise><div className="pk-eyebrow sp-eyebrow">The Rampant Club</div></Rise>
          <Rise delay={.06}><h1 className="pk-h1">Set your password</h1></Rise>
          <Rise delay={.2} className="sp-art"><CreamInk name="gent-toast" width="100%" rot={-4} dur={8} /></Rise>
        </div>

        <Rise delay={.14} className="sp-panel">
          {hasSession === false ? (
            <p className="sp-hint">Your session has expired. <a href="/login">Sign in</a> with the temporary password you were given, then set a new one here.</p>
          ) : (
            <>
              <p className="sp-hint">Welcome. Choose a password to finish setting up your account — you’ll use this from now on.</p>
              {error && <div className="sp-error" role="alert">{error}</div>}
              <form onSubmit={submit}>
                <label className="sp-label" htmlFor="sp-password">New password</label>
                <input id="sp-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="sp-input" />
                <label className="sp-label" htmlFor="sp-confirm">Confirm password</label>
                <input id="sp-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className="sp-input" />
                <button type="submit" disabled={loading} className="sp-btn" style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Saving…' : <>Set password &amp; continue <span className="pk-go" aria-hidden="true">→</span></>}
                </button>
              </form>
            </>
          )}
        </Rise>
      </div>
    </PublicPage>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
