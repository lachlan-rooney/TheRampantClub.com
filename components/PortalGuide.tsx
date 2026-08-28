'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// The members' portal training. Opens automatically the FIRST time a member
// reaches their dashboard, and can be replayed any time (the ? button on the
// dashboard, a ?guide=1 URL, or the 'open-portal-guide' window event). It walks
// every function of the portal, grouped exactly like the nav, telling each one's
// WHAT + HOW with an "Open it →" deep-link. Interactive: category tabs, Back/
// Next, keyboard arrows, progress, EN/VN.

const SEEN_KEY = 'rampant.portalguide.v1'
const LANG_KEY = 'rampant.welcome.lang.v1'
type Lang = 'en' | 'vn'
interface L { en: string; vn: string }

const ICONS: Record<string, string> = {
  home:      '<path d="M3 7.5L8 3.5l5 4"/><path d="M4.2 6.8V13h7.6V6.8"/><path d="M6.8 13V9.5h2.4V13"/>',
  menu:      '<path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6"/>',
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
}
const Icon = ({ n, size = 17 }: { n: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[n] || ICONS.home }} aria-hidden />
)

interface Fn { icon: string; name: L; what: L; how: L; href?: string }
interface Group { key: string; icon: string; label: L; blurb: L; items: Fn[] }

