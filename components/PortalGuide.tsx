'use client'

import { surfaceName } from '@/lib/members/surfaces'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// The members' portal training — a clean, linear flow. Mounted in the member
// layout so it's on every page: opens automatically the first time, replayable
// via the ◇ Portal guide button / the menu / a ?guide=1 URL / the
// 'open-portal-guide' event. One photo-led screen per area with short lines;
// members step through it all, then jump in from the final screen.

const SEEN_KEY = 'rampant.portalguide.v2'
// The language now comes from the ONE shared context (lib/lang.tsx). This
// component used to carry its own Lang type and its own localStorage key —
// a third implementation of the same idea. The old key is migrated on read by
// the provider, so a member who chose Vietnamese here keeps it.
interface L { en: string; vn: string }
const IMG = (n: string) => n.startsWith('trc/') ? `/images/${n}-800.webp` : `/images/social/${n}.webp`

const ICONS: Record<string, string> = {
  home: '<path d="M3 7.5L8 3.5l5 4"/><path d="M4.2 6.8V13h7.6V6.8"/><path d="M6.8 13V9.5h2.4V13"/>',
  menu: '<path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6"/>',
  glass: '<path d="M5 3h6l-.55 9.4a1 1 0 01-1 .95H6.55a1 1 0 01-1-.95z"/><path d="M5.25 7.2h5.5"/>',
  compass: '<circle cx="8" cy="8" r="5.6"/><path d="M10.3 5.7L8.7 8.7 5.7 10.3 7.3 7.3z"/>',
  radar: '<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.7"/>',
  quill: '<path d="M13 3C8 3.5 5.5 6 4 10l2 2c4-1.5 6.5-4 7-9z"/><path d="M4 10l-1.4 3.4M6.2 8.4h2.2"/>',
  flag: '<path d="M4 13.5V2.6"/><path d="M4 3.2h6.5l-1.4 2.1 1.4 2.1H4"/>',
  calendar: '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.2h12M5.5 2v2M10.5 2v2"/>',
  image: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.1"/><path d="M2.5 11.5l3.2-3 2.3 2 2.2-2.4 3.3 3.4"/>',
  pin: '<path d="M8 14s4.4-3.9 4.4-7.4a4.4 4.4 0 10-8.8 0C3.6 10.1 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
  building: '<rect x="3.5" y="2.5" width="9" height="11" rx="1"/><path d="M3.5 6h9M3.5 9.5h9M6.6 13.5V11h2.8v2.5"/>',
  sofa: '<path d="M4 8V6.6A1.6 1.6 0 015.6 5h4.8A1.6 1.6 0 0112 6.6V8"/><path d="M2.8 8.4A1.4 1.4 0 014.2 9.8V11h7.6V9.8a1.4 1.4 0 011.4-1.4V10a1.5 1.5 0 01-1.5 1.5v.9M4 11.5v.9"/>',
  bell: '<path d="M4.2 7a3.8 3.8 0 017.6 0c0 2.8 1 3.7 1 3.7H3.2s1-.9 1-3.7z"/><path d="M6.6 12.6a1.5 1.5 0 002.8 0"/>',
  people: '<circle cx="6" cy="6" r="2.1"/><path d="M2.6 13a3.4 3.4 0 016.8 0"/><path d="M11 4.4a2 2 0 010 3.9M11.6 13a3.3 3.3 0 00-1.1-2.4"/>',
  introduce: '<circle cx="6.2" cy="6" r="2.1"/><path d="M2.8 13a3.4 3.4 0 016.8 0"/><path d="M11.5 5.5v4M9.5 7.5h4"/>',
  chat: '<path d="M3 4h10a1 1 0 011 1v5a1 1 0 01-1 1H6l-3 2.5V5a1 1 0 011-1z"/>',
  card: '<rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M2 6.8h12M4.3 9.6h3"/>',
  clock: '<circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2.1 1.3"/>',
  book: '<path d="M8 4C6.5 3 4 3 2.5 3.7v8.6C4 11.6 6.5 11.6 8 12.6c1.5-1 4-1 5.5-.3V3.7C12 3 9.5 3 8 4z"/><path d="M8 4v8.6"/>',
  document: '<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/><path d="M6 8.2h4M6 10.6h4"/>',
  mail: '<rect x="2.5" y="4" width="11" height="8" rx="1.5"/><path d="M3 5l5 4 5-4"/>',
}
const Icon = ({ n, size = 15 }: { n: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[n] || ICONS.home }} aria-hidden />
)

