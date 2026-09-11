'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// CLUB ETHOS — a letter from the Chairman, delivered rather than popped up.
// ───────────────────────────────────────────────────────────────────────────
// It was a dark box that blinked into the middle of a blurred page. Now the
// room dims to bottle green, and a sheet of cream paper rises into it, tilting
// up into place; the words arrive a line at a time, the first letter set as a
// drop cap, and the signature writes itself in at the foot. It leaves the same
// way it came — nothing snaps.
//
// Esc, the close button, or a click outside the sheet all close it. It opens
// in the site's current language; the tabs switch it in place.

const INK   = '#052E20'
const PAPER = '#F3E9DA'
const MONO  = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

const TEXT = {
  en: {
    title: 'Club Ethos', sign: 'Chairman', close: 'Close',
    body: [
      'The Rampant Club exists to give serious whisky lovers freedoms rarely granted elsewhere. Hundreds of open bottles sit within a private space where members pour for themselves and stay as long as they like. There are no menus, no measures, and no permission required.',
      'That same philosophy extends beyond the glass. The Club is an exciting base for shared pursuits… sporting traditions, off-site excursions, private dinners, and events that reach well beyond the clubhouse.',
      'A discreet cocktail bar and experimental culinary lab sit alongside an immersive art studio and whisky library, giving members the freedom to test ideas, explore technique, and develop personalised flavours without constraint.',
      'This level of freedom only works because the Club is built on trust. Bottles are shared, not monitored. Spaces are respected, privacy is absolute. Membership is by invitation, renewal is not guaranteed, and belonging is demonstrated through conduct rather than status.',
      'This is not hospitality for everyone. Rather, it is a club for those who understand why this kind of access is rare.',
    ],
  },
  vn: {
    title: 'Tinh thần câu lạc bộ', sign: 'Chủ tịch', close: 'Đóng',
    body: [
      'Câu lạc bộ The Rampant ra đời để mang đến cho người yêu thích whisky thực thụ những quyền tự do hiếm khi có được ở những nơi khác. Hàng trăm chai whisky đã mở nắp được đặt trong một không gian riêng tư, nơi các thành viên được quyền tự rót và ở lại thưởng thức bao lâu tùy thích. Không có thực đơn, không cần đong đếm và không cần xin phép.',
      'Triết lý đó không chỉ giới hạn trong phạm vi câu lạc bộ. The Rampant Club là một địa điểm tuyệt vời cho các hoạt động chung... các truyền thống thể thao, các chuyến du ngoạn ngoại khóa, các bữa tối riêng tư và các sự kiện vượt xa khuôn khổ của một câu lạc bộ.',
      'Một quầy bar cocktail riêng tư và phòng nghiên cứu ẩm thực nằm cạnh một không gian nghệ thuật độc đáo cùng thư viện rượu whisky, mang đến cho các thành viên sự tự do để thử nghiệm ý tưởng, khám phá kỹ thuật và phát triển hương vị cá nhân mà không bị ràng buộc.',
      'Sự tự do này ở câu lạc bộ được xây dựng dựa trên niềm tin. Rượu được chia sẻ, không bị kiểm soát. Không gian được tôn trọng, quyền riêng tư tuyệt đối. Việc gia nhập chỉ dành cho những người được mời, chính sách gia hạn và tư cách thành viên được thể hiện qua hành vi, không phải địa vị.',
      'Điều này không dành cho tất cả mọi người. Thay vào đó, đây là một câu lạc bộ chỉ dành cho những ai hiểu tại sao sự tiếp cận kiểu này lại hiếm có.',
    ],
  },
}

