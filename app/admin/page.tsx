'use client'

import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import Link from 'next/link'
import { Donut, Sparkline, HBars, StackedBars, LineChart, Funnel, PALETTE } from './_charts/Charts'
import { useLang } from '@/lib/admin-lang'

// Admin / Dashboard
//
// The data centre. Pulls a single aggregator endpoint and renders the
// whole system at a glance. Every panel is clickable and routes to the
// relevant admin surface.

interface Data {
  kpis: {
    activeMembers: number
    activeMembers30dDelta: number
    pipelineCount: number
    prospectsLastWeek: number
    pendingSignatures: number
    oldestPending: number | null
    openComplaints: number
    avgSeverity: number
    lockerUtilization: number
    lockerOccupied: number
    lockerTotal: number
    bottleCount: number
    whiskyInStock: number
    whiskyOutOfStock: number
    adminCount: number
  }
  sparklines: { members: number[]; prospects: number[] }
  memberTiers: { tier: string; count: number }[]
  psHealth: { strong: number; healthy: number; drift: number; decay: number; lapsed: number; none: number }
  joins12m: { month: string; count: number }[]
  pipelineFunnel: { stages: { stage: string; count: number }[]; overallConversion: number }
  pipelineSources: { source: string; count: number }[]
  referrers: { key: string; count: number }[]
  lapsed: { b30: number; b60: number; b90: number }
  thisWeek: Array<{ kind: 'birthday' | 'anniversary'; member_no: string; name: string; days: number; years?: number }>
  activity: Array<{ id: string; prospect_id: string; actor: string | null; event_type: string; from_value: string | null; to_value: string | null; created_at: string }>
  bottleFillDist: { bucket: string; count: number }[]
  whiskyByRegion: { region: string; count: number }[]
  cardVolume7d: { day: string; topups: number; charges: number }[]
  topCards: { member_no: string; full_name: string; credit_vnd: number }[]
  timestamp: string
}

