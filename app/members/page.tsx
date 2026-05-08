'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import TonightPanel from '@/components/TonightPanel'

interface Notice {
  id: string
  title: string
  body: string
  category: string
  pinned: boolean
}

interface NextFixture {
  id: string
  sport: string
  title: string
  date: string
  location: string | null
}

export default function MembersPage() {
  const [greeting, setGreeting] = useState('')
  const [email, setEmail] = useState('')
  const [summary, setSummary] = useState('')
  const [memberNumber, setMemberNumber] = useState<number | null>(null)
  const [lockerNumber, setLockerNumber] = useState<string | null>(null)
  const [preferredDram, setPreferredDram] = useState<string | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [activeNotice, setActiveNotice] = useState(0)
  const [nextFixture, setNextFixture] = useState<NextFixture | null>(null)

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

    // Fetch next upcoming fixture
    supabase.from('fixtures')
      .select('id, sport, title, date, location')
      .gte('date', new Date().toISOString())
      .order('date', { ascending: true })
      .limit(1)
      .then(({ data }) => { if (data && data.length) setNextFixture(data[0] as NextFixture) })

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
          if (profile?.member_number) setMemberNumber(profile.member_number)
          if (profile?.locker_number) setLockerNumber(profile.locker_number)
          if (profile?.preferred_dram) setPreferredDram(profile.preferred_dram)
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


  const fmtDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      + ' \u00b7 '
      + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  interface Bucket {
    href: string
    en: string
    vn: string
    glyph: string
    primary?: string
    secondary?: string
  }

  const buckets: Bucket[] = [
    {
      href: '/members/events',
      en: 'Events',
      vn: 'S\u1ef1 ki\u1ec7n',
      glyph: '\u25c6',
      secondary: "What's on & sign-ups",
    },
    {
      href: '/members/profile',
      en: 'My Membership',
      vn: 'T\u01b0 C\u00e1ch Th\u00e0nh Vi\u00ean',
      glyph: '\u2726',
      primary: memberNumber ? '#' + String(memberNumber).padStart(3, '0') : '\u2014',
      secondary: lockerNumber ? 'Locker ' + lockerNumber : (preferredDram ? 'Dram: ' + preferredDram : 'Your details'),
    },
    {
      href: '/members/fixtures',
      en: 'Sports Fixtures',
      vn: 'L\u1ecbch Thi \u0110\u1ea5u',
      glyph: '\u29eb',
      primary: nextFixture ? nextFixture.sport.charAt(0).toUpperCase() + nextFixture.sport.slice(1) : 'No upcoming',
      secondary: nextFixture ? fmtDate(nextFixture.date) : 'Check the schedule',
    },
    {
      href: '/members/spaces',
      en: 'Spaces & Menus',
      vn: 'Kh\u00f4ng gian & Th\u1ef1c \u0111\u01a1n',
      glyph: '\u2b22',
      secondary: 'Library Bar \u00b7 Studio \u00b7 Rampant Room',
    },
    {
      href: '/members/rules',
      en: 'House Rules',
      vn: 'N\u1ed9i Quy',
      glyph: '\u00a7',
      secondary: "The club's operating principles",
    },
    {
      href: '/members/contact',
      en: 'Contact',
      vn: 'Li\u00ean h\u1ec7',
      glyph: '\u2709',
      secondary: 'Address & member hotline',
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
          max-width: 1080px;
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

        /* ── Bucket grid (desktop) / linear stack (mobile) ── */
        .members-bucket-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .members-bucket {
          position: relative;
          padding: 24px 22px 28px;
          background: rgba(229, 212, 194, 0.04);
          border: 1px solid rgba(229, 212, 194, 0.08);
          border-radius: 14px;
          text-decoration: none;
          color: #E5D4C2;
          min-height: 168px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition:
            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            background 0.3s ease,
            border-color 0.3s ease,
            box-shadow 0.4s ease;
        }
        .members-bucket::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 30% 0%, rgba(212,184,90,0.08), transparent 60%);
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
        }
        .members-bucket:hover {
          transform: translateY(-4px);
          background: rgba(229, 212, 194, 0.07);
          border-color: rgba(212, 184, 90, 0.4);
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.35);
        }
        .members-bucket:hover::before { opacity: 1; }

        .members-bucket-glyph {
          font-family: 'Rampant Sans', serif;
          font-size: 22px;
          color: #D4B85A;
          opacity: 0.7;
          margin-bottom: 14px;
          line-height: 1;
        }
        .members-bucket-en {
          font-family: 'Rampant Sans', serif;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: 0.02em;
          line-height: 1.15;
        }
        .members-bucket-vn {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 10px;
          color: #B2AA98;
          opacity: 0.55;
          letter-spacing: 0.06em;
          margin-top: 4px;
        }
        .members-bucket-primary {
          font-family: 'Rampant Sans', serif;
          font-size: 18px;
          font-weight: 500;
          color: #D4B85A;
          letter-spacing: 0.04em;
          margin-top: auto;
          padding-top: 14px;
        }
        .members-bucket-secondary {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px;
          color: #B2AA98;
          opacity: 0.7;
          letter-spacing: 0.04em;
          line-height: 1.5;
          margin-top: 6px;
        }
        .members-bucket-secondary:not(:last-child) { margin-top: 6px; }
        .members-bucket-primary + .members-bucket-secondary {
          margin-top: 4px;
          opacity: 0.55;
        }
        /* If there's no primary, push the secondary down to fill the card */
        .members-bucket > .members-bucket-vn + .members-bucket-secondary {
          margin-top: auto;
          padding-top: 18px;
        }
        .members-bucket-arrow {
          position: absolute;
          top: 22px;
          right: 22px;
          font-size: 14px;
          color: #E5D4C2;
          opacity: 0.25;
          transition: opacity 0.3s, transform 0.3s;
        }
        .members-bucket:hover .members-bucket-arrow {
          opacity: 0.7;
          transform: translateX(3px);
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

        @media (max-width: 1024px) {
          .members-bucket-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .members-container { padding: 80px 20px 60px; }
          .members-greeting { font-size: 26px; }
          .members-bucket-grid { grid-template-columns: 1fr; gap: 10px; }
          .members-bucket { min-height: auto; padding: 18px 18px 20px; }
        }
      ` }} />

      <div className="members-page">
        <div className="members-grain" />
        <div className="members-container">
          <h1 className="members-greeting">{greeting}</h1>
          {summary && <p className="members-email">{summary}</p>}
          {!summary && <p className="members-email">{email}</p>}

          <div style={{ margin: '32px 0 40px' }}>
            <TonightPanel showClubhouseCount bg="green" />
          </div>

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

          <div className="members-bucket-grid">
            {buckets.map(b => (
              <Link key={b.href} href={b.href} className="members-bucket">
                <div className="members-bucket-glyph" aria-hidden>{b.glyph}</div>
                <div className="members-bucket-en">{b.en}</div>
                <div className="members-bucket-vn">{b.vn}</div>
                {b.primary && <div className="members-bucket-primary">{b.primary}</div>}
                {b.secondary && <div className="members-bucket-secondary">{b.secondary}</div>}
                <div className="members-bucket-arrow">&rarr;</div>
              </Link>
            ))}
          </div>

          <div className="members-diamond" />
        </div>
      </div>
    </>
  )
}
