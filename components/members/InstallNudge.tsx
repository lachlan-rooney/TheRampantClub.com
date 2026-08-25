'use client'

import { useEffect, useState } from 'react'

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
        .inudge {
          position: fixed; left: 12px; right: 12px; z-index: 8997;
          bottom: calc(68px + env(safe-area-inset-bottom, 0px));
          max-width: 520px; margin: 0 auto;
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 12px;
          background: rgba(10, 53, 38, 0.96);
          border: 1px solid rgba(212, 184, 90, 0.32);
          box-shadow: 0 14px 34px rgba(0,0,0,0.4);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          animation: inudge-in 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        @media (min-width: 769px) { .inudge { bottom: 20px; right: 20px; left: auto; } }
        .inudge-txt { flex: 1; font-family: 'Google Sans Code', monospace; font-size: 11px; color: #E5D4C2; line-height: 1.5; }
        .inudge-sub { color: #B2AA98; }
        .inudge-btn { background: #D4B85A; color: #052E20; border: none; border-radius: 18px; padding: 8px 16px; font-family: 'Google Sans Code', monospace; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .inudge-x { background: transparent; border: none; color: #B2AA98; font-size: 18px; cursor: pointer; line-height: 1; padding: 0 2px; }
      ` }} />
      <div className="inudge" role="dialog" aria-label="Add to home screen">
        <div className="inudge-txt">
          {iosHint ? (
            <>Add the Club to your home screen — tap <strong>Share</strong>, then <strong>“Add to Home Screen.”</strong></>
          ) : (
            <>Keep the Club a tap away.<br /><span className="inudge-sub">Add it to your home screen.</span></>
          )}
        </div>
        {!iosHint && <button className="inudge-btn" onClick={install}>Install</button>}
        <button className="inudge-x" onClick={dismiss} aria-label="Dismiss">×</button>
      </div>
    </>
  )
}
