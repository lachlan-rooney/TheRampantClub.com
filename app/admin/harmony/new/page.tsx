'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { vnDateString } from '@/lib/datetime'
import { useLang } from '@/lib/admin-lang'

// Admin / Floor / Harmony Log / New
//
// Capture the night's narrative. Submit creates the log row + redirects
// to the detail page where the Claude extraction stream runs.

const SHIFTS = ['early', 'evening', 'late', 'all-day']

export default function NewHarmonyLogPage() {
  const { t } = useLang()
  const router = useRouter()
  const today = vnDateString()
  const [shift_date, setShiftDate] = useState(today)
  const [shift_label, setShiftLabel] = useState('evening')
  const [attendee_count, setAttendeeCount] = useState('')
  const [weather, setWeather] = useState('')
  const [room_state, setRoomState] = useState('')
  const [narrative, setNarrative] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (then: 'extract' | 'save') => {
    if (!narrative.trim()) { setError(t('Narrative required.', 'Cần nhập tường thuật.')); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/admin/harmony', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date, shift_label,
          attendee_count: attendee_count ? Number(attendee_count) : null,
          weather: weather || null,
          room_state: room_state || null,
          narrative,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Save failed', 'Lưu thất bại'))
      // Detail page reads ?run=1 and kicks off extraction automatically.
      router.push(`/admin/harmony/${j.log.id}${then === 'extract' ? '?run=1' : ''}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }, [shift_date, shift_label, attendee_count, weather, room_state, narrative, router, t])

  return (
    <>
      <Link href="/admin/harmony" style={backLink}>← {t('Harmony Log', 'Nhật ký ca trực')}</Link>

      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>{t('Floor · Harmony Log', 'Sảnh · Nhật ký ca trực')}</div>
        <h1 style={pageTitle}>{t("Tonight's shift", 'Ca trực tối nay')}</h1>
        <p style={lede}>
          {t('Type what happened tonight in plain English — who came in, what they drank, what they said, anything that mattered. Hit', 'Ghi lại những gì đã diễn ra tối nay bằng lời văn tự nhiên — ai đã đến, họ uống gì, họ nói gì, bất cứ điều gì đáng lưu ý. Nhấn')} <strong>{t('Process', 'Xử lý')}</strong> {t('and Claude reads it back and proposes structured updates. You tick what to keep.', 'và Claude sẽ đọc lại rồi đề xuất các cập nhật có cấu trúc. Bạn chọn những gì muốn giữ lại.')}
        </p>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {/* Metadata strip */}
      <div style={metaGrid}>
        <div style={fieldRow}>
          <div style={editLabel}>{t('Shift date', 'Ngày ca trực')}</div>
          <input type="date" value={shift_date} onChange={e => setShiftDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>{t('Shift', 'Ca trực')}</div>
          <select value={shift_label} onChange={e => setShiftLabel(e.target.value)} style={inputStyle}>
            {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>{t('Attendees', 'Số khách')}</div>
          <input type="number" min="0" value={attendee_count} onChange={e => setAttendeeCount(e.target.value)} placeholder="0" style={inputStyle} />
        </div>
        <div style={fieldRow}>
          <div style={editLabel}>{t('Weather', 'Thời tiết')}</div>
          <input value={weather} onChange={e => setWeather(e.target.value)} placeholder={t('Heavy rain · Cool · Humid', 'Mưa lớn · Mát · Ẩm')} style={inputStyle} />
        </div>
        <div style={{ ...fieldRow, gridColumn: '1 / -1' }}>
          <div style={editLabel}>{t('Room state · vibe', 'Trạng thái phòng · không khí')}</div>
          <input value={room_state} onChange={e => setRoomState(e.target.value)} placeholder={t('Quiet early, lively after 9. Cigar terrace busy.', 'Đầu giờ vắng, sôi động sau 9 giờ. Sân xì gà đông khách.')} style={inputStyle} />
        </div>
      </div>

      {/* Narrative */}
      <div style={{ marginTop: 22 }}>
        <div style={editLabel}>{t('Narrative', 'Tường thuật')} *</div>
        <textarea
          value={narrative}
          onChange={e => setNarrative(e.target.value)}
          rows={18}
          placeholder={t(`Type freely. Names, drinks, conversations, complaints, walk-ins, charges. Example:

"Mr Smith came in with Tran around 8. They finished Smith's Hibiki 21 — about three pours each. Smith asked about Bowmore 25 next visit. Mentioned a friend Mike who runs a hedge fund, intro'd them by name and asked if we'd consider him for membership. Sarah complained about music volume early — we turned it down and she was happy. Tran picked up the tab, ~4.2M off his card."`, `Nhập tự do. Tên khách, đồ uống, trò chuyện, phàn nàn, khách vãng lai, hóa đơn. Ví dụ:

"Ông Smith vào cùng Trần khoảng 8 giờ. Họ uống hết chai Hibiki 21 của Smith — mỗi người khoảng ba ly. Smith hỏi về Bowmore 25 cho lần tới. Có nhắc đến một người bạn tên Mike làm quỹ đầu cơ, giới thiệu tên và hỏi liệu chúng ta có cân nhắc kết nạp hội viên không. Sarah phàn nàn nhạc mở to lúc đầu — chúng ta đã vặn nhỏ và cô ấy hài lòng. Trần thanh toán, ~4.2M từ thẻ của anh ấy."`)}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 280, fontFamily: "'Google Sans Code', monospace", lineHeight: 1.7 }}
        />
        <div style={{ ...lede, marginTop: 6, fontSize: 11 }}>
          {narrative.length.toLocaleString()} {t('chars · Claude reads the whole thing before proposing anything.', 'ký tự · Claude đọc toàn bộ trước khi đề xuất bất kỳ điều gì.')}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
        <button
          onClick={() => submit('extract')}
          disabled={saving || !narrative.trim()}
          style={{ ...btnPrimary, opacity: !narrative.trim() ? 0.4 : 1, cursor: !narrative.trim() ? 'not-allowed' : 'pointer' }}
        >
          {saving ? t('Saving…', 'Đang lưu…') : `◆ ${t('Save & Process', 'Lưu & Xử lý')} →`}
        </button>
        <button
          onClick={() => submit('save')}
          disabled={saving || !narrative.trim()}
          style={{ ...btnGhost, opacity: !narrative.trim() ? 0.4 : 1, cursor: !narrative.trim() ? 'not-allowed' : 'pointer' }}
        >
          {t('Save as draft', 'Lưu nháp')}
        </button>
        <Link href="/admin/harmony" style={btnGhost}>{t('Cancel', 'Hủy')}</Link>
      </div>
    </>
  )
}

const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 18, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const metaGrid: React.CSSProperties = {
  display: 'grid', gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
}
const fieldRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textAlign: 'center',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', textDecoration: 'none',
  textAlign: 'center', cursor: 'pointer',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
