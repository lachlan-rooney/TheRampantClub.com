'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

interface NavOverlayProps {
  variant: 'public' | 'members'
  dark?: boolean
}

export default function NavOverlay({ variant, dark = false }: NavOverlayProps) {
  const [open, setOpen] = useState(false)
  const [logoInverted, setLogoInverted] = useState(dark)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const logoRef = useRef<HTMLImageElement>(null)
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
  }, [router])

  useEffect(() => {
    if (variant !== 'members') return
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('profiles').select('is_admin').eq('id', data.user.id).single()
        .then(({ data: profile }) => {
          if (profile?.is_admin) setIsAdminUser(true)
        })
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
          opacity: 0;
          transform: translateY(-6px);
          pointer-events: none;
          transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
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
          font-size: 9px;
          color: #5E6650;
          letter-spacing: 0.04em;
          margin-top: 1px;
        }

        .nav-signout {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
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
          font-size: 9px;
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
            background: rgba(94, 102, 80, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 8px;
            border: 1px solid rgba(229, 212, 194, 0.15);
          }
          .nav-dark .nav-menu {
            background: rgba(94, 102, 80, 0.85);
          }
          .nav-logo { display: none !important; }
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
            <Link href="/login" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Members</div>
              <div className="nav-link-vn">Thành viên</div>
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
            <Link href="/members" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Home</div>
              <div className="nav-link-vn">Trang chủ</div>
            </Link>
            <Link href="/members/events" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Events</div>
              <div className="nav-link-vn">Sự kiện</div>
            </Link>
            <Link href="/members/spaces" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Our Spaces</div>
              <div className="nav-link-vn">Không gian</div>
            </Link>
            <Link href="/members/contact" className="nav-link" onClick={() => setOpen(false)}>
              <div className="nav-link-en">Contact</div>
              <div className="nav-link-vn">Liên hệ</div>
            </Link>
            <button className="nav-link" onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              <div className="nav-link-en">Sign Out</div>
              <div className="nav-link-vn">Đăng xuất</div>
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