const GROUPS: Group[] = [
  { key: 'start', icon: 'home', label: { en: 'Getting around', vn: 'Bắt đầu' },
    blurb: { en: 'Two ways to move through the portal — the tiles here, and the full menu.', vn: 'Hai cách di chuyển trong cổng — các ô ở đây, và menu đầy đủ.' },
    items: [
      { icon: 'home', name: { en: 'The home tiles', vn: 'Các ô trang chủ' }, what: { en: 'This page is your index — every part of the club as a photo tile, grouped by topic.', vn: 'Trang này là mục lục của bạn — mọi phần của câu lạc bộ là một ô ảnh, nhóm theo chủ đề.' }, how: { en: 'Tap any tile to open it. Your membership card, next fixture and notices show live info right on the tiles.', vn: 'Nhấn vào ô bất kỳ để mở. Thẻ thành viên, trận đấu kế tiếp và thông báo hiển thị thông tin trực tiếp trên ô.' } },
      { icon: 'menu', name: { en: 'The menu (≡)', vn: 'Menu (≡)' }, what: { en: 'The button at the top opens the full navigation, grouped like this guide.', vn: 'Nút ở trên cùng mở toàn bộ điều hướng, nhóm giống hướng dẫn này.' }, how: { en: 'Everything is one tap away. Tap ≡ any time, on any page, to jump anywhere.', vn: 'Mọi thứ chỉ cách một lần chạm. Nhấn ≡ bất cứ lúc nào, trên trang bất kỳ.' } },
    ] },
  { key: 'whisky', icon: 'glass', label: { en: 'Whisky', vn: 'Whisky' },
    blurb: { en: 'The heart of the club — and it learns your taste as you go.', vn: 'Trái tim của câu lạc bộ — và nó học khẩu vị của bạn.' },
    items: [
      { icon: 'glass', name: { en: 'Whisky Library', vn: 'Thư Viện Whisky' }, what: { en: 'Every bottle the club pours — 300+ — as a searchable A–Z shelf, each with a flavour radar.', vn: 'Mọi chai câu lạc bộ phục vụ — hơn 300 — dạng kệ A–Z tìm kiếm được, mỗi chai có biểu đồ hương vị.' }, how: { en: 'Search by name, distillery or region; tap a bottle for its story and members’ notes.', vn: 'Tìm theo tên, nhà chưng cất hay vùng; nhấn một chai để xem câu chuyện và ghi chú của hội viên.' }, href: '/members/whisky' },
      { icon: 'compass', name: { en: 'Flavour Finder', vn: 'Tìm Ly Của Bạn' }, what: { en: 'Tell us what you’re in the mood for and we’ll match you to the closest drams we pour.', vn: 'Cho chúng tôi biết bạn đang muốn gì và chúng tôi sẽ gợi ý những ly gần nhất.' }, how: { en: 'Tap a flavour on the wheel to add it, tap again to turn it up (1–4), then “Find my match”.', vn: 'Nhấn một hương vị trên bánh xe để thêm, nhấn lại để tăng (1–4), rồi “Tìm ly của tôi”.' }, href: '/members/whisky/finder' },
      { icon: 'radar', name: { en: 'Your Palate', vn: 'Khẩu Vị Của Bạn' }, what: { en: 'A picture of your taste — a written summary and a radar, built from what you love and note.', vn: 'Bức tranh khẩu vị của bạn — bản tóm tắt và biểu đồ radar, dựng từ những gì bạn yêu thích.' }, how: { en: 'It grows on its own. The more notes you leave, the sharper it gets.', vn: 'Nó tự phát triển. Bạn ghi càng nhiều, nó càng chính xác.' }, href: '/members/taste' },
      { icon: 'quill', name: { en: 'Your Notes', vn: 'Nhật Ký Nếm Thử' }, what: { en: 'Jot a tasting note on any dram — private to you, or shared to the Snug.', vn: 'Ghi lại cảm nhận về bất kỳ ly nào — riêng tư, hoặc chia sẻ lên Phòng Khách.' }, how: { en: 'Open a bottle and add a note. Your notes quietly shape your recommendations.', vn: 'Mở một chai và thêm ghi chú. Ghi chú của bạn âm thầm định hình gợi ý.' }, href: '/members/notes' },
      { icon: 'flag', name: { en: 'Your Journey', vn: 'Hành Trình Của Bạn' }, what: { en: 'Your whisky story over time — milestones and how your palate has drifted.', vn: 'Câu chuyện whisky của bạn theo thời gian — cột mốc và sự thay đổi khẩu vị.' }, how: { en: 'Come back now and then to see how far you’ve come.', vn: 'Thỉnh thoảng ghé lại để xem bạn đã đi được bao xa.' }, href: '/members/journey' },
    ] },
  { key: 'whatson', icon: 'calendar', label: { en: "What’s On", vn: 'Sự Kiện' },
    blurb: { en: 'Everything happening — and the photos afterward.', vn: 'Mọi thứ đang diễn ra — và ảnh sau đó.' },
    items: [
      { icon: 'calendar', name: { en: 'Events & Fixtures', vn: 'Sự Kiện & Thi Đấu' }, what: { en: 'One calendar of what’s coming up — club events and sports fixtures together.', vn: 'Một lịch những gì sắp tới — sự kiện câu lạc bộ và lịch thi đấu.' }, how: { en: 'Filter by sport, and hit “Sign me up” on any fixture to join.', vn: 'Lọc theo môn, và nhấn “Cho tôi tham gia” để đăng ký thi đấu.' }, href: '/members/events' },
      { icon: 'image', name: { en: 'Event Gallery', vn: 'Thư Viện Sự Kiện' }, what: { en: 'Photos & video from club events — and you can add your own.', vn: 'Ảnh & video từ các sự kiện — và bạn có thể tự thêm.' }, how: { en: 'Open an event, then “Add photos” from your phone or paste a link.', vn: 'Mở một sự kiện, rồi “Thêm ảnh” từ điện thoại hoặc dán liên kết.' }, href: '/members/gallery' },
      { icon: 'pin', name: { en: 'Notice Board', vn: 'Bảng Tin' }, what: { en: 'House announcements, new every week.', vn: 'Thông báo của câu lạc bộ, mới mỗi tuần.' }, how: { en: 'A glance keeps you in the loop.', vn: 'Một cái liếc giúp bạn luôn cập nhật.' }, href: '/members/notices' },
    ] },
  { key: 'club', icon: 'building', label: { en: 'The Club', vn: 'Câu Lạc Bộ' },
    blurb: { en: 'The rooms, the menus, and a private line to us.', vn: 'Các phòng, thực đơn, và một đường dây riêng đến chúng tôi.' },
    items: [
      { icon: 'building', name: { en: 'Our Spaces', vn: 'Không Gian' }, what: { en: 'The five floors and the sports club, room by room.', vn: 'Năm tầng và câu lạc bộ thể thao, từng phòng.' }, how: { en: 'Scroll through to walk the building, top to bottom.', vn: 'Cuộn để đi qua toà nhà, từ trên xuống.' }, href: '/members/spaces' },
      { icon: 'menu', name: { en: 'The Menus', vn: 'Thực Đơn' }, what: { en: 'Food & drink lists across the club.', vn: 'Danh sách đồ ăn & thức uống.' }, how: { en: 'Tap a venue to view its menu.', vn: 'Nhấn một địa điểm để xem thực đơn.' }, href: '/menus' },
      { icon: 'sofa', name: { en: 'The Snug', vn: 'Phòng Khách' }, what: { en: 'The club in conversation — drams, moments, a word between members.', vn: 'Câu lạc bộ trò chuyện — ly rượu, khoảnh khắc, đôi lời giữa hội viên.' }, how: { en: 'Read along, or share a dram of your own.', vn: 'Đọc theo, hoặc chia sẻ ly của riêng bạn.' }, href: '/members/snug' },
      { icon: 'bell', name: { en: 'The Concierge', vn: 'Quản Gia' }, what: { en: 'A private line to the Club — requests, a bottle, a word about the evening.', vn: 'Đường dây riêng đến Câu lạc bộ — yêu cầu, một chai, đôi lời về buổi tối.' }, how: { en: 'Message us any time; a real person replies.', vn: 'Nhắn cho chúng tôi bất cứ lúc nào; người thật trả lời.' }, href: '/members/concierge' },
    ] },
  { key: 'community', icon: 'people', label: { en: 'Community', vn: 'Cộng Đồng' },
    blurb: { en: 'The people — meet them at your own pace.', vn: 'Những con người — gặp gỡ theo nhịp của bạn.' },
    items: [
      { icon: 'people', name: { en: 'The Members', vn: 'Thành Viên' }, what: { en: 'The membership, as much as each member chooses to share.', vn: 'Cộng đồng hội viên, theo mức mỗi người chọn chia sẻ.' }, how: { en: 'Browse; privacy is always the member’s call.', vn: 'Duyệt xem; quyền riêng tư luôn do hội viên quyết định.' }, href: '/members/members' },
      { icon: 'introduce', name: { en: 'Introductions', vn: 'Lời Giới Thiệu' }, what: { en: 'A gracious way to be introduced to another member.', vn: 'Cách lịch thiệp để được giới thiệu với hội viên khác.' }, how: { en: 'Request one; both sides opt in before names are shared.', vn: 'Yêu cầu một lời; cả hai bên đồng ý trước khi chia sẻ tên.' }, href: '/members/introductions' },
      { icon: 'chat', name: { en: 'Messages', vn: 'Tin Nhắn' }, what: { en: 'Your conversations with other members.', vn: 'Cuộc trò chuyện của bạn với hội viên khác.' }, how: { en: 'Once introduced, chat here.', vn: 'Sau khi được giới thiệu, trò chuyện tại đây.' }, href: '/members/messages' },
    ] },
  { key: 'you', icon: 'card', label: { en: 'You', vn: 'Bạn' },
    blurb: { en: 'Your membership, your calendar, your record.', vn: 'Tư cách, lịch, và hồ sơ của bạn.' },
    items: [
      { icon: 'card', name: { en: 'My Membership', vn: 'Tư Cách Thành Viên' }, what: { en: 'Your card, member number, locker and dram of choice — plus your receipts.', vn: 'Thẻ, số hội viên, tủ khoá và ly ưa thích — cùng biên nhận.' }, how: { en: 'Show the card at the bar; download receipts here.', vn: 'Xuất trình thẻ tại quầy; tải biên nhận tại đây.' }, href: '/members/profile' },
      { icon: 'calendar', name: { en: 'My Calendar', vn: 'Lịch Của Bạn' }, what: { en: 'A month view of what concerns you — your bookings and the fixtures you’ve joined.', vn: 'Lịch tháng những gì liên quan đến bạn — đặt chỗ và các trận bạn đã tham gia.' }, how: { en: 'A ✓ marks a fixture you’re signed up for.', vn: 'Dấu ✓ đánh dấu trận bạn đã đăng ký.' }, href: '/members/calendar' },
      { icon: 'clock', name: { en: 'Your Visits', vn: 'Những Lần Ghé Thăm' }, what: { en: 'Your record at the club over time.', vn: 'Hồ sơ ghé thăm của bạn theo thời gian.' }, how: { en: 'A quiet history of your evenings here.', vn: 'Lịch sử lặng lẽ những buổi tối của bạn.' }, href: '/members/visits' },
    ] },
  { key: 'info', icon: 'book', label: { en: 'Info', vn: 'Thông Tin' },
    blurb: { en: 'The fine print, and how to reach us.', vn: 'Những điều khoản, và cách liên hệ.' },
    items: [
      { icon: 'book', name: { en: 'House Rules', vn: 'Nội Quy' }, what: { en: 'The club’s operating principles.', vn: 'Nguyên tắc hoạt động của câu lạc bộ.' }, how: { en: 'Worth a read on day one.', vn: 'Đáng đọc trong ngày đầu.' }, href: '/members/rules' },
      { icon: 'document', name: { en: 'Terms', vn: 'Điều Khoản' }, what: { en: 'Full terms & conditions.', vn: 'Điều khoản & điều kiện đầy đủ.' }, how: { en: 'Here whenever you need them.', vn: 'Luôn ở đây khi bạn cần.' }, href: '/members/terms' },
      { icon: 'mail', name: { en: 'Contact', vn: 'Liên Hệ' }, what: { en: 'Address and the member hotline.', vn: 'Địa chỉ và đường dây nóng hội viên.' }, how: { en: 'For anything the Concierge can’t cover.', vn: 'Cho những gì Quản gia không thể giải quyết.' }, href: '/members/contact' },
    ] },
  { key: 'ask', icon: 'chat', label: { en: 'Questions?', vn: 'Câu Hỏi?' },
    blurb: { en: 'Not sure about something? Ask away — I’ll point you to the right spot. For anything personal, the Concierge has you.', vn: 'Chưa rõ điều gì? Cứ hỏi — tôi sẽ chỉ bạn đúng chỗ. Việc riêng tư, hãy nhờ Quản gia.' },
    items: [] },
]

