'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useLang } from '@/lib/admin-lang'

// Admin → Weekly Report (Operations). Lists reports + generates this week's draft.

interface Row {
  id: string
  period_start: string
  period_end: string
  status: string
  headline: string | null
  sent_to: string[] | null
  token_view_count: number
  include_financials: boolean
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#B2AA98' },
  pending_approval: { label: 'Awaiting approval', color: '#D4B85A' },
  approved: { label: 'Approved', color: '#7AB07A' },
  sent: { label: 'Sent', color: '#5B8FA8' },
}

export default function AdminReports() {
  const { t } = useLang()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const sb = createBrowserSupabaseClient()
    const { data } = await sb.from('weekly_reports').select('id, period_start, period_end, status, headline, sent_to, token_view_count, include_financials').order('period_start', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const generate = async () => {
    setBusy(true); setMsg('')
    const r = await fetch('/api/admin/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (r.ok) router.push(`/admin/reports/${d.id}`)
    else setMsg(d.error || t('Failed to generate', 'Không thể tạo báo cáo'))
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 8 }}>{t('Weekly Report', 'Báo cáo hàng tuần')}</h1>
          <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 20, lineHeight: 1.6, maxWidth: 620 }}>
            {t('Auto-drafted each Monday with the week’s data. Add the narrative, submit for approval, then it’s sent to Shawn (17:00 VN Mon) with a link to the full report.', 'Tự động soạn thảo mỗi thứ Hai với dữ liệu trong tuần. Thêm phần diễn giải, gửi để phê duyệt, rồi báo cáo được gửi cho Shawn (17:00 giờ VN, thứ Hai) kèm liên kết đến báo cáo đầy đủ.')}
          </p>
        </div>
        <button onClick={generate} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>
          {busy ? t('Generating…', 'Đang tạo…') : t('Generate this week’s draft', 'Tạo bản nháp tuần này')}
        </button>
      </div>
      {msg && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 12 }}>{msg}</div>}

      <div style={card}>
        {loading ? <div style={{ fontFamily: MONO, fontSize: 11, color: '#7E7864' }}>{t('Loading…', 'Đang tải…')}</div> : rows.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98' }}>{t('No reports yet — generate this week’s draft to begin.', 'Chưa có báo cáo nào — tạo bản nháp tuần này để bắt đầu.')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{[t('Week', 'Tuần'), t('Headline', 'Tiêu đề'), t('Status', 'Trạng thái'), t('Views', 'Lượt xem'), ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => {
                const s = STATUS[r.status] || STATUS.draft
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(229,212,194,0.06)' }}>
                    <td style={td}>{fmt(r.period_start)} – {fmt(r.period_end)}{r.include_financials ? <span style={finTag}>{t('+ financials', '+ tài chính')}</span> : ''}</td>
                    <td style={{ ...td, color: '#E5D4C2' }}>{r.headline || '—'}</td>
                    <td style={td}><span style={{ color: s.color }}>● {s.label}</span></td>
                    <td style={td}>{r.token_view_count || 0}</td>
                    <td style={{ ...td, textAlign: 'right' }}><Link href={`/admin/reports/${r.id}`} style={btnGhost}>{t('Open', 'Mở')}</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

const card: React.CSSProperties = { padding: 22, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 12, marginTop: 8 }
const th: React.CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 9, color: '#7E7864', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 10px' }
const td: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', padding: '10px 10px' }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 8, padding: '11px 20px', cursor: 'pointer', fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontFamily: MONO, fontSize: 10, textDecoration: 'none' }
const finTag: React.CSSProperties = { marginLeft: 8, fontFamily: MONO, fontSize: 8, color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 10, padding: '1px 7px' }
