'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/admin-lang'

// Staff view: introductions forming — the gracious host's awareness, to host around
// connections. Declines included (audit). Staff see THAT introductions happen; the
// resulting DMs are closed to staff (proven). No message contents here, ever.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Intro { id: string; via: string; from_name: string; to_name: string; status: string; context: string | null; created_at: string }
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#B2AA98' },
  accepted: { label: 'Connected', color: '#7AB07A' },
  declined: { label: 'Declined', color: '#C27070' },
}

export default function AdminIntroductions() {
  const { t } = useLang()
  const [rows, setRows] = useState<Intro[]>([])
  useEffect(() => { fetch('/api/admin/introductions').then(r => r.ok ? r.json() : { introductions: [] }).then(j => setRows(j.introductions || [])) }, [])

  return (
    <div>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('Introductions', 'Giới thiệu')}</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 4, letterSpacing: '0.04em' }}>{t('Connections forming — so the club can host around them.', 'Những kết nối đang hình thành — để câu lạc bộ có thể chăm sóc quanh chúng.')}</p>
      <p style={{ fontFamily: MONO, fontSize: 10, color: '#7E7864', marginBottom: 24, fontStyle: 'italic' }}>{t('Staff see that introductions happen. The resulting direct messages are closed to staff.', 'Nhân viên thấy rằng các lời giới thiệu diễn ra. Những tin nhắn riêng phát sinh từ đó không cho nhân viên xem.')}</p>

      {rows.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }}>{t('No introductions yet.', 'Chưa có lời giới thiệu nào.')}</div>
      ) : rows.map(i => {
        const s = STATUS[i.status] || STATUS.pending
        return (
          <div key={i.id} style={row}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{i.from_name} <span style={{ color: '#7E7864' }}>→</span> {i.to_name}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                {i.via === 'palate_match' && <span style={{ fontFamily: MONO, fontSize: 9, color: '#9E8FC4', border: '1px solid #9E8FC455', borderRadius: 8, padding: '2px 8px' }}>{t('palate', 'khẩu vị')}</span>}
                <span style={{ fontFamily: MONO, fontSize: 9, color: s.color, border: `1px solid ${s.color}55`, borderRadius: 8, padding: '2px 8px', letterSpacing: '0.04em' }}>{s.label}</span>
              </span>
            </div>
            {i.context && <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', fontStyle: 'italic', margin: '5px 0' }}>“{i.context}”</div>}
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', marginTop: 4 }}>{fmt(i.created_at)}</div>
          </div>
        )
      })}
    </div>
  )
}

const row: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10, padding: '11px 13px', marginBottom: 8 }
