'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import NavOverlay from '@/components/NavOverlay'
import LoginTicker from '@/components/LoginTicker'

export default function LoginPage() {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/members'

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Wrong credentials. Double check with your PA.')
      setLoading(false)
    } else {
      router.push(redirect)
    }
  }, [email, password, redirect, router])

  const handleForgotPassword = useCallback(async () => {
    if (!email) {
      setError('Pop your email in — we\'ll take it from there.')
      return
    }
    setError(null)
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/members`,
    })
    setForgotSent(true)
  }, [email])

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Pinyon+Script&display=block" rel="stylesheet" />
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        html, body {
          margin: 0;
          padding: 0;
          background: #052E20;
        }

        .login-page {
          min-height: 100vh;
          background: #052E20;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Google Sans Code', monospace;
          position: relative;
          padding: 24px;
        }

        .login-grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 200px;
        }

        .login-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 380px;
          text-align: center;
        }

        .login-wordmark {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-weight: 400;
          font-size: 14px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #E5D4C2;
          opacity: 0.5;
          margin-bottom: 48px;
        }

        .login-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 400;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #E5D4C2;
          margin-bottom: 6px;
        }
        .login-subtitle {
          font-size: 11px;
          color: #B2AA98;
          opacity: 0.5;
          letter-spacing: 0.06em;
          margin-bottom: 36px;
        }

        .login-input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(229, 212, 194, 0.06);
          border: 1px solid rgba(229, 212, 194, 0.12);
          border-radius: 8px;
          color: #E5D4C2;
          font-family: 'Google Sans Code', monospace;
          font-size: 13px;
          letter-spacing: 0.02em;
          outline: none;
          transition: border-color 0.2s ease;
          margin-bottom: 12px;
        }
        .login-input::placeholder { color: #B2AA98; opacity: 0.3; }
        .login-input:focus { border-color: rgba(229, 212, 194, 0.3); }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px rgba(5, 46, 32, 0.95) inset !important;
          -webkit-text-fill-color: #E5D4C2 !important;
          border-color: rgba(229, 212, 194, 0.12);
          transition: background-color 5000s ease-in-out 0s;
        }

        .login-btn {
          width: 100%;
          padding: 16px;
          background: #5E6650;
          border: none;
          border-radius: 8px;
          color: #E5D4C2;
          font-family: 'Pinyon Script', 'Rampant Sans', serif;
          font-size: 22px;
          font-weight: 400;
          letter-spacing: 0.06em;
          text-transform: none;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 4px;
        }
        .login-btn:hover { background: #4a5040; }
        .login-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .login-toggle {
          margin-top: 20px;
          font-size: 11px;
          color: #B2AA98;
          opacity: 0.5;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Google Sans Code', monospace;
          letter-spacing: 0.04em;
          transition: opacity 0.2s;
        }
        .login-toggle:hover { opacity: 0.6; }

        .login-message {
          margin-top: 16px;
          padding: 12px;
          border-radius: 8px;
          font-size: 12px;
          letter-spacing: 0.02em;
        }
        .login-message.success {
          background: rgba(94, 102, 80, 0.15);
          border: 1px solid rgba(94, 102, 80, 0.25);
          color: #B2AA98;
        }
        .login-message.error {
          background: rgba(139, 58, 58, 0.1);
          border: 1px solid rgba(139, 58, 58, 0.2);
          color: #C27070;
        }

        .login-diamond {
          width: 6px;
          height: 6px;
          background: #5E6650;
          transform: rotate(45deg);
          opacity: 0.3;
          margin: 28px auto 0;
        }
      ` }} />

      <NavOverlay variant="public" dark />
      <LoginTicker />

      <div className="login-page">
        <div className="login-grain" />

        <div className="login-card" style={{ opacity: fontsReady ? 1 : 0, transition: 'opacity 0.3s ease' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/Key .svg"
            alt="The Rampant Club"
            style={{ height: 80, width: 'auto', display: 'block', margin: '0 auto 48px' }}
          />

          <h1 className="login-title">Members</h1>
          <p className="login-subtitle">Thành viên</p>

          <form onSubmit={handleLogin}>
            <input
              type="email"
              className="login-input"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="password"
              className="login-input"
              placeholder="Password (not your whisky locker code)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button className="login-btn" type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span>{loading ? 'Entering The Lions Den...' : 'Hic Sunt Leones'}</span>
              {!loading && <span style={{ fontSize: 24, opacity: 0.5, fontFamily: "'Rampant Sans', serif", position: 'absolute', right: 16 }}>&rsaquo;</span>}
            </button>
          </form>

          <button
            className="login-toggle"
            onClick={handleForgotPassword}
          >
            {forgotSent ? 'Check your email. We\'ve sent a lifeline.' : 'Forgotten password? It happens to the best of us.'}
          </button>

          {error && <div className="login-message error">{error}</div>}

          <div className="login-diamond" />
        </div>
      </div>
    </>
  )
}
