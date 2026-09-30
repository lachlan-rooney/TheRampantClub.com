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
//
// ── IT IS THE FIRST THING A BUYER SEES ────────────────────────────────────
// Owner, 2026-09-30: "This page neeeds to be more exciting", then "Maybe the
// two logos side by side as opposed to the two words..."
//
// It was a form on a flat green field: a centred box, two lines of grey type
// and a cream button. Everything behind it — twenty single casks, the labels,
// the boxes — was hidden behind a door that looked like a login.
//
// So: the two CRESTS, side by side over a hairline, because a joint programme
// is announced by two marks and not by two words in 11px mono. The club's
// whisky lit by a fire, full-bleed and bleeding off the right, which is the
// only thing on this page that says what is behind it. And the title set as
// large as the page will take.
//
// WHAT DID NOT CHANGE: the age confirmation, the password, and the line about
// this not being an offer for sale. Those are the door, and the door is the
// point — the rest is only the reason to knock.

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

  const ready = !busy && age && !!password.trim()

  return (
    <main className="tg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* THE WHISKY, LIT. One photograph, full height, bleeding off the right
          on a desk and sitting behind everything on a phone. The gradient over
          it is what stops it being a picture with words on top: the green eats
          its edge, so the page has one surface, not two. */}
      <div className="tg-art" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/tet/octave-fire.webp" alt="" />
        <span className="tg-fade" />
        <span className="tg-glow" />
      </div>

      {/* The door asks for a password in two languages, so it has to offer the
          switch as well. A Vietnamese buyer should not have to read English to
          find out how to read Vietnamese. */}
      <div className="tg-lang"><LangToggle /></div>

      <div className="tg-col">
        {/* TWO CRESTS, NOT TWO WORDS (owner, 2026-09-30). The club's lion and
            Duncan Taylor's crest, set to the same optical height either side of
            a hairline — the way a joint bottling is signed. */}
        <div className="tg-marks">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tg-mark tg-mark-trc" src="/images/logo-mark-cream.svg" alt="The Rampant Club" />
          <span className="tg-rule" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tg-mark tg-mark-dt" src="/images/tet/dt-crest.png" alt="Duncan Taylor Scotch Whisky" />
        </div>

        <div className="tg-eyebrow">{t('Corporate gifting', 'Quà tặng doanh nghiệp')}</div>
        <h1 className="tg-title">Tết Đinh Mùi<span>2027</span></h1>
        <p className="tg-lede">
          {t('Twenty single casks from Duncan Taylor, bottled and dressed for the year of the goat — your company’s name on the label.',
             'Hai mươi thùng rượu đơn từ Duncan Taylor, đóng chai và khoác áo cho năm Đinh Mùi — tên công ty quý vị trên nhãn.')}
        </p>

        <form onSubmit={submit} className="tg-form">
          <div className="tg-door">{t('Please confirm your age and enter the password you were given.',
                                      'Vui lòng xác nhận độ tuổi và nhập mật khẩu đã được cung cấp.')}</div>

          <label className="tg-check">
            <input type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} />
            <span>{t('I am 18 years of age or over', 'Tôi từ 18 tuổi trở lên')}</span>
          </label>

          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('Password', 'Mật khẩu')}
            autoComplete="off" spellCheck={false}
            className="tg-field" aria-label={t('Password', 'Mật khẩu')}
          />
          {invited && (
            <div className="tg-note">{t('Password filled in from your invitation.', 'Mật khẩu đã được điền từ lời mời của bạn.')}</div>
          )}

          {err && <div className="tg-err">{err}</div>}

          <button type="submit" disabled={!ready} className="tg-btn" style={{ opacity: ready ? 1 : 0.42 }}>
            {busy ? t('One moment…', 'Chờ một chút…') : <>{t('Enter', 'Vào trang')} <span className="tg-go" aria-hidden="true">→</span></>}
          </button>
        </form>

        <p className="tg-fine">
          {t('Nothing on this page is an offer for sale. Prices are indicative and any order is completed on invoice.',
             'Nội dung trang này không phải là lời chào bán. Giá chỉ mang tính tham khảo; đơn hàng được hoàn tất bằng hóa đơn.')}
        </p>
      </div>
    </main>
  )
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const GREEN = '#052E20'

