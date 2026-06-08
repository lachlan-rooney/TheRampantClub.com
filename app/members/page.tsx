'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import TonightPanel from '@/components/TonightPanel'
import WelcomeTour from '@/components/WelcomeTour'

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
  const [firstName, setFirstName] = useState<string | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [summary, setSummary] = useState('')
  const [memberNo, setMemberNo] = useState<string | null>(null)
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
      supabase.from('profiles').select('display_name, member_no, preferred_dram, locker_number').eq('id', data.user.id).single()
        .then(({ data: profile }) => {
          const name = profile?.display_name
          if (name) {
            setGreeting(`${timeGreeting}, ${name}`)
            setFirstName(name.split(' ')[0])
          } else {
            setGreeting(timeGreeting)
          }
          if (profile?.member_no) setMemberNo(profile.member_no)
          if (profile?.locker_number) setLockerNumber(profile.locker_number)
          if (profile?.preferred_dram) setPreferredDram(profile.preferred_dram)
          const parts: string[] = []
          if (profile?.member_no) parts.push(`Member No. ${profile.member_no.replace(/^TRC-M/i, '')}`)
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
      primary: memberNo ? '#' + memberNo.replace(/^TRC-M/i, '') : '\u2014',
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
      href: '/members/journal',
      en: "Cellarmaster's Journal",
      vn: 'Nhật Ký Cellarmaster',
      glyph: '✍',
      secondary: 'Tasting notes & long-form whisky writing',
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

  // Mirror the nav's Explore / You / House groups so the two surfaces agree.
  // Whisky Library is the prominent first Explore tile (it had none before).
  const byHref = Object.fromEntries(buckets.map(b => [b.href, b])) as Record<string, Bucket>
  const extra: Record<string, Bucket> = {
    whisky: { href: '/members/whisky',        en: 'Whisky Library', vn: 'Th\u01b0 Vi\u1ec7n Whisky', glyph: '\u2756', secondary: 'The shelf \u00b7 radar \u00b7 300+ drams' },
    finder: { href: '/members/whisky/finder', en: 'Flavour Finder', vn: 'T\u00ecm Ly C\u1ee7a B\u1ea1n', glyph: '\u25ce', secondary: 'Match a dram to your taste' },
    menus:  { href: '/menus',                 en: 'The Menus',      vn: 'Th\u1ef1c \u0110\u01a1n',     glyph: '\u2630', secondary: 'Food & drink lists' },
    terms:  { href: '/members/terms',         en: 'Terms',          vn: '\u0110i\u1ec1u Kho\u1ea3n',   glyph: '\u00b6', secondary: 'Full terms & conditions' },
    taste:  { href: '/members/taste',         en: 'Your Palate',    vn: 'Kh\u1ea9u V\u1ecb C\u1ee7a B\u1ea1n', glyph: '\u25c9', secondary: 'Your taste \u00b7 radar \u00b7 loved drams' },
    visits: { href: '/members/visits',        en: 'Your Visits',    vn: 'Nh\u1eefng L\u1ea7n Gh\u00e9 Th\u0103m', glyph: '\u2741', secondary: 'Your record at the club' },
    gifts:  { href: '/members/gifts',         en: 'Gifts',          vn: 'Qu\u00e0 T\u1eb7ng',          glyph: '\u2766', secondary: 'Gifts from the club' },
  }
  const bucketGroups = [
    { label: 'Explore', tiles: [extra.whisky, extra.finder, byHref['/members/spaces'], byHref['/members/events'], byHref['/members/fixtures'], byHref['/members/journal']] },
    { label: 'You',     tiles: [byHref['/members/profile'], extra.taste, extra.visits, extra.gifts] },
    { label: 'House',   tiles: [extra.menus, byHref['/members/rules'], extra.terms, byHref['/members/contact']] },
  ].map(g => ({ ...g, tiles: g.tiles.filter(Boolean) }))

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

        /* ── Top row: Tonight + Notice Board side by side ── */
        .members-top-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin: 32px 0 40px;
          align-items: stretch;
        }
        .members-top-cell { min-width: 0; }

        /* ── Notice Board — corkboard with pinned paper ── */
        .notice-cork {
          position: relative;
          padding: 16px 20px 16px;
          height: 100%;
          border-radius: 8px;
          background:
            radial-gradient(circle at 22% 18%, rgba(255,235,200,0.10), transparent 35%),
            radial-gradient(circle at 78% 72%, rgba(0,0,0,0.18), transparent 50%),
            #8B6F47;
          box-shadow:
            inset 0 0 22px rgba(0,0,0,0.32),
            inset 0 0 0 6px #4F3A24,
            0 4px 14px rgba(0,0,0,0.25);
          overflow: hidden;
          isolation: isolate;
        }
        .notice-cork::after {
          /* Faint speckled cork texture */
          content: '';
          position: absolute; inset: 8px;
          background-image:
            radial-gradient(rgba(0,0,0,0.18) 0.7px, transparent 0.8px),
            radial-gradient(rgba(255,255,255,0.08) 0.6px, transparent 0.7px);
          background-size: 7px 7px, 11px 11px;
          background-position: 0 0, 3px 5px;
          opacity: 0.6;
          pointer-events: none;
          z-index: -1;
        }
        .notice-pin {
          position: absolute;
          top: 14px; right: 14px;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, #F8C16A, #B8862B 65%, #6E4F12);
          box-shadow:
            0 1px 2px rgba(0,0,0,0.5),
            0 0 0 1px rgba(0,0,0,0.25);
          z-index: 2;
        }
        .notice-paper {
          position: relative;
          background: linear-gradient(180deg, #F8EFDD 0%, #ECDFC4 100%);
          border-radius: 4px;
          padding: 14px 16px 16px;
          margin-top: 4px;
          box-shadow:
            0 2px 4px rgba(0,0,0,0.18),
            0 6px 14px rgba(0,0,0,0.22);
          transform: rotate(-0.6deg);
          transition: transform 0.4s ease;
          min-height: 64px;
        }
        a:hover .notice-paper { transform: rotate(0deg) translateY(-1px); }
        .notice-chev {
          background: rgba(248,239,221,0.9);
          color: #4A3B2E;
          border: 1px solid rgba(0,0,0,0.15);
          border-radius: 4px;
          padding: 2px 8px;
          font-family: 'Rampant Sans', serif;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          opacity: 0.85;
          transition: opacity 0.2s, background 0.2s;
        }
        .notice-chev:hover { opacity: 1; background: #F8EFDD; }
        .notice-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: #2A1F18;
          transition: opacity 0.3s;
        }

        /* ── Section label (Explore / You / House) — mirrors the nav groups ── */
        .members-section-label {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #D4B85A;
          opacity: 0.7;
          margin: 28px 0 12px;
        }
        .members-section-label:first-of-type { margin-top: 4px; }

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
          font-size: 24px;
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
          font-size: 20px;
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
        @media (max-width: 760px) {
          .members-top-row { grid-template-columns: 1fr; gap: 12px; }
        }
        @media (max-width: 600px) {
          .members-container { padding: 80px 20px 60px; }
          .members-greeting { font-size: 28px; }
          .members-bucket-grid { grid-template-columns: 1fr; gap: 10px; }
          .members-bucket { min-height: auto; padding: 18px 18px 20px; }
        }
      ` }} />

      <WelcomeTour name={firstName} />

      <div className="members-page">
        <div className="members-grain" />
        <div className="members-container">
          <h1 className="members-greeting">{greeting}</h1>
          {summary && <p className="members-email">{summary}</p>}
          {!summary && <p className="members-email">{email}</p>}

          <div className="members-top-row">
            <div className="members-top-cell">
              <TonightPanel showClubhouseCount bg="green" />
            </div>

            {notices.length > 0 && (
              <Link
                href="/members/notices"
                style={{ textDecoration: 'none', display: 'block', position: 'relative', zIndex: 9001 }}
                className="members-top-cell"
              >
                <div className="notice-cork">
                  {/* Brass push-pin */}
                  <span className="notice-pin" aria-hidden />
                  <div style={{
                    fontFamily: "'Rampant Sans', serif", fontSize: 16,
                    color: '#3E2D1F', letterSpacing: '0.06em',
                    marginBottom: 12, fontWeight: 600,
                  }}>
                    Notice Board
                  </div>
                <div className="notice-paper">
                  {notices.map((n, i) => (
                    <div key={n.id} style={{
                      opacity: i === activeNotice ? 1 : 0,
                      position: i === activeNotice ? 'relative' : 'absolute',
                      top: i === activeNotice ? undefined : 14,
                      left: i === activeNotice ? undefined : 14,
                      right: i === activeNotice ? undefined : 14,
                      transition: 'opacity 0.6s ease',
                    }}>
                      <div style={{
                        fontFamily: "'Rampant Sans', serif", fontSize: 14, fontWeight: 600,
                        color: '#2A1F18', marginBottom: 4,
                      }}>
                        {n.title}
                      </div>
                      <div style={{
                        fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                        color: '#4A3B2E', opacity: 0.85, lineHeight: 1.55,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {n.body}
                      </div>
                    </div>
                  ))}
                </div>
                {notices.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => { e.preventDefault(); setActiveNotice(prev => (prev - 1 + notices.length) % notices.length) }}
                      className="notice-chev"
                    >‹</button>
                    {notices.map((_, i) => (
                      <div key={i} className="notice-dot" style={{ opacity: i === activeNotice ? 0.7 : 0.2 }} />
                    ))}
                    <button
                      onClick={(e) => { e.preventDefault(); setActiveNotice(prev => (prev + 1) % notices.length) }}
                      className="notice-chev"
                    >›</button>
                  </div>
                )}
              </div>
            </Link>
            )}
          </div>

          {bucketGroups.map(group => (
            <div key={group.label}>
              <div className="members-section-label">{group.label}</div>
              <div className="members-bucket-grid">
                {group.tiles.map(b => (
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
            </div>
          ))}

          <div className="members-diamond" />
        </div>
      </div>
    </>
  )
}