export default function EthosLetter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang: siteLang } = useLang()
  const [lang, setLang] = useState<'en' | 'vn'>('en')
  // mounted → rendered at all; shown → the "in" state the transitions run to.
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setLang(siteLang)
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 560)
    return () => clearTimeout(t)
  }, [open, siteLang])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [mounted, onClose])

  if (!mounted) return null
  const t = TEXT[lang]

  return (
    <div className={`el ${shown ? 'is-in' : ''}`} onClick={onClose} role="dialog" aria-modal="true" aria-label={t.title}>
      <style dangerouslySetInnerHTML={{ __html: `
        .el { position: fixed; inset: 0; z-index: 99999; overflow-y: auto; overscroll-behavior: contain;
              background: rgba(5, 46, 32, 0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px);
              transition: background .55s ease, backdrop-filter .55s ease, -webkit-backdrop-filter .55s ease;
              perspective: 1400px; padding: 7vh 16px 9vh; }
        .el.is-in { background: rgba(5, 46, 32, .82); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }

        .el-sheet { position: relative; max-width: 720px; margin: 0 auto; background: ${PAPER}; color: ${INK};
                    padding: clamp(34px, 6vw, 64px) clamp(24px, 6vw, 68px) clamp(34px, 5vw, 56px);
                    border-radius: 4px;
                    box-shadow: 0 40px 90px rgba(0,0,0,.45), 0 10px 24px rgba(0,0,0,.25);
                    transform-origin: 50% 100%;
                    transform: translateY(70px) rotateX(14deg) scale(.96); opacity: 0;
                    transition: transform .8s cubic-bezier(.16,.84,.44,1), opacity .5s ease; }
        .el.is-in .el-sheet { transform: none; opacity: 1; transition-delay: .08s; }
        /* a faint deckle of paper, and a hairline inset like a letterhead */
        .el-sheet::before { content: ''; position: absolute; inset: 12px; border: 1px solid rgba(5,46,32,.12);
                            border-radius: 2px; pointer-events: none; }

        .el-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .el-tabs { display: flex; gap: 18px; }
        .el-tab { position: relative; background: none; border: none; padding: 0 0 6px; cursor: pointer; color: ${INK};
                  font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; opacity: .45; transition: opacity .3s; }
        .el-tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.5px; background: ${INK};
                         transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.16,.84,.44,1); }
        .el-tab.is-on { opacity: 1; } .el-tab.is-on::after { transform: scaleX(1); }
        .el-close { background: none; border: none; cursor: pointer; color: ${INK}; padding: 4px 0;
                    font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
        .el-close span { display: inline-block; margin-left: 8px; transition: transform .35s ease; }
        .el-close:hover span { transform: rotate(90deg); }

        .el-seal { position: absolute; top: clamp(26px, 5vw, 44px); right: 50%; transform: translateX(50%);
                   width: 38px; opacity: .85; }
        .el-title { font-family: ${SERIF}; font-weight: 400; font-size: clamp(40px, 7vw, 72px); line-height: .95;
                    margin: clamp(34px, 5vw, 48px) 0 0; }
        .el-line { opacity: 0; transform: translateY(14px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,.84,.44,1); }
        .el.is-in .el-line { opacity: 1; transform: none; }
        .el-body { margin-top: 28px; }
        .el-body p { font-family: ${MONO}; font-size: 13.5px; line-height: 2; margin: 0 0 18px; }
        .el-body p:first-child::first-letter { font-family: ${SERIF}; float: left; font-size: 64px; line-height: .82;
                                               margin: 7px 5px 0 0; }
        .el-foot { display: flex; justify-content: flex-end; align-items: flex-end; gap: 14px; margin-top: 30px; }
        .el-role { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; opacity: .6;
                   padding-bottom: 14px; }
        /* the signature writes itself in, left to right */
        .el-sig { height: 84px; width: auto; clip-path: inset(0 100% 0 0); filter: brightness(0); opacity: .82;
                  transition: clip-path 1.6s cubic-bezier(.45,.05,.3,1) 1.1s; }
        .el.is-in .el-sig { clip-path: inset(0 0 0 0); }

        @media (prefers-reduced-motion: reduce) {
          .el, .el-sheet, .el-line, .el-sig { transition: none !important; }
          .el-sheet { transform: none; }
        }
      ` }} />

      <div className="el-sheet" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-mark.svg" alt="" aria-hidden="true" className="el-seal" />
        <div className="el-top">
          <div className="el-tabs" role="tablist" aria-label="Language">
            {(['en', 'vn'] as const).map(l => (
              <button key={l} type="button" role="tab" aria-selected={lang === l}
                      className={`el-tab ${lang === l ? 'is-on' : ''}`} onClick={() => setLang(l)}>
                {l === 'en' ? 'EN' : 'VN'}
              </button>
            ))}
          </div>
          <button type="button" className="el-close" onClick={onClose}>{t.close}<span>×</span></button>
        </div>

        <h2 className="el-title el-line" style={{ transitionDelay: '.25s' }}>{t.title}</h2>
        <div className="el-body" key={lang}>
          {t.body.map((p, i) => (
            <p key={i} className="el-line" style={{ transitionDelay: `${0.35 + i * 0.09}s` }}>{p}</p>
          ))}
        </div>
        <div className="el-foot el-line" style={{ transitionDelay: '.85s' }}>
          <div className="el-role">{t.sign}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/signature%20(1)%20(1).png" alt={`${t.sign} — signature`} className="el-sig" />
        </div>
      </div>
    </div>
  )
}
