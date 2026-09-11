'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { PublicPage } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

export default function ResetPasswordPage() {
  const [fontsReady, setFontsReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords don\'t match.')
      return
    }
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message || 'Could not update password. Try requesting a new reset link.')
      return
    }
    setDone(true)
    setTimeout(() => router.push('/members'), 1200)
  }, [password, confirm, router])

  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        html, body { margin: 0; padding: 0; }
        /* The words and a new key on the left, two underlined fields on the
           right, the same gold line of script as the door. No card. */
        .rp-page { min-height: 100vh; min-height: 100svh; display: flex; align-items: center; }
        .rp-grid { width: 100%; box-sizing: border-box; display: grid; grid-template-columns: 1.05fr .95fr; gap: 72px;
                   align-items: center; padding-top: 110px; padding-bottom: 110px; }
        .rp-grid.is-single { grid-template-columns: 1fr; }
        .rp-words { position: relative; }
        .rp-wordmark { color: #D4B85A; opacity: 1; }
        .rp-title { margin-top: 16px; }
        .rp-subtitle { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 14px; line-height: 2; margin: 20px 0 0; }
        .rp-art { width: clamp(160px, 16vw, 230px); margin: 34px 0 0 clamp(60px, 12vw, 190px); }
        .rp-panel { width: 100%; max-width: 440px; justify-self: end; }
        .rp-form { display: grid; gap: 26px; }
        .rp-input {
          display: block; width: 100%; box-sizing: border-box;
          background: transparent; color: #E5D4C2;
          border: none; border-bottom: 1px solid rgba(229, 212, 194, 0.32); border-radius: 0;
          padding: 14px 0; outline: none;
          font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 14px; letter-spacing: 0.02em;
          transition: border-color 0.25s ease;
        }
        .rp-input::placeholder { color: rgba(229, 212, 194, 0.5); }
        .rp-input:focus { border-bottom-color: #D4B85A; }
        .rp-input:-webkit-autofill,
        .rp-input:-webkit-autofill:hover,
        .rp-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #052E20 inset !important;
          -webkit-text-fill-color: #E5D4C2 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .rp-btn {
          justify-self: start; margin-top: 10px;
          display: inline-flex; align-items: baseline; gap: 16px;
          background: none; border: none; border-bottom: 1px solid #D4B85A; border-radius: 0;
          padding: 0 2px 8px 0; color: #D4B85A; cursor: pointer;
          font-family: 'Pinyon Script', 'Rampant Sans', serif; font-size: 34px; font-weight: 400; line-height: 1.1;
        }
        .rp-btn .pk-go { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 15px; }
        .rp-btn:hover:not(:disabled) .pk-go { transform: translateX(7px); }
        .rp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rp-message { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; line-height: 1.8; }
        .rp-message.error { color: #E89B9B; }
        .rp-back {
          display: inline-block; margin-top: 30px; color: #D4B85A; text-decoration: none;
          border-bottom: 1px solid #D4B85A; padding-bottom: 6px;
          font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
        }
        .rp-back:hover .pk-go { transform: translateX(7px); }

        @media (max-width: 860px) {
          .rp-page { align-items: flex-start; }
          .rp-grid { grid-template-columns: 1fr; gap: 36px; padding: 72px 20px 96px; }
          .rp-art { position: absolute; top: -8px; right: -10px; width: 88px; margin: 0; }
          .rp-words > :first-child, .rp-words > .rp-title { max-width: 72%; }
          .rp-panel { justify-self: start; max-width: none; }
          .rp-input { font-size: 16px; }
          .rp-btn { font-size: 30px; }
        }
      ` }} />
      <CreamInkDefs />

      <div className="rp-page" style={{ opacity: fontsReady ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        <div className={`pk-wrap rp-grid ${done || hasSession === false ? 'is-single' : ''}`}>
          <div className="rp-words">
            <div className="pk-eyebrow rp-wordmark">The Rampant Club</div>

            {done ? (
              <>
                <h1 className="pk-h1 rp-title">Done</h1>
                <p className="rp-subtitle">Taking you to the members&rsquo; area…</p>
              </>
            ) : hasSession === false ? (
              <>
                <h1 className="pk-h1 rp-title">Link expired</h1>
                <p className="rp-subtitle">Reset links are single-use and time-limited.</p>
                <a href="/login" className="rp-back">Request a new one <span className="pk-go">→</span></a>
              </>
            ) : (
              <>
                <h1 className="pk-h1 rp-title">Set a new password</h1>
                <p className="rp-subtitle">At least eight characters.</p>
              </>
            )}
            <div className="rp-art"><CreamInk name="key" width="100%" rot={-10} dur={9} /></div>
          </div>

          {!done && hasSession !== false && (
            <div className="rp-panel">
              <form onSubmit={handleSubmit} className="rp-form">
                <input
                  type="password"
                  className="rp-input"
                  placeholder="New password"
                  aria-label="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <input
                  type="password"
                  className="rp-input"
                  placeholder="Confirm new password"
                  aria-label="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="submit" className="rp-btn" disabled={loading || !password || !confirm}>
                  <span>{loading ? '…' : 'Save'}</span>
                  {!loading && <span className="pk-go" aria-hidden="true">→</span>}
                </button>
                {error && <div className="rp-message error" role="alert">{error}</div>}
              </form>
            </div>
          )}
        </div>
      </div>
    </PublicPage>
  )
}
