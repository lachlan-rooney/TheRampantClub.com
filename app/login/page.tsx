'use client'

import { useState, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import NavOverlay from '@/components/NavOverlay'
import LoginTicker from '@/components/LoginTicker'
import { PublicPage } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// THE DOOR OPENS AT ONCE. This page used to read the ?redirect= address with
// useSearchParams, which made Next render the whole page in the browser only —
// a blank screen until the scripts arrived — and then kept the panel hidden
// until the button's script font had loaded from Google. Together that was
// ~1.5s of nothing. Now the address is read at the moment of signing in, the
// page is sent as HTML, and the font is self-hosted and requested up front
// (font-display: block holds just that one line until it lands, so there is
// still no flash of the wrong face).
export default function LoginPage() {
  return <LoginContent />
}

// Only ever send someone on to a page of this site. `?redirect=` used to be
// followed wherever it pointed, so a doctored link could land a member on
// another site straight after signing in.
function safeRedirect(): string {
  const r = new URLSearchParams(window.location.search).get('redirect') || ''
  return r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/\\') ? r : '/members'
}

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)

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
      // Hard navigation so the browser sees a real page transition and offers to save the password.
      // router.push() is a client-side route change that some browsers don't recognise as a login success.
      window.location.href = safeRedirect()
    }
  }, [email, password])

  const [forgotLoading, setForgotLoading] = useState(false)
  const handleForgotPassword = useCallback(async () => {
    if (forgotLoading || forgotSent) return
    if (!email) {
      setError('Pop your email in — we\'ll take it from there.')
      return
    }
    setError(null)
    setForgotLoading(true)
    const supabase = createBrowserSupabaseClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    })
    setForgotLoading(false)
    setForgotSent(true)
  }, [email, forgotLoading, forgotSent])

  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      {/* The button's script face (self-hosted), asked for with the HTML so it
          lands with the page; React hoists this into <head>. */}
      <link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        html, body { margin: 0; padding: 0; }

        /* ── Arriving at the door ─────────────────────────────────────────
           Words and the key on the left, the form on the right, set on the
           green like the rest of the house: no card, no box — underlined
           fields, a gold submit that is a line of script with an arrow. */
        .lg { position: relative; min-height: 100vh; min-height: 100svh; display: flex; align-items: center; }
        .lg-grid {
          width: 100%; box-sizing: border-box;
          display: grid; grid-template-columns: 1.05fr .95fr; gap: 64px; align-items: center;
          padding-top: 132px; padding-bottom: 96px;
          /* the fixed lion (NavOverlay) sits at the right edge, mid-height —
             keep the form clear of it whatever the width of the desk */
          padding-right: max(24px, calc(150px - (100vw - 1180px) / 2));
        }
        .lg-words { position: relative; }
        .lg-eyebrow { color: #D4B85A; opacity: 1; }
        .lg-title { margin-top: 18px; }
        .lg-key { width: clamp(190px, 19vw, 270px); margin: 34px 0 0 clamp(80px, 14vw, 220px); }

        .lg-panel { width: 100%; max-width: 440px; justify-self: end; }
        .lg-form { display: grid; gap: 26px; }

        .login-input {
          display: block; width: 100%; box-sizing: border-box;
          background: transparent; color: #E5D4C2;
          border: none; border-bottom: 1px solid rgba(229, 212, 194, 0.32); border-radius: 0;
          padding: 14px 0;
          font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 14px; letter-spacing: 0.02em;
          outline: none; transition: border-color 0.25s ease;
        }
        .login-input::placeholder { color: rgba(229, 212, 194, 0.5); }
        .login-input:focus { border-bottom-color: #D4B85A; }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #052E20 inset !important;
          -webkit-text-fill-color: #E5D4C2 !important;
          caret-color: #E5D4C2;
          transition: background-color 5000s ease-in-out 0s;
        }

        .login-btn {
          justify-self: start; margin-top: 10px;
          display: inline-flex; align-items: baseline; gap: 18px;
          background: none; border: none; border-bottom: 1px solid #D4B85A; border-radius: 0;
          padding: 0 2px 8px 0; color: #D4B85A; cursor: pointer;
          font-family: 'Pinyon Script', 'Rampant Sans', serif; font-size: 34px; font-weight: 400;
          line-height: 1.1; letter-spacing: 0.02em; text-transform: none;
        }
        .login-btn .lg-go { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 15px;
                            display: inline-block; transition: transform .35s ease; }
        .login-btn:hover:not(:disabled) .lg-go { transform: translateX(7px); }
        .login-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .login-toggle {
          display: block; margin-top: 30px; padding: 4px 0; text-align: left;
          background: none; border: none; cursor: pointer; color: #E5D4C2; opacity: 0.78;
          font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 11.5px; line-height: 1.8;
          letter-spacing: 0.04em; text-decoration: underline; text-decoration-color: rgba(229,212,194,.35);
          text-underline-offset: 5px; transition: opacity 0.2s;
        }
        .login-toggle:hover:not(:disabled) { opacity: 1; }
        .login-toggle:disabled { cursor: default; text-decoration: none; }

        .login-message { margin-top: 18px; font-family: 'Google Sans Code', 'DM Mono', monospace;
                         font-size: 12px; line-height: 1.8; letter-spacing: 0.02em; }
        .login-message.error { color: #E89B9B; }

        /* rises in on arrival — CSS only, no waiting on scripts or fonts */
        .lg-rise { opacity: 0; transform: translateY(22px); animation: pk-rise .9s cubic-bezier(.16,.84,.44,1) both; }

        @media (max-width: 1024px) { .lg-grid { padding-right: 24px; } }
        @media (max-width: 860px) {
          .lg { align-items: flex-start; }
          .lg-grid { grid-template-columns: 1fr; gap: 40px; padding: 104px 20px 72px; }
          .lg-key { position: absolute; top: 6px; right: -6px; width: 104px; margin: 0; }
          .lg-panel { justify-self: start; max-width: none; }
          .lg-form { gap: 22px; }
          /* 16px stops iOS zooming the page when a field is focused */
          .login-input { font-size: 16px; }
          /* …but the placeholder is a line of copy that must be read whole */
          .login-input::placeholder { font-size: 12.5px; letter-spacing: 0; }
          .login-btn { font-size: 30px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-rise { opacity: 1; transform: none; animation: none; }
          .login-btn .lg-go { transition: none; }
        }
      ` }} />
      <CreamInkDefs />

      <NavOverlay variant="public" dark />
      <LoginTicker />

      <div className="lg">
        <div className="pk-wrap lg-grid">
          <div className="lg-words">
            <div className="lg-rise"><div className="pk-eyebrow lg-eyebrow">The Rampant Club</div></div>
            <div className="lg-rise" style={{ animationDelay: '.06s' }}><h1 className="pk-h1 lg-title">Members</h1></div>
            <div className="lg-rise" style={{ animationDelay: '.12s' }}><p className="pk-sub" style={{ margin: '12px 0 0' }}>Thành viên</p></div>
            <div className="lg-key lg-rise" style={{ animationDelay: '.2s' }}>
              <CreamInk name="key" width="100%" rot={-10} dur={9} />
            </div>
          </div>

          <div className="lg-panel lg-rise" style={{ animationDelay: '.16s' }}>
            <form onSubmit={handleLogin} className="lg-form">
              <input
                type="email"
                id="login-email"
                name="email"
                className="login-input"
                placeholder="Email address"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                type="password"
                id="login-password"
                name="password"
                className="login-input"
                placeholder="Password (not your whisky locker code)"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button className="login-btn" type="submit" disabled={loading}>
                <span>{loading ? 'Entering The Lions Den...' : 'Hic Sunt Leones'}</span>
                {!loading && <span className="lg-go" aria-hidden="true">→</span>}
              </button>
            </form>

            <button
              className="login-toggle"
              onClick={handleForgotPassword}
              disabled={forgotLoading || forgotSent}
            >
              {forgotLoading
                ? 'Sending…'
                : forgotSent
                  ? 'Check your email. We\'ve sent a lifeline.'
                  : 'Forgotten password? It happens to the best of us.'}
            </button>

            {error && <div className="login-message error" role="alert">{error}</div>}
          </div>
        </div>
      </div>
    </PublicPage>
  )
}
