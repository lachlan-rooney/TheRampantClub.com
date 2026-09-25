'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { PublicPage, Rise } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// Forced first-login password change. A freshly-created member login lands here
// (middleware routes must_change_password accounts here) and cannot reach member
// pages until they set their own password. The server route clears the flag;
// we then refresh the session so the new JWT no longer carries must_change
// (otherwise the middleware would loop on the stale token).
//
// IT IS BILINGUAL NOW (owner, 2026-09-25). This is the first page a brand-new
// member is made to use, before they can reach anything else, and it was in
// English only — including the one line that tells you why the form would not
// submit. A Vietnamese member typing a six-character password saw an English
// sentence and no way to change the language. The rule is also stated UNDER
// the box now, before it is broken, rather than only as an error afterwards.

export default function SetPasswordPage() {
  const { t } = useLang()
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
    if (password.length < 8) { setError(t('Password must be at least 8 characters.', 'Mật khẩu phải có ít nhất 8 ký tự.')); return }
    if (password !== confirm) { setError(t('The two passwords do not match.', 'Hai mật khẩu không khớp nhau.')); return }
    setLoading(true)
    try {
      const r = await fetch('/api/members/set-initial-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Could not set your password.', 'Không đặt được mật khẩu.'))
      // Refresh so the new JWT drops must_change_password, then hard-nav so the
      // middleware re-reads the refreshed cookie.
      const supabase = createBrowserSupabaseClient()
      await supabase.auth.refreshSession()
      window.location.href = '/members'
    } catch (e) {
      setError((e as Error).message); setLoading(false)
    }
  }, [password, confirm, t])

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
        .sp-rule { font-family: ${MONO}; font-size: 11.5px; line-height: 1.7; color: rgba(229,212,194,.5);
                   margin: 6px 0 14px; }
        .sp-rule-short { color: #D4B85A; }
        .sp-lang { display: flex; justify-content: flex-end; padding-top: 18px; }

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
        <div className="sp-lang"><LangToggle /></div>
        <div className="sp-words">
          <Rise><div className="pk-eyebrow sp-eyebrow">The Rampant Club</div></Rise>
          <Rise delay={.06}><h1 className="pk-h1">{t('Set your password', 'Đặt mật khẩu')}</h1></Rise>
          <Rise delay={.2} className="sp-art"><CreamInk name="gent-toast" width="100%" rot={-4} dur={8} /></Rise>
        </div>

        <Rise delay={.14} className="sp-panel">
          {hasSession === false ? (
            <p className="sp-hint">
              {t('Your session has expired. ', 'Phiên đăng nhập đã hết hạn. ')}
              <a href="/login">{t('Sign in', 'Đăng nhập')}</a>
              {t(' with the temporary password you were given, then set a new one here.',
                 ' bằng mật khẩu tạm thời đã được cấp, rồi đặt mật khẩu mới tại đây.')}
            </p>
          ) : (
            <>
              <p className="sp-hint">
                {t('Welcome. Choose a password to finish setting up your account — you’ll use this from now on.',
                   'Chào mừng quý vị. Hãy chọn một mật khẩu để hoàn tất thiết lập tài khoản — quý vị sẽ dùng mật khẩu này từ nay về sau.')}
              </p>
              {error && <div className="sp-error" role="alert">{error}</div>}
              <form onSubmit={submit}>
                <label className="sp-label" htmlFor="sp-password">{t('New password', 'Mật khẩu mới')}</label>
                <input id="sp-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="sp-input" />
                {/* THE RULE, BEFORE IT IS BROKEN. It used to appear only as an
                    error, in English, after the form refused to submit. */}
                <p className="sp-rule">
                  {t('Eight characters or more.', 'Từ 8 ký tự trở lên.')}
                  {password.length > 0 && password.length < 8 &&
                    <span className="sp-rule-short"> · {t(`${8 - password.length} more to go`, `còn thiếu ${8 - password.length} ký tự`)}</span>}
                </p>
                <label className="sp-label" htmlFor="sp-confirm">{t('Confirm password', 'Nhập lại mật khẩu')}</label>
                <input id="sp-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className="sp-input" />
                {confirm.length > 0 && password !== confirm &&
                  <p className="sp-rule sp-rule-short">{t('The two do not match yet.', 'Hai mật khẩu chưa khớp nhau.')}</p>}
                <button type="submit" disabled={loading} className="sp-btn" style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? t('Saving…', 'Đang lưu…') : <>{t('Set password & continue', 'Đặt mật khẩu & tiếp tục')} <span className="pk-go" aria-hidden="true">→</span></>}
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
