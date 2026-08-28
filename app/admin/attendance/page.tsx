'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/admin-lang'
import { vnDateString } from '@/lib/datetime'

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Guest { id: string; guest_name: string; host_member_no: string | null; visit_date: string; duration_min: number | null; party_size: number; note: string | null }

const fmt = (d: string) => new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

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
    setGuests(g => g.filter(x => x.id !== id))
    try { await fetch(`/api/admin/guest-visits/${id}`, { method: 'DELETE' }) } catch { /* */ }
  }

  // This-week (VN Mon–Sun) rollup.
  const weekTotals = useMemo(() => {
    const now = new Date(vnDateString() + 'T12:00:00+07:00')
    const dow = (now.getDay() + 6) % 7
    const mon = new Date(now); mon.setDate(now.getDate() - dow)
    const from = vnDateString(mon)
    const wk = guests.filter(g => g.visit_date >= from)
    return { heads: wk.reduce((s, g) => s + (g.party_size || 1), 0), hours: Math.round(wk.reduce((s, g) => s + (g.duration_min || 0), 0) / 60), count: wk.length }
  }, [guests])

  const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 7, padding: '9px 12px', fontFamily: MONO, fontSize: 12, outline: 'none' }
  const label: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98', margin: '0 0 4px', display: 'block' }

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('Guest Attendance', 'Khách Ghé Thăm')}</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 20, letterSpacing: '0.04em' }}>
        {t('Log guests and walk-ins (non-members) so the weekly report counts everyone who’s been in — members are already tracked via visits.', 'Ghi lại khách và người ghé (không phải hội viên) để báo cáo tuần tính đủ mọi người — hội viên đã được ghi qua lượt ghé.')}
        {weekTotals.count > 0 && ` · ${t('This week', 'Tuần này')}: ${weekTotals.heads} ${t('guests', 'khách')}${weekTotals.hours ? `, ~${weekTotals.hours}h` : ''}`}
      </p>

      <div style={{ border: '1px solid rgba(212,184,90,0.25)', borderRadius: 12, padding: 18, marginBottom: 24, background: 'rgba(5,46,32,0.4)' }}>
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

      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 8 }}>{t('Recent', 'Gần đây')}</div>
      {loading ? <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6 }}>{t('Loading…', 'Đang tải…')}</div>
        : guests.length === 0 ? <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '16px 0' }}>{t('No guests logged yet.', 'Chưa có khách nào được ghi.')}</div>
        : guests.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 9, marginBottom: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{g.guest_name}{g.party_size > 1 ? ` +${g.party_size - 1}` : ''}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98' }}>{fmt(g.visit_date)}{g.duration_min ? ` · ${g.duration_min}m` : ''}{g.host_member_no ? ` · ${t('host', 'mời')} ${g.host_member_no.replace(/^TRC-M/i, '#')}` : ''}</span>
            <button onClick={() => remove(g.id)} style={{ fontFamily: MONO, fontSize: 10, background: 'none', border: 'none', color: '#8A6A6A', cursor: 'pointer' }}>{t('Remove', 'Xoá')}</button>
          </div>
        ))}
    </div>
  )
}
