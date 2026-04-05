'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

interface Notice {
  id: string
  title: string
  body: string
  category: string
  pinned: boolean
}

export default function MembersPage() {
  const [greeting, setGreeting] = useState('')
  const [email, setEmail] = useState('')
  const [summary, setSummary] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const [activeNotice, setActiveNotice] = useState(0)

  useEffect(() => {
    const hour = new Date().getHours()
    let timeGreeting = 'Good evening'
    if (hour < 12) timeGreeting = 'Good morning'
    else if (hour < 17) timeGreeting = 'Good afternoon'

    const supabase = createBrowserSupabaseClient()

    // Fetch notices
    supabase.from('notices').select('id, title, body, category, pinned')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setNotices(data) })

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email || '')
      supabase.from('profiles').select('display_name, member_number, preferred_dram, locker_number').eq('id', data.user.id).single()
        .then(({ data: profile }) => {
          const name = profile?.display_name
          if (name) {
            setGreeting(`${timeGreeting}, ${name}`)
          } else {
            setGreeting(timeGreeting)
          }
          const parts: string[] = []
          if (profile?.member_number) parts.push(`Member No. ${String(profile.member_number).padStart(3, '0')}`)
          if (profile?.locker_number) parts.push(`Locker ${profile.locker_number}`)
          if (profile?.preferred_dram) parts.push(`Dram of choice: ${profile.preferred_dram}`)
          setSummary(parts.join(' · '))
        })
    })
  }, [])

  // Rotate notices
  useEffect(() => {
    if (notices.length <= 1) return
    const interval = setInterval(() => {
      setActiveNotice(prev => (prev + 1) % notices.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [notices.length])


  const sections = [
    {
      href: '/members/events',
      en: 'Events',
      vn: 'Sự kiện',
      desc: 'What\u2019s on & sign-ups',
    },
    {
      href: '/members/spaces',
      en: 'Spaces & Menus',
      vn: 'Không gian & Thực đơn',
      desc: 'The Library Bar, Studio & more',
    },
    {
      href: '/members/profile',
      en: 'My Membership',
      vn: 'Tư Cách Thành Viên',
      desc: 'Your details & member number',
    },
    {
      href: '/members/fixtures',
      en: 'T.R.C Sports Fixtures',
      vn: 'Lịch Thi Đấu',
      desc: 'Upcoming sports & sign-ups',
    },
    {
      href: '/members/rules',
      en: 'House Rules',
      vn: 'Nội Quy Câu Lạc Bộ',
      desc: "The club's operating principles",
    },
    {
      href: '/members/contact',
      en: 'Contact',
      vn: 'Liên hệ',
      desc: 'Address & member hotline',
    },
  ]

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');

        .members-page {
          min-height: 100vh;
          background: #052E20;
          font-family: 'DM Mono', monospace;
          position: relative;
        }

        .members-grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 200px;
        }

        .members-container {
          position: relative;
          z-index: 2;
          max-width: 680px;
          margin: 0 auto;
          padding: 100px 24px 80px;
        }

        .members-greeting {
          font-family: 'Rampant Sans', serif;
          font-size: 32px;
          font-weight: 600;
          color: #E5D4C2;
          letter-spacing: 0.02em;
          margin-bottom: 4px;
        }
        .members-email {
          font-size: 11px;
          color: #B2AA98;
          opacity: 0.4;
          letter-spacing: 0.04em;
          margin-bottom: 56px;
        }

        .members-section-list {
          display: flex;
          flex-direction: column;
        }

        .members-section-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 0;
          border-bottom: 1px solid rgba(229, 212, 194, 0.08);
          text-decoration: none;
          transition: padding-left 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .members-section-item:first-child {
          border-top: 1px solid rgba(229, 212, 194, 0.08);
        }
        .members-section-item:hover {
          padding-left: 12px;
        }

        .members-section-en {
          font-family: 'Rampant Sans', serif;
          font-size: 20px;
          font-weight: 600;
          color: #E5D4C2;
          letter-spacing: 0.02em;
          display: block;
        }
        .members-section-vn {
          font-size: 10px;
          color: #B2AA98;
          opacity: 0.4;
          letter-spacing: 0.06em;
          display: block;
          margin-top: 2px;
        }

        .members-section-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .members-section-desc {
          font-size: 11px;
          color: #B2AA98;
          letter-spacing: 0.03em;
          text-align: right;
        }

        .members-section-arrow {
          font-size: 16px;
          color: #E5D4C2;
          opacity: 0.25;
          transition: opacity 0.2s, transform 0.2s;
        }
        .members-section-item:hover .members-section-arrow {
          opacity: 0.5;
          transform: translateX(4px);
        }

        .members-diamond {
          width: 6px;
          height: 6px;
          background: #E5D4C2;
          transform: rotate(45deg);
          opacity: 0.2;
          margin: 48px auto 0;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #052E20; }
        ::-webkit-scrollbar-thumb { background: rgba(94, 102, 80, 0.2); border-radius: 3px; }

        @media (max-width: 768px) {
          .members-container { padding: 80px 20px 60px; }
          .members-greeting { font-size: 26px; }
          .members-section-desc { display: none; }
        }
      ` }} />

      <div className="members-page">
        <div className="members-grain" />
        <div className="members-container">
          <h1 className="members-greeting">{greeting}</h1>
          {summary && <p className="members-email">{summary}</p>}
          {!summary && <p className="members-email">{email}</p>}

          {notices.length > 0 && (
            <Link
              href="/members/notices"
              style={{ textDecoration: 'none', display: 'block', margin: '0 0 48px' }}
            >
              <div style={{
                padding: '20px 24px',
                background: 'rgba(229,212,194,0.04)',
                borderRadius: 8,
                border: '1px solid rgba(229,212,194,0.06)',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 72,
                userSelect: 'none',
              }}>
                <div style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9,
                  color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase',
                  marginBottom: 8, opacity: 0.5,
                }}>
                  ◆ Notice Board
                </div>
                {notices.map((n, i) => (
                  <div key={n.id} style={{
                    opacity: i === activeNotice ? 1 : 0,
                    position: i === activeNotice ? 'relative' : 'absolute',
                    top: i === activeNotice ? undefined : 28,
                    left: i === activeNotice ? undefined : 24,
                    right: i === activeNotice ? undefined : 24,
                    transition: 'opacity 0.6s ease',
                  }}>
                    <div style={{
                      fontFamily: "'Rampant Sans', serif", fontSize: 15, fontWeight: 500,
                      color: '#E5D4C2', marginBottom: 4,
                    }}>
                      {n.title}
                    </div>
                    <div style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      color: '#B2AA98', opacity: 0.6, lineHeight: 1.5,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {n.body}
                    </div>
                  </div>
                ))}
                {notices.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                    <button
                      onClick={(e) => { e.preventDefault(); setActiveNotice(prev => (prev - 1 + notices.length) % notices.length) }}
                      style={{
                        background: 'rgba(229,212,194,0.08)', border: '1px solid rgba(229,212,194,0.12)',
                        color: '#E5D4C2', opacity: 0.6, cursor: 'pointer', fontSize: 16,
                        padding: '4px 10px', borderRadius: 4,
                        fontFamily: "'Rampant Sans', serif",
                        lineHeight: 1,
                      }}
                    >
                      ‹
                    </button>
                    {notices.map((_, i) => (
                      <div key={i} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#E5D4C2',
                        opacity: i === activeNotice ? 0.6 : 0.15,
                        transition: 'opacity 0.3s',
                      }} />
                    ))}
                    <button
                      onClick={(e) => { e.preventDefault(); setActiveNotice(prev => (prev + 1) % notices.length) }}
                      style={{
                        background: 'rgba(229,212,194,0.08)', border: '1px solid rgba(229,212,194,0.12)',
                        color: '#E5D4C2', opacity: 0.6, cursor: 'pointer', fontSize: 16,
                        padding: '4px 10px', borderRadius: 4,
                        fontFamily: "'Rampant Sans', serif",
                        lineHeight: 1,
                      }}
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </Link>
          )}

          <div className="members-section-list">
            {sections.map((s) => (
              <Link key={s.href} href={s.href} className="members-section-item">
                <div>
                  <span className="members-section-en">{s.en}</span>
                  <span className="members-section-vn">{s.vn}</span>
                </div>
                <div className="members-section-right">
                  <span className="members-section-desc">{s.desc}</span>
                  <span className="members-section-arrow">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="members-diamond" />
        </div>
      </div>
    </>
  )
}
