'use client'

import { surfaceName } from '@/lib/members/surfaces'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import TonightPanel from '@/components/TonightPanel'
import AnticipationCard from '@/components/members/AnticipationCard'
import ReturnCard from '@/components/members/ReturnCard'
import CorkBoard, { type BoardNotice } from '@/components/members/CorkBoard'
import EmptyState from '@/components/members/EmptyState'
import { typeLabel } from '@/lib/fixtures'
import { Skeleton } from '@/components/members/Skeleton'
import { useLang } from '@/lib/lang'
import { PublicPage, type Ink } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// ═══════════════════════════════════════════════════════════════════════════
// THE MEMBER DASHBOARD — the most-seen page in the house.
// ───────────────────────────────────────────────────────────────────────────
// It was a stack of boxes: a small greeting, a corkboard carousel in a brown
// frame, and seventeen photographic tiles under dark veils. Now it is set like
// the public site: the greeting LARGE, a still life of the house's ink at rest
// beside it, the Tonight board, the new cork board, and the whole portal as an
// index — each group under its own drawing, each place a line of type over a
// hairline, its picture arriving only when you point at it.

interface NextFixture {
  id: string
  type: string
  title: string
  date: string
  location: string | null
}

// The still life beside the greeting — things left on a table at the end of a
// good evening (the homepage hero's idea, re-inked for the green).
const STILL: { name: Ink; w: string; top: string; left: string; rot: number; dur: number; delay: number; z?: number }[] = [
  { name: 'lion-lounging', w: '66%', top: '34%', left: '18%', rot: -4,  dur: 9,   delay: .25, z: 2 },
  { name: 'glass',         w: '22%', top: '0%',  left: '66%', rot: 7,   dur: 7.5, delay: .4 },
  { name: 'cigar',         w: '24%', top: '6%',  left: '16%', rot: -16, dur: 8,   delay: .5 },
  { name: 'sunglasses',    w: '25%', top: '80%', left: '66%', rot: 10,  dur: 6.5, delay: .6 },
]

// Each group of the index hangs under one drawing.
const GROUP_INK: Record<string, Ink> = {
  "What's On": 'girl-toast',
  'The Club':  'butler-tray',
  'Whisky':    'lion-bottle',
  'You':       'key',
  'Info':      'newspaper',
}

