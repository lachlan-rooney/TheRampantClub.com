'use client'

import { surfaceName } from '@/lib/members/surfaces'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useLang } from '@/lib/lang'
import { InkFloat } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// Member nav — grouped by what a member actually comes here to do, each link with
// a consistent line icon (same visual language as the admin sidebar). Order is
// intentional: whisky (the heart of the club) → what's on → the physical club →
// people → your account → the fine print.
// Labels come from lib/members/surfaces.ts — this file decides ORDER and GROUPING,
// never what a thing is called.
const L = (href: string) => ({ href, en: surfaceName(href, 'en'), vn: surfaceName(href, 'vn') })

const MEMBER_GROUPS: { label: string; vn: string; links: { href: string; en: string; vn: string; icon: string }[] }[] = [
  { label: 'What’s On', vn: 'Sự Kiện', links: [
    { ...L('/members/events'), icon: 'calendar' },
    { ...L('/members/gallery'), icon: 'image' },
    { ...L('/members/notices'), icon: 'pin' },
  ] },
  { label: 'The Club', vn: 'Câu Lạc Bộ', links: [
    { ...L('/members/spaces'), icon: 'building' },
    { ...L('/menus'), icon: 'menu' },
    { ...L('/members/snug'), icon: 'sofa' },
    { ...L('/members/concierge'), icon: 'bell' },
  ] },
  { label: 'Whisky', vn: 'Whisky', links: [
    { ...L('/members/whisky'), icon: 'glass' },
    { ...L('/members/whisky/finder'), icon: 'compass' },
    { ...L('/members/taste'), icon: 'radar' },
    { ...L('/members/notes'), icon: 'quill' },
    { ...L('/members/journey'), icon: 'flag' },
  ] },
  { label: 'Community', vn: 'Cộng Đồng', links: [
    { ...L('/members/members'), icon: 'people' },
    { ...L('/members/introductions'), icon: 'introduce' },
    { ...L('/members/messages'), icon: 'chat' },
  ] },
  { label: 'You', vn: 'Bạn', links: [
    { ...L('/members/profile'), icon: 'card' },
    { ...L('/members/calendar'), icon: 'calendar' },
    { ...L('/members/visits'), icon: 'clock' },
  ] },
  { label: 'Info', vn: 'Thông Tin', links: [
    { ...L('/members/rules'), icon: 'book' },
    { ...L('/members/terms'), icon: 'document' },
    { ...L('/members/contact'), icon: 'mail' },
  ] },
]

