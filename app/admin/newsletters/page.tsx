'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface NL { id: string; period_start: string; period_end: string; subject: string; status: string; sent_at: string | null; recipient_count: number | null; token_view_count: number }
interface Settings { approver_profile: string | null; send_enabled: boolean; from_name: string; from_email: string; test_recipients: string[]; suppress: string[] }

const STATUS: Record<string, { en: string; vi: string; color: string }> = {
  draft: { en: 'Draft', vi: 'Bản nháp', color: '#B2AA98' },
  pending_approval: { en: 'Awaiting approval', vi: 'Chờ duyệt', color: '#E58F4A' },
  approved: { en: 'Approved', vi: 'Đã duyệt', color: '#7AB07A' },
  sent: { en: 'Sent', vi: 'Đã gửi', color: '#D4B85A' },
}
const fmt = (d: string) => new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export default function AdminNewslettersPage() {
  const { t } = useLang()
  const router = useRouter()
  const [items, setItems] = useState<NL[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [recipientCount, setRecipientCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/newsletters', { cache: 'no-store' })
      const j = await r.json()
      setItems(j.newsletters || []); setSettings(j.settings); setRecipientCount(j.recipient_count || 0)
    } catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const generate = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/newsletters/generate', { method: 'POST' })
      const j = await r.json()
      if (j.id) router.push(`/admin/newsletters/${j.id}`)
    } finally { setBusy(false) }
  }

  const saveSettings = async (patch: Partial<Settings>) => {
    setSettings(s => s ? { ...s, ...patch } : s)
    await fetch('/api/admin/newsletters/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    load()
  }

  const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 7, padding: '9px 12px', fontFamily: MONO, fontSize: 12, outline: 'none', marginBottom: 10 }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('Member Newsletter', 'Bản Tin Hội Viên')}</h1>
          <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em' }}>
            {t('A broadcast to all members — recaps, updates, new members to greet. Draft → approve → send.', 'Gửi đến tất cả hội viên — tổng kết, cập nhật, chào hội viên mới. Nháp → duyệt → gửi.')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <button onClick={generate} disabled={busy} style={{ fontFamily: MONO, fontSize: 11, background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 7, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>{busy ? t('Preparing…', 'Đang chuẩn bị…') : t("＋ Draft this month", '＋ Nháp tháng này')}</button>
          <button onClick={() => setShowSettings(s => !s)} style={{ fontFamily: MONO, fontSize: 10, background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.2)', borderRadius: 7, padding: '7px 14px', cursor: 'pointer' }}>{t('Settings', 'Cài đặt')}</button>
        </div>
      </div>

      {/* Send-safety banner */}
      <div style={{ margin: '18px 0', padding: '12px 16px', borderRadius: 10, border: `1px solid ${settings?.send_enabled ? 'rgba(122,176,122,0.4)' : 'rgba(212,184,90,0.4)'}`, background: settings?.send_enabled ? 'rgba(122,176,122,0.08)' : 'rgba(212,184,90,0.08)', fontFamily: MONO, fontSize: 11, color: '#E5D4C2', lineHeight: 1.6 }}>
        {settings?.send_enabled
          ? `✓ ${t('Sending is ON', 'Gửi đang BẬT')} — ${recipientCount} ${t('members would receive a live send.', 'hội viên sẽ nhận khi gửi thật.')}`
          : `⚠ ${t('Sending is OFF (safe)', 'Gửi đang TẮT (an toàn)')} — ${t('a live blast is blocked until you turn on the master switch in Settings.', 'không thể gửi hàng loạt cho đến khi bật công tắc chính trong Cài đặt.')} ${recipientCount} ${t('members on file.', 'hội viên trong danh sách.')}`}
      </div>

      {showSettings && settings && (
        <div style={{ border: '1px solid rgba(229,212,194,0.14)', borderRadius: 12, padding: 18, marginBottom: 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 12, color: '#E5D4C2', marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.send_enabled} onChange={e => saveSettings({ send_enabled: e.target.checked })} />
            {t('Master send switch — allow live sends to all members', 'Công tắc gửi chính — cho phép gửi thật đến tất cả hội viên')}
          </label>
          <div style={{ fontFamily: MONO, fontSize: 11, color: settings.approver_profile ? '#7AB07A' : '#E58F4A', marginBottom: 14 }}>
            {settings.approver_profile
              ? `✓ ${t('Approver is set — only they can approve.', 'Đã đặt người duyệt — chỉ họ mới được duyệt.')}`
              : <>⚠ {t('No approver set — any admin can approve.', 'Chưa có người duyệt — bất kỳ admin nào cũng có thể duyệt.')}{' '}
                  <button onClick={() => saveSettings({ approver_profile: 'me' } as unknown as Partial<Settings>)} style={{ fontFamily: MONO, fontSize: 10, background: 'rgba(212,184,90,0.15)', color: '#E7C766', border: '1px solid rgba(212,184,90,0.4)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>{t('Set me as approver', 'Đặt tôi làm người duyệt')}</button></>}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B2AA98', margin: '0 0 4px' }}>{t('From name / email', 'Tên / email người gửi')}</div>
          <input style={input} defaultValue={settings.from_name} onBlur={e => saveSettings({ from_name: e.target.value })} />
          <input style={input} defaultValue={settings.from_email} onBlur={e => saveSettings({ from_email: e.target.value })} />
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B2AA98', margin: '0 0 4px' }}>{t('Test recipients (comma / newline)', 'Người nhận thử (phẩy / xuống dòng)')}</div>
          <textarea style={{ ...input, minHeight: 54 }} defaultValue={(settings.test_recipients || []).join('\n')} onBlur={e => saveSettings({ test_recipients: e.target.value as unknown as string[] })} />
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B2AA98', margin: '0 0 4px' }}>{t('Suppression list — never email these', 'Danh sách chặn — không bao giờ gửi')}</div>
          <textarea style={{ ...input, minHeight: 40 }} defaultValue={(settings.suppress || []).join('\n')} onBlur={e => saveSettings({ suppress: e.target.value as unknown as string[] })} />
        </div>
      )}

      {loading ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6 }}>{t('Loading…', 'Đang tải…')}</div>
      ) : items.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '24px 0' }}>{t('No newsletters yet — draft this month to begin.', 'Chưa có bản tin — tạo nháp tháng này để bắt đầu.')}</div>
      ) : items.map(n => {
        const st = STATUS[n.status] || STATUS.draft
        return (
          <Link key={n.id} href={`/admin/newsletters/${n.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10, marginBottom: 8, textDecoration: 'none', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2', flex: 1, minWidth: 0 }}>{n.subject}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98' }}>{fmt(n.period_start)}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: st.color, border: `1px solid ${st.color}55`, borderRadius: 999, padding: '2px 9px' }}>{t(st.en, st.vi)}</span>
            {n.status === 'sent' && <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{n.recipient_count} {t('sent', 'đã gửi')} · {n.token_view_count} {t('views', 'lượt xem')}</span>}
          </Link>
        )
      })}
    </div>
  )
}
