'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// THE DOOR, AS A VISITOR SEES IT. One screen: confirm 18 or over, type the
// password. Both in one submission, because the server requires both and two
// screens for two facts is one screen too many.
//
// Bilingual throughout — the buyer for a Vietnamese company's Tết gifting is
// more likely reading the Vietnamese.

export default function TetGate() {
  const { t } = useLang()
  const [password, setPassword] = useState('')
  const [age, setAge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [invited, setInvited] = useState(false)

  // THE INVITE LINK. /tet?k=the-phrase fills the password in, so a buyer
  // scanning the QR on a leaflet has one thing left to do: confirm their age.
  // That confirmation is never skipped — it is the half of this door that the
  // law cares about, and the database refuses a reservation without it.
  //
  // The key is stripped from the address bar immediately: a password sitting in
  // browser history, or in a screenshot of a phone handed round a meeting room,
  // is a password that has left the leaflet.
  useEffect(() => {
    const url = new URL(window.location.href)
    const k = url.searchParams.get('k')
    if (!k) return
    setPassword(k)
    setInvited(true)
    url.searchParams.delete('k')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/tet/enter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, age_confirmed: age }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.message || t('That did not work.', 'Không thành công.')); return }
      // A full reload, not a router push: the page is server-rendered behind
      // the cookie the server has just set.
      window.location.reload()
    } catch {
      setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.'))
    } finally { setBusy(false) }
  }

  return (
    <main style={wrap}>
      {/* The door asks for a password in two languages, so it has to offer the
          switch as well. A Vietnamese buyer should not have to read English to
          find out how to read Vietnamese. */}
      <div style={{ position: 'fixed', top: 18, right: 18 }}>
        <LangToggle />
      </div>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div style={eyebrow}>The Rampant Club · Duncan Taylor</div>
        <h1 style={title}>Tết Đinh Mùi 2027</h1>
        <p style={lede}>
          {t('A private page for corporate gifting. Please confirm your age and enter the password you were given.',
             'Trang riêng dành cho quà tặng doanh nghiệp. Vui lòng xác nhận độ tuổi và nhập mật khẩu đã được cung cấp.')}
        </p>

        <form onSubmit={submit} style={{ marginTop: 28 }}>
          <label style={check}>
            <input type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} style={{ width: 20, height: 20, accentColor: '#D4B85A' }} />
            <span>{t('I am 18 years of age or over', 'Tôi từ 18 tuổi trở lên')}</span>
          </label>

          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('Password', 'Mật khẩu')}
            autoComplete="off" spellCheck={false}
            style={field} aria-label={t('Password', 'Mật khẩu')}
          />
          {invited && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(229,212,194,.55)', marginTop: 8 }}>
              {t('Password filled in from your invitation.', 'Mật khẩu đã được điền từ lời mời của bạn.')}
            </div>
          )}

          {err && <div style={error}>{err}</div>}

          <button type="submit" disabled={busy || !age || !password.trim()}
                  style={{ ...button, opacity: busy || !age || !password.trim() ? 0.45 : 1 }}>
            {busy ? t('One moment…', 'Chờ một chút…') : t('Enter', 'Vào trang')}
          </button>
        </form>

        <p style={fine}>
          {t('Nothing on this page is an offer for sale. Prices are indicative and any order is completed on invoice.',
             'Nội dung trang này không phải là lời chào bán. Giá chỉ mang tính tham khảo; đơn hàng được hoàn tất bằng hóa đơn.')}
        </p>
      </div>
    </main>
  )
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

const wrap: React.CSSProperties = {
  minHeight: '100dvh', background: '#052E20', color: '#E5D4C2',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
}
const eyebrow: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#D4B85A',
}
const title: React.CSSProperties = {
  fontFamily: SERIF, fontSize: 'clamp(34px, 6vw, 52px)', fontWeight: 500, margin: '14px 0 0', lineHeight: 1.05,
}
const lede: React.CSSProperties = {
  fontFamily: MONO, fontSize: 13, lineHeight: 1.9, color: 'rgba(229,212,194,.72)', marginTop: 16,
}
const check: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 13,
  color: '#E5D4C2', cursor: 'pointer', marginBottom: 16,
}
const field: React.CSSProperties = {
  width: '100%', minHeight: 52, padding: '0 16px', borderRadius: 8, boxSizing: 'border-box',
  background: 'rgba(229,212,194,.07)', border: '1px solid rgba(229,212,194,.22)',
  color: '#E5D4C2', fontFamily: MONO, fontSize: 16, outline: 'none',
}
const button: React.CSSProperties = {
  width: '100%', minHeight: 52, marginTop: 14, borderRadius: 8, cursor: 'pointer',
  background: '#E5D4C2', color: '#052E20', border: 'none',
  fontFamily: MONO, fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase',
}
const error: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 12, lineHeight: 1.7,
}
const fine: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, color: 'rgba(229,212,194,.4)', lineHeight: 1.8, marginTop: 28,
}
