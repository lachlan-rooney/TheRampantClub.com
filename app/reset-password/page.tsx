'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

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
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Pinyon+Script&display=block" rel="stylesheet" />
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        html, body { margin: 0; padding: 0; background: #052E20; }
        .rp-page {
          min-height: 100vh; background: #052E20;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Google Sans Code', monospace;
          position: relative; padding: 24px;
        }
        .rp-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 1;
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px;
        }
        .rp-card { position: relative; z-index: 2; width: 100%; max-width: 380px; text-align: center; }
        .rp-wordmark {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-weight: 400; font-size: 14px; letter-spacing: 0.2em;
          text-transform: uppercase; color: #E5D4C2; opacity: 0.5; margin-bottom: 48px;
        }
        .rp-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 24px; font-weight: 400; letter-spacing: 0.14em;
          text-transform: uppercase; color: #E5D4C2; margin-bottom: 6px;
        }
        .rp-subtitle {
          font-size: 11px; color: #B2AA98; opacity: 0.5;
          letter-spacing: 0.06em; margin-bottom: 36px;
        }
        .rp-input {
          width: 100%; padding: 14px 16px;
          background: rgba(229, 212, 194, 0.06);
          border: 1px solid rgba(229, 212, 194, 0.12);
          border-radius: 8px; color: #E5D4C2;
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; letter-spacing: 0.02em;
          outline: none; transition: border-color 0.2s ease; margin-bottom: 12px;
        }
        .rp-input::placeholder { color: #B2AA98; opacity: 0.3; }
        .rp-input:focus { border-color: rgba(229, 212, 194, 0.3); }
        .rp-input:-webkit-autofill,
        .rp-input:-webkit-autofill:hover,
        .rp-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px rgba(5, 46, 32, 0.95) inset !important;
          -webkit-text-fill-color: #E5D4C2 !important;
          border-color: rgba(229, 212, 194, 0.12);
          transition: background-color 5000s ease-in-out 0s;
        }
        .rp-btn {
          width: 100%; padding: 16px;
          background: #5E6650; border: none; border-radius: 8px;
          color: #E5D4C2; font-family: 'Pinyon Script', 'Rampant Sans', serif;
          font-size: 24px; font-weight: 400; letter-spacing: 0.06em;
          cursor: pointer; transition: all 0.2s ease; margin-top: 4px;
        }
        .rp-btn:hover { background: #4a5040; }
        .rp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rp-message {
          margin-top: 16px; padding: 12px; border-radius: 8px;
          font-size: 12px; letter-spacing: 0.02em;
        }
        .rp-message.success {
          background: rgba(94, 102, 80, 0.15);
          border: 1px solid rgba(94, 102, 80, 0.25);
          color: #B2AA98;
        }
        .rp-message.error {
          background: rgba(139, 58, 58, 0.1);
          border: 1px solid rgba(139, 58, 58, 0.2);
          color: #C27070;
        }
        .rp-back {
          display: inline-block; margin-top: 24px;
          font-size: 11px; color: #B2AA98; opacity: 0.5;
          letter-spacing: 0.04em; text-decoration: none;
          transition: opacity 0.2s;
        }
        .rp-back:hover { opacity: 0.9; }
      ` }} />

      <div className="rp-page" style={{ opacity: fontsReady ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        <div className="rp-grain" />
        <div className="rp-card">
          <div className="rp-wordmark">The Rampant Club</div>

          {done ? (
            <>
              <div className="rp-title">Done</div>
              <div className="rp-subtitle">Taking you to the members&rsquo; area…</div>
            </>
          ) : hasSession === false ? (
            <>
              <div className="rp-title">Link expired</div>
              <div className="rp-subtitle">Reset links are single-use and time-limited.</div>
              <a href="/login" className="rp-back">Request a new one →</a>
            </>
          ) : (
            <>
              <div className="rp-title">Set a new password</div>
              <div className="rp-subtitle">At least eight characters.</div>
              <form onSubmit={handleSubmit}>
                <input
                  type="password"
                  className="rp-input"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <input
                  type="password"
                  className="rp-input"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="submit" className="rp-btn" disabled={loading || !password || !confirm}>
                  {loading ? '…' : 'Save'}
                </button>
                {error && <div className="rp-message error">{error}</div>}
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