interface Item { icon: string; name: L; line: L }
interface Slide { key: string; icon: string; image: string; title: L; blurb: L; items: Item[] }

// Short, plain one-liners. One photo-led screen per area.
const SLIDES: Slide[] = [
  { key: 'start', icon: 'home', image: 'trc/card-tees', title: { en: 'Getting around', vn: 'Cách dùng' },
    blurb: { en: 'Two ways to move around — the picture tiles, and the menu.', vn: 'Hai cách di chuyển — các ô hình, và menu.' },
    items: [
      { icon: 'home', name: { en: 'The home tiles', vn: 'Ô trang chủ' }, line: { en: 'Tap any picture to open that part of the club.', vn: 'Chạm một hình để mở phần đó.' } },
      { icon: 'menu', name: { en: 'The menu (≡)', vn: 'Menu (≡)' }, line: { en: 'The button up top opens the full menu, on any page.', vn: 'Nút phía trên mở menu đầy đủ, trên mọi trang.' } },
    ] },
  { key: 'whisky', icon: 'glass', image: 'trc/ags-bottle', title: { en: 'Whisky', vn: 'Whisky' },
    blurb: { en: 'Explore whisky — the app learns what you like as you go.', vn: 'Khám phá whisky — ứng dụng học gu của bạn.' },
    items: [
      { icon: 'glass', name: { en: 'Whisky Library', vn: 'Thư Viện Whisky' }, line: { en: 'Browse every bottle we pour — search, read members’ notes.', vn: 'Duyệt mọi chai — tìm kiếm, đọc ghi chú hội viên.' } },
      { icon: 'compass', name: { en: 'Flavour Finder', vn: 'Tìm Ly Của Bạn' }, line: { en: 'Tell it what you fancy; it finds bottles that match.', vn: 'Cho biết bạn thích gì; nó tìm chai phù hợp.' } },
      { icon: 'radar', name: { en: 'Your Palate', vn: 'Khẩu Vị' }, line: { en: 'A chart of your taste — it builds itself from your notes.', vn: 'Biểu đồ gu của bạn — tự dựng từ ghi chú.' } },
      { icon: 'quill', name: { en: 'Your Notes', vn: 'Ghi Chú' }, line: { en: 'Jot what you thought of a dram, like a diary.', vn: 'Ghi cảm nhận về một ly, như nhật ký.' } },
      { icon: 'flag', name: { en: 'Your Journey', vn: 'Hành Trình' }, line: { en: 'Your whisky story over time.', vn: 'Câu chuyện whisky của bạn theo thời gian.' } },
    ] },
  { key: 'whatson', icon: 'calendar', image: 'trc/gala-cheer', title: { en: "What’s On", vn: 'Sự Kiện' },
    blurb: { en: 'Everything happening — and the photos afterwards.', vn: 'Mọi thứ đang diễn ra — và ảnh sau đó.' },
    items: [
      { icon: 'calendar', name: { en: surfaceName('/members/events', 'en'), vn: surfaceName('/members/events', 'vn') }, line: { en: 'What’s coming up — tap “Sign me up” to join a match.', vn: 'Sắp tới — chạm “Cho tôi tham gia” để dự trận.' } },
      { icon: 'image', name: { en: surfaceName('/members/gallery', 'en'), vn: surfaceName('/members/gallery', 'vn') }, line: { en: 'Photos from events — add your own too.', vn: 'Ảnh từ sự kiện — thêm ảnh của bạn.' } },
      { icon: 'pin', name: { en: surfaceName('/members/notices', 'en'), vn: surfaceName('/members/notices', 'vn') }, line: { en: 'Short club announcements, every week.', vn: 'Thông báo ngắn, hàng tuần.' } },
    ] },
  { key: 'club', icon: 'building', image: 'trc/bar-cart', title: { en: 'The Club', vn: 'Câu Lạc Bộ' },
    blurb: { en: 'The rooms, the menus, a members’ chat, and staff.', vn: 'Các phòng, thực đơn, trò chuyện hội viên, và nhân viên.' },
    items: [
      { icon: 'building', name: { en: 'Our Spaces', vn: 'Không Gian' }, line: { en: 'A tour of the five floors and the sports club.', vn: 'Tham quan năm tầng và câu lạc bộ thể thao.' } },
      { icon: 'menu', name: { en: 'The Menus', vn: 'Thực Đơn' }, line: { en: 'Food and drink menus.', vn: 'Thực đơn đồ ăn và thức uống.' } },
      { icon: 'sofa', name: { en: 'The Snug', vn: 'Phòng Khách' }, line: { en: 'A members’ chatroom — post drams, photos, and chat.', vn: 'Phòng trò chuyện hội viên — đăng ly, ảnh, trò chuyện.' } },
      { icon: 'bell', name: { en: 'The Concierge', vn: 'Quản Gia' }, line: { en: 'A private line to staff — a real person replies.', vn: 'Đường dây riêng với nhân viên — người thật trả lời.' } },
    ] },
  { key: 'community', icon: 'people', image: 'trc/gala-arrivals', title: { en: 'Community', vn: 'Cộng Đồng' },
    blurb: { en: 'The other members — meet them privately, at your pace.', vn: 'Các hội viên khác — gặp gỡ riêng tư, theo nhịp của bạn.' },
    items: [
      { icon: 'people', name: { en: 'The Members', vn: 'Thành Viên' }, line: { en: 'A directory — each member shows what they choose.', vn: 'Danh bạ — mỗi người hiển thị điều họ chọn.' } },
      { icon: 'introduce', name: { en: 'Introductions', vn: 'Giới Thiệu' }, line: { en: 'Meet a member — both agree before names are shared.', vn: 'Làm quen — cả hai đồng ý trước khi chia sẻ tên.' } },
      { icon: 'chat', name: { en: 'Messages', vn: 'Tin Nhắn' }, line: { en: 'Your private chats with other members.', vn: 'Trò chuyện riêng với hội viên khác.' } },
    ] },
  { key: 'you', icon: 'card', image: 'trc/card-lemon', title: { en: 'You', vn: 'Bạn' },
    blurb: { en: 'Your membership, your schedule, your history.', vn: 'Tư cách, lịch, và lịch sử của bạn.' },
    items: [
      { icon: 'card', name: { en: 'My Membership', vn: 'Tư Cách Thành Viên' }, line: { en: 'Your card, number, locker, and receipts.', vn: 'Thẻ, số, tủ khoá và biên nhận.' } },
      { icon: 'calendar', name: { en: 'My Calendar', vn: 'Lịch Của Bạn' }, line: { en: 'Your bookings and the matches you’ve joined.', vn: 'Đặt chỗ và các trận bạn tham gia.' } },
      { icon: 'clock', name: { en: 'Your Visits', vn: 'Ghé Thăm' }, line: { en: 'A record of your visits.', vn: 'Ghi lại những lần ghé của bạn.' } },
    ] },
  { key: 'info', icon: 'book', image: 'trc/club-booklet', title: { en: 'Info', vn: 'Thông Tin' },
    blurb: { en: 'The rules, the legal bits, and how to reach us.', vn: 'Nội quy, phần pháp lý, và cách liên hệ.' },
    items: [
      { icon: 'book', name: { en: 'House Rules', vn: 'Nội Quy' }, line: { en: 'How the club works — worth a read.', vn: 'Cách câu lạc bộ hoạt động — đáng đọc.' } },
      { icon: 'document', name: { en: 'Terms', vn: 'Điều Khoản' }, line: { en: 'The full terms and conditions.', vn: 'Điều khoản đầy đủ.' } },
      { icon: 'mail', name: { en: 'Contact', vn: 'Liên Hệ' }, line: { en: 'Address and phone number.', vn: 'Địa chỉ và số điện thoại.' } },
    ] },
  { key: 'ask', icon: 'chat', image: 'trc/headcover-script', title: { en: 'You’re all set', vn: 'Bạn đã sẵn sàng' },
    blurb: { en: 'That’s the tour. Ask a question below, or jump straight in.', vn: 'Đó là toàn bộ. Hỏi bên dưới, hoặc bắt đầu ngay.' },
    items: [] },
]

