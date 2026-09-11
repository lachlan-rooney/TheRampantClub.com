'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLang } from '@/lib/lang'

// Each quip carries its own Vietnamese. Names (bottles, rooms, records, people)
// stay as they are; the joke is translated, not the proper nouns.
interface Quip { en: string; vn: string }

const DRAMS: Quip[] = [
  { en: 'Dram of the day: The Octave 2011 Glentauchers — neat, obviously', vn: 'Ly của ngày: The Octave 2011 Glentauchers — uống nguyên chất, dĩ nhiên rồi' },
  { en: 'Dram of the day: Duncan Taylor "An Islay" 16 — the peat speaks for itself', vn: 'Ly của ngày: Duncan Taylor "An Islay" 16 — vị than bùn tự nói lên tất cả' },
  { en: 'Dram of the day: Highland Park 18 — a drop of water permitted', vn: 'Ly của ngày: Highland Park 18 — được phép thêm một giọt nước' },
  { en: 'Dram of the day: Ardbeg Uigeadail — not for the faint-hearted', vn: 'Ly của ngày: Ardbeg Uigeadail — không dành cho người yếu tim' },
]

const OTHER_QUIPS: Quip[] = [
  // Now playing in The Rampant Room
  { en: 'Now playing in The Rampant Room: Coltrane — A Love Supreme (Side B)', vn: 'Đang phát tại The Rampant Room: Coltrane — A Love Supreme (Side B)' },
  { en: 'Now playing in The Rampant Room: Safe Mind — 6\' Pole', vn: 'Đang phát tại The Rampant Room: Safe Mind — 6\' Pole' },
  { en: 'Now playing in The Library Bar Room: Boy Harsher — Tears', vn: 'Đang phát tại The Library Bar Room: Boy Harsher — Tears' },
  { en: 'Now playing in The Rampant Room: Nujabes — Feather', vn: 'Đang phát tại The Rampant Room: Nujabes — Feather' },
  { en: 'Now playing in The Rampant Room: Tinariwen — Chet Boghassa', vn: 'Đang phát tại The Rampant Room: Tinariwen — Chet Boghassa' },

  // The Library
  { en: 'Days since someone fell asleep in the Library: 2', vn: 'Số ngày kể từ lần cuối có người ngủ gật trong Thư viện: 2' },
  { en: 'A member has been swirling the same cognac for 32 minutes. We are monitoring the situation.', vn: 'Một hội viên đã lắc cùng một ly cognac suốt 32 phút. Chúng tôi đang theo dõi tình hình.' },
  { en: 'Days since a dram debate exceeded 45 minutes: 1', vn: 'Số ngày kể từ lần cuối một cuộc tranh luận về whisky kéo dài quá 45 phút: 1' },

  // Operations & quips
  { en: 'Whisky bottles open in The Rampant Room: 292 (and counting)', vn: 'Số chai whisky đang mở tại The Rampant Room: 292 (và vẫn tăng)' },
  { en: 'The oat milk situation has been resolved', vn: 'Vụ sữa yến mạch đã được giải quyết' },
  { en: 'Lost property: Miss Tran\'s tasteful cashmere scarf, Mr Minh\'s interesting gucci wallet', vn: 'Đồ thất lạc: chiếc khăn cashmere tinh tế của Miss Tran, chiếc ví gucci khá "độc đáo" của Mr Minh' },
  { en: 'The Wi-Fi password remains unchanged at 88888888.', vn: 'Mật khẩu Wi-Fi vẫn là 88888888, không hề thay đổi.' },
  { en: 'Car park: one noble steed, two xe máy, one suspiciously nice bicycle', vn: 'Bãi xe: một chiến mã cao quý, hai xe máy, một chiếc xe đạp đẹp đến đáng ngờ' },
  { en: 'The Committee reminds members that "just one more" IS a binding agreement', vn: 'Hội đồng xin nhắc hội viên rằng "thêm một ly nữa thôi" LÀ một cam kết ràng buộc' },
  { en: 'Dress code update: yellow socks with cream sandals now a disciplinary matter', vn: 'Cập nhật quy định trang phục: tất vàng đi cùng dép màu kem giờ là vấn đề kỷ luật' },
  { en: 'A member has requested we stock Sloe Gin in the winter time. The request is under review.', vn: 'Một hội viên đề nghị chúng tôi có Sloe Gin vào mùa đông. Đề nghị đang được xem xét.' },
  { en: 'Book club postponed. No one finished their books. Again.', vn: 'Câu lạc bộ sách tạm hoãn. Không ai đọc xong sách. Lại một lần nữa.' },
  { en: 'The espresso machine is not "broken". You are using it wrong.', vn: 'Máy espresso không hề "hỏng". Chỉ là bạn dùng chưa đúng cách.' },
  { en: 'Lost: one leather bookmark, sentimental value inferred', vn: 'Thất lạc: một thẻ kẹp sách bằng da, có vẻ mang giá trị kỷ niệm' },
  { en: 'The suggestion box has been emptied. Suggestions were... somewhat helpful?', vn: 'Hộp góp ý đã được dọn. Các góp ý... cũng hữu ích phần nào?' },
  { en: 'Tonight\'s conversation topic: "Is Islay overrated?" (It is not.)', vn: 'Chủ đề trò chuyện tối nay: "Islay có được đánh giá quá cao?" (Không hề.)' },
  { en: 'The bees on the rooftop are doing well. Not that you give a buzz.', vn: 'Đàn ong trên sân thượng vẫn khoẻ. Dù chắc bạn cũng chẳng buồn "vo ve" hỏi han.' },
  { en: 'The Chairman\'s dram is not available to non-Chairmen... Unless you ask nicely.', vn: 'Ly của Chủ tịch không dành cho người không phải Chủ tịch... Trừ khi bạn hỏi thật khéo.' },
  { en: 'The cà phê sữa đá is not a substitute for the Dram of the Day. We have discussed this...', vn: 'Cà phê sữa đá không thay thế được Ly của ngày. Chuyện này chúng ta đã bàn rồi...' },
  { en: 'A gecko has been found in The Elevator. He has been granted temporary membership.', vn: 'Một chú thạch sùng được phát hiện trong thang máy. Chú đã được cấp tư cách thành viên tạm thời.' },
  { en: 'Thunder over District 1. The vinyl has been turned up accordingly.', vn: 'Sấm rền trên Quận 1. Đĩa than đã được vặn to tương ứng.' },
]