const SUGGESTED: L[] = [
  { en: 'How do I find a whisky I’ll like?', vn: 'Làm sao tìm whisky hợp gu tôi?' },
  { en: 'How do I sign up for a fixture?', vn: 'Làm sao đăng ký thi đấu?' },
  { en: 'Where do I see my bookings?', vn: 'Xem đặt chỗ của tôi ở đâu?' },
  { en: 'How do I add photos from an event?', vn: 'Làm sao thêm ảnh từ sự kiện?' },
]
const FIRST_MOVES: { icon: string; label: L; href: string }[] = [
  { icon: 'compass', label: { en: 'Find your dram', vn: 'Tìm ly của bạn' }, href: '/members/whisky/finder' },
  { icon: 'quill', label: { en: 'Leave a tasting note', vn: 'Ghi cảm nhận' }, href: '/members/notes' },
  { icon: 'calendar', label: { en: 'See what’s on', vn: 'Xem sự kiện' }, href: '/members/events' },
  { icon: 'bell', label: { en: 'Say hello to the Concierge', vn: 'Chào Quản gia' }, href: '/members/concierge' },
]

export default function PortalGuide({ name }: { name?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [gi, setGi] = useState(0)          // group index; -1 shown as intro handled by gi===0 'start'
  const [lang, setLang] = useState<Lang>('en')
  const t = (l: L) => (lang === 'vn' && l.vn ? l.vn : l.en)
  // Ask-a-question state.
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const [qErr, setQErr] = useState('')
  const ask = async (question: string) => {
    const text = question.trim()
    if (!text || asking) return
    setAsking(true); setAnswer(''); setQErr(''); setQ(text)
    try {
      const r = await fetch('/api/members/portal-help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text }) })
      const j = await r.json()
      if (!r.ok) { setQErr(j.error || 'Try again.'); return }
      setAnswer(j.answer || '')
    } catch { setQErr(t({ en: 'Couldn’t reach the guide — try the Concierge.', vn: 'Không kết nối được — hãy nhờ Quản gia.' })) }
    finally { setAsking(false) }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedLang = window.localStorage.getItem(LANG_KEY) as Lang | null
      if (savedLang === 'vn' || savedLang === 'en') setLang(savedLang)
      const url = new URL(window.location.href)
      const seen = window.localStorage.getItem(SEEN_KEY)
      if (!seen || url.searchParams.get('guide') === '1') { setGi(0); setOpen(true) }
    } catch { /* */ }
    const onOpen = () => { setGi(0); setOpen(true) }
    window.addEventListener('open-portal-guide', onOpen)
    return () => window.removeEventListener('open-portal-guide', onOpen)
  }, [])

  const markSeen = useCallback(() => { try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* */ } }, [])
  const close = useCallback(() => { setOpen(false); markSeen() }, [markSeen])
  const goto = (href: string) => { markSeen(); setOpen(false); router.push(href) }
  const setLangPersist = (l: Lang) => { setLang(l); try { window.localStorage.setItem(LANG_KEY, l) } catch { /* */ } }

  const next = useCallback(() => setGi(i => Math.min(GROUPS.length - 1, i + 1)), [])
  const prev = useCallback(() => setGi(i => Math.max(0, i - 1)), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close, next, prev])

  if (!open) return null
  const g = GROUPS[gi]
  const last = gi === GROUPS.length - 1

  return (
    <div className="pg-root" role="dialog" aria-modal="true" aria-label="Portal guide">
      <style dangerouslySetInnerHTML={{ __html: `
        .pg-root { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; }
        .pg-back { position:absolute; inset:0; background:rgba(3,20,14,0.86); backdrop-filter:blur(4px); }
        .pg-card { position:relative; width:min(680px,96vw); max-height:92vh; display:flex; flex-direction:column;
          background:#0A3526; border:1px solid rgba(212,184,90,0.28); border-radius:16px; box-shadow:0 40px 100px rgba(0,0,0,0.6); overflow:hidden;
          animation:pg-in 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes pg-in { from { opacity:0; transform:translateY(14px) scale(0.98) } to { opacity:1; transform:none } }
        @media (prefers-reduced-motion: reduce) { .pg-card { animation:none } }
        .pg-progress { height:3px; background:rgba(229,212,194,0.10); }
        .pg-progress-fill { height:100%; background:linear-gradient(90deg,#B8862B,#E7C766); transition:width 0.4s cubic-bezier(0.22,1,0.36,1); }
        .pg-head { padding:18px 22px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .pg-eyebrow { font-family:'Google Sans Code',monospace; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:#D4B85A; }
        .pg-title { font-family:'Rampant Sans',serif; font-size:23px; color:#E5D4C2; margin:4px 0 0; line-height:1.15; }
        .pg-lang { display:flex; gap:4px; flex-shrink:0; }
        .pg-lang button { font-family:'Google Sans Code',monospace; font-size:10px; padding:4px 9px; border-radius:6px; cursor:pointer; border:1px solid rgba(229,212,194,0.18); background:transparent; color:#B2AA98; }
        .pg-lang button.on { background:rgba(212,184,90,0.16); border-color:rgba(212,184,90,0.5); color:#E7C766; }
        .pg-close { background:none; border:none; color:#B2AA98; font-size:18px; cursor:pointer; line-height:1; }
        .pg-tabs { display:flex; gap:5px; overflow-x:auto; padding:14px 22px 4px; }
        .pg-tab { flex-shrink:0; display:flex; align-items:center; gap:6px; font-family:'Google Sans Code',monospace; font-size:10px; letter-spacing:0.04em;
          padding:6px 11px; border-radius:999px; cursor:pointer; border:1px solid rgba(229,212,194,0.14); background:transparent; color:#B2AA98; white-space:nowrap; }
        .pg-tab.on { background:rgba(212,184,90,0.14); border-color:rgba(212,184,90,0.5); color:#E7C766; }
        .pg-blurb { font-family:'Google Sans Code',monospace; font-size:11.5px; color:#B2AA98; line-height:1.6; padding:8px 22px 2px; }
        .pg-body { overflow-y:auto; padding:8px 16px 8px; }
        .pg-fn { display:flex; gap:13px; padding:13px 14px; border-radius:12px; }
        .pg-fn:hover { background:rgba(229,212,194,0.03); }
        .pg-ic { flex-shrink:0; width:38px; height:38px; display:flex; align-items:center; justify-content:center; border-radius:50%;
          color:#D4B85A; background:rgba(212,184,90,0.08); border:1px solid rgba(212,184,90,0.32); }
        .pg-fn-name { font-family:'Rampant Sans',serif; font-size:16px; color:#E5D4C2; }
        .pg-fn-what { font-family:'Google Sans Code',monospace; font-size:11.5px; color:#B2AA98; line-height:1.55; margin:3px 0; }
        .pg-fn-how { font-family:'Google Sans Code',monospace; font-size:11px; color:#8FA58C; line-height:1.5; }
        .pg-open { display:inline-block; margin-top:6px; font-family:'Google Sans Code',monospace; font-size:10.5px; letter-spacing:0.04em; color:#052E20;
          background:#D4B85A; border:none; border-radius:6px; padding:5px 12px; cursor:pointer; font-weight:700; }
        .pg-chip { font-family:'Google Sans Code',monospace; font-size:10.5px; color:#E5D4C2; background:rgba(212,184,90,0.08); border:1px solid rgba(212,184,90,0.28);
          border-radius:999px; padding:5px 11px; cursor:pointer; text-align:left; }
        .pg-chip:hover { border-color:rgba(212,184,90,0.6); background:rgba(212,184,90,0.14); }
        .pg-input { flex:1; min-width:0; box-sizing:border-box; background:rgba(5,46,32,0.55); color:#E5D4C2; border:1px solid rgba(229,212,194,0.16);
          border-radius:8px; padding:10px 12px; font-family:'Google Sans Code',monospace; font-size:12.5px; outline:none; }
        .pg-answer { margin-top:12px; background:rgba(212,184,90,0.06); border:1px solid rgba(212,184,90,0.22); border-radius:10px; padding:13px 15px;
          font-family:'Rampant Sans',serif; font-size:14.5px; line-height:1.6; color:#E5D4C2; white-space:pre-wrap; }
        .pg-typing { display:inline-flex; gap:5px; align-items:center; }
        .pg-typing i { width:6px; height:6px; border-radius:50%; background:#D4B85A; opacity:0.5; animation:pg-blink 1.1s infinite; }
        .pg-typing i:nth-child(2){ animation-delay:0.2s } .pg-typing i:nth-child(3){ animation-delay:0.4s }
        @keyframes pg-blink { 0%,80%,100%{ opacity:0.25; transform:translateY(0) } 40%{ opacity:1; transform:translateY(-3px) } }
        .pg-move { display:inline-flex; align-items:center; gap:7px; font-family:'Google Sans Code',monospace; font-size:11px; color:#E5D4C2;
          background:rgba(229,212,194,0.04); border:1px solid rgba(229,212,194,0.16); border-radius:8px; padding:8px 13px; cursor:pointer; }
        .pg-move:hover { border-color:rgba(212,184,90,0.5); background:rgba(212,184,90,0.08); }
        .pg-foot { display:flex; align-items:center; gap:10px; padding:14px 22px 18px; border-top:1px solid rgba(229,212,194,0.10); }
        .pg-dots { display:flex; gap:5px; margin-right:auto; }
        .pg-dot { width:7px; height:7px; border-radius:50%; background:rgba(229,212,194,0.2); cursor:pointer; }
        .pg-dot.on { background:#D4B85A; }
        .pg-btn { font-family:'Google Sans Code',monospace; font-size:11px; padding:8px 16px; border-radius:8px; cursor:pointer; border:1px solid rgba(229,212,194,0.18); background:transparent; color:#B2AA98; }
        .pg-btn.gold { background:#D4B85A; color:#052E20; border:none; font-weight:700; }
        @media (max-width:560px){ .pg-title { font-size:20px } .pg-tab span { display:none } }
      ` }} />
      <div className="pg-back" onClick={close} />
      <div className="pg-card">
        <div className="pg-progress"><div className="pg-progress-fill" style={{ width: `${((gi + 1) / GROUPS.length) * 100}%` }} /></div>
        <div className="pg-head">
          <div>
            <div className="pg-eyebrow">{gi === 0 ? (name ? t({ en: `Welcome, ${name}`, vn: `Chào mừng, ${name}` }) : t({ en: 'Welcome', vn: 'Chào mừng' })) : t({ en: 'Your portal', vn: 'Cổng của bạn' })}</div>
            <h2 className="pg-title">{gi === 0 ? t({ en: 'A quick tour of your portal', vn: 'Tham quan nhanh cổng của bạn' }) : t(g.label)}</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="pg-lang">
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLangPersist('en')}>EN</button>
              <button className={lang === 'vn' ? 'on' : ''} onClick={() => setLangPersist('vn')}>VN</button>
            </div>
            <button className="pg-close" onClick={close} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="pg-tabs">
          {GROUPS.map((grp, i) => (
            <button key={grp.key} className={'pg-tab' + (i === gi ? ' on' : '')} onClick={() => setGi(i)}>
              <span style={{ display: 'flex' }}><Icon n={grp.icon} size={13} /></span><span>{t(grp.label)}</span>
            </button>
          ))}
        </div>

        <div className="pg-blurb">{t(g.blurb)}</div>
        <div className="pg-body">
          {g.key === 'ask' ? (
            <div style={{ padding: '4px 6px 6px' }}>
              {/* Suggested questions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {SUGGESTED.map((s, i) => (
                  <button key={i} className="pg-chip" onClick={() => ask(t(s))}>{t(s)}</button>
                ))}
              </div>
              {/* Ask box */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="pg-input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(q) }}
                  placeholder={t({ en: 'Ask anything about the portal…', vn: 'Hỏi bất cứ điều gì về cổng…' })} maxLength={500} />
                <button className="pg-btn gold" onClick={() => ask(q)} disabled={asking || q.trim().length < 2} style={{ opacity: asking || q.trim().length < 2 ? 0.5 : 1 }}>
                  {asking ? t({ en: 'Thinking…', vn: 'Đang nghĩ…' }) : t({ en: 'Ask', vn: 'Hỏi' })}
                </button>
              </div>
              {qErr && <div style={{ fontFamily: "'Google Sans Code',monospace", fontSize: 11, color: '#C27070', marginTop: 10 }}>{qErr}</div>}
              {(asking || answer) && (
                <div className="pg-answer">
                  {asking ? <span className="pg-typing"><i /><i /><i /></span> : answer}
                </div>
              )}
              {/* Encourage first moves */}
              <div style={{ fontFamily: "'Google Sans Code',monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D4B85A', margin: '20px 0 8px' }}>{t({ en: 'Your first moves', vn: 'Bước đầu tiên' })}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FIRST_MOVES.map((m, i) => (
                  <button key={i} className="pg-move" onClick={() => goto(m.href)}>
                    <span style={{ display: 'flex', color: '#D4B85A' }}><Icon n={m.icon} size={14} /></span>{t(m.label)}
                  </button>
                ))}
              </div>
            </div>
          ) : g.items.map((f, i) => (
            <div key={i} className="pg-fn">
              <span className="pg-ic"><Icon n={f.icon} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="pg-fn-name">{t(f.name)}</div>
                <div className="pg-fn-what">{t(f.what)}</div>
                <div className="pg-fn-how">{t({ en: 'How: ', vn: 'Cách dùng: ' })}{t(f.how)}</div>
                {f.href && <button className="pg-open" onClick={() => goto(f.href!)}>{t({ en: 'Open it →', vn: 'Mở ra →' })}</button>}
              </div>
            </div>
          ))}
        </div>

        <div className="pg-foot">
          <div className="pg-dots">
            {GROUPS.map((_, i) => <span key={i} className={'pg-dot' + (i === gi ? ' on' : '')} onClick={() => setGi(i)} />)}
          </div>
          <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#7E7864', marginRight: 4 }}>{gi + 1}/{GROUPS.length}</span>
          {gi > 0 && <button className="pg-btn" onClick={prev}>{t({ en: 'Back', vn: 'Trước' })}</button>}
          {last
            ? <button className="pg-btn gold" onClick={close}>{t({ en: 'Explore the club', vn: 'Khám phá câu lạc bộ' })}</button>
            : <button className="pg-btn gold" onClick={next}>{gi === 0 ? t({ en: 'Show me around →', vn: 'Dẫn tôi đi →' }) : t({ en: 'Next', vn: 'Tiếp' })}</button>}
        </div>
      </div>
    </div>
  )
}