const CSS = `
.tg { position: relative; min-height: 100dvh; background: ${GREEN}; color: ${CREAM};
      display: flex; align-items: center; overflow: hidden;
      padding: clamp(28px, 6vh, 72px) clamp(22px, 7vw, 96px); }

/* ── the photograph ───────────────────────────────────────────────────── */
.tg-art { position: absolute; inset: 0 0 0 42%; z-index: 0; }
.tg-art img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; display: block;
              /* The scrim over it is green, and green on amber goes to mud.
                 A little saturation back keeps the whisky the colour it is. */
              filter: saturate(1.12) contrast(1.04); }
/* Green over the left edge of the picture, so the two surfaces are one. */
.tg-fade { position: absolute; inset: 0;
           background: linear-gradient(90deg, ${GREEN} 0%, ${GREEN} 6%, rgba(5,46,32,.80) 19%, rgba(5,46,32,.34) 38%, rgba(5,46,32,.06) 62%, rgba(5,46,32,0) 78%); }
/* The fire moves. Barely — a room with a fire in it is never quite still, and
   a still photograph of one reads as a poster. */
.tg-glow { position: absolute; inset: 0; pointer-events: none;
           background: radial-gradient(52% 44% at 28% 56%, rgba(212,150,60,.30), rgba(212,150,60,0) 70%);
           animation: tg-flicker 7.5s ease-in-out infinite; }
@keyframes tg-flicker {
  0%, 100% { opacity: .55; transform: scale(1); }
  38%      { opacity: .95; transform: scale(1.04); }
  61%      { opacity: .68; transform: scale(.99); }
}

.tg-lang { position: fixed; top: 18px; right: 18px; z-index: 3; }

.tg-col { position: relative; z-index: 2; width: min(520px, 100%); }

/* ── the two crests ───────────────────────────────────────────────────── */
.tg-marks { display: flex; align-items: center; gap: clamp(16px, 3vw, 26px); }
.tg-mark { display: block; width: auto; }
.tg-mark-trc { height: clamp(58px, 8vh, 84px); }
/* The DT crest is round and the lion is tall, so they are matched by EYE and
   not by number: the same height would leave the round one looking larger. */
.tg-mark-dt  { height: clamp(48px, 6.6vh, 68px); }
.tg-rule { width: 1px; align-self: stretch; margin: 6px 0;
           background: linear-gradient(180deg, rgba(229,212,194,0), rgba(229,212,194,.45), rgba(229,212,194,0)); }

.tg-eyebrow { font-family: ${MONO}; font-size: 11px; letter-spacing: .22em; text-transform: uppercase;
              color: ${GOLD}; margin-top: clamp(22px, 4vh, 40px); }
.tg-title { font-family: ${SERIF}; font-weight: 500; line-height: .94; margin: 12px 0 0;
            font-size: clamp(44px, 8.4vw, 92px); letter-spacing: -.01em; }
/* The year drops to its own line and takes the gold: a date is a fact, and the
   festival is the name. */
.tg-title span { display: block; color: ${GOLD}; font-size: .62em; letter-spacing: .04em; margin-top: .08em; }
.tg-lede { font-family: ${MONO}; font-size: 13.5px; line-height: 1.95; color: rgba(229,212,194,.80);
           margin: 22px 0 0; max-width: 46ch; }

/* ── the door ─────────────────────────────────────────────────────────── */
.tg-form { margin-top: clamp(26px, 5vh, 44px); padding-top: clamp(22px, 4vh, 34px);
           border-top: 1px solid rgba(229,212,194,.16); }
.tg-door { font-family: ${MONO}; font-size: 12px; line-height: 1.8; color: rgba(229,212,194,.6); margin-bottom: 18px; }
.tg-check { display: flex; align-items: center; gap: 12px; font-family: ${MONO}; font-size: 13.5px;
            color: ${CREAM}; cursor: pointer; margin-bottom: 16px; user-select: none; }
.tg-check input { width: 22px; height: 22px; accent-color: ${GOLD}; cursor: pointer; flex: none; }
.tg-field { width: 100%; min-height: 54px; padding: 0 16px; border-radius: 8px; box-sizing: border-box;
            background: rgba(229,212,194,.07); border: 1px solid rgba(229,212,194,.22);
            color: ${CREAM}; font-family: ${MONO}; font-size: 16px; outline: none;
            transition: border-color .25s ease, background .25s ease; }
.tg-field:focus { border-color: rgba(212,184,90,.7); background: rgba(229,212,194,.10); }
.tg-note { font-family: ${MONO}; font-size: 11px; color: rgba(229,212,194,.55); margin-top: 8px; }
.tg-err  { font-family: ${MONO}; font-size: 12px; color: #C27070; margin-top: 12px; line-height: 1.7; }
.tg-btn { width: 100%; min-height: 54px; margin-top: 14px; border-radius: 8px; cursor: pointer;
          background: ${GOLD}; color: ${GREEN}; border: none;
          font-family: ${MONO}; font-size: 13px; letter-spacing: .12em; text-transform: uppercase;
          transition: transform .2s ease, box-shadow .3s ease; }
.tg-btn:not(:disabled):hover { box-shadow: 0 10px 30px rgba(212,184,90,.22); }
.tg-btn:disabled { cursor: not-allowed; }
.tg-go { display: inline-block; margin-left: 6px; transition: transform .3s ease; }
.tg-btn:not(:disabled):hover .tg-go { transform: translateX(6px); }
.tg-fine { font-family: ${MONO}; font-size: 10.5px; color: rgba(229,212,194,.42); line-height: 1.8; margin-top: 26px; max-width: 52ch; }

/* ── a phone: the picture is a BAND, not a backdrop ───────────────────── */
/* Behind the whole page it fought the words: the label sat under the age
   confirmation and both lost. A band across the top is the same picture doing
   the same job — say what is behind the door — without anything reading
   through it. */
@media (max-width: 860px) {
  .tg { display: block; align-items: stretch; padding: 0 0 clamp(34px, 7vh, 60px); }
  .tg-art { position: relative; inset: auto; width: 100%; height: 40vh; min-height: 260px; }
  .tg-art img { object-position: 56% 38%; }
  .tg-fade { background: linear-gradient(180deg, rgba(5,46,32,.34) 0%, rgba(5,46,32,.10) 30%, rgba(5,46,32,.72) 74%, ${GREEN} 100%); }
  .tg-glow { background: radial-gradient(62% 44% at 44% 58%, rgba(212,150,60,.34), rgba(212,150,60,0) 72%); }
  .tg-col { width: 100%; padding: 0 clamp(22px, 6vw, 34px); margin-top: -7vh; }
  .tg-marks { gap: 18px; }
  .tg-eyebrow { margin-top: 24px; }
  .tg-lede { font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .tg-glow { animation: none; opacity: .7; }
  .tg-btn, .tg-go, .tg-field { transition: none; }
}
`
