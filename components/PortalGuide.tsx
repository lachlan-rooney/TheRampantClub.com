'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// The members' portal training — a clean, linear flow. Mounted in the member
// layout so it's on every page: opens automatically the first time, replayable
// via the ◇ Portal guide button / the menu / a ?guide=1 URL / the
// 'open-portal-guide' event. One photo-led screen per area with short lines;
// members step through it all, then jump in from the final screen.

const SEEN_KEY = 'rampant.portalguide.v2'
const LANG_KEY = 'rampant.welcome.lang.v1'
type Lang = 'en' | 'vn'
interface L { en: string; vn: string }
const IMG = (n: string) => `/images/social/${n}.webp`

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
  { key: 'start', icon: 'home', image: 'whisky-lounge', title: { en: 'Getting around', vn: 'Cách dùng' },
    blurb: { en: 'Two ways to move around — the picture tiles, and the menu.', vn: 'Hai cách di chuyển — các ô hình, và menu.' },
    items: [
      { icon: 'home', name: { en: 'The home tiles', vn: 'Ô trang chủ' }, line: { en: 'Tap any picture to open that part of the club.', vn: 'Chạm một hình để mở phần đó.' } },
      { icon: 'menu', name: { en: 'The menu (≡)', vn: 'Menu (≡)' }, line: { en: 'The button up top opens the full menu, on any page.', vn: 'Nút phía trên mở menu đầy đủ, trên mọi trang.' } },
    ] },
  { key: 'whisky', icon: 'glass', image: 'bottle-collection', title: { en: 'Whisky', vn: 'Whisky' },
    blurb: { en: 'Explore whisky — the app learns what you like as you go.', vn: 'Khám phá whisky — ứng dụng học gu của bạn.' },
    items: [
      { icon: 'glass', name: { en: 'Whisky Library', vn: 'Thư Viện Whisky' }, line: { en: 'Browse every bottle we pour — search, read members’ notes.', vn: 'Duyệt mọi chai — tìm kiếm, đọc ghi chú hội viên.' } },
      { icon: 'compass', name: { en: 'Flavour Finder', vn: 'Tìm Ly Của Bạn' }, line: { en: 'Tell it what you fancy; it finds bottles that match.', vn: 'Cho biết bạn thích gì; nó tìm chai phù hợp.' } },
      { icon: 'radar', name: { en: 'Your Palate', vn: 'Khẩu Vị' }, line: { en: 'A chart of your taste — it builds itself from your notes.', vn: 'Biểu đồ gu của bạn — tự dựng từ ghi chú.' } },
      { icon: 'quill', name: { en: 'Your Notes', vn: 'Ghi Chú' }, line: { en: 'Jot what you thought of a dram, like a diary.', vn: 'Ghi cảm nhận về một ly, như nhật ký.' } },
      { icon: 'flag', name: { en: 'Your Journey', vn: 'Hành Trình' }, line: { en: 'Your whisky story over time.', vn: 'Câu chuyện whisky của bạn theo thời gian.' } },
    ] },
  { key: 'whatson', icon: 'calendar', image: 'cocktails', title: { en: "What’s On", vn: 'Sự Kiện' },
    blurb: { en: 'Everything happening — and the photos afterwards.', vn: 'Mọi thứ đang diễn ra — và ảnh sau đó.' },
    items: [
      { icon: 'calendar', name: { en: 'Events & Fixtures', vn: 'Sự Kiện & Thi Đấu' }, line: { en: 'What’s coming up — tap “Sign me up” to join a match.', vn: 'Sắp tới — chạm “Cho tôi tham gia” để dự trận.' } },
      { icon: 'image', name: { en: 'Event Gallery', vn: 'Thư Viện Sự Kiện' }, line: { en: 'Photos from events — add your own too.', vn: 'Ảnh từ sự kiện — thêm ảnh của bạn.' } },
      { icon: 'pin', name: { en: 'Notice Board', vn: 'Bảng Tin' }, line: { en: 'Short club announcements, every week.', vn: 'Thông báo ngắn, hàng tuần.' } },
    ] },
  { key: 'club', icon: 'building', image: 'gala-table', title: { en: 'The Club', vn: 'Câu Lạc Bộ' },
    blurb: { en: 'The rooms, the menus, a members’ chat, and staff.', vn: 'Các phòng, thực đơn, trò chuyện hội viên, và nhân viên.' },
    items: [
      { icon: 'building', name: { en: 'Our Spaces', vn: 'Không Gian' }, line: { en: 'A tour of the five floors and the sports club.', vn: 'Tham quan năm tầng và câu lạc bộ thể thao.' } },
      { icon: 'menu', name: { en: 'The Menus', vn: 'Thực Đơn' }, line: { en: 'Food and drink menus.', vn: 'Thực đơn đồ ăn và thức uống.' } },
      { icon: 'sofa', name: { en: 'The Snug', vn: 'Phòng Khách' }, line: { en: 'A members’ chatroom — post drams, photos, and chat.', vn: 'Phòng trò chuyện hội viên — đăng ly, ảnh, trò chuyện.' } },
      { icon: 'bell', name: { en: 'The Concierge', vn: 'Quản Gia' }, line: { en: 'A private line to staff — a real person replies.', vn: 'Đường dây riêng với nhân viên — người thật trả lời.' } },
    ] },
  { key: 'community', icon: 'people', image: 'ao-dai', title: { en: 'Community', vn: 'Cộng Đồng' },
    blurb: { en: 'The other members — meet them privately, at your pace.', vn: 'Các hội viên khác — gặp gỡ riêng tư, theo nhịp của bạn.' },
    items: [
      { icon: 'people', name: { en: 'The Members', vn: 'Thành Viên' }, line: { en: 'A directory — each member shows what they choose.', vn: 'Danh bạ — mỗi người hiển thị điều họ chọn.' } },
      { icon: 'introduce', name: { en: 'Introductions', vn: 'Giới Thiệu' }, line: { en: 'Meet a member — both agree before names are shared.', vn: 'Làm quen — cả hai đồng ý trước khi chia sẻ tên.' } },
      { icon: 'chat', name: { en: 'Messages', vn: 'Tin Nhắn' }, line: { en: 'Your private chats with other members.', vn: 'Trò chuyện riêng với hội viên khác.' } },
    ] },
  { key: 'you', icon: 'card', image: 'lion-crest', title: { en: 'You', vn: 'Bạn' },
    blurb: { en: 'Your membership, your schedule, your history.', vn: 'Tư cách, lịch, và lịch sử của bạn.' },
    items: [
      { icon: 'card', name: { en: 'My Membership', vn: 'Tư Cách Thành Viên' }, line: { en: 'Your card, number, locker, and receipts.', vn: 'Thẻ, số, tủ khoá và biên nhận.' } },
      { icon: 'calendar', name: { en: 'My Calendar', vn: 'Lịch Của Bạn' }, line: { en: 'Your bookings and the matches you’ve joined.', vn: 'Đặt chỗ và các trận bạn tham gia.' } },
      { icon: 'clock', name: { en: 'Your Visits', vn: 'Ghé Thăm' }, line: { en: 'A record of your visits.', vn: 'Ghi lại những lần ghé của bạn.' } },
    ] },
  { key: 'info', icon: 'book', image: 'springbank', title: { en: 'Info', vn: 'Thông Tin' },
    blurb: { en: 'The rules, the legal bits, and how to reach us.', vn: 'Nội quy, phần pháp lý, và cách liên hệ.' },
    items: [
      { icon: 'book', name: { en: 'House Rules', vn: 'Nội Quy' }, line: { en: 'How the club works — worth a read.', vn: 'Cách câu lạc bộ hoạt động — đáng đọc.' } },
      { icon: 'document', name: { en: 'Terms', vn: 'Điều Khoản' }, line: { en: 'The full terms and conditions.', vn: 'Điều khoản đầy đủ.' } },
      { icon: 'mail', name: { en: 'Contact', vn: 'Liên Hệ' }, line: { en: 'Address and phone number.', vn: 'Địa chỉ và số điện thoại.' } },
    ] },
  { key: 'ask', icon: 'chat', image: 'whisky-library', title: { en: 'You’re all set', vn: 'Bạn đã sẵn sàng' },
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
  const [lang, setLang] = useState<Lang>('en')
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
      const sl = window.localStorage.getItem(LANG_KEY) as Lang | null
      if (sl === 'vn' || sl === 'en') setLang(sl)
      const url = new URL(window.location.href)
      if (!window.localStorage.getItem(SEEN_KEY) || url.searchParams.get('guide') === '1') { setI(0); reset(); setOpen(true) }
    } catch { /* */ }
    const onOpen = () => { setI(0); reset(); setOpen(true) }
    window.addEventListener('open-portal-guide', onOpen)
    return () => window.removeEventListener('open-portal-guide', onOpen)
  }, [])

  const markSeen = useCallback(() => { try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* */ } }, [])
  const close = useCallback(() => { setOpen(false); markSeen() }, [markSeen])
  const goto = (href: string) => { markSeen(); setOpen(false); router.push(href) }
  const setLangPersist = (l: Lang) => { setLang(l); try { window.localStorage.setItem(LANG_KEY, l) } catch { /* */ } }
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

  return (
    <div className="pg-root" role="dialog" aria-modal="true" aria-label="Portal guide">
      <style dangerouslySetInnerHTML={{ __html: `
        .pg-root { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:18px; }
        .pg-back { position:absolute; inset:0; background:rgba(3,20,14,0.88); backdrop-filter:blur(4px); }
        .pg-card { position:relative; width:min(500px,96vw); max-height:94vh; display:flex; flex-direction:column;
          background:#0A3526; border:1px solid rgba(212,184,90,0.28); border-radius:18px; box-shadow:0 40px 100px rgba(0,0,0,0.6); overflow:hidden;
          animation:pg-in 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes pg-in { from { opacity:0; transform:translateY(14px) scale(0.98) } to { opacity:1; transform:none } }
        .pg-fade { animation:pg-fade 0.35s ease both; }
        @keyframes pg-fade { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        @media (prefers-reduced-motion: reduce) { .pg-card,.pg-fade { animation:none } }
        .pg-hero { position:relative; height:150px; }
        .pg-hero img { width:100%; height:100%; object-fit:cover; display:block; }
        .pg-hero::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,53,38,0.15) 0%, rgba(10,53,38,0.55) 60%, #0A3526 100%); }
        .pg-progress { position:absolute; top:0; left:0; right:0; height:3px; background:rgba(0,0,0,0.25); z-index:2; }
        .pg-progress-fill { height:100%; background:linear-gradient(90deg,#B8862B,#E7C766); transition:width 0.4s cubic-bezier(0.22,1,0.36,1); }
        .pg-close { position:absolute; top:12px; right:12px; z-index:3; width:28px; height:28px; border-radius:50%; background:rgba(5,46,32,0.6); border:1px solid rgba(229,212,194,0.2);
          color:#E5D4C2; font-size:14px; cursor:pointer; line-height:1; }
        .pg-lang { position:absolute; top:12px; left:12px; z-index:3; display:flex; gap:4px; }
        .pg-lang button { font-family:'Google Sans Code',monospace; font-size:10px; padding:3px 8px; border-radius:6px; cursor:pointer; border:1px solid rgba(229,212,194,0.2); background:rgba(5,46,32,0.6); color:#B2AA98; }
        .pg-lang button.on { background:rgba(212,184,90,0.22); border-color:rgba(212,184,90,0.6); color:#E7C766; }
        .pg-headwrap { position:absolute; bottom:12px; left:20px; right:20px; z-index:2; display:flex; align-items:center; gap:10px; }
        .pg-headic { width:34px; height:34px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:50%; color:#E7C766; background:rgba(5,46,32,0.55); border:1px solid rgba(212,184,90,0.4); }
        .pg-eyebrow { font-family:'Google Sans Code',monospace; font-size:9px; letter-spacing:0.16em; text-transform:uppercase; color:#E7C766; }
        .pg-title { font-family:'Rampant Sans',serif; font-size:22px; color:#F3EAD9; margin:0; line-height:1.1; text-shadow:0 2px 12px rgba(0,0,0,0.5); }
        .pg-blurb { font-family:'Google Sans Code',monospace; font-size:11.5px; color:#B2AA98; line-height:1.6; padding:14px 20px 4px; }
        .pg-body { overflow-y:auto; padding:4px 12px 8px; }
        .pg-li { display:flex; gap:12px; align-items:flex-start; padding:9px 8px; }
        .pg-li-ic { flex-shrink:0; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; color:#D4B85A; background:rgba(212,184,90,0.08); border:1px solid rgba(212,184,90,0.3); margin-top:1px; }
        .pg-li-name { font-family:'Rampant Sans',serif; font-size:15px; color:#E5D4C2; line-height:1.2; }
        .pg-li-line { font-family:'Google Sans Code',monospace; font-size:11px; color:#B2AA98; line-height:1.5; margin-top:2px; }
        .pg-chip { font-family:'Google Sans Code',monospace; font-size:10.5px; color:#E5D4C2; background:rgba(212,184,90,0.08); border:1px solid rgba(212,184,90,0.28); border-radius:999px; padding:6px 11px; cursor:pointer; text-align:left; }
        .pg-chip:hover { border-color:rgba(212,184,90,0.6); background:rgba(212,184,90,0.14); }
        .pg-input { flex:1; min-width:0; box-sizing:border-box; background:rgba(5,46,32,0.55); color:#E5D4C2; border:1px solid rgba(229,212,194,0.16); border-radius:8px; padding:10px 12px; font-family:'Google Sans Code',monospace; font-size:12.5px; outline:none; }
        .pg-answer { margin-top:12px; background:rgba(212,184,90,0.06); border:1px solid rgba(212,184,90,0.22); border-radius:10px; padding:13px 15px; font-family:'Rampant Sans',serif; font-size:14.5px; line-height:1.6; color:#E5D4C2; white-space:pre-wrap; }
        .pg-typing { display:inline-flex; gap:5px; } .pg-typing i { width:6px; height:6px; border-radius:50%; background:#D4B85A; opacity:0.5; animation:pg-blink 1.1s infinite; }
        .pg-typing i:nth-child(2){ animation-delay:0.2s } .pg-typing i:nth-child(3){ animation-delay:0.4s }
        @keyframes pg-blink { 0%,80%,100%{ opacity:0.25; transform:translateY(0) } 40%{ opacity:1; transform:translateY(-3px) } }
        .pg-move { display:inline-flex; align-items:center; gap:7px; font-family:'Google Sans Code',monospace; font-size:11px; color:#E5D4C2; background:rgba(229,212,194,0.04); border:1px solid rgba(229,212,194,0.16); border-radius:8px; padding:8px 13px; cursor:pointer; }
        .pg-move:hover { border-color:rgba(212,184,90,0.5); background:rgba(212,184,90,0.08); }
        .pg-foot { display:flex; align-items:center; gap:10px; padding:12px 20px 16px; border-top:1px solid rgba(229,212,194,0.10); }
        .pg-dots { display:flex; gap:5px; margin-right:auto; }
        .pg-dot { width:7px; height:7px; border-radius:50%; background:rgba(229,212,194,0.2); cursor:pointer; transition:background 0.2s; }
        .pg-dot.on { background:#D4B85A; }
        .pg-btn { font-family:'Google Sans Code',monospace; font-size:11px; padding:8px 16px; border-radius:8px; cursor:pointer; border:1px solid rgba(229,212,194,0.18); background:transparent; color:#B2AA98; }
        .pg-btn.gold { background:#D4B85A; color:#052E20; border:none; font-weight:700; }
      ` }} />
      <div className="pg-back" onClick={close} />
      <div className="pg-card">
        <div className="pg-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG(s.image)} alt="" />
          <div className="pg-progress"><div className="pg-progress-fill" style={{ width: `${((i + 1) / SLIDES.length) * 100}%` }} /></div>
          <div className="pg-lang">
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLangPersist('en')}>EN</button>
            <button className={lang === 'vn' ? 'on' : ''} onClick={() => setLangPersist('vn')}>VN</button>
          </div>
          <button className="pg-close" onClick={close} aria-label="Close">✕</button>
          <div className="pg-headwrap">
            <span className="pg-headic"><Icon n={s.icon} size={17} /></span>
            <div>
              <div className="pg-eyebrow">{i === 0 && who ? t({ en: `Welcome, ${who}`, vn: `Chào mừng, ${who}` }) : `${i + 1} / ${SLIDES.length}`}</div>
              <h2 className="pg-title">{t(s.title)}</h2>
            </div>
          </div>
        </div>

        <div className="pg-fade" key={s.key} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="pg-blurb">{t(s.blurb)}</div>
          <div className="pg-body">
            {s.key === 'ask' ? (
              <div style={{ padding: '4px 6px 4px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {SUGGESTED.map((sg, k) => <button key={k} className="pg-chip" onClick={() => ask(t(sg))}>{t(sg)}</button>)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="pg-input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q.trim().length >= 2) ask(q) }}
                    placeholder={t({ en: 'Ask anything about the app…', vn: 'Hỏi bất cứ điều gì…' })} maxLength={500} />
                  <button className="pg-btn gold" onClick={() => ask(q)} disabled={asking || q.trim().length < 2} style={{ opacity: asking || q.trim().length < 2 ? 0.5 : 1 }}>
                    {asking ? t({ en: 'Thinking…', vn: 'Đang nghĩ…' }) : t({ en: 'Ask', vn: 'Hỏi' })}
                  </button>
                </div>
                {qErr && <div style={{ fontFamily: "'Google Sans Code',monospace", fontSize: 11, color: '#C27070', marginTop: 10 }}>{qErr}</div>}
                {(asking || answer) && <div className="pg-answer">{asking ? <span className="pg-typing"><i /><i /><i /></span> : answer}</div>}
                <div style={{ fontFamily: "'Google Sans Code',monospace", fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4B85A', margin: '20px 0 8px' }}>{t({ en: 'Jump in', vn: 'Bắt đầu' })}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {FIRST_MOVES.map((m, k) => (
                    <button key={k} className="pg-move" onClick={() => goto(m.href)}><span style={{ display: 'flex', color: '#D4B85A' }}><Icon n={m.icon} size={14} /></span>{t(m.label)}</button>
                  ))}
                </div>
              </div>
            ) : s.items.map((it, k) => (
              <div key={k} className="pg-li">
                <span className="pg-li-ic"><Icon n={it.icon} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="pg-li-name">{t(it.name)}</div>
                  <div className="pg-li-line">{t(it.line)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pg-foot">
          <div className="pg-dots">{SLIDES.map((_, k) => <span key={k} className={'pg-dot' + (k === i ? ' on' : '')} onClick={() => setI(k)} />)}</div>
          {i > 0 && <button className="pg-btn" onClick={prev}>{t({ en: 'Back', vn: 'Trước' })}</button>}
          {last
            ? <button className="pg-btn gold" onClick={close}>{t({ en: 'Done', vn: 'Xong' })}</button>
            : <button className="pg-btn gold" onClick={next}>{i === 0 ? t({ en: 'Start →', vn: 'Bắt đầu →' }) : t({ en: 'Next →', vn: 'Tiếp →' })}</button>}
        </div>
      </div>
    </div>
  )
}