// One monochrome line-icon set (viewBox 0 0 16 16, currentColor strokes) shared
// by every member-nav link — no emoji, harmonious with the admin sidebar.
const NAV_ICONS: Record<string, string> = {
  home:      '<path d="M3 7.5L8 3.5l5 4"/><path d="M4.2 6.8V13h7.6V6.8"/><path d="M6.8 13V9.5h2.4V13"/>',
  glass:     '<path d="M5 3h6l-.55 9.4a1 1 0 01-1 .95H6.55a1 1 0 01-1-.95z"/><path d="M5.25 7.2h5.5"/>',
  compass:   '<circle cx="8" cy="8" r="5.6"/><path d="M10.3 5.7L8.7 8.7 5.7 10.3 7.3 7.3z"/>',
  radar:     '<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.7"/>',
  quill:     '<path d="M13 3C8 3.5 5.5 6 4 10l2 2c4-1.5 6.5-4 7-9z"/><path d="M4 10l-1.4 3.4M6.2 8.4h2.2"/>',
  flag:      '<path d="M4 13.5V2.6"/><path d="M4 3.2h6.5l-1.4 2.1 1.4 2.1H4"/>',
  calendar:  '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.2h12M5.5 2v2M10.5 2v2"/>',
  trophy:    '<path d="M5 3h6v2.6a3 3 0 01-6 0z"/><path d="M5 3.8H3.4a1.6 1.6 0 001.8 2.4M11 3.8h1.6a1.6 1.6 0 01-1.8 2.4"/><path d="M8 8.4v2.1M6 13.2h4M6.4 13.2c0-1.1.7-2 1.6-2s1.6.9 1.6 2"/>',
  image:     '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.1"/><path d="M2.5 11.5l3.2-3 2.3 2 2.2-2.4 3.3 3.4"/>',
  pin:       '<path d="M8 14s4.4-3.9 4.4-7.4a4.4 4.4 0 10-8.8 0C3.6 10.1 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
  building:  '<rect x="3.5" y="2.5" width="9" height="11" rx="1"/><path d="M3.5 6h9M3.5 9.5h9M6.6 13.5V11h2.8v2.5"/>',
  menu:      '<path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6"/>',
  sofa:      '<path d="M4 8V6.6A1.6 1.6 0 015.6 5h4.8A1.6 1.6 0 0112 6.6V8"/><path d="M2.8 8.4A1.4 1.4 0 014.2 9.8V11h7.6V9.8a1.4 1.4 0 011.4-1.4V10a1.5 1.5 0 01-1.5 1.5v.9M4 11.5v.9"/>',
  bell:      '<path d="M4.2 7a3.8 3.8 0 017.6 0c0 2.8 1 3.7 1 3.7H3.2s1-.9 1-3.7z"/><path d="M6.6 12.6a1.5 1.5 0 002.8 0"/>',
  people:    '<circle cx="6" cy="6" r="2.1"/><path d="M2.6 13a3.4 3.4 0 016.8 0"/><path d="M11 4.4a2 2 0 010 3.9M11.6 13a3.3 3.3 0 00-1.1-2.4"/>',
  introduce: '<circle cx="6.2" cy="6" r="2.1"/><path d="M2.8 13a3.4 3.4 0 016.8 0"/><path d="M11.5 5.5v4M9.5 7.5h4"/>',
  chat:      '<path d="M3 4h10a1 1 0 011 1v5a1 1 0 01-1 1H6l-3 2.5V5a1 1 0 011-1z"/>',
  card:      '<rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M2 6.8h12M4.3 9.6h3"/>',
  clock:     '<circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2.1 1.3"/>',
  book:      '<path d="M8 4C6.5 3 4 3 2.5 3.7v8.6C4 11.6 6.5 11.6 8 12.6c1.5-1 4-1 5.5-.3V3.7C12 3 9.5 3 8 4z"/><path d="M8 4v8.6"/>',
  document:  '<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/><path d="M6 8.2h4M6 10.6h4"/>',
  mail:      '<rect x="2.5" y="4" width="11" height="8" rx="1.5"/><path d="M3 5l5 4 5-4"/>',
  signout:   '<path d="M6 3.5H3.5v9H6"/><path d="M9.5 5.5L12.5 8l-3 2.5"/><path d="M12.5 8H6"/>',
}
function NavIcon({ name }: { name: string }) {
  return (
    <svg className="nav-link-ico" width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: NAV_ICONS[name] || NAV_ICONS.glass }} aria-hidden />
  )
}

interface NavOverlayProps {
  variant: 'public' | 'members'
  dark?: boolean
  // Some pages carry their own mark. The fixed logo tracks down the whole
  // page, and on /studio it rode straight over the lion.
  hideLogo?: boolean
}

const allCollapsed = (): Record<string, boolean> => Object.fromEntries(MEMBER_GROUPS.map(g => [g.label, true]))

