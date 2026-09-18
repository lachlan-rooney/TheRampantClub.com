'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

// THE WAY BACK, ON EVERY SCREEN (2026-09-16 — the owner: "all areas of the kiosk
// need a back button… direction, home, maybe the bar along the bottom like the
// mobile"). A bolted-down tablet has no address bar and no browser back, so each
// screen used to need its own exit and some had none at all — the staff picker
// stranded anyone who tapped "Staff" by mistake.
//
// Modelled on the members' phone bar (components/members/BottomTabBar): house
// green, one cream hairline, the active tab marked with a gold rule. Bigger hit
// targets — this is a wall-mounted tablet, tapped by people standing up.
//
// WHERE IT DOES NOT GO, deliberately:
//   · /kiosk/door  — a door device cannot open the board (middleware sends it
//                    back), and the door flow carries its own step-by-step Back.
//   · /kiosk/pair  — an unpaired tablet has nowhere to go back TO.
//   · /kiosk/[floor] — the old Phase 1 display pages, which nothing links to.
//
// HOME ENDS THE SESSION. Tapping Home while a member is signed in signs them out
// first: otherwise the next person to pick up the tablet inherits their session.
// Both logouts are fired every time — each is a no-op when there is no session.

const SHOW_ON = ['/kiosk/board', '/kiosk/finder', '/kiosk/member', '/kiosk/staff', '/kiosk/menu']

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const ICONS: Record<string, ReactNode> = {
  home: <svg width="26" height="26" viewBox="0 0 24 24" {...S}><path d="M3 11 12 4l9 7" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg>,
  compass: <svg width="26" height="26" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="8.5" /><path d="m15.2 8.8-2 4.4-4.4 2 2-4.4z" /></svg>,
  menu: <svg width="26" height="26" viewBox="0 0 24 24" {...S}><path d="M5 4.5h14v15H5z" /><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" /></svg>,
  staff: <svg width="26" height="26" viewBox="0 0 24 24" {...S}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" /></svg>,
}

export default function KioskBar() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const on = SHOW_ON.some(h => pathname === h || pathname.startsWith(h + '/'))

  // The Menu tab used to appear only in rooms that had a PDF, and opened it in
  // a new browser tab — which on a tablet standing in the Library meant a PDF
  // viewer the next member had to find their way out of. Every room now gets
  // the same tab, it stays inside the kiosk shell, and /kiosk/menu still offers
  // the room's own printed menu underneath when there is one.

  if (!on) return null

  const home = async () => {
    // Order matters: end the sessions, THEN navigate, so the next screen cannot
    // render anything belonging to whoever was just here.
    await Promise.allSettled([
      fetch('/api/kiosk/member/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'done' }) }),
      fetch('/api/kiosk/staff/logout', { method: 'POST' }),
    ])
    router.replace('/kiosk/board')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Pages size themselves against this, so the bar never covers a control:
           height: calc(100dvh - var(--kiosk-bar)). Declared on :root so a page
           can read it even before the bar has rendered. */
        :root { --kiosk-bar: calc(78px + env(safe-area-inset-bottom, 0px)); }
        .kbar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 8998;
          background: rgba(5, 46, 32, 0.96);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid rgba(229, 212, 194, 0.16);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .kbar-inner { display: flex; }
        .kbar-tab {
          flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 13px 2px 12px; text-decoration: none; position: relative;
          background: none; border: none; cursor: pointer;
          color: rgba(229, 212, 194, 0.72); transition: color .2s ease, transform .1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .kbar-tab::before {
          content: ''; position: absolute; top: -1px; left: 26%; right: 26%; height: 2px; background: #D4B85A;
          transform: scaleX(0); transition: transform .35s cubic-bezier(.16,.84,.44,1);
        }
        .kbar-tab:active { transform: scale(.94); }
        .kbar-tab.is-active { color: #D4B85A; }
        .kbar-tab.is-active::before { transform: scaleX(1); }
        .kbar-icon { display: flex; align-items: center; justify-content: center; height: 26px; }
        .kbar-label {
          font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 11px;
          letter-spacing: .08em; text-transform: uppercase; line-height: 1.25; text-align: center;
        }
        .kbar-vn { display: block; font-size: 9px; letter-spacing: .04em; text-transform: none; opacity: .5; }
        @media (prefers-reduced-motion: reduce) { .kbar-tab, .kbar-tab::before { transition: none; } }
      ` }} />
      <nav className="kbar" aria-label="Kiosk navigation">
        <div className="kbar-inner">
          <button onClick={home} className={`kbar-tab ${isActive('/kiosk/board') ? 'is-active' : ''}`}>
            <span className="kbar-icon" aria-hidden>{ICONS.home}</span>
            <span className="kbar-label">Home<span className="kbar-vn">Trang chính</span></span>
          </button>

          <button onClick={() => router.push('/kiosk/finder')} className={`kbar-tab ${isActive('/kiosk/finder') ? 'is-active' : ''}`}>
            <span className="kbar-icon" aria-hidden>{ICONS.compass}</span>
            <span className="kbar-label">Flavour Finder<span className="kbar-vn">Tìm hương vị</span></span>
          </button>

          <button onClick={() => router.push('/kiosk/menu')} className={`kbar-tab ${isActive('/kiosk/menu') ? 'is-active' : ''}`}>
            <span className="kbar-icon" aria-hidden>{ICONS.menu}</span>
            <span className="kbar-label">Menu<span className="kbar-vn">Thực đơn</span></span>
          </button>

          <button onClick={() => router.push('/kiosk/staff')} className={`kbar-tab ${isActive('/kiosk/staff') ? 'is-active' : ''}`}>
            <span className="kbar-icon" aria-hidden>{ICONS.staff}</span>
            <span className="kbar-label">Staff<span className="kbar-vn">Nhân viên</span></span>
          </button>
        </div>
      </nav>
    </>
  )
}
