'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// Member nav — grouped by what a member actually comes here to do, each link with
// a consistent line icon (same visual language as the admin sidebar). Order is
// intentional: whisky (the heart of the club) → what's on → the physical club →
// people → your account → the fine print.
const MEMBER_GROUPS: { label: string; links: { href: string; en: string; vn: string; icon: string }[] }[] = [
  { label: 'What’s On', links: [
    { href: '/members/events',        icon: 'calendar', en: 'Events & Fixtures', vn: 'Sự Kiện & Thi Đấu' },
    { href: '/members/gallery',       icon: 'image',    en: 'Event Gallery',  vn: 'Thư Viện Sự Kiện' },
    { href: '/members/notices',       icon: 'pin',      en: 'Notice Board',   vn: 'Bảng Tin' },
  ] },
  { label: 'The Club', links: [
    { href: '/members/spaces',        icon: 'building', en: 'Our Spaces',     vn: 'Không gian' },
    { href: '/menus',                 icon: 'menu',     en: 'The Menus',      vn: 'Thực Đơn' },
    { href: '/members/snug',          icon: 'sofa',     en: 'The Snug',       vn: 'Phòng Khách' },
    { href: '/members/concierge',     icon: 'bell',     en: 'The Concierge',  vn: 'Quản Gia' },
  ] },
  { label: 'Whisky', links: [
    { href: '/members/whisky',        icon: 'glass',   en: 'Whisky Library',  vn: 'Thư Viện Whisky' },
    { href: '/members/whisky/finder', icon: 'compass', en: 'Flavour Finder',  vn: 'Tìm Ly Của Bạn' },
    { href: '/members/taste',         icon: 'radar',   en: 'Your Palate',     vn: 'Khẩu Vị Của Bạn' },
    { href: '/members/notes',         icon: 'quill',   en: 'Your Notes',      vn: 'Nhật Ký Nếm Thử' },
    { href: '/members/journey',       icon: 'flag',    en: 'Your Journey',    vn: 'Hành Trình Của Bạn' },
  ] },
  { label: 'Community', links: [
    { href: '/members/members',       icon: 'people',    en: 'The Members',   vn: 'Thành Viên' },
    { href: '/members/introductions', icon: 'introduce', en: 'Introductions', vn: 'Lời Giới Thiệu' },
    { href: '/members/messages',      icon: 'chat',      en: 'Messages',      vn: 'Tin Nhắn' },
  ] },
  { label: 'You', links: [
    { href: '/members/profile',       icon: 'card',     en: 'My Membership',  vn: 'Tư Cách Thành Viên' },
    { href: '/members/calendar',      icon: 'calendar', en: 'My Calendar',    vn: 'Lịch Của Bạn' },
    { href: '/members/visits',        icon: 'clock',    en: 'Your Visits',    vn: 'Những Lần Ghé Thăm' },
  ] },
  { label: 'Info', links: [
    { href: '/members/rules',         icon: 'book',     en: 'House Rules',  vn: 'Nội Quy' },
    { href: '/members/terms',         icon: 'document', en: 'Terms',        vn: 'Điều Khoản' },
    { href: '/members/contact',       icon: 'mail',     en: 'Contact',      vn: 'Liên hệ' },
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
}

export default function NavOverlay({ variant, dark = false }: NavOverlayProps) {
  const [open, setOpen] = useState(false)
  const [logoInverted, setLogoInverted] = useState(dark)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [conciergeUnread, setConciergeUnread] = useState(0)
  // Collapsible member-nav groups — default collapsed so the menu opens compact
  // (Home + category headers), each header a tap to reveal its links. Persisted.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(MEMBER_GROUPS.map(g => [g.label, true]))
  )
  useEffect(() => {
    try {
      const raw = localStorage.getItem('member_nav_collapsed')
      if (raw) setCollapsed(c => ({ ...c, ...JSON.parse(raw) }))
    } catch { /* ignore */ }
  }, [])
  const toggleGroup = (label: string) => setCollapsed(c => {
    const next = { ...c, [label]: !c[label] }
    try { localStorage.setItem('member_nav_collapsed', JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })
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

        .nav-menu {
          position: fixed;
          top: 68px;
          left: 28px;
          z-index: 8999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          /* Grouped member nav can be ~16 rows — cap to the viewport and scroll
             rather than clip Sign Out / Admin off the bottom on short screens. */
          max-height: calc(100vh - 84px);
          overflow-y: auto;
          opacity: 0;
          transform: translateY(-6px);
          pointer-events: none;
          transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
          padding: 18px 22px;
          background: rgba(242, 229, 210, 0.94);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-radius: 8px;
          border: 1px solid rgba(5, 46, 32, 0.10);
          box-shadow: 0 18px 36px rgba(5, 46, 32, 0.15);
        }
        .nav-dark .nav-menu {
          background: rgba(5, 46, 32, 0.94);
          border: 1px solid rgba(229, 212, 194, 0.18);
          box-shadow: 0 18px 36px rgba(0, 0, 0, 0.45);
        }
        .nav-menu.is-open {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .nav-link {
          text-decoration: none;
          display: block;
          transition: opacity 0.2s ease;
        }
        .nav-link:hover { opacity: 0.5; }

        /* Icon-led member links — icon + stacked EN/VN text on one row. Only the
           member nav uses this; public/Home stay block so nothing else shifts. */
        .nav-link-withicon { display: flex; align-items: center; gap: 12px; }
        .nav-link-text { display: block; }
        .nav-link-ico { flex-shrink: 0; color: #A9822C; opacity: 0.85; }
        .nav-dark .nav-link-ico { color: #D4B85A; opacity: 0.9; }

        /* Primary action (Member Log in) — gold accent so the key returning-
           member action stands out, in both the light and dark nav themes. */
        .nav-link-primary .nav-link-en { color: #A9822C; }
        .nav-link-primary .nav-link-vn { color: #A9822C; opacity: 0.85; }
        .nav-dark .nav-link-primary .nav-link-en { color: #E7C766; }
        .nav-dark .nav-link-primary .nav-link-vn { color: #D4B85A; }

        .nav-link-en {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 14px;
          font-weight: 400;
          color: #052E20;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .nav-link-vn {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #052E20;
          letter-spacing: 0.04em;
          margin-top: 1px;
        }

        .nav-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          padding: 0 5px;
          border-radius: 8px;
          background: #D4B85A;
          color: #052E20;
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .nav-group-label {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #5E6650;
          opacity: 0.7;
          margin-top: 12px;
          margin-bottom: -2px;
        }

        /* Collapsible group header (member nav) */
        .nav-group-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px 0 6px;
          margin-top: 8px;
          border-top: 1px solid rgba(5, 46, 32, 0.10);
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #5E6650;
          transition: color 0.2s ease;
        }
        .nav-group-toggle:first-of-type { border-top: none; }
        .nav-group-toggle:hover { color: #052E20; }
        .nav-group-toggle .nav-group-left { display: flex; align-items: center; gap: 8px; }
        .nav-group-caret { font-size: 9px; opacity: 0.6; transition: transform 0.2s ease; }
        .nav-dark .nav-group-toggle { color: #B2AA98; border-top-color: rgba(229, 212, 194, 0.12); }
        .nav-dark .nav-group-toggle:hover { color: #E5D4C2; }
        .nav-group-links {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 6px 0 4px 10px;
          border-left: 1px solid rgba(5, 46, 32, 0.10);
          margin-left: 2px;
        }
        .nav-dark .nav-group-links { border-left-color: rgba(229, 212, 194, 0.14); }

        .nav-signout {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          color: #5E6650;
          opacity: 0.5;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          text-align: left;
          margin-top: 6px;
          transition: opacity 0.2s ease;
        }
        .nav-signout:hover { opacity: 1; }

        .nav-admin-link {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          color: #5E6650;
          opacity: 0.35;
          text-decoration: none;
          transition: opacity 0.2s ease;
        }
        .nav-admin-link:hover { opacity: 0.7; }

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
        .nav-dark .nav-link-en { color: #E5D4C2; }
        .nav-dark .nav-link-vn { color: #B2AA98; }
        .nav-dark .nav-group-label { color: #D4B85A; opacity: 0.6; }
        .nav-dark .nav-signout { color: #B2AA98; }
        .nav-dark .nav-admin-link { color: #B2AA98; }
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
          .nav-menu {
            top: 60px;
            left: 16px;
            padding: 16px 20px;
          }
          .nav-logo { display: none !important; }
        }
        /* Hide the lion on iPad-sized viewports too, but only inside the members portal */
        @media (max-width: 1024px) {
          .nav-dark .nav-logo { display: none !important; }
        }
      ` }} />

      <div className={dark ? 'nav-dark' : ''}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href="/" style={{ position: 'fixed', top: '50%', right: 24, transform: 'translateY(-50%)', zIndex: 9000, cursor: 'pointer', lineHeight: 0 }}>
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
                <div className="nav-link-en">Home</div>
                <div className="nav-link-vn">Trang chủ</div>
              </span>
            </Link>
            {MEMBER_GROUPS.map(g => {
              const isCollapsed = collapsed[g.label] ?? true
              const groupHasUnread = conciergeUnread > 0 && g.links.some(l => l.href === '/members/concierge')
              return (
                <Fragment key={g.label}>
                  <button type="button" className="nav-group-toggle" onClick={() => toggleGroup(g.label)} aria-expanded={!isCollapsed}>
                    <span className="nav-group-left">
                      {g.label}
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
                              {l.en}
                              {l.href === '/members/concierge' && conciergeUnread > 0 && (
                                <span className="nav-badge">{conciergeUnread > 9 ? '9+' : conciergeUnread}</span>
                              )}
                            </div>
                            <div className="nav-link-vn">{l.vn}</div>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Fragment>
              )
            })}
            <button className="nav-link nav-link-withicon" onClick={() => { setOpen(false); window.dispatchEvent(new Event('open-portal-guide')) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', marginTop: 12 }}>
              <NavIcon name="compass" />
              <span className="nav-link-text">
                <div className="nav-link-en">Portal Guide</div>
                <div className="nav-link-vn">Hướng Dẫn</div>
              </span>
            </button>
            <button className="nav-link nav-link-withicon" onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', marginTop: 4 }}>
              <NavIcon name="signout" />
              <span className="nav-link-text">
                <div className="nav-link-en">Sign Out</div>
                <div className="nav-link-vn">Đăng xuất</div>
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
          </>
        )}
      </div>
      </div>
    </>
  )
}
