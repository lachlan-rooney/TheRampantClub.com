'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PromptModal } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'

// Admin / Floor / MX Daily
//
// The Member Experience Manager's morning check-in: birthdays this week,
// anniversaries, lapsed-member radar (30/60/90), and the complaint queue.

interface Birthday {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  birthday: string
  days_until: number
}
interface Anniversary {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  join_date: string
  years: number
  days_until: number
  gifting: { budget_vnd: number; spent_vnd: number; remaining_vnd: number; gift_count: number } | null
}
interface LapsedRow {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  last_visit: string | null
  days_since_visit: number
  total_visits: number
}
interface Complaint {
  id: string
  member_no: string | null
  member_name: string | null
  severity: number
  category: string | null
  summary: string
  details: string | null
  status: string
  reported_by: string | null
  resolved_by: string | null
  resolution: string | null
  reported_at: string
  resolved_at: string | null
}

interface ClosingHandover {
  shift_date: string
  items: Array<{ id: string; label: string; checked: boolean; name: string | null; ts: string | null }>
  free_notes: string | null
  submitted_by: string | null
  submitted_at: string | null
  handover_acknowledged_by: string | null
  handover_acknowledged_at: string | null
}

interface MissedSeal {
  shift_date: string
  missing: ('opening' | 'closing')[]
}
interface Data {
  birthdays: Birthday[]
  anniversaries: Anniversary[]
  lapsed: { bucket_30: LapsedRow[]; bucket_60: LapsedRow[]; bucket_90: LapsedRow[] }
  complaints: Complaint[]
  last_closing: ClosingHandover | null
  missed_seals: MissedSeal[]
  counts: { birthdays: number; anniversaries: number; lapsed_total: number; complaints_open: number; missed_seals: number }
}