export default function NavOverlay({ variant, dark = false, hideLogo = false }: NavOverlayProps) {
  // Member links stack two lines, English over Vietnamese. In VN the order
  // flips — the same swap MemberPage makes with a page's title — so the switch
  // visibly changes the menu rather than leaving it as it was. Group names
  // (the welcome guide's names for the same groups) follow the switch too.
  const { lang } = useLang()
  const lines = (en: string, vn: string) => lang === 'vn' ? [vn, en] : [en, vn]
  const [open, setOpen] = useState(false)
  const [logoInverted, setLogoInverted] = useState(dark)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [conciergeUnread, setConciergeUnread] = useState(0)
  // Collapsible member-nav groups — the menu ALWAYS opens compact (Home +
  // category headers), each header a tap to reveal its links.
  //
  // This used to be remembered in localStorage, so a group opened once stayed
  // open on every visit after — the menu arrived with "The Club" already
  // expanded and nothing on screen said why. Now every opening starts
  // collapsed, and the old saved state is cleared rather than left to linger.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(allCollapsed)
  useEffect(() => {
    try { localStorage.removeItem('member_nav_collapsed') } catch { /* ignore */ }
  }, [])
  useEffect(() => { if (open) setCollapsed(allCollapsed()) }, [open])
  const toggleGroup = (label: string) => setCollapsed(c => ({ ...c, [label]: !c[label] }))
  const navRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const logoRef = useRef<HTMLImageElement>(null)
  const handleSignOut = useCallback(async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    setOpen(false)
    // Full reload so the middleware re-reads cleared auth cookies on the next request.
    // router.push() keeps Next's server cache and can leave the user appearing signed in.
    window.location.href = '/'
  }, [])

  useEffect(() => {
    if (variant !== 'members') return
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('profiles').select('is_admin').eq('id', data.user.id).single()
        .then(({ data: profile }) => {
          if (profile?.is_admin) setIsAdminUser(true)
        })
      // Concierge unread badge — count of unread Club replies (RLS: own only).
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('recipient', data.user.id).eq('type', 'concierge_reply').eq('read', false)
        .then(({ count }) => setConciergeUnread(count || 0))
    })
  }, [variant])

  // Detect background behind logo and toggle colour
  useEffect(() => {
    // If dark prop is set, always use cream logo — skip detection
    if (dark) {
      setLogoInverted(true)
      return
    }

    const isDarkAt = (x: number, y: number, logo: HTMLElement) => {
      const els = document.elementsFromPoint(x, y)
      for (const el of els) {
        if (el === logo) continue
        const bg = getComputedStyle(el).backgroundColor
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const match = bg.match(/(\d+),\s*(\d+),\s*(\d+)/)
          if (match) {
            const brightness = (parseInt(match[1]) * 299 + parseInt(match[2]) * 587 + parseInt(match[3]) * 114) / 1000
            return brightness < 128
          }
          break
        }
      }
      return false
    }

    let ticking = false
    const checkBackground = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const logo = logoRef.current
        if (logo) {
          const rect = logo.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const darkCenter = isDarkAt(cx, rect.top + rect.height * 0.5, logo)
          setLogoInverted(darkCenter)
        }
        ticking = false
      })
    }
    checkBackground()
    window.addEventListener('scroll', checkBackground, { passive: true })
    return () => window.removeEventListener('scroll', checkBackground)
  }, [dark])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        navRef.current && !navRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        .nav-trigger {
          position: fixed;
          top: 24px;
          left: 24px;
          z-index: 9000;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .nav-trigger:hover { transform: scale(1.15); }

        @keyframes diamond-pulse {
          0%, 100% { transform: rotate(45deg) scale(1); opacity: 1; }
          50% { transform: rotate(45deg) scale(1.5); opacity: 0.5; }
        }
        .nav-diamond {
          width: 10px;
          height: 10px;
          background: #052E20;
          transform: rotate(45deg);
          transition: all 0.3s ease;
          animation: diamond-pulse 1.2s ease-in-out 3;
        }

        /* ── THE MENU: a sheet from the left, in the house style ─────────────
           It was a small floating box of little spaced capitals — the old
           look, next to a site now set in large display type. Now a full-
           height sheet slides in with the page dimmed behind it: the rooms
           set large in the display face, the Vietnamese beneath in mono,
           hairlines between the groups, utilities quiet at the foot, and one
           of the house's ink drawings for company. Cream on the public site,
           the portal's deep green inside it. */
        .nav-scrim { position: fixed; inset: 0; z-index: 8998; background: rgba(5, 46, 32, .26);
                     -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
                     opacity: 0; pointer-events: none; transition: opacity .45s ease; }
        .nav-dark .nav-scrim { background: rgba(0, 0, 0, .42); }
        .nav-scrim.is-open { opacity: 1; pointer-events: auto; }

        .nav-menu {
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 8999;
          width: min(400px, 88vw);
          display: flex; flex-direction: column; gap: 2px;
          overflow-y: auto; overscroll-behavior: contain;
          padding: 88px 34px 30px;
          background: #EADCCB; color: #052E20;
          border-right: 1px solid rgba(5, 46, 32, .12);
          box-shadow: 24px 0 70px rgba(5, 46, 32, .18);
          transform: translateX(-102%); pointer-events: none;
          transition: transform .55s cubic-bezier(.16,.84,.44,1);
        }
        .nav-dark .nav-menu { background: #04251A; color: #E5D4C2; border-right-color: rgba(229, 212, 194, .12);
                              box-shadow: 24px 0 70px rgba(0, 0, 0, .5); }
        .nav-menu.is-open { transform: none; pointer-events: auto; }

        .nav-link { text-decoration: none; display: block; padding: 7px 0; color: inherit; }
        .nav-link-withicon { display: flex; align-items: flex-start; gap: 12px; }
        .nav-link-text { display: block; }
        /* type-led now: the little line icons go */
        .nav-link-ico { display: none; }

        .nav-link-en {
          font-family: 'Rampant Sans', 'Playfair Display', serif; font-weight: 400;
          font-size: 28px; line-height: 1.02; letter-spacing: 0; text-transform: none;
          color: #052E20; transition: color .25s ease, transform .35s cubic-bezier(.16,.84,.44,1);
        }
        .nav-link-vn {
          font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .03em;
          color: #052E20; opacity: .6; margin-top: 4px;
        }
        .nav-link:hover .nav-link-en, .nav-link:focus-visible .nav-link-en { color: #8A6A1F; transform: translateX(4px); }
        .nav-link:focus-visible { outline: none; }
        .nav-dark .nav-link-en { color: #E5D4C2; }
        .nav-dark .nav-link-vn { color: #E5D4C2; }
        .nav-dark .nav-link:hover .nav-link-en, .nav-dark .nav-link:focus-visible .nav-link-en { color: #D4B85A; }

        /* Primary action (Member Log in) — gold, so the returning member finds it */
        .nav-link-primary .nav-link-en { color: #8A6A1F; }
        .nav-link-primary .nav-link-vn { color: #8A6A1F; opacity: .85; }
        .nav-dark .nav-link-primary .nav-link-en { color: #E7C766; }
        .nav-dark .nav-link-primary .nav-link-vn { color: #D4B85A; }

        .nav-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 16px; height: 16px; padding: 0 5px; border-radius: 8px;
          background: #D4B85A; color: #052E20;
          font-family: 'Google Sans Code', monospace; font-size: 9px; font-weight: 700; letter-spacing: 0;
        }

        .nav-group-label {
          font-family: 'Google Sans Code', monospace; font-size: 10px; letter-spacing: .18em;
          text-transform: uppercase; opacity: .6; margin-top: 12px;
        }

        /* Collapsible groups (member nav): the group name in the display face */
        .nav-group-toggle {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          width: 100%; background: none; border: none; cursor: pointer;
          padding: 16px 0 12px; margin-top: 4px;
          border-top: 1px solid rgba(5, 46, 32, .14);
          font-family: 'Rampant Sans', serif; font-size: 20px; letter-spacing: 0; text-transform: none;
          color: #052E20; opacity: .8; transition: opacity .2s ease, color .2s ease;
        }
        .nav-group-toggle:hover, .nav-group-toggle[aria-expanded="true"] { opacity: 1; }
        .nav-group-toggle .nav-group-left { display: flex; align-items: center; gap: 8px; }
        .nav-group-caret { font-family: 'Google Sans Code', monospace; font-size: 11px; opacity: .6; }
        .nav-dark .nav-group-toggle { color: #E5D4C2; border-top-color: rgba(229, 212, 194, .14); }
        .nav-group-links { display: flex; flex-direction: column; gap: 0; padding: 0 0 12px 14px; }
        .nav-group-links .nav-link-en { font-size: 22px; }

        /* Utilities at the foot: quiet mono, not rooms */
        .nav-menu button.nav-link { margin-top: 0 !important; }
        .nav-menu button.nav-link .nav-link-en {
          font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
        }
        .nav-menu button.nav-link .nav-link-vn { font-size: 10.5px; }
        .nav-foot { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(5, 46, 32, .14); display: flex; flex-direction: column; gap: 2px; }
        .nav-dark .nav-foot { border-top-color: rgba(229, 212, 194, .14); }
        .nav-ink { margin-top: auto; padding-top: 26px; flex-shrink: 0; align-self: flex-end; opacity: .9; pointer-events: none; }
        .nav-ink img { display: block; width: 100%; height: auto; }

        .nav-signout {
          font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .06em;
          color: inherit; opacity: .6; background: none; border: none; cursor: pointer; padding: 0;
          text-align: left; margin-top: 6px; transition: opacity .2s ease;
        }
        .nav-signout:hover { opacity: 1; }

        .nav-admin-link {
          font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
          color: inherit; opacity: .5; text-decoration: none; padding: 4px 0; transition: opacity .2s ease;
        }
        .nav-admin-link:hover { opacity: .9; }

        @media (prefers-reduced-motion: reduce) {
          .nav-menu, .nav-scrim, .nav-link-en { transition: none; }
        }

        .nav-logo {
          position: fixed;
          top: 50%;
          right: 24px;
          transform: translateY(-50%);
          z-index: 9000;
          height: 100px;
          width: auto;
          pointer-events: auto;
          cursor: pointer;
          user-select: none;
        }

        /* ── Dark variant (for green backgrounds) ── */
        .nav-dark .nav-diamond { background: #E5D4C2; }
        .nav-inv .nav-diamond { background: #E5D4C2; }
        .nav-dark .nav-logo {
        }
        .nav-logo.inverted {
          transition: filter 0.3s ease;
        }
        .nav-logo:not(.inverted) {
          transition: filter 0.3s ease;
        }

        @media (max-width: 768px) {
          .nav-trigger { top: 18px; left: 18px; }
          .nav-menu { padding: 78px 26px 26px; }
          .nav-logo { display: none !important; }
        }
        /* Hide the lion on iPad-sized viewports too, but only inside the members portal */
        @media (max-width: 1024px) {
          .nav-dark .nav-logo { display: none !important; }
        }
      ` }} />

      {/* nav-inv follows the SAME runtime detection as the logo. The diamond used
          to take its colour from the `dark` prop alone, so on a page that never
          passes it — /spaces, which is #052E20 — the diamond stayed #052E20 and
          was invisible against the page. Two mechanisms answering one question. */}
      <div className={`${dark ? 'nav-dark' : ''} ${logoInverted ? 'nav-inv' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href="/" style={{ position: 'fixed', top: '50%', right: 24, transform: 'translateY(-50%)',
                           zIndex: 9000, cursor: 'pointer', lineHeight: 0,
                           display: hideLogo ? 'none' : 'block' }}>
        <img
          ref={logoRef}
          src={logoInverted ? '/images/logo-mark-cream.svg' : '/images/logo-mark.svg'}
          alt="The Rampant Club"
          className={`nav-logo ${logoInverted ? 'inverted' : ''}`}
        />
      </a>

      <button
        ref={triggerRef}
        className="nav-trigger"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        <div className="nav-diamond" />
      </button>

      <div className={`nav-scrim ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div ref={navRef} className={`nav-menu ${open ? 'is-open' : ''}`}>
        {variant === 'public' ? (
          <>
            <Link href="/" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Home</div>
              <div className="nav-link-vn">Trang chủ</div>
            </Link>
            <Link href="/login" className="nav-link nav-link-primary" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Member Log in</div>
              <div className="nav-link-vn">Đăng Nhập</div>
            </Link>
            <Link href="/atlas" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">The Atlas</div>
              <div className="nav-link-vn">Bản Đồ Whisky</div>
            </Link>
            <Link href="/origin" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">The Origin</div>
              <div className="nav-link-vn">Nguồn Gốc</div>
            </Link>
            <Link href="/spaces" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Club Spaces</div>
              <div className="nav-link-vn">Không Gian</div>
            </Link>
            <Link href="/studio" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">The Studio</div>
              <div className="nav-link-vn">Phòng Studio</div>
            </Link>
            <Link href="/sports" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">The Sports Club</div>
              <div className="nav-link-vn">Câu Lạc Bộ Thể Thao</div>
            </Link>
            <Link href="/vacancies" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Staff & Vacancies</div>
              <div className="nav-link-vn">Tuyển dụng</div>
            </Link>
          </>
        ) : (
          <>
            <Link href="/members" className="nav-link nav-link-withicon" onClick={() => setOpen(false)}>
              <NavIcon name="home" />
              <span className="nav-link-text">
                <div className="nav-link-en">{lines('My Dashboard', 'Trang của tôi')[0]}</div>
                <div className="nav-link-vn">{lines('My Dashboard', 'Trang của tôi')[1]}</div>
              </span>
            </Link>
            {MEMBER_GROUPS.map(g => {
              const isCollapsed = collapsed[g.label] ?? true
              const groupHasUnread = conciergeUnread > 0 && g.links.some(l => l.href === '/members/concierge')
              return (
                <Fragment key={g.label}>
                  <button type="button" className="nav-group-toggle" onClick={() => toggleGroup(g.label)} aria-expanded={!isCollapsed}>
                    <span className="nav-group-left">
                      {lang === 'vn' ? g.vn : g.label}
                      {isCollapsed && groupHasUnread && (
                        <span className="nav-badge">{conciergeUnread > 9 ? '9+' : conciergeUnread}</span>
                      )}
                    </span>
                    <span className="nav-group-caret">{isCollapsed ? '▸' : '▾'}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="nav-group-links">
                      {g.links.map(l => (
                        <Link key={l.href} href={l.href} className="nav-link nav-link-withicon" onClick={() => setOpen(false)}>
                          <NavIcon name={l.icon} />
                          <span className="nav-link-text">
                            <div className="nav-link-en" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {lines(l.en, l.vn)[0]}
                              {l.href === '/members/concierge' && conciergeUnread > 0 && (
                                <span className="nav-badge">{conciergeUnread > 9 ? '9+' : conciergeUnread}</span>
                              )}
                            </div>
                            <div className="nav-link-vn">{lines(l.en, l.vn)[1]}</div>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Fragment>
              )
            })}
            <div className="nav-foot">
            <button className="nav-link nav-link-withicon" onClick={() => { setOpen(false); window.dispatchEvent(new Event('open-portal-guide')) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', marginTop: 12 }}>
              <NavIcon name="compass" />
              <span className="nav-link-text">
                <div className="nav-link-en">{lines('Portal Guide', 'Hướng Dẫn')[0]}</div>
                <div className="nav-link-vn">{lines('Portal Guide', 'Hướng Dẫn')[1]}</div>
              </span>
            </button>
            <button className="nav-link nav-link-withicon" onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', marginTop: 4 }}>
              <NavIcon name="signout" />
              <span className="nav-link-text">
                <div className="nav-link-en">{lines('Sign Out', 'Đăng xuất')[0]}</div>
                <div className="nav-link-vn">{lines('Sign Out', 'Đăng xuất')[1]}</div>
              </span>
            </button>
            {isAdminUser && (
              <>
                <Link href="/members/upload" className="nav-admin-link" onClick={() => setOpen(false)}>
                  Upload
                </Link>
                <Link href="/admin" className="nav-admin-link" onClick={() => setOpen(false)}>
                  Admin
                </Link>
              </>
            )}
            </div>
          </>
        )}
        {/* one of the house's ink drawings, keeping the sheet company */}
        {dark
          ? <CreamInk name="lion-lounging" width={150} rot={-3} dur={10} className="nav-ink" />
          : <InkFloat name="lion-lounging" width={150} rot={-3} dur={10} className="nav-ink" />}
      </div>
      {dark && <CreamInkDefs />}
      </div>
    </>
  )
}
