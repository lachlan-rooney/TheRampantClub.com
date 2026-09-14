'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/admin-lang'
import { vnDateString } from '@/lib/datetime'

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Guest {
  id: string; guest_name: string; host_member_no: string | null; visit_date: string; duration_min: number | null; party_size: number; note: string | null
  // Door sign-ins (db/guest_signin.sql, 2026-09-14). Absent on manual entries and before that SQL has run.
  signed_in_at?: string | null; on_list?: boolean | null; referred_reason?: string | null
  decision?: 'admitted' | 'refused' | null; decision_reason?: string | null; decided_by_name?: string | null; decided_at?: string | null
  host_name?: string | null
  signature?: 'live' | 'deleted' | null
}

const fmt = (d: string) => new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' })

// A referral nobody decided within two hours was settled some other way — the
// door stops accepting a decision on it then (app/api/kiosk/door/shared.ts).
const STALE_MS = 2 * 3600 * 1000

// Not a guest who came in: refused at the door, or still waiting on the duty manager.
const counts = (g: Guest) => g.decision !== 'refused' && !(g.referred_reason && !g.decision)

export default function AttendancePage() {
  const { t } = useLang()
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ guest_name: '', visit_date: vnDateString(), duration_min: '', party_size: '1', host_member_no: '', note: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/guest-visits', { cache: 'no-store' }); const j = await r.json(); setGuests(j.guests || []) }
    catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/admin/guest-visits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: form.guest_name,
          visit_date: form.visit_date,
          duration_min: form.duration_min || undefined,
          party_size: form.party_size || 1,
          host_member_no: form.host_member_no || undefined,
          note: form.note || undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || t('Could not save.', 'Không thể lưu.')); return }
      setForm(f => ({ ...f, guest_name: '', duration_min: '', party_size: '1', host_member_no: '', note: '' }))
      await load()
    } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    const prev = guests
    setGuests(g => g.filter(x => x.id !== id))
    try {
      const r = await fetch(`/api/admin/guest-visits/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
    } catch {
      // Delete failed — restore the row and tell the operator.
      setGuests(prev); setError(t('Could not remove that guest — try again.', 'Không thể xoá khách đó — thử lại.'))
    }
  }

  // This-week (VN Mon–Sun) rollup. Compute the boundary PURELY in VN space via
  // UTC accessors — browser-local getDay()/getDate() would be a day off for
  // admins west of ~UTC-5. Refusals and undecided referrals are not visits.
  const weekTotals = useMemo(() => {
    const [y, m, d] = vnDateString().split('-').map(Number)
    const base = new Date(Date.UTC(y, m - 1, d))
    const dow = (base.getUTCDay() + 6) % 7            // Mon=0
    const mon = new Date(base); mon.setUTCDate(base.getUTCDate() - dow)
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
    const from = mon.toISOString().slice(0, 10)
    const to = sun.toISOString().slice(0, 10)
    const wk = guests.filter(g => g.visit_date >= from && g.visit_date <= to && counts(g))
    return { heads: wk.reduce((s, g) => s + (g.party_size || 1), 0), hours: Math.round(wk.reduce((s, g) => s + (g.duration_min || 0), 0) / 60), count: wk.length }
  }, [guests])

  const door = guests.filter(g => g.signed_in_at)
  const manual = guests.filter(g => !g.signed_in_at)

  const reasonLabel = (r: string | null | undefined) =>
    r === 'after_last_entry' ? t('after 10:30pm', 'sau 22:30')
    : r === 'already_signed_in' ? t('already signed in', 'đã đăng ký trước đó')
    : r === 'not_on_list' ? t('name not given', 'chưa báo tên') : ''

  const status = (g: Guest): { text: string; tone: 'ok' | 'gold' | 'bad' | 'wait' } => {
    if (!g.referred_reason) return { text: t('On the list', 'Có trong danh sách'), tone: 'ok' }
    if (g.decision === 'admitted') return { text: `${t('Admitted by', 'Cho vào bởi')} ${g.decided_by_name || t('staff', 'nhân viên')} · ${reasonLabel(g.referred_reason)}`, tone: 'gold' }
    if (g.decision === 'refused') return { text: `${t('Refused by', 'Từ chối bởi')} ${g.decided_by_name || t('staff', 'nhân viên')} · ${reasonLabel(g.referred_reason)}`, tone: 'bad' }
    const stale = g.signed_in_at && Date.now() - +new Date(g.signed_in_at) > STALE_MS
    return { text: `${stale ? t('Not decided at the door', 'Chưa được quyết định tại cửa') : t('Waiting for the duty manager', 'Đang chờ quản lý ca trực')} · ${reasonLabel(g.referred_reason)}`, tone: 'wait' }
  }
  const toneStyle = (tone: 'ok' | 'gold' | 'bad' | 'wait'): React.CSSProperties =>
    tone === 'ok' ? { color: '#7AB07A', borderColor: 'rgba(122,176,122,0.4)' }
    : tone === 'gold' ? { color: '#D4B85A', borderColor: 'rgba(212,184,90,0.4)' }
    : tone === 'bad' ? { color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }
    : { color: '#E5D4C2', borderColor: 'rgba(229,212,194,0.35)' }

  const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 7, padding: '9px 12px', fontFamily: MONO, fontSize: 12, outline: 'none' }
  const label: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98', margin: '0 0 4px', display: 'block' }
  const section: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 8 }
  const empty: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '16px 0' }

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('Guest Attendance', 'Khách Ghé Thăm')}</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 20, letterSpacing: '0.04em' }}>
        {t('Log guests and walk-ins (non-members) so the weekly report counts everyone who’s been in — members are already tracked via visits.', 'Ghi lại khách và người ghé (không phải hội viên) để báo cáo tuần tính đủ mọi người — hội viên đã được ghi qua lượt ghé.')}
        {weekTotals.count > 0 && ` · ${t('This week', 'Tuần này')}: ${weekTotals.heads} ${t('guests', 'khách')}${weekTotals.hours ? `, ~${weekTotals.hours}h` : ''}`}
      </p>

      {/* ── AT THE DOOR ─────────────────────────────────────────────────────
          Signed in on the door iPad. The signature thumbnail exists for seven
          days from signing; after that the image is gone and only the record
          remains. The image is fetched per row from a route that applies the
          seven-day rule itself, so a late clean-up job can never show an old one. */}
      <div style={section}>{t('At the door', 'Tại cửa')}</div>
      {loading ? <div style={{ ...empty, fontStyle: 'normal' }}>{t('Loading…', 'Đang tải…')}</div>
        : door.length === 0 ? <div style={empty}>{t('No door sign-ins yet.', 'Chưa có lượt đăng ký tại cửa.')}</div>
        : door.map(g => {
          const s = status(g)
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 9, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', width: 92, flexShrink: 0 }}>{fmt(g.visit_date)}<br />{g.signed_in_at ? hhmm(g.signed_in_at) : ''}</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{g.guest_name}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', marginTop: 3 }}>
                  {g.host_name || g.host_member_no ? `${t('guest of', 'khách của')} ${g.host_name || g.host_member_no}` : t('no host on the list', 'không có hội viên mời trong danh sách')}
                </div>
                <span style={{ display: 'inline-block', marginTop: 6, fontFamily: MONO, fontSize: 9, padding: '2px 8px', borderRadius: 8, border: '1px solid', letterSpacing: '0.04em', ...toneStyle(s.tone) }}>{s.text}</span>
                {g.decision_reason && <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', marginTop: 4, fontStyle: 'italic' }}>“{g.decision_reason}”</div>}
              </div>
              {g.signature === 'live' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/admin/guest-visits/${g.id}/signature`} alt={t('Signature', 'Chữ ký')} loading="lazy"
                  style={{ width: 132, height: 50, objectFit: 'contain', background: '#E5D4C2', borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <span style={{ width: 132, fontFamily: MONO, fontSize: 9, color: '#7E7864', textAlign: 'center', flexShrink: 0, lineHeight: 1.5 }}>
                  {t('signature deleted after 7 days', 'chữ ký đã xoá sau 7 ngày')}
                </span>
              )}
              <button onClick={() => remove(g.id)} style={{ fontFamily: MONO, fontSize: 10, background: 'none', border: 'none', color: '#8A6A6A', cursor: 'pointer' }}>{t('Remove', 'Xoá')}</button>
            </div>
          )
        })}

      <div style={{ border: '1px solid rgba(212,184,90,0.25)', borderRadius: 12, padding: 18, margin: '28px 0 24px', background: 'rgba(5,46,32,0.4)' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D4B85A', marginBottom: 12 }}>{t('Log a guest', 'Ghi một khách')}</div>
        {error && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={label}>{t('Guest name', 'Tên khách')}</label><input style={input} value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} placeholder={t('e.g. Mr Tran (guest of #012)', 'vd. Ông Trần (khách của #012)')} /></div>
          <div><label style={label}>{t('Date', 'Ngày')}</label><input style={input} type="date" value={form.visit_date} onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={label}>{t('Party size', 'Số người')}</label><input style={input} type="number" min={1} value={form.party_size} onChange={e => setForm(f => ({ ...f, party_size: e.target.value }))} /></div>
          <div><label style={label}>{t('Minutes stayed', 'Số phút ở lại')}</label><input style={input} type="number" min={0} value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} placeholder={t('optional', 'tuỳ chọn')} /></div>
          <div><label style={label}>{t('Host member # (opt.)', 'Hội viên mời (tuỳ chọn)')}</label><input style={input} value={form.host_member_no} onChange={e => setForm(f => ({ ...f, host_member_no: e.target.value }))} placeholder="TRC-M012" /></div>
        </div>
        <input style={{ ...input, marginBottom: 12 }} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t('Note (optional)', 'Ghi chú (tuỳ chọn)')} />
        <button onClick={add} disabled={busy || !form.guest_name.trim()} style={{ fontFamily: MONO, fontSize: 11, background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 7, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', opacity: busy || !form.guest_name.trim() ? 0.5 : 1 }}>{busy ? t('Saving…', 'Đang lưu…') : t('Log guest', 'Ghi khách')}</button>
      </div>

      <div style={section}>{t('Logged by hand', 'Ghi thủ công')}</div>
      {loading ? <div style={{ ...empty, fontStyle: 'normal' }}>{t('Loading…', 'Đang tải…')}</div>
        : manual.length === 0 ? <div style={empty}>{t('No guests logged yet.', 'Chưa có khách nào được ghi.')}</div>
        : manual.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 9, marginBottom: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{g.guest_name}{g.party_size > 1 ? ` +${g.party_size - 1}` : ''}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98' }}>{fmt(g.visit_date)}{g.duration_min ? ` · ${g.duration_min}m` : ''}{g.host_member_no ? ` · ${t('host', 'mời')} ${g.host_member_no.replace(/^TRC-M/i, '#')}` : ''}</span>
            <button onClick={() => remove(g.id)} style={{ fontFamily: MONO, fontSize: 10, background: 'none', border: 'none', color: '#8A6A6A', cursor: 'pointer' }}>{t('Remove', 'Xoá')}</button>
          </div>
        ))}
    </div>
  )
}
