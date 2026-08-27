'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import TonightPanel from '@/components/TonightPanel'
import WelcomeTour from '@/components/WelcomeTour'
import AnticipationCard from '@/components/members/AnticipationCard'
import ReturnCard from '@/components/members/ReturnCard'

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

// Monochrome line icons for the dashboard tiles — one consistent set, drawn as
// strokes (never emoji), matching the admin nav's icon language so the two
// surfaces feel like one product. viewBox 0 0 16 16.
const TILE_ICONS: Record<string, string> = {
  calendar: '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.2h12M5.5 2v2M10.5 2v2"/>',
  card:     '<rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M2 6.8h12M4.3 9.6h3"/>',
  trophy:   '<path d="M5 3h6v2.6a3 3 0 01-6 0z"/><path d="M5 3.8H3.4a1.6 1.6 0 001.8 2.4M11 3.8h1.6a1.6 1.6 0 01-1.8 2.4"/><path d="M8 8.4v2.1M6 13.2h4M6.4 13.2c0-1.1.7-2 1.6-2s1.6.9 1.6 2"/>',
  quill:    '<path d="M13 3C8 3.5 5.5 6 4 10l2 2c4-1.5 6.5-4 7-9z"/><path d="M4 10l-1.4 3.4M6.2 8.4h2.2"/>',
  building: '<rect x="3.5" y="2.5" width="9" height="11" rx="1"/><path d="M3.5 6h9M3.5 9.5h9M6.6 13.5V11h2.8v2.5"/>',
  book:     '<path d="M8 4C6.5 3 4 3 2.5 3.7v8.6C4 11.6 6.5 11.6 8 12.6c1.5-1 4-1 5.5-.3V3.7C12 3 9.5 3 8 4z"/><path d="M8 4v8.6"/>',
  mail:     '<rect x="2.5" y="4" width="11" height="8" rx="1.5"/><path d="M3 5l5 4 5-4"/>',
  sofa:     '<path d="M4 8V6.6A1.6 1.6 0 015.6 5h4.8A1.6 1.6 0 0112 6.6V8"/><path d="M2.8 8.4A1.4 1.4 0 014.2 9.8V11h7.6V9.8a1.4 1.4 0 011.4-1.4V10a1.5 1.5 0 01-1.5 1.5v.9M4 11.5v.9"/>',
  bell:     '<path d="M4.2 7a3.8 3.8 0 017.6 0c0 2.8 1 3.7 1 3.7H3.2s1-.9 1-3.7z"/><path d="M6.6 12.6a1.5 1.5 0 002.8 0"/>',
  glass:    '<path d="M5 3h6l-.55 9.4a1 1 0 01-1 .95H6.55a1 1 0 01-1-.95z"/><path d="M5.25 7.2h5.5"/>',
  compass:  '<circle cx="8" cy="8" r="5.6"/><path d="M10.3 5.7L8.7 8.7 5.7 10.3 7.3 7.3z"/>',
  menu:     '<path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6"/>',
  document: '<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/><path d="M6 8.2h4M6 10.6h4"/>',
  radar:    '<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.7"/>',
  flag:     '<path d="M4 13.5V2.6"/><path d="M4 3.2h6.5l-1.4 2.1 1.4 2.1H4"/>',
  star:     '<path d="M8 2.6l1.6 3.2 3.5.5-2.6 2.5.6 3.5L8 10.6l-3.1 1.7.6-3.5L2.9 6.3l3.5-.5z"/>',
  pin:      '<path d="M8 14s4.4-3.9 4.4-7.4a4.4 4.4 0 10-8.8 0C3.6 10.1 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
  gift:     '<rect x="2.6" y="6" width="10.8" height="7.4" rx="1"/><path d="M2 6h12M8 6v7.4M5.6 6a1.7 1.7 0 110-3.4C7 2.6 8 6 8 6M10.4 6a1.7 1.7 0 100-3.4C9 2.6 8 6 8 6"/>',
  image:    '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.1"/><path d="M2.5 11.5l3.2-3 2.3 2 2.2-2.4 3.3 3.4"/>',
}