const SUGGESTED: L[] = [
  { en: 'How do I find a whisky I’ll like?', vn: 'Làm sao tìm whisky hợp gu?' },
  { en: 'How do I join a sports match?', vn: 'Làm sao tham gia trận đấu?' },
  { en: 'Where are my bookings?', vn: 'Đặt chỗ của tôi ở đâu?' },
]
const FIRST_MOVES: { icon: string; label: L; href: string }[] = [
  { icon: 'compass', label: { en: 'Find your dram', vn: 'Tìm ly của bạn' }, href: '/members/whisky/finder' },
  { icon: 'quill', label: { en: 'Write a note', vn: 'Ghi cảm nhận' }, href: '/members/notes' },
  { icon: 'calendar', label: { en: 'See what’s on', vn: 'Xem sự kiện' }, href: '/members/events' },
  { icon: 'bell', label: { en: 'Message the Concierge', vn: 'Nhắn Quản gia' }, href: '/members/concierge' },
]

export default function PortalGuide({ name }: { name?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const { lang, setLang } = useLang()
  const [who, setWho] = useState<string | undefined>(name)
  const t = (l: L) => (lang === 'vn' && l.vn ? l.vn : l.en)

  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const [qErr, setQErr] = useState('')
  const ask = async (question: string) => {
    const text = question.trim()
    if (text.length < 2 || asking) return
    setAsking(true); setAnswer(''); setQErr(''); setQ(text)
    try {
      const r = await fetch('/api/members/portal-help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text }) })
      const j = await r.json()
      if (!r.ok) { setQErr(j.error || 'Try again.'); return }
      setAnswer(j.answer || '')
    } catch { setQErr(t({ en: 'Couldn’t reach the guide — try the Concierge.', vn: 'Không kết nối được — hãy nhờ Quản gia.' })) }
    finally { setAsking(false) }
  }
  const reset = () => { setQ(''); setAnswer(''); setQErr(''); setAsking(false) }

  useEffect(() => {
    if (name) { setWho(name); return }
    try {
      const sb = createBrowserSupabaseClient()
      sb.auth.getUser().then(({ data }) => {
        if (!data.user) return
        sb.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle()
          .then(({ data: p }) => { if (p?.display_name) setWho(p.display_name) })
      })
    } catch { /* optional */ }
  }, [name])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const url = new URL(window.location.href)
      // NEVER auto-open over the consent gate. A first-time member is redirected to
      // /members/agree, and this opened on top of it — an aria-modal dialog touring
      // a portal they cannot reach yet, covering the one control they need. It
      // intercepted a real tap during verification. Explicit replay (?guide=1 or the
      // open-portal-guide event) still works; only the automatic open is suppressed.
      const onConsentGate = url.pathname.startsWith('/members/agree')
      // AND ONLY ON THE DASHBOARD. The guide is mounted in the member layout, so
      // "has not seen it yet" was true on every page: a new member who closed it
      // on the dashboard, then opened the Notice Board from the menu, met it
      // again there — and again on What's On. Closing it is what marks it seen,
      // so anyone who navigated away instead of closing was toured repeatedly.
      // It now greets them once, where they land, and waits to be asked after
      // that: the menu, the dashboard button, ?guide=1, or the event.
      const onDashboard = url.pathname === '/members' || url.pathname === '/members/'
      const asked = url.searchParams.get('guide') === '1'
      const firstTime = !window.localStorage.getItem(SEEN_KEY) && onDashboard
      if (!onConsentGate && (firstTime || asked)) {
        setI(0); reset(); setOpen(true)
      }
    } catch { /* */ }
    const onOpen = () => { setI(0); reset(); setOpen(true) }
    window.addEventListener('open-portal-guide', onOpen)
    return () => window.removeEventListener('open-portal-guide', onOpen)
  }, [])

  const markSeen = useCallback(() => { try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* */ } }, [])
  const close = useCallback(() => { setOpen(false); markSeen() }, [markSeen])
  const goto = (href: string) => { markSeen(); setOpen(false); router.push(href) }
  const next = useCallback(() => setI(v => Math.min(SLIDES.length - 1, v + 1)), [])
  const prev = useCallback(() => setI(v => Math.max(0, v - 1)), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) { if (e.key === 'Escape') el.blur(); return }
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close, next, prev])

  if (!open) return null
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1
  const n2 = (v: number) => String(v).padStart(2, '0')

  return (
    <div className="pg-root" role="dialog" aria-modal="true" aria-label="Portal guide">
      {/* ═════════════════════════════════════════════════════════════════════
          THE GUIDE IS THE PORTAL, NOT A POP-UP ON TOP OF IT.
          It used to be a 500px rounded card on a blurred scrim: a gradient
          progress bar, circular icon badges, pill buttons, 11px type — the
          look of an onboarding widget, from before the portal was rebuilt in
          the house style. Nothing in the club looks like that any more.

          So it is now built from the same vocabulary as every member page
          (components/public/kit.tsx, MemberPage): the portal's own ground,
          Rampant Sans set LARGE and left-aligned, mono body at a readable
          14px/2, hairline rules instead of borders and badges, and the club's
          own photograph given real room rather than a 150px letterbox.
          The step arrows are the house's underlined CTA with the sliding
          arrow, the same control as "Back to dashboard".

          The EN/VN switch is now the SHARED LangToggle. This file carried a
          third hand-rolled pair of EN/VN buttons — the exact drift the toggle
          was made to end (see components/LangToggle.tsx).
          ═══════════════════════════════════════════════════════════════════ */}
      <style dangerouslySetInnerHTML={{ __html: `
        .pg-root { position:fixed; inset:0; z-index:10000; background:#052E20; color:#E5D4C2;
                   overflow-y:auto; overscroll-behavior:contain; animation:pg-in .45s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes pg-in { from { opacity:0 } to { opacity:1 } }
        .pg-fade { animation:pg-fade .5s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes pg-fade { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        @media (prefers-reduced-motion: reduce) { .pg-root,.pg-fade { animation:none } }

        /* The top strip — the way out, and the language. Fixed to the sheet so
           a long slide never scrolls them off, as the corner switch did. */
        .pg-top { position:sticky; top:0; z-index:4; display:flex; align-items:center; justify-content:space-between;
                  gap:16px; padding:18px clamp(20px,4vw,52px) 14px;
                  background:linear-gradient(180deg,#052E20 72%,rgba(5,46,32,0)); }
        .pg-mark { font-family:'Google Sans Code','DM Mono',monospace; font-size:10.5px; letter-spacing:.22em;
                   text-transform:uppercase; opacity:.62; }
        .pg-topr { display:flex; align-items:center; gap:clamp(12px,3vw,22px); }
        .pg-x { background:none; border:none; cursor:pointer; color:#E5D4C2; padding:0 0 5px;
                border-bottom:1px solid rgba(229,212,194,.45);
                font-family:'Google Sans Code','DM Mono',monospace; font-size:11.5px; letter-spacing:.12em; text-transform:uppercase;
                opacity:.9; transition:opacity .2s ease,border-color .2s ease; }
        .pg-x:hover { opacity:1; border-bottom-color:#D4B85A; }

        .pg-wrap { max-width:1180px; margin:0 auto; padding:0 clamp(20px,4vw,52px) 40px; box-sizing:border-box; }
        .pg-grid { display:grid; grid-template-columns:minmax(0,1fr) clamp(260px,32vw,420px); gap:clamp(28px,5vw,64px);
                   align-items:start; padding-top:clamp(8px,2vw,26px); }

        .pg-title { font-family:'Rampant Sans',serif; font-weight:400; color:#E5D4C2;
                    font-size:clamp(40px,7vw,88px); line-height:.96; margin:0; overflow-wrap:anywhere; }
        .pg-lede { font-family:'Google Sans Code','DM Mono',monospace; font-size:14px; line-height:2;
                   opacity:.88; max-width:540px; margin:22px 0 0; }

        /* The photograph: a tall panel beside the words on a desk, a wide band
           above them on a phone. Same treatment as the site's thumbs. */
        .pg-photo { overflow:hidden; border-radius:12px; box-shadow:0 18px 44px rgba(0,0,0,.34);
                    aspect-ratio:4/5; }
        .pg-photo img { display:block; width:100%; height:100%; object-fit:cover; }

        /* The list — hairline rules, no badges. Set like pk-details. */
        .pg-list { margin:clamp(30px,4vw,46px) 0 0; }
        .pg-row { display:grid; grid-template-columns:22px minmax(0,1fr); gap:16px; align-items:start;
                  padding:16px 0; border-top:1px solid rgba(229,212,194,.14); }
        .pg-row:last-child { border-bottom:1px solid rgba(229,212,194,.14); }
        .pg-row-ic { color:#D4B85A; opacity:.9; padding-top:3px; }
        .pg-row-name { font-family:'Rampant Sans',serif; font-size:clamp(19px,2.2vw,24px); line-height:1.1; }
        .pg-row-line { font-family:'Google Sans Code','DM Mono',monospace; font-size:12.5px; line-height:1.85;
                       opacity:.78; margin-top:7px; }

        /* The foot — the count, then the way back and on. */
        .pg-foot { display:flex; align-items:center; gap:clamp(14px,3vw,26px); flex-wrap:wrap;
                   margin-top:clamp(34px,5vw,58px); padding-top:20px; border-top:1px solid rgba(229,212,194,.14); }
        .pg-count { font-family:'Google Sans Code','DM Mono',monospace; font-size:11px; letter-spacing:.18em;
                    opacity:.55; margin-right:auto; }
        .pg-cta { background:none; border:none; cursor:pointer; color:#E5D4C2; padding:0 0 6px;
                  border-bottom:1px solid currentColor;
                  font-family:'Google Sans Code','DM Mono',monospace; font-size:12px; letter-spacing:.12em; text-transform:uppercase; }
        .pg-cta[disabled] { opacity:.4; cursor:default; }
        .pg-cta.is-on { color:#D4B85A; }
        .pg-go { display:inline-block; transition:transform .35s ease; }
        .pg-cta:hover .pg-go { transform:translateX(7px); }
        .pg-cta.is-back:hover .pg-go { transform:translateX(-7px); }
        @media (prefers-reduced-motion: reduce) { .pg-go { transition:none } }

        /* The last screen — ask a question, then a first move. */
        .pg-ask { display:flex; gap:14px; align-items:flex-end; flex-wrap:wrap; margin-top:8px; }
        .pg-input { flex:1 1 260px; min-width:0; box-sizing:border-box; background:none; color:#E5D4C2;
                    border:none; border-bottom:1px solid rgba(229,212,194,.3); padding:8px 2px;
                    font-family:'Google Sans Code','DM Mono',monospace; font-size:14px; outline:none; }
        .pg-input:focus { border-bottom-color:#D4B85A; }
        .pg-input::placeholder { color:#E5D4C2; opacity:.42; }
        .pg-sugg { display:flex; flex-direction:column; align-items:flex-start; gap:2px; margin:4px 0 26px; }
        .pg-sugg button { background:none; border:none; cursor:pointer; color:#E5D4C2; opacity:.76; text-align:left;
                          padding:7px 0; font-family:'Google Sans Code','DM Mono',monospace; font-size:12.5px; line-height:1.7; }
        .pg-sugg button:hover { opacity:1; color:#D4B85A; }
        .pg-answer { margin-top:24px; padding:20px 0 0; border-top:1px solid rgba(229,212,194,.14);
                     font-family:'Google Sans Code','DM Mono',monospace; font-size:13.5px; line-height:2; white-space:pre-wrap; }
        .pg-typing { display:inline-flex; gap:5px; } .pg-typing i { width:6px; height:6px; border-radius:50%; background:#D4B85A; opacity:.5; animation:pg-blink 1.1s infinite; }
        .pg-typing i:nth-child(2){ animation-delay:.2s } .pg-typing i:nth-child(3){ animation-delay:.4s }
        @keyframes pg-blink { 0%,80%,100%{ opacity:.25; transform:translateY(0) } 40%{ opacity:1; transform:translateY(-3px) } }
        .pg-moves { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:0 28px; margin-top:6px; }
        .pg-move { display:flex; align-items:center; gap:12px; background:none; border:none; cursor:pointer; color:#E5D4C2;
                   text-align:left; padding:15px 0; border-top:1px solid rgba(229,212,194,.14);
                   font-family:'Google Sans Code','DM Mono',monospace; font-size:12.5px; letter-spacing:.04em; }
        .pg-move:hover { color:#D4B85A; }
        .pg-move .pg-move-ic { color:#D4B85A; display:flex; }

        /* ── ON A DESK TOO (2026-09-14, Lachlan: "you still have to scroll on
           desktop"). The desk was sized for width only: an 88px title, a 4:5
           photograph up to 525px tall, 16px row padding — the Whisky slide ran
           well past a laptop's ~660px of usable height. Everything that takes
           vertical room is now sized by the window's HEIGHT as well as its
           width, and the photograph takes the height that is left rather than
           its own ratio. Budget at 1366x768 (≈657px inside the browser), the
           five-row Whisky slide: bar 44 + title 54 + lede 56 + list 17 +
           rows 5×56 + foot 50 + margin 20 ≈ 520px. The phone rules below are
           untouched. */
        @media (min-width: 861px) {
          .pg-top { padding:clamp(10px,1.8vh,18px) clamp(20px,4vw,52px) clamp(6px,1.2vh,12px); }
          .pg-wrap { padding-bottom:clamp(12px,2.4vh,28px); }
          .pg-grid { grid-template-columns:minmax(0,1fr) clamp(220px,26vw,360px); gap:clamp(24px,4vw,56px);
                     align-items:center; padding-top:clamp(2px,1vh,12px); }
          .pg-title { font-size:clamp(34px,min(6vw,8.2vh),80px); }
          .pg-lede { font-size:13px; line-height:1.7; margin-top:clamp(8px,1.6vh,18px); }
          .pg-list { margin-top:clamp(12px,2.6vh,30px); }
          .pg-row { padding:clamp(6px,1.25vh,14px) 0; gap:14px; grid-template-columns:18px minmax(0,1fr); }
          .pg-row-ic { padding-top:1px; }
          .pg-row-name { font-size:clamp(16px,2.4vh,22px); }
          .pg-row-line { font-size:12px; line-height:1.55; margin-top:3px; }
          .pg-photo { aspect-ratio:auto; height:min(calc(100dvh - 170px), 520px); }
          .pg-foot { margin-top:clamp(14px,2.8vh,34px); padding-top:clamp(10px,1.8vh,18px); }
          /* the last screen */
          .pg-ask { margin-top:2px; }
          .pg-sugg { margin:2px 0 clamp(10px,2vh,22px); }
          .pg-sugg button { padding:clamp(3px,.7vh,7px) 0; font-size:12px; }
          .pg-move { padding:clamp(8px,1.4vh,14px) 0; font-size:12px; }
          .pg-answer { margin-top:clamp(10px,2vh,20px); padding-top:clamp(10px,2vh,18px); font-size:12.5px; line-height:1.75; }
        }
        /* A short desk window (a laptop with the dock and tabs showing): the
           words stay, the photograph steps back to a narrow panel. */
        @media (min-width: 861px) and (max-height: 620px) {
          .pg-grid { grid-template-columns:minmax(0,1fr) clamp(180px,20vw,260px); }
          .pg-lede { line-height:1.55; }
          .pg-row-line { line-height:1.4; }
        }

        /* ── A SCREEN IS A SCREEN. ─────────────────────────────────────────
           Every slide has to fit the phone without scrolling: a guide you
           have to scroll to finish reading is a guide people abandon. The
           desk had room; phones overflowed by up to 400px on the Whisky
           slide, measured at 390x844 and 414x736.
           So on a phone the type steps down, the rows tighten, the
           photograph becomes a band rather than a picture — and on a SHORT
           phone it goes entirely, because the words are the point. */
        @media (max-width: 860px) {
          /* Flex, not block: the photograph comes after the words in the
             DOM (so a screen reader meets the heading first) and is lifted
             above them on a phone with order, the way the member pages put
             their art at the top. */
          .pg-grid { display:flex; flex-direction:column; padding-top:0; }
          .pg-photo { order:-1; aspect-ratio:auto; height:clamp(110px,19vh,170px); margin-bottom:16px; }
          .pg-title { font-size:clamp(28px,8.4vw,42px); }
          .pg-lede { font-size:13px; line-height:1.75; margin-top:12px; }
          .pg-list { margin-top:18px; }
          .pg-row { padding:11px 0; gap:13px; grid-template-columns:20px minmax(0,1fr); }
          .pg-row-name { font-size:17px; }
          .pg-row-line { font-size:12px; line-height:1.6; margin-top:4px; }
          .pg-foot { margin-top:18px; padding-top:13px; }
          .pg-top { padding:14px 20px 10px; }
          .pg-wrap { padding-bottom:22px; }
          /* the last screen */
          .pg-ask { margin-top:4px; }
          .pg-sugg { margin:2px 0 14px; }
          .pg-sugg button { padding:5px 0; font-size:12px; }
          .pg-move { padding:11px 0; font-size:12px; }
          .pg-answer { margin-top:14px; padding-top:14px; font-size:12.5px; line-height:1.75; }
        }
        @media (max-width: 860px) and (max-height: 790px) {
          /* Short phone: the picture is the first thing to go. */
          .pg-photo { display:none; }
          .pg-title { font-size:clamp(26px,7.4vw,34px); }
          .pg-row { padding:9px 0; }
        }
      ` }} />

      <div className="pg-top">
        <span className="pg-mark">{t({ en: 'Portal guide', vn: 'Hướng dẫn' })}</span>
        <div className="pg-topr">
          <LangToggle compact />
          <button className="pg-x" onClick={close}>{t({ en: 'Close', vn: 'Đóng' })}</button>
        </div>
      </div>

      <div className="pg-wrap">
        <div className="pg-fade" key={s.key}>
          <div className="pg-grid">
            <div>
              <h2 className="pg-title">{t(s.title)}</h2>
              <p className="pg-lede">
                {i === 0 && who ? `${t({ en: `Welcome, ${who}.`, vn: `Chào mừng, ${who}.` })} ` : ''}
                {t(s.blurb)}
              </p>

              {s.key === 'ask' ? (
                <div className="pg-list" style={{ borderTop: '1px solid rgba(229,212,194,.14)', paddingTop: 26 }}>
                  <div className="pg-ask">
                    <input className="pg-input" value={q} onChange={e => setQ(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && q.trim().length >= 2) ask(q) }}
                      placeholder={t({ en: 'Ask anything about the app…', vn: 'Hỏi bất cứ điều gì…' })} maxLength={500} />
                    <button className="pg-cta is-on" onClick={() => ask(q)} disabled={asking || q.trim().length < 2}>
                      {asking ? t({ en: 'Thinking…', vn: 'Đang nghĩ…' }) : <>{t({ en: 'Ask', vn: 'Hỏi' })} <span className="pg-go" aria-hidden="true">→</span></>}
                    </button>
                  </div>
                  <div className="pg-sugg">
                    {SUGGESTED.map((sg, k) => <button key={k} onClick={() => ask(t(sg))}>{t(sg)}</button>)}
                  </div>
                  {qErr && <div style={{ fontFamily: "'Google Sans Code',monospace", fontSize: 12, color: '#C98A8A' }}>{qErr}</div>}
                  {(asking || answer) && <div className="pg-answer">{asking ? <span className="pg-typing"><i /><i /><i /></span> : answer}</div>}

                  <div className="pg-moves">
                    {FIRST_MOVES.map((m, k) => (
                      <button key={k} className="pg-move" onClick={() => goto(m.href)}>
                        <span className="pg-move-ic"><Icon n={m.icon} size={15} /></span>{t(m.label)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pg-list">
                  {s.items.map((it, k) => (
                    <div key={k} className="pg-row">
                      <span className="pg-row-ic"><Icon n={it.icon} size={17} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="pg-row-name">{t(it.name)}</div>
                        <div className="pg-row-line">{t(it.line)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pg-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG(s.image)} alt="" />
            </div>
          </div>

          <div className="pg-foot">
            <span className="pg-count">{n2(i + 1)} / {n2(SLIDES.length)}</span>
            {i > 0 && (
              <button className="pg-cta is-back" onClick={prev}>
                <span className="pg-go" aria-hidden="true">←</span> {t({ en: 'Back', vn: 'Trước' })}
              </button>
            )}
            {last
              ? <button className="pg-cta is-on" onClick={close}>{t({ en: 'Done', vn: 'Xong' })} <span className="pg-go" aria-hidden="true">→</span></button>
              : <button className="pg-cta is-on" onClick={next}>
                  {i === 0 ? t({ en: 'Start', vn: 'Bắt đầu' }) : t({ en: 'Next', vn: 'Tiếp' })} <span className="pg-go" aria-hidden="true">→</span>
                </button>}
          </div>
        </div>
      </div>
    </div>
  )
}