export default function AdminDashboard() {
  const { t } = useLang()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { showToast, toastNode } = useToast()
  // Confirm modal — send the weekly digest.
  const [confirmDigest, setConfirmDigest] = useState(false)
  const [digestBusy, setDigestBusy] = useState(false)
  const sendDigest = async () => {
    setDigestBusy(true)
    try {
      const r = await fetch('/api/cron/weekly-digest', { method: 'POST' })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || t('Send failed', 'Gửi thất bại'))
      setConfirmDigest(false)
      showToast(`${t('Weekly digest sent to', 'Đã gửi bản tin tuần đến')} ${j.recipients.length} ${j.recipients.length === 1 ? t('recipient', 'người nhận') : t('recipients', 'người nhận')}.`)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setDigestBusy(false)
    }
  }

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const r = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      const j = await r.json()
      setData(j)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={emptyText}>{t('Reading the room…', 'Đang cảm nhận không gian…')}</div>

  const k = data.kpis
  const refreshedAt = new Date(data.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {/* Hero header */}
      <div style={heroRow}>
        <div>
          <div style={eyebrow}>{t('Data centre', 'Trung tâm dữ liệu')}</div>
          <h1 style={pageTitle}>{t('Dashboard', 'Bảng điều khiển')}</h1>
          <p style={lede}>{t('Everything the system knows, at a glance. Every tile is a link — click into anything that catches your eye.', 'Tất cả những gì hệ thống biết, trong một cái nhìn. Mỗi ô là một liên kết — nhấp vào bất cứ điều gì thu hút bạn.')}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={load} disabled={refreshing} style={refreshBtn}>
            {refreshing ? t('◌ Refreshing…', '◌ Đang làm mới…') : t('↻ Refresh', '↻ Làm mới')}
          </button>
          <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864', letterSpacing: '0.08em' }}>
            {t('Updated', 'Cập nhật')} {refreshedAt}
          </div>
        </div>
      </div>

      {/* ROW 1 — KPI strip */}
      <div style={kpiGrid}>
        <KpiTile
          href="/admin/mis"
          label={t('Active members', 'Thành viên hoạt động')}
          value={k.activeMembers}
          delta={k.activeMembers30dDelta ? `+${k.activeMembers30dDelta} / 30d` : t('steady', 'ổn định')}
          deltaPositive={k.activeMembers30dDelta > 0}
          spark={data.sparklines.members}
          tone="#7AB07A"
        />
        <KpiTile
          href="/admin/mis/pipeline"
          label={t('In pipeline', 'Trong pipeline')}
          value={k.pipelineCount}
          delta={`+${k.prospectsLastWeek} / 7d`}
          deltaPositive={k.prospectsLastWeek > 0}
          spark={data.sparklines.prospects}
          tone="#D4B85A"
        />
        <KpiTile
          href="/admin/agreements"
          label={t('Pending signatures', 'Chữ ký đang chờ')}
          value={k.pendingSignatures}
          delta={k.oldestPending != null ? `${t('oldest', 'cũ nhất')} ${k.oldestPending}d` : '—'}
          deltaPositive={k.oldestPending != null && k.oldestPending < 7}
          tone="#E58F4A"
        />
        <KpiTile
          href="/admin/mx-daily"
          label={t('Open complaints', 'Khiếu nại mở')}
          value={k.openComplaints}
          delta={k.openComplaints ? `${t('avg', 'TB')} S${k.avgSeverity}` : t('clear', 'không có')}
          deltaPositive={k.openComplaints === 0}
          tone={k.openComplaints ? '#C27070' : '#7AB07A'}
        />
        <KpiTile
          href="/admin/lockers"
          label={t('Locker utilization', 'Sử dụng tủ khóa')}
          value={`${k.lockerUtilization}%`}
          delta={`${k.lockerOccupied}/${k.lockerTotal} · ${k.bottleCount} ${t('btl', 'chai')}`}
          deltaPositive={k.lockerUtilization > 0}
          tone="#9E8FC4"
        />
        <KpiTile
          href="/admin/whisky"
          label={t('Whisky in stock', 'Whisky còn hàng')}
          value={k.whiskyInStock}
          delta={k.whiskyOutOfStock ? `${k.whiskyOutOfStock} ${t('out', 'hết')}` : t('all in stock', 'còn đủ hàng')}
          deltaPositive={k.whiskyOutOfStock === 0}
          tone="#5B8FA8"
        />
      </div>

      {/* ROW 2 — Member intelligence */}
      <div style={sectionLabel}>{t('Member Intelligence', 'Thông tin thành viên')}</div>
      <div style={threeColGrid}>
        <Panel title={t('Member composition', 'Cơ cấu thành viên')} subtitle={t('Active members by tier', 'Thành viên hoạt động theo hạng')} href="/admin/mis">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Donut
              data={data.memberTiers.map((t, i) => ({ label: t.tier, value: t.count, color: PALETTE[i % PALETTE.length] }))}
              centerValue={k.activeMembers}
              centerLabel={t('Active', 'Hoạt động')}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.memberTiers.filter(mt => mt.count > 0).map((mt, i) => (
                <div key={mt.tier} style={legendRow}>
                  <span style={{ ...legendDot, background: PALETTE[i % PALETTE.length] }} />
                  <span style={legendLabel}>{mt.tier}</span>
                  <span style={legendValue}>{mt.count}</span>
                </div>
              ))}
              {data.memberTiers.every(mt => mt.count === 0) && <div style={emptyHint}>{t('No active members yet.', 'Chưa có thành viên hoạt động.')}</div>}
            </div>
          </div>
        </Panel>

        <Panel title={t('PS(t) health', 'Sức khỏe PS(t)')} subtitle={t('Member preference decay distribution', 'Phân bố suy giảm sở thích thành viên')} href="/admin/mis">
          <HBars
            data={[
              { label: t('Strong (≥4)', 'Mạnh (≥4)'),  value: data.psHealth.strong,  color: '#7AB07A' },
              { label: t('Healthy (3–4)', 'Khỏe (3–4)'),value: data.psHealth.healthy, color: '#A8C588' },
              { label: t('Drift (2–3)', 'Trôi dạt (2–3)'),  value: data.psHealth.drift,   color: '#D4B85A' },
              { label: t('Decay (1–2)', 'Suy giảm (1–2)'),  value: data.psHealth.decay,   color: '#E58F4A' },
              { label: t('Lapsed (<1)', 'Mất dấu (<1)'),  value: data.psHealth.lapsed,  color: '#C27070' },
              { label: t('No prefs yet', 'Chưa có sở thích'), value: data.psHealth.none,    color: 'rgba(229,212,194,0.20)' },
            ]}
          />
          <div style={panelTip}>
            {t('Members in Drift/Decay need a touchpoint or revalidation soon — open the member profile and capture a fresh preference.', 'Thành viên ở nhóm Trôi dạt/Suy giảm cần được chăm sóc hoặc xác nhận lại sớm — mở hồ sơ thành viên và ghi nhận sở thích mới.')}
          </div>
        </Panel>

        <Panel title={t('Joins · 12 months', 'Gia nhập · 12 tháng')} subtitle={t('New active members per month', 'Thành viên hoạt động mới mỗi tháng')} href="/admin/mis">
          <LineChart data={data.joins12m} width={320} height={140} valueKey="count" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={statlet}>{t('Total joins:', 'Tổng gia nhập:')} <strong style={{ color: '#E5D4C2' }}>{data.joins12m.reduce((s, j) => s + j.count, 0)}</strong></span>
            <span style={statlet}>{t('Peak month:', 'Tháng cao nhất:')} <strong style={{ color: '#D4B85A' }}>{Math.max(0, ...data.joins12m.map(j => j.count))}</strong></span>
          </div>
        </Panel>
      </div>

      {/* ROW 3 — Pipeline intelligence */}
      <div style={sectionLabel}>{t('Pipeline Intelligence', 'Thông tin pipeline')}</div>
      <div style={twoColGrid}>
        <Panel title={t('Funnel by stage', 'Phễu theo giai đoạn')} subtitle={t('Live prospects only — archived excluded', 'Chỉ ứng viên đang hoạt động — không tính đã lưu trữ')} href="/admin/mis/pipeline">
          <Funnel stages={data.pipelineFunnel.stages} conversion={data.pipelineFunnel.overallConversion} />
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title={t('Source attribution', 'Nguồn ứng viên')} subtitle={t('Where prospects come from', 'Ứng viên đến từ đâu')} href="/admin/mis/pipeline">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Donut
                data={data.pipelineSources.map((s, i) => ({ label: s.source, value: s.count, color: PALETTE[(i + 1) % PALETTE.length] }))}
                centerValue={data.pipelineSources.reduce((s, x) => s + x.count, 0)}
                centerLabel={t('Prospects', 'Ứng viên')}
                size={130} thickness={20}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.pipelineSources.map((s, i) => (
                  <div key={s.source} style={legendRow}>
                    <span style={{ ...legendDot, background: PALETTE[(i + 1) % PALETTE.length] }} />
                    <span style={legendLabel}>{s.source}</span>
                    <span style={legendValue}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title={t('Top referrers', 'Người giới thiệu hàng đầu')} subtitle={t('Members bringing prospects', 'Thành viên đưa ứng viên đến')} href="/admin/mis/pipeline">
            {data.referrers.length === 0 ? (
              <div style={emptyHint}>{t('No referrers tracked yet.', 'Chưa ghi nhận người giới thiệu.')}</div>
            ) : (
              <HBars
                data={data.referrers.map((r, i) => ({
                  label: r.key.startsWith('TRC-M') ? r.key : r.key.slice(0, 28),
                  value: r.count,
                  color: PALETTE[(i + 2) % PALETTE.length],
                }))}
                barHeight={14} gap={5}
              />
            )}
          </Panel>
        </div>
      </div>

      {/* ROW 4 — Operational health */}
      <div style={sectionLabel}>{t('Operational Health', 'Sức khỏe vận hành')}</div>
      <div style={threeColGrid}>
        <Panel title={t('Lapsed radar', 'Radar mất dấu')} subtitle={t('Active members without a recent visit', 'Thành viên hoạt động chưa ghé gần đây')} href="/admin/mx-daily">
          <HBars
            data={[
              { label: t('30–59 days', '30–59 ngày'), value: data.lapsed.b30, color: '#D4B85A' },
              { label: t('60–89 days', '60–89 ngày'), value: data.lapsed.b60, color: '#E58F4A' },
              { label: t('90+ days', '90+ ngày'),   value: data.lapsed.b90, color: '#C27070' },
            ]}
          />
          <div style={panelTip}>
            {t('30d → friendly nudge. 60d → personal call. 90+ → escalate to GM.', '30 ngày → nhắc nhẹ nhàng. 60 ngày → gọi điện cá nhân. 90+ → chuyển lên GM.')}
          </div>
        </Panel>

        <Panel title={t('This week', 'Tuần này')} subtitle={t('Birthdays & anniversaries', 'Sinh nhật & kỷ niệm')} href="/admin/mx-daily" headerLink>
          {data.thisWeek.length === 0 ? (
            <div style={emptyHint}>{t('Nothing in the next 7 days.', 'Không có gì trong 7 ngày tới.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.thisWeek.map((ev, i) => (
                <Link key={i} href={`/admin/mis/${ev.member_no}`} style={touchRow}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: ev.kind === 'birthday' ? '#D4B85A' : '#7AB07A',
                  }} />
                  <span style={{ flex: 1, fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2' }}>
                    {ev.name}
                    {ev.kind === 'anniversary' && <span style={{ color: '#7AB07A', marginLeft: 6 }}>· {ev.years}y</span>}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98' }}>
                    {ev.days === 0 ? t('today', 'hôm nay') : ev.days === 1 ? t('tomorrow', 'ngày mai') : `${t('in', 'trong')} ${ev.days}d`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('Live activity', 'Hoạt động trực tiếp')} subtitle={t('Latest pipeline events', 'Sự kiện pipeline mới nhất')} href="/admin/mis/pipeline" headerLink>
          {data.activity.length === 0 ? (
            <div style={emptyHint}>{t('No recent activity.', 'Không có hoạt động gần đây.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {data.activity.map(a => (
                <Link key={a.id} href={`/admin/mis/pipeline/${a.prospect_id}`} style={activityRow}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2' }}>
                      {formatActivity(a, t)}
                    </span>
                    <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
                      {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', marginTop: 2 }}>
                    {a.prospect_id} · {a.actor || t('system', 'hệ thống')}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ROW 5 — Whisky & cards */}
      <div style={sectionLabel}>{t('Whisky & Cards', 'Whisky & Thẻ')}</div>
      <div style={threeColGrid}>
        <Panel title={t('Bottle fill distribution', 'Phân bố mức rượu trong chai')} subtitle={t('Across every locker', 'Trên tất cả tủ khóa')} href="/admin/lockers">
          <HBars
            data={data.bottleFillDist.map(b => ({
              label: `${b.bucket}%`, value: b.count,
              color: b.bucket === '0–25' ? '#C27070'
                   : b.bucket === '26–50' ? '#E58F4A'
                   : b.bucket === '51–75' ? '#D4B85A'
                   : '#7AB07A',
            }))}
          />
          <div style={panelTip}>
            {t('Bottles ≤25% are the next sales opportunity — offer a top-up at next visit.', 'Chai ≤25% là cơ hội bán tiếp theo — mời khách bổ sung vào lần ghé sau.')}
          </div>
        </Panel>

        <Panel title={t('Inventory by region', 'Tồn kho theo vùng')} subtitle={t('Whiskies in stock — top regions', 'Whisky còn hàng — các vùng hàng đầu')} href="/admin/whisky">
          {data.whiskyByRegion.length === 0 ? (
            <div style={emptyHint}>{t('No region data yet.', 'Chưa có dữ liệu vùng.')}</div>
          ) : (
            <HBars data={data.whiskyByRegion.map(r => ({ label: r.region, value: r.count }))} />
          )}
        </Panel>

        <Panel title={t('Card volume · 7d', 'Lưu lượng thẻ · 7 ngày')} subtitle={t('Top-ups (green) vs. charges (gold)', 'Nạp tiền (xanh) so với trừ tiền (vàng)')} href="/admin/cards">
          <StackedBars data={data.cardVolume7d} labels width={300} height={120} />
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontFamily: "'Google Sans Code', monospace", fontSize: 10 }}>
            <span style={{ color: '#7AB07A' }}>
              ▇ {t('Top-ups:', 'Nạp tiền:')} {formatVnd(data.cardVolume7d.reduce((s, d) => s + d.topups, 0))}
            </span>
            <span style={{ color: '#D4B85A' }}>
              ▇ {t('Charges:', 'Trừ tiền:')} {formatVnd(data.cardVolume7d.reduce((s, d) => s + d.charges, 0))}
            </span>
          </div>
          {data.topCards.length > 0 && (
            <>
              <div style={{ ...sectionLabel, fontSize: 9, marginTop: 14, marginBottom: 6 }}>{t('Top-credited cards', 'Thẻ nhiều tín dụng nhất')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.topCards.map(c => (
                  <div key={c.member_no} style={legendRow}>
                    <span style={legendLabel}>{c.full_name}</span>
                    <span style={legendValue}>{formatVnd(c.credit_vnd)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* Footer / admin status */}
      <div style={footer}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={footerStat}><strong style={{ color: '#D4B85A' }}>{k.adminCount}</strong> {t('Admin', 'Quản trị viên')}{k.adminCount === 1 ? '' : t('s', '')}</span>
          <span style={footerStat}>·</span>
          <span style={footerStat}>{k.activeMembers} {t('active', 'hoạt động')} · {k.pipelineCount} {t('in pipeline', 'trong pipeline')} · {k.openComplaints} {t('complaints', 'khiếu nại')}</span>
          <span style={footerStat}>·</span>
          <Link href="/admin/training" style={{ ...footerStat, color: '#7AB07A', textDecoration: 'none' }}>{t('Training', 'Đào tạo')} →</Link>
          <span style={footerStat}>·</span>
          <button
            onClick={() => setConfirmDigest(true)}
            style={{ ...footerStat, color: '#D4B85A', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Google Sans Code', monospace" }}
          >
            {t('↗ Send weekly digest', '↗ Gửi bản tin tuần')}
          </button>
        </div>
        <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
          {t('Refreshed', 'Làm mới lúc')} {refreshedAt} · GMT+7
        </div>
      </div>

      <ConfirmModal
        open={confirmDigest}
        tone="info"
        eyebrow={t('↗ WEEKLY DIGEST', '↗ BẢN TIN TUẦN')}
        title={t('Send the weekly digest now?', 'Gửi bản tin tuần ngay bây giờ?')}
        subject={`${t('To everyone on', 'Đến tất cả trong')} DIGEST_RECIPIENTS`}
        body={t('Sends the weekly digest email immediately, outside the normal Monday schedule. Recipients receive it right away.', 'Gửi email bản tin tuần ngay lập tức, ngoài lịch thứ Hai thông thường. Người nhận sẽ nhận được ngay.')}
        confirmLabel={t('Send digest', 'Gửi bản tin')}
        busyLabel={t('Sending…', 'Đang gửi…')}
        busy={digestBusy}
        onCancel={() => setConfirmDigest(false)}
        onConfirm={sendDigest}
      />

      {toastNode}
    </>
  )
}

// ── KPI tile ───────────────────────────────────────────────────────────
function KpiTile({ href, label, value, delta, deltaPositive, spark, tone }: {
  href: string
  label: string
  value: number | string
  delta: string
  deltaPositive: boolean
  spark?: number[]
  tone: string
}) {
  return (
    <Link href={href} style={kpiTile}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={kpiLabel}>{label}</div>
          <div style={{ ...kpiValue, color: '#E5D4C2' }}>{value}</div>
        </div>
        {spark && spark.length >= 2 && (
          <div style={{ marginTop: 4 }}>
            <Sparkline values={spark} color={tone} width={80} height={28} />
          </div>
        )}
      </div>
      <div style={{
        marginTop: 8, fontFamily: "'Google Sans Code', monospace", fontSize: 10,
        color: deltaPositive ? '#7AB07A' : '#B2AA98', letterSpacing: '0.06em',
      }}>
        {deltaPositive ? '↑ ' : ''}{delta}
      </div>
      <div style={{ ...kpiAccent, background: tone }} />
    </Link>
  )
}

function Panel({ title, subtitle, href, headerLink, children }: {
  title: string
  subtitle?: string
  href?: string
  headerLink?: boolean   // scope the link to the header only — for panels whose
                         // children contain their own <Link>s (nested <a> is invalid)
  children: React.ReactNode
}) {
  const header = (
    <div style={panelHeader}>
      <div>
        <div style={panelTitle}>{title}</div>
        {subtitle && <div style={panelSubtitle}>{subtitle}</div>}
      </div>
      {href && <div style={panelArrow}>→</div>}
    </div>
  )
  // Children link to their own destinations → only the header is the link.
  if (href && headerLink) return (
    <div style={panel}>
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{header}</Link>
      <div>{children}</div>
    </div>
  )
  // Whole panel is one link (charts/stats with no inner links).
  if (href) return <Link href={href} style={panel}>{header}<div>{children}</div></Link>
  return <div style={panel}>{header}<div>{children}</div></div>
}

function formatActivity(a: { event_type: string; from_value: string | null; to_value: string | null }, t: (en: string, vi: string) => string): string {
  switch (a.event_type) {
    case 'created':             return t('New prospect added', 'Đã thêm ứng viên mới')
    case 'stage_changed':       return `${t('Stage', 'Giai đoạn')} → ${a.to_value}`
    case 'source_changed':      return `${t('Source', 'Nguồn')} → ${a.to_value || '—'}`
    case 'decision_changed':    return `${t('Decision', 'Quyết định')} → ${a.to_value || '—'}`
    case 'letter_sent':         return t('Letter sent', 'Đã gửi thư')
    case 'scored':              return t('Score updated', 'Đã cập nhật điểm')
    case 'member_no_allocated': return t(`Provisional ${a.to_value} allocated`, `Đã cấp tạm ${a.to_value}`)
    case 'invitation_sent':     return t('Invitation sent', 'Đã gửi lời mời')
    case 'invitation_resent':   return t('Invitation resent', 'Đã gửi lại lời mời')
    case 'signed':              return `${t('Agreement signed', 'Đã ký thỏa thuận')}${a.to_value ? ` → ${a.to_value}` : ''}`
    case 'converted':           return t(`Converted to ${a.to_value}`, `Chuyển đổi thành ${a.to_value}`)
    case 'archived':            return t('Archived', 'Đã lưu trữ')
    default:                    return a.event_type
  }
}

function formatVnd(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ₫`
  if (v >= 1_000)     return `${Math.round(v / 1_000)}k ₫`
  return `${v} ₫`
}

// ── styles ─────────────────────────────────────────────────────────────
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
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 720, margin: 0,
}
const heroRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 20, marginBottom: 24,
}
const refreshBtn: React.CSSProperties = {
  background: 'rgba(212,184,90,0.12)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.30)', borderRadius: 6,
  padding: '8px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.10em', cursor: 'pointer',
}
const kpiGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12, marginBottom: 32,
}
const kpiTile: React.CSSProperties = {
  position: 'relative',
  display: 'block', padding: 16,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, textDecoration: 'none',
  overflow: 'hidden',
  transition: 'transform 0.15s ease, border-color 0.15s ease',
}
const kpiLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.12em', textTransform: 'uppercase',
}
const kpiValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 36, fontWeight: 600,
  marginTop: 4, lineHeight: 1,
}
const kpiAccent: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, height: 2, width: '100%',
  opacity: 0.6,
}
const sectionLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.20em', textTransform: 'uppercase',
  marginTop: 22, marginBottom: 12,
  paddingLeft: 10, borderLeft: '2px solid #D4B85A',
}
const threeColGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 14, marginBottom: 8,
}
const twoColGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
  gap: 14, marginBottom: 8,
}
const panel: React.CSSProperties = {
  display: 'block', padding: 18,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, textDecoration: 'none',
}
const panelHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  marginBottom: 14,
}
const panelTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const panelSubtitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7, marginTop: 2,
}
const panelArrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 14,
  color: '#D4B85A', opacity: 0.5,
}
const panelTip: React.CSSProperties = {
  marginTop: 12, padding: '8px 12px',
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.16)',
  borderLeft: '2px solid #D4B85A', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', lineHeight: 1.6,
}
const legendRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
}
const legendDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
}
const legendLabel: React.CSSProperties = {
  flex: 1, fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const legendValue: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', fontWeight: 500,
}
const touchRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 8px', textDecoration: 'none',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const activityRow: React.CSSProperties = {
  display: 'block', padding: '8px 10px', textDecoration: 'none',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const statlet: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const emptyHint: React.CSSProperties = {
  padding: '14px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.5, fontStyle: 'italic',
}
const emptyText: React.CSSProperties = {
  padding: '48px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const footer: React.CSSProperties = {
  marginTop: 32, padding: '16px 18px',
  background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 8,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  flexWrap: 'wrap', gap: 12,
}
const footerStat: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}