function TileIcon({ name }: { name: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: TILE_ICONS[name] || TILE_ICONS.card }} aria-hidden />
  )
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
    icon: string
    img?: string
    primary?: string
    secondary?: string
  }

  const IMG = (n: string) => `/images/social/${n}.webp`

  const buckets: Bucket[] = [
    {
      href: '/members/events',
      img: IMG('cocktails'),
      en: 'Events',
      vn: 'S\u1ef1 ki\u1ec7n',
      icon: 'calendar',
      secondary: "What's on & sign-ups",
    },
    {
      href: '/members/profile',
      img: IMG('lion-crest'),
      en: 'My Membership',
      vn: 'T\u01b0 C\u00e1ch Th\u00e0nh Vi\u00ean',
      icon: 'card',
      primary: memberNo ? '#' + memberNo.replace(/^TRC-M/i, '') : '\u2014',
      secondary: lockerNumber ? 'Locker ' + lockerNumber : (preferredDram ? 'Dram: ' + preferredDram : 'Your details'),
    },
    {
      href: '/members/fixtures',
      img: IMG('tennis-visor'),
      en: 'Sports Fixtures',
      vn: 'L\u1ecbch Thi \u0110\u1ea5u',
      icon: 'trophy',
      primary: nextFixture ? nextFixture.sport.charAt(0).toUpperCase() + nextFixture.sport.slice(1) : 'No upcoming',
      secondary: nextFixture ? fmtDate(nextFixture.date) : 'Check the schedule',
    },
    {
      href: '/members/journal',
      img: IMG('springbank'),
      en: "Cellarmaster's Journal",
      vn: 'Nhật Ký Cellarmaster',
      icon: 'quill',
      secondary: 'Tasting notes & long-form whisky writing',
    },
    {
      href: '/members/spaces',
      img: IMG('gala-table'),
      en: 'Spaces & Menus',
      vn: 'Kh\u00f4ng gian & Th\u1ef1c \u0111\u01a1n',
      icon: 'building',
      secondary: 'Library Bar \u00b7 Studio \u00b7 Rampant Room',
    },
    {
      href: '/members/rules',
      img: IMG('lion-crest'),
      en: 'House Rules',
      vn: 'N\u1ed9i Quy',
      icon: 'book',
      secondary: "The club's operating principles",
    },
    {
      href: '/members/contact',
      img: IMG('saigon-street'),
      en: 'Contact',
      vn: 'Li\u00ean h\u1ec7',
      icon: 'mail',
      secondary: 'Address & member hotline',
    },
  ]

  // Mirror the nav's Explore / You / House groups so the two surfaces agree.
  // Whisky Library is the prominent first Explore tile (it had none before).
  const byHref = Object.fromEntries(buckets.map(b => [b.href, b])) as Record<string, Bucket>
  const extra: Record<string, Bucket> = {
    snug:   { href: '/members/snug', img: IMG('whisky-lounge'),          en: 'The Snug',       vn: 'Ph\u00f2ng Kh\u00e1ch',       icon: 'sofa', secondary: 'The club in conversation \u2014 drams, moments, a word between members' },
    concierge: { href: '/members/concierge', img: IMG('ao-dai'), en: 'The Concierge',  vn: 'Qu\u1ea3n Gia',          icon: 'bell', secondary: 'A line to the Club \u2014 requests, bottles, a word about the evening' },
    whisky: { href: '/members/whisky', img: IMG('whisky-library'),        en: 'Whisky Library', vn: 'Th\u01b0 Vi\u1ec7n Whisky', icon: 'glass', secondary: 'The shelf \u00b7 radar \u00b7 300+ drams' },
    finder: { href: '/members/whisky/finder', img: IMG('art-bottles'), en: 'Flavour Finder', vn: 'T\u00ecm Ly C\u1ee7a B\u1ea1n', icon: 'compass', secondary: 'Match a dram to your taste' },
    menus:  { href: '/menus', img: IMG('gala-table'),                 en: 'The Menus',      vn: 'Th\u1ef1c \u0110\u01a1n',     icon: 'menu', secondary: 'Food & drink lists' },
    terms:  { href: '/members/terms', img: IMG('springbank'),         en: 'Terms',          vn: '\u0110i\u1ec1u Kho\u1ea3n',   icon: 'document', secondary: 'Full terms & conditions' },
    taste:  { href: '/members/taste', img: IMG('bottle-collection'),         en: 'Your Palate',    vn: 'Kh\u1ea9u V\u1ecb C\u1ee7a B\u1ea1n', icon: 'radar', secondary: 'Your taste \u00b7 radar \u00b7 loved drams' },
    journey: { href: '/members/journey', img: IMG('saigon-street'),      en: 'Your Journey',   vn: 'H\u00e0nh Tr\u00ecnh', icon: 'flag', secondary: 'Your whisky story over time \u00b7 milestones \u00b7 palate drift' },
    visits: { href: '/members/visits', img: IMG('market'),        en: 'Your Visits',    vn: 'Nh\u1eefng L\u1ea7n Gh\u00e9 Th\u0103m', icon: 'pin', secondary: 'Your record at the club' },
    gifts:  { href: '/members/gifts', img: IMG('brass-pin'),         en: 'Gifts',          vn: 'Qu\u00e0 T\u1eb7ng',          icon: 'gift', secondary: 'Gifts from the club' },
    gallery: { href: '/members/gallery', img: IMG('gala-table'),     en: 'Event Gallery',  vn: 'Th\u01b0 Vi\u1ec7n S\u1ef1 Ki\u1ec7n', icon: 'image', secondary: 'Photos & video from fixtures, dinners & socials' },
  }
  const bucketGroups = [
    { label: 'Explore', tiles: [extra.snug, extra.whisky, extra.finder, byHref['/members/spaces'], byHref['/members/events'], byHref['/members/fixtures'], extra.gallery] },
    { label: 'You',     tiles: [extra.concierge, byHref['/members/profile'], extra.taste, extra.journey, extra.visits] },
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

        @keyframes tileRise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        .members-bucket {
          position: relative;
          padding: 24px 22px 28px;
          background: rgba(229, 212, 194, 0.04);
          border: 1px solid rgba(229, 212, 194, 0.10);
          border-radius: 14px;
          animation: tileRise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
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

        /* Photographic layer + gradient veil that keeps text legible */
        .members-bucket-img {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.5;
          transform: scale(1.04);
          transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease;
          z-index: 0;
        }
        .members-bucket-veil {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            165deg,
            rgba(5, 46, 32, 0.58) 0%,
            rgba(5, 46, 32, 0.74) 52%,
            rgba(5, 46, 32, 0.92) 100%
          );
        }
        .members-bucket:hover .members-bucket-img {
          transform: scale(1.1);
          opacity: 0.66;
        }
        .members-bucket-body {
          position: relative;
          z-index: 2;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .members-bucket-body .members-bucket-emblem { color: #E7C766; }
        .members-bucket-body .members-bucket-en { text-shadow: 0 1px 10px rgba(0,0,0,0.55); }
        .members-bucket-body .members-bucket-vn,
        .members-bucket-body .members-bucket-secondary { opacity: 0.82; text-shadow: 0 1px 8px rgba(0,0,0,0.5); }
        .members-bucket-body .members-bucket-primary { text-shadow: 0 1px 10px rgba(0,0,0,0.5); }

        /* Icon emblem — a hairline-gold medallion so every tile carries the
           same crest-like mark. Consistent, bordered, never emoji. */
        .members-bucket-emblem {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #D4B85A;
          background: rgba(212,184,90,0.08);
          border: 1px solid rgba(212,184,90,0.35);
          box-shadow: 0 2px 10px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(5,46,32,0.4);
          margin-bottom: 16px;
          transition: border-color 0.3s ease, background 0.3s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1);
        }
        .members-bucket:hover .members-bucket-emblem {
          border-color: rgba(231,199,102,0.75);
          background: rgba(212,184,90,0.14);
          transform: translateY(-1px);
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
        @media (prefers-reduced-motion: reduce) {
          .members-bucket { animation: none; }
        }
      ` }} />

      <WelcomeTour name={firstName} />

      <div className="members-page">
        <div className="members-grain" />
        <div className="members-container">
          <h1 className="members-greeting">{greeting}</h1>
          {summary && <p className="members-email">{summary}</p>}
          {!summary && <p className="members-email">{email}</p>}

          <AnticipationCard />
          <ReturnCard />

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
                {group.tiles.map((b, i) => (
                  <Link key={b.href} href={b.href} className="members-bucket" style={{ animationDelay: `${i * 45}ms` }}>
                    {b.img && <span className="members-bucket-img" style={{ backgroundImage: `url(${b.img})` }} aria-hidden />}
                    <span className="members-bucket-veil" aria-hidden />
                    <div className="members-bucket-body">
                      <div className="members-bucket-emblem" aria-hidden><TileIcon name={b.icon} /></div>
                      <div className="members-bucket-en">{b.en}</div>
                      <div className="members-bucket-vn">{b.vn}</div>
                      {b.primary && <div className="members-bucket-primary">{b.primary}</div>}
                      {b.secondary && <div className="members-bucket-secondary">{b.secondary}</div>}
                      <div className="members-bucket-arrow">&rarr;</div>
                    </div>
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