export default function MXDailyPage() {
  const { t } = useLang()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddComplaint, setShowAddComplaint] = useState(false)
  const [c, setC] = useState({ member_no: '', member_name: '', summary: '', severity: 2, category: '', details: '' })
  const [submitting, setSubmitting] = useState(false)
  // Handover-ack state. Shares the localStorage initials key with the
  // checklists page so a staff member only types their initials once
  // per session across both surfaces.
  const [ackInitials, setAckInitials] = useState('')
  const [ackBusy, setAckBusy] = useState(false)
  const [ackError, setAckError] = useState<string | null>(null)
  useEffect(() => {
    try { setAckInitials(localStorage.getItem('checklist_initials') || '') } catch { /* */ }
  }, [])
  const persistAckInitials = (v: string) => {
    setAckInitials(v)
    try { localStorage.setItem('checklist_initials', v) } catch { /* */ }
  }

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/mx-daily', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const submitComplaint = async () => {
    if (!c.summary.trim()) return
    setSubmitting(true)
    await fetch('/api/admin/complaints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_no: c.member_no || null,
        member_name: c.member_name || null,
        summary: c.summary,
        severity: c.severity,
        category: c.category || null,
        details: c.details || null,
      }),
    })
    setC({ member_no: '', member_name: '', summary: '', severity: 2, category: '', details: '' })
    setShowAddComplaint(false)
    setSubmitting(false)
    load()
  }

  const acknowledgeHandover = async () => {
    if (!data?.last_closing) return
    if (!ackInitials.trim()) { setAckError(t('Enter your initials first.', 'Vui lòng nhập tên viết tắt của bạn trước.')); return }
    setAckBusy(true); setAckError(null)
    try {
      const r = await fetch('/api/admin/checklists/ack', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date: data.last_closing.shift_date,
          acknowledged_by: ackInitials.trim(),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Ack failed', 'Xác nhận thất bại'))
      load()  // refresh so the panel flips to the receipt view
    } catch (e) {
      setAckError((e as Error).message)
    } finally {
      setAckBusy(false)
    }
  }

  const setComplaintStatus = async (id: string, status: string, resolution?: string) => {
    await fetch(`/api/admin/complaints/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution }),
    })
    load()
  }
  // Prompt modal — resolution note when resolving a complaint.
  const [resolveId, setResolveId] = useState<string | null>(null)

  if (loading || !data) return <div style={emptyText}>{t('Loading MX Daily…', 'Đang tải MX Daily…')}</div>

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>{t('Floor · Member Experience', 'Sàn phục vụ · Trải nghiệm hội viên')}</div>
        <h1 style={pageTitle}>MX Daily</h1>
        <p style={lede}>
          {t('The morning check-in. Birthdays, anniversaries, members slipping out of the rhythm, and any friction we need to clear. Action one thing from each panel before service.', 'Buổi kiểm tra đầu ngày. Sinh nhật, kỷ niệm, những hội viên đang thưa dần, và bất kỳ vướng mắc nào cần xử lý. Hãy hành động một việc từ mỗi bảng trước giờ phục vụ.')}
        </p>
        <div style={{ ...lede, marginTop: 8, color: '#7E7864', fontSize: 11 }}>{today}</div>
      </div>

      {/* Stat strip */}
      <div style={statStrip}>
        <StatTile label={t('Birthdays (7d)', 'Sinh nhật (7 ngày)')}     value={data.counts.birthdays} color="#D4B85A" />
        <StatTile label={t('Anniversaries (7d)', 'Kỷ niệm (7 ngày)')} value={data.counts.anniversaries} color="#7AB07A" />
        <StatTile label={t('Lapsed members', 'Hội viên thưa vắng')}     value={data.counts.lapsed_total} color="#C27070" />
        <StatTile label={t('Open complaints', 'Khiếu nại đang mở')}    value={data.counts.complaints_open} color="#C27070" />
        <StatTile label={t('Missed seals (7d)', 'Niêm phong bị thiếu (7 ngày)')}  value={data.counts.missed_seals} color={data.counts.missed_seals > 0 ? '#E58F4A' : '#7AB07A'} />
      </div>

      {/* Missed-seal alerts — surfaces audit-trail gaps from the last 7
          shift-days. Rendered ABOVE the handover panel so it's the first
          thing the morning team sees if a sheet wasn't sealed last night.
          Hidden when there are no gaps — absence is the success state. */}
      {data.missed_seals && data.missed_seals.length > 0 && (
        <div style={missedSealsPanel}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={missedSealsEyebrow}>{t('⚠ Missed seals · last 7 days', '⚠ Niêm phong bị thiếu · 7 ngày qua')}</span>
            <span style={{ ...lede, fontSize: 11, color: '#B2AA98', margin: 0 }}>
              {data.missed_seals.length} {t('shift-day', 'ngày làm việc')}{data.missed_seals.length === 1 ? '' : t('s', '')} {t('without a complete sealed record.', 'không có bản ghi được niêm phong đầy đủ.')}
            </span>
            <Link href="/admin/checklists" style={{ ...panelActionLink, marginLeft: 'auto' }}>
              {t('Open checklists →', 'Mở danh sách kiểm tra →')}
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.missed_seals.map(m => (
              <div key={m.shift_date} style={missedSealsRow}>
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2', minWidth: 140 }}>
                  {new Date(m.shift_date + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {m.missing.includes('opening') && <span style={missedSealsChip}>{t('opening unsealed', 'ca mở chưa niêm phong')}</span>}
                {m.missing.includes('closing') && <span style={missedSealsChip}>{t('closing unsealed', 'ca đóng chưa niêm phong')}</span>}
              </div>
            ))}
          </div>
          <div style={{ ...lede, fontSize: 10, color: '#7E7864', marginTop: 10, lineHeight: 1.6 }}>
            {t('A missed seal means either no checklist was started for that shift, or one was started but never locked. Open the day on the checklists page to inspect, complete if possible, or note the gap for the audit record.', 'Niêm phong bị thiếu nghĩa là ca đó chưa mở danh sách kiểm tra, hoặc đã mở nhưng chưa khóa lại. Hãy mở ngày đó trên trang danh sách kiểm tra để rà soát, hoàn tất nếu có thể, hoặc ghi chú khoảng trống cho hồ sơ kiểm toán.')}
          </div>
        </div>
      )}

      {/* Closing handover from the previous shift — the loop-closer */}
      {data.last_closing && (
        <Panel
          title={`${t('Handover · closing of', 'Bàn giao · đóng ca ngày')} ${new Date(data.last_closing.shift_date + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`}
          eyebrow={t("Yesterday's team", 'Ca làm hôm qua')}
          action={<Link href="/admin/checklists" style={panelActionLink}>{t('Open checklists →', 'Mở danh sách kiểm tra →')}</Link>}
        >
          {data.last_closing.free_notes ? (
            <div style={{ ...handoverBox }}>{data.last_closing.free_notes}</div>
          ) : (
            <div style={panelEmpty}>{t('No handover note recorded.', 'Chưa có ghi chú bàn giao.')}</div>
          )}
          <div style={{ ...panelHint, marginTop: 10 }}>
            {t('Signed off by', 'Ký duyệt bởi')} <strong style={{ color: '#E5D4C2' }}>{data.last_closing.submitted_by || t('unknown', 'không rõ')}</strong>
            {data.last_closing.submitted_at && (
              <> · {new Date(data.last_closing.submitted_at).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
            )}
            {' · '}
            {data.last_closing.items.filter(i => i.checked).length}/{data.last_closing.items.length} {t('items ticked', 'mục đã đánh dấu')}
          </div>

          {/* Handover-read receipt — closes the seam two-way. Already
              read? Render the receipt with whose initials and when.
              Otherwise inline form: type initials, ✓ Acknowledge. */}
          {data.last_closing.handover_acknowledged_at ? (
            <div style={ackReceipt}>
              <span style={{ color: '#7AB07A' }}>{t('✓ Read by', '✓ Đã đọc bởi')} <strong>{data.last_closing.handover_acknowledged_by || t('unknown', 'không rõ')}</strong></span>
              <span style={{ color: '#7E7864', marginLeft: 6 }}>
                · {new Date(data.last_closing.handover_acknowledged_at).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ) : (
            <div style={ackBlock}>
              <div style={{ ...panelHint, color: '#D4B85A', marginBottom: 6 }}>
                {t("Acknowledge that you've read this handover — closes the audit seam between shifts.", 'Xác nhận rằng bạn đã đọc bản bàn giao này — khép lại mối nối kiểm toán giữa các ca.')}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={ackInitials}
                  onChange={e => persistAckInitials(e.target.value)}
                  placeholder={t('Your initials', 'Tên viết tắt của bạn')}
                  maxLength={20}
                  style={ackInput}
                />
                <button
                  onClick={acknowledgeHandover}
                  disabled={!ackInitials.trim() || ackBusy}
                  style={{ ...ackBtn, opacity: !ackInitials.trim() || ackBusy ? 0.5 : 1 }}
                >
                  {ackBusy ? t('Acknowledging…', 'Đang xác nhận…') : t('✓ Acknowledge handover', '✓ Xác nhận bàn giao')}
                </button>
                {ackError && <span style={{ color: '#C27070', fontSize: 11, fontFamily: "'Google Sans Code', monospace" }}>{ackError}</span>}
              </div>
            </div>
          )}
        </Panel>
      )}

      <div style={{ ...twoCol, marginTop: data.last_closing ? 16 : 0 }}>
        {/* LEFT: Birthdays + Anniversaries + Tonight */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel
            title={t('Tonight', 'Tối nay')}
            eyebrow={t('Pre-shift', 'Trước ca')}
            action={<Link href="/admin/tonight" style={panelActionLink}>{t('Full brief →', 'Tóm tắt đầy đủ →')}</Link>}
          >
            <div style={panelHint}>
              {t('The Tonight page has the full breakdown of bookings, last-visit notes, and preferences. Use that for service prep. Bring back here anything that needs MX intervention.', 'Trang Tonight có toàn bộ chi tiết đặt chỗ, ghi chú lần ghé gần nhất và sở thích. Dùng trang đó để chuẩn bị phục vụ. Mang về đây bất cứ điều gì cần MX can thiệp.')}
            </div>
          </Panel>

          <Panel
            title={t('Birthdays this week', 'Sinh nhật tuần này')}
            eyebrow={t('Touchpoint', 'Điểm chạm')}
            badge={data.counts.birthdays > 0 ? String(data.counts.birthdays) : undefined}
          >
            {data.birthdays.length === 0 ? (
              <div style={panelEmpty}>{t('No birthdays in the next 7 days.', 'Không có sinh nhật trong 7 ngày tới.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.birthdays.map(b => (
                  <Link key={b.member_no} href={`/admin/mis/${b.member_no}`} style={memberRow}>
                    <div>
                      <div style={memberName}>{b.full_name}</div>
                      <div style={memberMeta}>{b.member_no} · {b.tier}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={dayBadge(b.days_until)}>{labelForDays(b.days_until)}</div>
                      <div style={memberMeta}>{b.birthday.slice(5)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div style={panelTip}>
              {t('Action: hand-written card + a comp pour at next visit. Note it in the journal afterwards.', 'Hành động: thiệp viết tay + một ly mời miễn phí vào lần ghé tới. Ghi lại vào nhật ký sau đó.')}
            </div>
          </Panel>

          <Panel
            title={t('Membership anniversaries', 'Kỷ niệm hội viên')}
            eyebrow={t('Milestone', 'Cột mốc')}
            badge={data.counts.anniversaries > 0 ? String(data.counts.anniversaries) : undefined}
          >
            {data.anniversaries.length === 0 ? (
              <div style={panelEmpty}>{t('No anniversaries in the next 7 days.', 'Không có kỷ niệm trong 7 ngày tới.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.anniversaries.map(a => (
                  <Link key={a.member_no} href={`/admin/mis/${a.member_no}`} style={memberRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={memberName}>{a.full_name}</div>
                      <div style={memberMeta}>{a.member_no} · {a.tier}</div>
                      {a.gifting && a.gifting.budget_vnd > 0 && (
                        <div style={giftingStrip}>
                          <div style={giftingTrack}>
                            <div style={{
                              ...giftingFill,
                              width: `${Math.min(100, Math.round((a.gifting.spent_vnd / a.gifting.budget_vnd) * 100))}%`,
                              background: a.gifting.gift_count === 0 ? '#C27070' : '#7AB07A',
                            }} />
                          </div>
                          <div style={giftingLabel}>
                            <strong style={{ color: a.gifting.gift_count === 0 ? '#C27070' : '#E5D4C2' }}>
                              {formatVndCompact(a.gifting.spent_vnd)}
                            </strong>
                            <span style={{ opacity: 0.6 }}>{t(' of ', ' trên ')}{formatVndCompact(a.gifting.budget_vnd)}{t(' used', ' đã dùng')}</span>
                            {a.gifting.gift_count === 0 && <span style={{ color: '#C27070' }}>{t(' · no gifts yet', ' · chưa có quà tặng')}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ ...dayBadge(a.days_until), background: 'rgba(122,176,122,0.18)', color: '#7AB07A', borderColor: 'rgba(122,176,122,0.40)' }}>
                        {a.years}y · {labelForDays(a.days_until)}
                      </div>
                      <div style={memberMeta}>{t('since', 'từ')} {a.join_date.slice(0, 10)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div style={panelTip}>
              {t('Action: gift or hosted experience for 1/3/5-year marks. Smaller acknowledgement for 2/4-year.', 'Hành động: quà tặng hoặc trải nghiệm được mời cho mốc 1/3/5 năm. Lời ghi nhận nhỏ hơn cho mốc 2/4 năm.')}
            </div>
          </Panel>
        </div>

        {/* RIGHT: Lapsed + Complaints */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title={t('Lapsed radar', 'Radar thưa vắng')} eyebrow={t('Retention', 'Giữ chân')} badge={data.counts.lapsed_total > 0 ? String(data.counts.lapsed_total) : undefined}>
            <LapsedBucket title={t('30–59 days', '30–59 ngày')} rows={data.lapsed.bucket_30} tone="#D4B85A" />
            <LapsedBucket title={t('60–89 days', '60–89 ngày')} rows={data.lapsed.bucket_60} tone="#E58F4A" />
            <LapsedBucket title={t('90+ days', '90+ ngày')}   rows={data.lapsed.bucket_90} tone="#C27070" />
            <div style={panelTip}>
              {t('Action: 30d gets a casual text or invite to the next event. 60d gets a personal call from MX. 90+ gets escalated to the GM.', 'Hành động: 30 ngày thì nhắn tin thân mật hoặc mời tới sự kiện tới. 60 ngày thì MX gọi điện cá nhân. 90+ ngày thì chuyển lên GM.')}
            </div>
          </Panel>

          <Panel
            title={t('Complaint queue', 'Hàng chờ khiếu nại')}
            eyebrow={t('Triage', 'Phân loại')}
            badge={data.counts.complaints_open > 0 ? String(data.counts.complaints_open) : undefined}
            action={
              <button onClick={() => setShowAddComplaint(s => !s)} style={panelActionBtn}>
                {showAddComplaint ? t('Cancel', 'Hủy') : t('＋ Log complaint', '＋ Ghi khiếu nại')}
              </button>
            }
          >
            {showAddComplaint && (
              <div style={complaintForm}>
                <div style={editLabel}>{t('Summary *', 'Tóm tắt *')}</div>
                <input value={c.summary} onChange={e => setC({ ...c, summary: e.target.value })} placeholder={t('One-line description of the friction', 'Mô tả một dòng về vướng mắc')} style={inputStyle} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>{t('Member no.', 'Số hội viên')}</div>
                    <input value={c.member_no} onChange={e => setC({ ...c, member_no: e.target.value })} placeholder={t('optional', 'tùy chọn')} style={inputStyle} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <div style={editLabel}>{t('Member name', 'Tên hội viên')}</div>
                    <input value={c.member_name} onChange={e => setC({ ...c, member_name: e.target.value })} placeholder={t('optional', 'tùy chọn')} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>{t('Severity', 'Mức độ')}</div>
                    <select value={c.severity} onChange={e => setC({ ...c, severity: Number(e.target.value) })} style={inputStyle}>
                      <option value={1}>{t('1 · Minor', '1 · Nhẹ')}</option>
                      <option value={2}>{t('2 · Notable', '2 · Đáng lưu ý')}</option>
                      <option value={3}>{t('3 · Material', '3 · Đáng kể')}</option>
                      <option value={4}>{t('4 · Serious', '4 · Nghiêm trọng')}</option>
                      <option value={5}>{t('5 · Critical', '5 · Rất nghiêm trọng')}</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>{t('Category', 'Loại')}</div>
                    <select value={c.category} onChange={e => setC({ ...c, category: e.target.value })} style={inputStyle}>
                      <option value="">—</option>
                      <option value="service">{t('Service', 'Dịch vụ')}</option>
                      <option value="product">{t('Product', 'Sản phẩm')}</option>
                      <option value="facility">{t('Facility', 'Cơ sở vật chất')}</option>
                      <option value="billing">{t('Billing', 'Thanh toán')}</option>
                      <option value="other">{t('Other', 'Khác')}</option>
                    </select>
                  </div>
                </div>
                <div style={editLabel}>{t('Details', 'Chi tiết')}</div>
                <textarea rows={3} value={c.details} onChange={e => setC({ ...c, details: e.target.value })} placeholder={t('What happened, who said what, current state…', 'Chuyện gì đã xảy ra, ai nói gì, tình trạng hiện tại…')} style={{ ...inputStyle, resize: 'vertical' }} />
                <button onClick={submitComplaint} disabled={!c.summary.trim() || submitting} style={{ ...btnPrimary, marginTop: 6, opacity: !c.summary.trim() ? 0.4 : 1 }}>
                  {submitting ? t('Saving…', 'Đang lưu…') : t('Log complaint', 'Ghi khiếu nại')}
                </button>
              </div>
            )}

            {data.complaints.length === 0 ? (
              <div style={panelEmpty}>{t('No open or acknowledged complaints. Quiet week.', 'Không có khiếu nại đang mở hoặc đã ghi nhận. Một tuần yên ả.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.complaints.map(c => (
                  <div key={c.id} style={complaintRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={severityBadge(c.severity)}>S{c.severity}</span>
                          {c.category && <span style={categoryBadge}>{c.category}</span>}
                          <span style={statusBadge(c.status)}>{c.status}</span>
                        </div>
                        <div style={{ ...memberName, marginTop: 6 }}>{c.summary}</div>
                        {(c.member_name || c.member_no) && (
                          <div style={memberMeta}>
                            {c.member_name || ''}
                            {c.member_no && <span style={{ marginLeft: 6 }}>· {c.member_no}</span>}
                          </div>
                        )}
                        {c.details && <div style={complaintDetails}>{c.details}</div>}
                        <div style={memberMeta}>
                          {t('Reported', 'Ghi nhận')} {new Date(c.reported_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {c.reported_by && ` · ${c.reported_by}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.status === 'open' && (
                          <button onClick={() => setComplaintStatus(c.id, 'acknowledged')} style={tinyBtn}>{t('Acknowledge', 'Ghi nhận')}</button>
                        )}
                        {c.status !== 'resolved' && (
                          <button onClick={() => setResolveId(c.id)} style={{ ...tinyBtn, color: '#7AB07A', borderColor: 'rgba(122,176,122,0.30)' }}>{t('Resolve', 'Giải quyết')}</button>
                        )}
                        {c.status !== 'dismissed' && (
                          <button onClick={() => setComplaintStatus(c.id, 'dismissed')} style={{ ...tinyBtn, color: '#7E7864' }}>{t('Dismiss', 'Bỏ qua')}</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <PromptModal
        open={!!resolveId}
        eyebrow={t('✓ RESOLVE COMPLAINT', '✓ GIẢI QUYẾT KHIẾU NẠI')}
        title={t('Resolve this complaint?', 'Giải quyết khiếu nại này?')}
        label={t('Resolution note — what was done (optional)', 'Ghi chú giải quyết — đã làm gì (tùy chọn)')}
        placeholder={t('e.g. Spoke with member, comped the round, flagged to F&B.', 'ví dụ: Đã trao đổi với hội viên, mời lượt đồ uống, báo cho F&B.')}
        confirmLabel={t('Mark resolved', 'Đánh dấu đã giải quyết')}
        multiline
        validate={() => null}
        onCancel={() => setResolveId(null)}
        onConfirm={(note) => { if (resolveId) setComplaintStatus(resolveId, 'resolved', note); setResolveId(null) }}
      />
    </>
  )
}

function LapsedBucket({ title, rows, tone }: { title: string; rows: LapsedRow[]; tone: string }) {
  if (rows.length === 0) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ ...lapsedBucketLabel, color: tone, borderColor: tone + '40' }}>{title} · {rows.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.slice(0, 8).map(r => (
          <Link key={r.member_no} href={`/admin/mis/${r.member_no}`} style={memberRow}>
            <div>
              <div style={memberName}>{r.full_name}</div>
              <div style={memberMeta}>{r.member_no} · {r.tier} · {r.total_visits} visits</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...dayBadge(0), background: 'transparent', color: tone, borderColor: tone + '60' }}>
                {r.days_since_visit}d
              </div>
              <div style={memberMeta}>
                {r.last_visit ? `last ${new Date(r.last_visit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'no visits'}
              </div>
            </div>
          </Link>
        ))}
        {rows.length > 8 && <div style={{ ...memberMeta, paddingLeft: 12, marginTop: 2 }}>…and {rows.length - 8} more.</div>}
      </div>
    </div>
  )
}

function Panel({ title, eyebrow, badge, action, children }: {
  title: string; eyebrow: string; badge?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={panel}>
      <div style={panelHeader}>
        <div>
          <div style={panelEyebrow}>{eyebrow}</div>
          <div style={panelTitle}>
            {title}
            {badge && <span style={panelBadge}>{badge}</span>}
          </div>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color }}>{value}</div>
    </div>
  )
}

function labelForDays(d: number): string {
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  return `in ${d}d`
}

// ── styles ─────────────────────────────────────────────────────────
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const statStrip: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10, marginBottom: 20,
}
const statTile: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, padding: '14px 16px',
}
const statLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const statValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 600,
  marginTop: 6,
}
const twoCol: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
  gap: 16,
}
const panel: React.CSSProperties = {
  background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, padding: 18,
}
const panelHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  marginBottom: 12,
}
const panelEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const panelTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', margin: '4px 0 0', letterSpacing: '0.04em',
  display: 'flex', alignItems: 'center', gap: 8,
}
const panelBadge: React.CSSProperties = {
  background: 'rgba(212,184,90,0.20)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 10,
  padding: '1px 8px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, fontWeight: 600,
}
const panelHint: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.6, opacity: 0.85,
}
// Handover-ack — the read receipt that closes the seam two-way.
// Form appears below the handover note when not yet ack'd; receipt
// replaces it once recorded. Stylistically deliberately quiet — the
// goal is "yes, I read this" without making the panel feel like a
// task list.
const ackBlock: React.CSSProperties = {
  marginTop: 14, padding: '10px 14px',
  background: 'rgba(212,184,90,0.06)',
  border: '1px solid rgba(212,184,90,0.30)',
  borderLeft: '2px solid #D4B85A',
  borderRadius: 4,
}
const ackInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.55)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4,
  padding: '6px 10px', maxWidth: 140,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  outline: 'none',
}
const ackBtn: React.CSSProperties = {
  background: 'rgba(122,176,122,0.16)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 4,
  padding: '6px 14px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em',
}
const ackReceipt: React.CSSProperties = {
  marginTop: 12, padding: '8px 12px',
  background: 'rgba(122,176,122,0.10)',
  border: '1px solid rgba(122,176,122,0.30)',
  borderLeft: '2px solid #7AB07A',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}

// Missed-seal alerts — sits ABOVE the handover panel when any gaps exist.
// Amber tone (judgment/attention) rather than red (destructive), and
// disappears entirely when zero gaps so absence is the success state.
const missedSealsPanel: React.CSSProperties = {
  marginBottom: 18, padding: '14px 18px',
  background: 'rgba(229,143,74,0.08)',
  border: '1px solid rgba(229,143,74,0.35)',
  borderLeft: '3px solid #E58F4A',
  borderRadius: 6,
}
const missedSealsEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E58F4A', letterSpacing: '0.14em', textTransform: 'uppercase',
  fontWeight: 700,
}
const missedSealsRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  padding: '6px 10px',
  background: 'rgba(229,143,74,0.04)',
  border: '1px solid rgba(229,143,74,0.18)',
  borderRadius: 4,
}
const missedSealsChip: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#E58F4A',
  background: 'rgba(229,143,74,0.12)',
  border: '1px solid rgba(229,143,74,0.40)',
  borderRadius: 3, padding: '2px 8px',
  letterSpacing: '0.08em', textTransform: 'uppercase',
}

const handoverBox: React.CSSProperties = {
  padding: '12px 14px',
  background: 'rgba(122,176,122,0.08)',
  border: '1px solid rgba(122,176,122,0.25)',
  borderLeft: '3px solid #7AB07A',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', lineHeight: 1.7, whiteSpace: 'pre-wrap',
}
const giftingStrip: React.CSSProperties = {
  marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3,
}
const giftingTrack: React.CSSProperties = {
  height: 3, background: 'rgba(229,212,194,0.08)', borderRadius: 2, overflow: 'hidden',
}
const giftingFill: React.CSSProperties = {
  height: '100%', transition: 'width 0.4s ease',
}
const giftingLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.04em',
}

function formatVndCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ₫`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k ₫`
  return `${v} ₫`
}
const panelEmpty: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.6, opacity: 0.6, fontStyle: 'italic',
  padding: '6px 0',
}
const panelTip: React.CSSProperties = {
  marginTop: 10, padding: '8px 10px',
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.16)',
  borderLeft: '2px solid #D4B85A', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', lineHeight: 1.55,
}
const panelActionLink: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7AB07A', letterSpacing: '0.08em', textDecoration: 'none',
}
const panelActionBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.30)', borderRadius: 4,
  padding: '6px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
}
const memberRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 10px', textDecoration: 'none',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const memberName: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', letterSpacing: '0.02em',
}
const memberMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginTop: 2,
}
function dayBadge(days: number): React.CSSProperties {
  const isToday = days === 0
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    border: '1px solid ' + (isToday ? 'rgba(212,184,90,0.60)' : 'rgba(212,184,90,0.30)'),
    background: isToday ? 'rgba(212,184,90,0.20)' : 'rgba(212,184,90,0.08)',
    color: '#D4B85A',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}
const lapsedBucketLabel: React.CSSProperties = {
  display: 'inline-block', padding: '3px 10px', borderRadius: 4,
  border: '1px solid',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600,
  marginBottom: 6,
}
const complaintRow: React.CSSProperties = {
  padding: 12,
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 6,
}
const complaintDetails: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.6, margin: '6px 0',
  padding: '6px 0', borderTop: '1px solid rgba(229,212,194,0.05)',
}
function severityBadge(sev: number): React.CSSProperties {
  const color = sev >= 4 ? '#C27070' : sev >= 3 ? '#E58F4A' : sev >= 2 ? '#D4B85A' : '#7AB07A'
  return {
    background: color + '20', color, border: `1px solid ${color}60`,
    borderRadius: 3, padding: '1px 6px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.06em', fontWeight: 600,
  }
}
const categoryBadge: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '1px 6px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.04em', textTransform: 'uppercase',
}
function statusBadge(s: string): React.CSSProperties {
  const map: Record<string, { fg: string; bg: string; bd: string }> = {
    open:         { fg: '#C27070', bg: 'rgba(180,70,70,0.18)',  bd: 'rgba(180,70,70,0.40)' },
    acknowledged: { fg: '#D4B85A', bg: 'rgba(212,184,90,0.18)', bd: 'rgba(212,184,90,0.40)' },
    resolved:     { fg: '#7AB07A', bg: 'rgba(122,176,122,0.18)',bd: 'rgba(122,176,122,0.40)' },
    dismissed:    { fg: '#7E7864', bg: 'rgba(229,212,194,0.06)',bd: 'rgba(229,212,194,0.16)' },
  }
  const p = map[s] || map.open
  return {
    background: p.bg, color: p.fg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '1px 6px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }
}
const complaintForm: React.CSSProperties = {
  marginBottom: 14, padding: 12,
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginTop: 4,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '10px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textAlign: 'center',
}
const tinyBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  padding: '4px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