// Pick one dram per day based on date, then combine with other quips
function getDailyDram(): Quip {
  const now = new Date()
  const daysSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60 * 24))
  return DRAMS[daysSinceEpoch % DRAMS.length]
}

const QUIPS = [getDailyDram(), ...OTHER_QUIPS]

export default function LoginTicker() {
  const { t } = useLang()
  const [time, setTime] = useState('')
  const [temp, setTemp] = useState<number | null>(null)
  const [quipIndex, setQuipIndex] = useState(0)
  const [quipVisible, setQuipVisible] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Hide while scrolled past the top, reveal again at the top
  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setQuipIndex(Math.floor(Math.random() * QUIPS.length))
    setMounted(true)
  }, [])

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      }).format(new Date())
      setTime(now)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Real temperature, through OUR OWN /api/weather — never the vendor directly.
  // connect-src does not allow api.open-meteo.com, so the browser call was blocked
  // every time and the catch quietly substituted 31°. The page looked right and
  // was simply wrong, which is the worst way for a thing to fail. The proxy
  // already existed and already caches for ten minutes; it just was not used.
  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(d => { if (typeof d?.temp === 'number') setTemp(d.temp) })
      .catch(() => {})
  }, [])

  // Rotate quips every 12 seconds with fade
  const rotateQuip = useCallback(() => {
    setQuipVisible(false)
    setTimeout(() => {
      setQuipIndex(prev => {
        const prevQuip = QUIPS[prev]
        const prevIsNowPlaying = prevQuip.en.startsWith('Now playing')
        let next = prev
        let attempts = 0
        while (attempts < 50) {
          next = Math.floor(Math.random() * QUIPS.length)
          if (next === prev) { attempts++; continue }
          if (prevIsNowPlaying && QUIPS[next].en.startsWith('Now playing')) { attempts++; continue }
          break
        }
        return next
      })
      setQuipVisible(true)
    }, 400)
  }, [])

  useEffect(() => {
    const id = setInterval(rotateQuip, 8000)
    return () => clearInterval(id)
  }, [rotateQuip])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        fontFamily: "'Google Sans Code', 'DM Mono', monospace",
        fontSize: 11,
        letterSpacing: '0.06em',
        color: '#E5D4C2',
        opacity: hidden ? 0 : 0.4,
        transform: hidden ? 'translateY(-8px)' : 'translateY(0)',
        pointerEvents: hidden ? 'none' : 'auto',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: '12px 20px',
        borderBottom: '1px solid rgba(229,212,194,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Clock + temp */}
      <span style={{ whiteSpace: 'nowrap' }}>
        {temp !== null ? `${temp}°C` : '—'} &nbsp;|&nbsp; {time || '—'} GMT+7
      </span>

      {/* Diamond separator */}
      <span
        style={{
          display: 'inline-block',
          width: 4,
          height: 4,
          background: '#E5D4C2',
          transform: 'rotate(45deg)',
          opacity: 0.4,
          flexShrink: 0,
        }}
      />

      {/* Rotating quip */}
      <span
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: quipVisible ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      >
        {mounted ? t(QUIPS[quipIndex].en, QUIPS[quipIndex].vn) : ''}
      </span>
    </div>
  )
}
