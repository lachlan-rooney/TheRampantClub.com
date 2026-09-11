'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'

// A subtle, dismissable "add to home screen" nudge for members. You already ship
// a manifest + service worker (PWARegistrar) but never prompt anyone to install.
// Chrome/Android: captures beforeinstallprompt → one-tap Install. iOS Safari
// (no such event): shows the Share → "Add to Home Screen" hint. Remembered.

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const KEY = 'trc_install_nudge_dismissed'

export default function InstallNudge() {
  const { t } = useLang()
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    try { if (localStorage.getItem(KEY)) return } catch { /* ignore */ }
    // Already installed?
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setShow(true) }
    window.addEventListener('beforeinstallprompt', onBIP)

    // iOS Safari never fires beforeinstallprompt — offer the manual hint instead.
    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
    if (isIOS && isSafari) { setIosHint(true); setShow(true) }

    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
    setShow(false)
  }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    try { await deferred.userChoice } catch { /* ignore */ }
    dismiss()
  }

  if (!show) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes inudge-in { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
        /* A slip of the house's green laid over the page: one hairline, no
           rounded card, cream type you can read, the action an underlined line. */
        .inudge {
          position: fixed; left: 12px; right: 12px; z-index: 8997;
          bottom: calc(80px + env(safe-area-inset-bottom, 0px));
          max-width: 520px; margin: 0 auto;
          display: flex; align-items: center; gap: 16px;
          padding: 14px 16px; border-radius: 4px;
          background: rgba(5, 46, 32, 0.97);
          border: 1px solid rgba(229, 212, 194, 0.22);
          box-shadow: 0 18px 40px rgba(0,0,0,0.45);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          animation: inudge-in 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        @media (min-width: 769px) { .inudge { bottom: 20px; right: 20px; left: auto; } }
        .inudge-txt { flex: 1; font-family: 'Google Sans Code', monospace; font-size: 12.5px; color: #E5D4C2; line-height: 1.7; }
        .inudge-sub { opacity: .8; }
        .inudge-btn { background: none; color: #D4B85A; border: none; border-bottom: 1px solid #D4B85A; border-radius: 0;
                      padding: 0 0 5px; font-family: 'Google Sans Code', monospace; font-size: 11.5px;
                      letter-spacing: .12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .inudge-x { background: transparent; border: none; color: #E5D4C2; opacity: .75; font-size: 20px; cursor: pointer; line-height: 1; padding: 0 2px; }
        .inudge-x:hover { opacity: 1; }
        @media (prefers-reduced-motion: reduce) { .inudge { animation: none; } }
      ` }} />
      <div className="inudge" role="dialog" aria-label={t('Add to home screen', 'Thêm vào màn hình chính')}>
        <div className="inudge-txt">
          {iosHint ? (
            <>{t('Add the Club to your home screen — tap', 'Thêm Câu Lạc Bộ vào màn hình chính — chạm')} <strong>{t('Share', 'Chia sẻ')}</strong>, {t('then', 'rồi chọn')} <strong>{t('“Add to Home Screen.”', '“Thêm vào MH chính”.')}</strong></>
          ) : (
            <>{t('Keep the Club a tap away.', 'Câu Lạc Bộ, chỉ cách một chạm.')}<br /><span className="inudge-sub">{t('Add it to your home screen.', 'Thêm vào màn hình chính của bạn.')}</span></>
          )}
        </div>
        {!iosHint && <button className="inudge-btn" onClick={install}>{t('Install', 'Cài đặt')}</button>}
        <button className="inudge-x" onClick={dismiss} aria-label={t('Dismiss', 'Bỏ qua')}>×</button>
      </div>
    </>
  )
}