export default function MembersPage() {
  const { t, lang } = useLang()
  // The hour, not the greeting text — the words are composed at render so they
  // follow the EN/VN switch instead of being frozen in whichever language loaded.
  const [greetHour, setGreetHour] = useState<number | null>(null)
  const [firstName, setFirstName] = useState<string | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [memberNo, setMemberNo] = useState<string | null>(null)
  const [lockerNumber, setLockerNumber] = useState<string | null>(null)
  const [preferredDram, setPreferredDram] = useState<string | null>(null)
  const [notices, setNotices] = useState<BoardNotice[]>([])
  const [noticesLoaded, setNoticesLoaded] = useState(false)
  const [nextFixture, setNextFixture] = useState<NextFixture | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    // Show the time greeting AT ONCE. It needs no network, and waiting for the
    // profile left the heading empty for two chained round trips — which reads
    // as a missing greeting rather than a loading one.
    setGreetHour(new Date().getHours())

    const supabase = createBrowserSupabaseClient()

    // Fetch notices
    supabase.from('notices').select('id, title, body, category, pinned, author, created_at')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setNotices(data as BoardNotice[]); setNoticesLoaded(true) })

    // Fetch next upcoming fixture
    supabase.from('fixtures')
      .select('id, type, title, date, location')
      .gte('date', new Date().toISOString())
      .order('date', { ascending: true })
      .limit(1)
      .then(({ data }) => { if (data && data.length) setNextFixture(data[0] as NextFixture) })

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setProfileLoaded(true); return }
      setEmail(data.user.email || '')
      supabase.from('profiles').select('display_name, member_no, preferred_dram, locker_number').eq('id', data.user.id).single()
        .then(({ data: profile }) => {
          const name = profile?.display_name
          if (name) {
            // The whole display name (e.g. "Mr Rooney") — the first word alone
            // can be just an honorific, so greet with the full name.
            setFirstName(name)
          }
          if (profile?.member_no) setMemberNo(profile.member_no)
          if (profile?.locker_number) setLockerNumber(profile.locker_number)
          if (profile?.preferred_dram) setPreferredDram(profile.preferred_dram)
          setProfileLoaded(true)
        }, () => setProfileLoaded(true))
    })
  }, [])

  const timeGreeting = greetHour === null ? ''
    : greetHour < 12 ? t('Good morning', 'Chào buổi sáng')
    : greetHour < 17 ? t('Good afternoon', 'Chào buổi chiều')
    : t('Good evening', 'Chào buổi tối')
  const greeting = timeGreeting && firstName ? `${timeGreeting}, ${firstName}` : timeGreeting

  const summary = [
    memberNo && t(`Member No. ${memberNo.replace(/^TRC-M/i, '')}`, `Số thành viên ${memberNo.replace(/^TRC-M/i, '')}`),
    lockerNumber && t(`Locker ${lockerNumber}`, `Tủ khóa ${lockerNumber}`),
    preferredDram && t(`Dram of choice: ${preferredDram}`, `Ly ưa thích: ${preferredDram}`),
  ].filter(Boolean).join(' · ')

  const dateLocale = lang === 'vn' ? 'vi-VN' : 'en-GB'
  const fmtDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
      + ' \u00b7 '
      + dt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
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

  // 'trc/…' names are the club's own photographs (public/images/trc); the
  // rest are the older social set.
  const IMG = (n: string) => n.startsWith('trc/') ? `/images/${n}-800.webp` : `/images/social/${n}.webp`

  const buckets: Bucket[] = [
    {
      href: '/members/events',
      img: IMG('trc/gala-cheer'),
      en: surfaceName('/members/events', 'en'),
      vn: surfaceName('/members/events', 'vn'),
      icon: 'calendar',
      primary: nextFixture ? typeLabel(nextFixture.type, lang) : undefined,
      secondary: nextFixture ? fmtDate(nextFixture.date) : t("What's on \u00b7 sign-ups \u00b7 sports", 'Sự kiện \u00b7 đăng ký \u00b7 thể thao'),
    },
    {
      href: '/members/profile',
      img: IMG('trc/card-lemon'),
      en: surfaceName('/members/profile', 'en'),
      vn: surfaceName('/members/profile', 'vn'),
      icon: 'card',
      primary: memberNo ? '#' + memberNo.replace(/^TRC-M/i, '') : '\u2014',
      secondary: lockerNumber ? t('Locker ', 'Tủ khóa ') + lockerNumber : (preferredDram ? t('Dram: ', 'Ly: ') + preferredDram : t('Your details', 'Thông tin của bạn')),
    },
    {
      href: '/members/fixtures',
      img: IMG('trc/cup-high-five'),
      en: surfaceName('/members/fixtures', 'en'),
      vn: surfaceName('/members/fixtures', 'vn'),
      icon: 'trophy',
      primary: nextFixture ? typeLabel(nextFixture.type, lang) : t('No upcoming', 'Chưa có lịch'),
      secondary: nextFixture ? fmtDate(nextFixture.date) : t('Check the schedule', 'Xem lịch thi đấu'),
    },
    {
      href: '/members/journal',
      img: IMG('trc/glass-script'),
      en: surfaceName('/members/journal', 'en'),
      vn: surfaceName('/members/journal', 'vn'),
      icon: 'quill',
      secondary: t('Tasting notes & long-form whisky writing', 'Ghi chú nếm thử & bài viết chuyên sâu về whisky'),
    },
    {
      href: '/members/spaces',
      img: IMG('trc/bar-cart'),
      en: surfaceName('/members/spaces', 'en'),
      vn: surfaceName('/members/spaces', 'vn'),
      icon: 'building',
      secondary: 'Library Bar \u00b7 Studio \u00b7 Rampant Room',
    },
    {
      href: '/members/rules',
      img: IMG('trc/club-booklet'),
      en: surfaceName('/members/rules', 'en'),
      vn: surfaceName('/members/rules', 'vn'),
      icon: 'book',
      secondary: t("The club's operating principles", 'Nguyên tắc hoạt động của câu lạc bộ'),
    },
    {
      href: '/members/contact',
      img: IMG('saigon-street'),
      en: surfaceName('/members/contact', 'en'),
      vn: surfaceName('/members/contact', 'vn'),
      icon: 'mail',
      secondary: t('Address & member hotline', 'Địa chỉ & đường dây nóng thành viên'),
    },
  ]

  // Mirror the nav's Explore / You / House groups so the two surfaces agree.
  // Whisky Library is the prominent first Explore tile (it had none before).
  const byHref = Object.fromEntries(buckets.map(b => [b.href, b])) as Record<string, Bucket>
  const extra: Record<string, Bucket> = {
    snug:   { href: '/members/snug', img: IMG('whisky-lounge'),          en: surfaceName('/members/snug', 'en'),       vn: surfaceName('/members/snug', 'vn'),       icon: 'sofa', secondary: t('The club in conversation \u2014 drams, moments, a word between members', 'Câu lạc bộ trò chuyện \u2014 những ly rượu, khoảnh khắc, đôi lời giữa các thành viên') },
    concierge: { href: '/members/concierge', img: IMG('trc/decanter-pour'), en: surfaceName('/members/concierge', 'en'),  vn: surfaceName('/members/concierge', 'vn'),          icon: 'bell', secondary: t('A line to the Club \u2014 requests, bottles, a word about the evening', 'Đường dây riêng tới Câu Lạc Bộ \u2014 yêu cầu, chai rượu, đôi lời về buổi tối') },
    whisky: { href: '/members/whisky', img: IMG('whisky-library'),        en: surfaceName('/members/whisky', 'en'), vn: surfaceName('/members/whisky', 'vn'), icon: 'glass', secondary: t('The shelf \u00b7 radar \u00b7 300+ drams', 'Kệ rượu \u00b7 radar \u00b7 hơn 300 loại') },
    finder: { href: '/members/whisky/finder', img: IMG('trc/octave-glencairn'), en: surfaceName('/members/whisky/finder', 'en'), vn: surfaceName('/members/whisky/finder', 'vn'), icon: 'compass', secondary: t('Match a dram to your taste', 'Tìm ly hợp khẩu vị của bạn') },
    menus:  { href: '/menus', img: IMG('trc/cocktail-pour'),                 en: surfaceName('/menus', 'en'),      vn: surfaceName('/menus', 'vn'),     icon: 'menu', secondary: t('Food & drink lists', 'Thực đơn đồ ăn & thức uống') },
    terms:  { href: '/members/terms', img: IMG('trc/pins-seals'),         en: surfaceName('/members/terms', 'en'),          vn: surfaceName('/members/terms', 'vn'),   icon: 'document', secondary: t('Full terms & conditions', 'Điều khoản & điều kiện đầy đủ') },
    taste:  { href: '/members/taste', img: IMG('bottle-collection'),         en: surfaceName('/members/taste', 'en'),    vn: surfaceName('/members/taste', 'vn'), icon: 'radar', secondary: t('Your taste \u00b7 radar \u00b7 loved drams', 'Khẩu vị \u00b7 radar \u00b7 những ly yêu thích') },
    journey: { href: '/members/journey', img: IMG('trc/cask-lid'),      en: surfaceName('/members/journey', 'en'),   vn: surfaceName('/members/journey', 'vn'), icon: 'flag', secondary: t('Your whisky story over time \u00b7 milestones \u00b7 palate drift', 'Câu chuyện whisky của bạn \u00b7 cột mốc \u00b7 khẩu vị đổi thay') },
    visits: { href: '/members/visits', img: IMG('trc/card-deck'),        en: surfaceName('/members/visits', 'en'),    vn: surfaceName('/members/visits', 'vn'), icon: 'pin', secondary: t('Your record at the club', 'Những lần bạn ghé câu lạc bộ') },
    gifts:  { href: '/members/gifts', img: IMG('trc/pins-dish'),         en: surfaceName('/members/gifts', 'en'),          vn: surfaceName('/members/gifts', 'vn'),          icon: 'gift', secondary: t('Gifts from the club', 'Quà tặng từ câu lạc bộ') },
    gallery: { href: '/members/gallery', img: IMG('trc/gala-arrivals'),     en: surfaceName('/members/gallery', 'en'),  vn: surfaceName('/members/gallery', 'vn'), icon: 'image', secondary: t('Photos & video from fixtures, dinners & socials', 'Ảnh & video từ các trận đấu, bữa tối & buổi gặp mặt') },
  }
  // Tile groups mirror the nav's groups exactly (Whisky · What's On · The Club ·
  // You · Info) so the dashboard and the menu tell the same story. Events and
  // Event Gallery sit next to each other — an event and its photos belong together.
  const bucketGroups = [
    { label: "What's On", vn: 'Sự Kiện',    tiles: [byHref['/members/events'], extra.gallery] },
    { label: 'The Club',  vn: 'Câu Lạc Bộ', tiles: [byHref['/members/spaces'], extra.menus, extra.snug, extra.concierge] },
    { label: 'Whisky',    vn: 'Whisky',     tiles: [extra.whisky, extra.finder, extra.taste, extra.journey] },
    { label: 'You',       vn: 'Bạn',        tiles: [byHref['/members/profile'], extra.visits] },
    { label: 'Info',      vn: 'Thông Tin',  tiles: [byHref['/members/rules'], extra.terms, byHref['/members/contact']] },
  ].map(g => ({ ...g, tiles: g.tiles.filter(Boolean) }))

  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        .members-page { position: relative; color: #E5D4C2; }
        /* the fixed lion (NavOverlay) sits at the right edge, mid-height, on a
           desk wider than 1024 — keep the column clear of it at any width */
        .md-wrap { max-width: 1180px; margin: 0 auto; box-sizing: border-box;
                   padding-left: 24px; padding-right: max(24px, calc(150px - (100vw - 1180px) / 2)); }
        .md-rise { opacity: 0; transform: translateY(22px); animation: pk-rise .9s cubic-bezier(.16,.84,.44,1) both; }

        /* ── the masthead: the greeting large, the still life beside it ── */
        .md-mast { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr); gap: 40px;
                   align-items: center; padding-top: 118px; padding-bottom: 72px; }
        .md-greet { font-family: 'Rampant Sans', serif; font-weight: 400; margin: 0; min-height: .92em;
                    font-size: clamp(46px, 7vw, 100px); line-height: .96; }
        .md-summary { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 13.5px; line-height: 1.9;
                      letter-spacing: .02em; opacity: .85; margin: 24px 0 0; }
        .md-guide-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
        .md-guide { margin-top: 30px; color: #D4B85A; }
        .md-lion-sm { display: none; }

        .md-still { position: relative; aspect-ratio: 1 / .82; width: 92%; margin-left: auto; }
        .md-obj { position: absolute; opacity: 0; transition: opacity 1s ease; }
        .md-obj.is-in { opacity: 1; }

        /* ── the passive cards, Tonight, and the board ── */
        .md-cards:empty { display: none; }
        /* the passive cards each draw the hairline above them; this closes the set */
        .md-cards { margin-bottom: 64px; border-bottom: 1px solid rgba(229,212,194,.18); }
        .md-notices { padding-top: 104px; }
        .md-board-link { display: inline-flex; align-items: baseline; gap: 18px; color: #E5D4C2; text-decoration: none;
                         font-family: 'Rampant Sans', serif; font-weight: 400; font-size: clamp(36px, 5.6vw, 72px);
                         line-height: .98; margin: 0 0 34px; }
        .md-board-link .pk-go { font-family: 'Google Sans Code', monospace; font-size: .42em; color: #D4B85A; }
        .md-board-link:hover .pk-go { transform: translateX(10px); }
        .md-board-link:hover { color: #fff4e6; }
        .md-board { transition: min-height .4s ease; }

        /* ── the index: every place in the portal ── */
        .md-index { padding-top: 120px; padding-bottom: 130px; }
        .md-group { display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); gap: 48px; }
        .md-group + .md-group { margin-top: 88px; }
        .md-group-head { position: relative; }
        .md-group-title { font-family: 'Rampant Sans', serif; font-weight: 400; margin: 0;
                          font-size: clamp(32px, 4vw, 52px); line-height: .96; }
        .md-group-ink { width: 128px; margin-top: 26px; }

        .md-list { list-style: none; margin: 0; padding: 0; border-bottom: 1px solid rgba(229,212,194,.16); }
        .md-row { position: relative; display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr) 24px;
                  gap: 24px; align-items: center; padding: 20px 0; color: #E5D4C2; text-decoration: none;
                  border-top: 1px solid rgba(229,212,194,.16); }
        .md-name { font-family: 'Rampant Sans', serif; font-size: clamp(24px, 2.4vw, 32px); line-height: 1.02;
                   display: block; transition: color .3s ease, transform .45s cubic-bezier(.16,.84,.44,1); }
        .md-alt { font-family: 'Rampant Sans', serif; font-size: 16px; line-height: 1.2; opacity: .55; display: block; margin-top: 6px; }
        .md-primary { display: block; font-family: 'Rampant Sans', serif; font-size: 20px; line-height: 1.1; color: #D4B85A; margin-bottom: 4px; }
        .md-secondary { display: block; font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12.5px; line-height: 1.75; opacity: .85; }
        .md-arrow { font-family: 'Google Sans Code', monospace; font-size: 15px; color: #D4B85A; justify-self: end; }
        /* the place's picture, only when you point at it */
        /* out of the flow, so it never sets the row's height; it may lap the
           hairlines, like a photograph laid on a list */
        .md-pic { position: absolute; right: 48px; top: 50%; z-index: 2; pointer-events: none;
                  width: 120px; aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden;
                  opacity: 0; transform: translateY(-50%) rotate(-3deg) scale(.9);
                  box-shadow: 0 12px 26px rgba(0,0,0,.35);
                  transition: opacity .35s ease, transform .55s cubic-bezier(.16,.84,.44,1); }
        .md-pic img { display: block; width: 100%; height: 100%; object-fit: cover; }
        @media (hover: hover) {
          .md-info { padding-right: 140px; }
          .md-row:hover .md-name, .md-row:focus-visible .md-name { color: #D4B85A; transform: translateX(6px); }
          .md-row:hover .md-pic, .md-row:focus-visible .md-pic { opacity: 1; transform: translateY(-50%) rotate(-3deg) scale(1); }
        }

        @media (max-width: 1024px) {
          .md-group { grid-template-columns: 1fr; gap: 22px; }
          .md-group-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
          .md-group-ink { width: 92px; margin-top: 0; }
        }
        @media (max-width: 860px) {
          .md-wrap { padding-left: 20px; padding-right: 20px; }
          .md-mast { grid-template-columns: 1fr; gap: 0; padding-top: 112px; padding-bottom: 48px; }
          .md-greet { font-size: clamp(40px, 11.5vw, 64px); }
          .md-summary { font-size: 13px; margin-top: 18px; }
          .md-still { display: none; }
          .md-lion-sm { display: block; width: 44%; max-width: 190px; margin-right: -8px; flex: 0 0 auto; }
          .md-guide { margin-top: 22px; }
          .md-cards { margin-bottom: 48px; }
          .md-notices { padding-top: 80px; }
          .md-board-link { margin-bottom: 24px; }
          .md-index { padding-top: 88px; padding-bottom: 96px; }
          .md-group + .md-group { margin-top: 64px; }
          .md-row { grid-template-columns: minmax(0, 1fr) 20px; gap: 6px 14px; padding: 18px 0; }
          .md-name-cell { grid-column: 1; }
          .md-info { grid-column: 1; grid-row: 2; padding-right: 0; }
          .md-pic { display: none; }
          .md-arrow { grid-column: 2; grid-row: 1 / span 2; }
          .md-name { font-size: 26px; }
          .md-alt { font-size: 15px; margin-top: 4px; }
          .md-primary { font-size: 18px; margin-top: 6px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .md-rise { opacity: 1; transform: none; animation: none; }
          .md-obj { transition: none; opacity: 1; }
          .md-name, .md-pic { transition: none; }
        }
      ` }} />
      <CreamInkDefs />

      <div className="members-page">
        <header className="md-wrap md-mast">
          <div>
            <h1 className="md-greet md-rise" style={{ animationDelay: '.04s' }}>{greeting}</h1>
            <div className="md-rise" style={{ animationDelay: '.12s' }}>
              {!profileLoaded
                ? <div style={{ marginTop: 30, paddingBottom: 6 }}><Skeleton width={260} height={12} radius={3} /></div>
                : <p className="md-summary">{summary || email}</p>}
            </div>
            <div className="md-guide-row md-rise" style={{ animationDelay: '.2s' }}>
              <button type="button" className="pk-cta md-guide"
                      onClick={() => window.dispatchEvent(new Event('open-portal-guide'))}>
                {t('◇ Portal guide', '◇ Hướng dẫn')} <span className="pk-go">→</span>
              </button>
              {/* a phone has no empty half — the lion lounges beside the guide */}
              <div className="md-lion-sm" aria-hidden="true">
                <CreamInk name="lion-lounging" width="100%" rot={-4} dur={9} />
              </div>
            </div>
          </div>

          <div className="md-still" aria-hidden="true">
            {STILL.map(o => (
              <div key={o.name} className={`md-obj ${greetHour !== null ? 'is-in' : ''}`}
                   style={{ width: o.w, top: o.top, left: o.left, zIndex: o.z ?? 1, transitionDelay: `${o.delay}s` }}>
                <CreamInk name={o.name} width="100%" rot={o.rot} dur={o.dur} />
              </div>
            ))}
          </div>
        </header>

        <div className="md-wrap">
          <div className="md-cards">
            <AnticipationCard />
            <ReturnCard />
          </div>

          <section className="md-rise" style={{ animationDelay: '.26s' }}>
            <TonightPanel showClubhouseCount bg="green" />
          </section>

          <section className="md-notices">
            <Link href="/members/notices" className="md-board-link">
              {t('The Notice Board', surfaceName('/members/notices', 'vn'))} <span className="pk-go">→</span>
            </Link>
            <div className="md-board" style={{ minHeight: noticesLoaded ? 0 : 240 }}>
              {noticesLoaded && (
                <CorkBoard notices={notices} compact
                           empty={<EmptyState title={t('The board is quiet', 'Bảng tin đang yên ắng')} />} />
              )}
            </div>
          </section>

          <div className="md-index">
            {bucketGroups.map(group => (
              <section key={group.label} className="md-group">
                <div className="md-group-head">
                  <h2 className="md-group-title">{t(group.label, group.vn)}</h2>
                  {GROUP_INK[group.label] && (
                    <div className="md-group-ink">
                      <CreamInk name={GROUP_INK[group.label]} width="100%" rot={-5} dur={8.5} />
                    </div>
                  )}
                </div>
                <ul className="md-list">
                  {group.tiles.map(b => (
                    <li key={b.href}>
                      <Link href={b.href} className="md-row pk-hover">
                        <span className="md-name-cell">
                          {/* VN promotes the Vietnamese name to the heading and demotes the
                              English beneath it — the same swap MemberPage does. */}
                          <span className="md-name">{lang === 'vn' ? b.vn : b.en}</span>
                          <span className="md-alt">{lang === 'vn' ? b.en : b.vn}</span>
                        </span>
                        <span className="md-info">
                          {b.primary && <span className="md-primary">{b.primary}</span>}
                          {b.secondary && <span className="md-secondary">{b.secondary}</span>}
                        </span>
                        <span className="md-pic" aria-hidden="true">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {b.img && <img src={b.img} alt="" loading="lazy" />}
                        </span>
                        <span className="md-arrow pk-go" aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </PublicPage>
  )
}
