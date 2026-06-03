'use client'

import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import Link from 'next/link'
import { Donut, Sparkline, HBars, StackedBars, LineChart, Funnel, PALETTE } from './_charts/Charts'

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
      if (!r.ok || !j.ok) throw new Error(j.error || 'Send failed')
      setConfirmDigest(false)
      showToast(`Weekly digest sent to ${j.recipients.length} ${j.recipients.length === 1 ? 'recipient' : 'recipients'}.`)
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

  if (loading || !data) return <div style={emptyText}>Reading the room…</div>

  const k = data.kpis
  const refreshedAt = new Date(data.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {/* Hero header */}
      <div style={heroRow}>
        <div>
          <div style={eyebrow}>Data centre</div>
          <h1 style={pageTitle}>Dashboard</h1>
          <p style={lede}>Everything the system knows, at a glance. Every tile is a link — click into anything that catches your eye.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={load} disabled={refreshing} style={refreshBtn}>
            {refreshing ? '◌ Refreshing…' : '↻ Refresh'}
          </button>
          <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864', letterSpacing: '0.08em' }}>
            Updated {refreshedAt}
          </div>
        </div>
      </div>

      {/* ROW 1 — KPI strip */}
      <div style={kpiGrid}>
        <KpiTile
          href="/admin/mis"
          label="Active members"
          value={k.activeMembers}
          delta={k.activeMembers30dDelta ? `+${k.activeMembers30dDelta} / 30d` : 'steady'}
          deltaPositive={k.activeMembers30dDelta > 0}
          spark={data.sparklines.members}
          tone="#7AB07A"
        />
        <KpiTile
          href="/admin/mis/pipeline"
          label="In pipeline"
          value={k.pipelineCount}
          delta={`+${k.prospectsLastWeek} / 7d`}
          deltaPositive={k.prospectsLastWeek > 0}
          spark={data.sparklines.prospects}
          tone="#D4B85A"
        />
        <KpiTile
          href="/admin/agreements"
          label="Pending signatures"
          value={k.pendingSignatures}
          delta={k.oldestPending != null ? `oldest ${k.oldestPending}d` : '—'}
          deltaPositive={k.oldestPending != null && k.oldestPending < 7}
          tone="#E58F4A"
        />
        <KpiTile
          href="/admin/mx-daily"
          label="Open complaints"
          value={k.openComplaints}
          delta={k.openComplaints ? `avg S${k.avgSeverity}` : 'clear'}
          deltaPositive={k.openComplaints === 0}
          tone={k.openComplaints ? '#C27070' : '#7AB07A'}
        />
        <KpiTile
          href="/admin/lockers"
          label="Locker utilization"
          value={`${k.lockerUtilization}%`}
          delta={`${k.lockerOccupied}/${k.lockerTotal} · ${k.bottleCount} btl`}
          deltaPositive={k.lockerUtilization > 0}
          tone="#9E8FC4"
        />
        <KpiTile
          href="/admin/whisky"
          label="Whisky in stock"
          value={k.whiskyInStock}
          delta={k.whiskyOutOfStock ? `${k.whiskyOutOfStock} out` : 'all in stock'}
          deltaPositive={k.whiskyOutOfStock === 0}
          tone="#5B8FA8"
        />
      </div>

      {/* ROW 2 — Member intelligence */}
      <div style={sectionLabel}>Member Intelligence</div>
      <div style={threeColGrid}>
        <Panel title="Member composition" subtitle="Active members by tier" href="/admin/mis">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Donut
              data={data.memberTiers.map((t, i) => ({ label: t.tier, value: t.count, color: PALETTE[i % PALETTE.length] }))}
              centerValue={k.activeMembers}
              centerLabel="Active"
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.memberTiers.filter(t => t.count > 0).map((t, i) => (
                <div key={t.tier} style={legendRow}>
                  <span style={{ ...legendDot, background: PALETTE[i % PALETTE.length] }} />
                  <span style={legendLabel}>{t.tier}</span>
                  <span style={legendValue}>{t.count}</span>
                </div>
              ))}
              {data.memberTiers.every(t => t.count === 0) && <div style={emptyHint}>No active members yet.</div>}
            </div>
          </div>
        </Panel>

        <Panel title="PS(t) health" subtitle="Member preference decay distribution" href="/admin/mis">
          <HBars
            data={[
              { label: 'Strong (≥4)',  value: data.psHealth.strong,  color: '#7AB07A' },
              { label: 'Healthy (3–4)',value: data.psHealth.healthy, color: '#A8C588' },
              { label: 'Drift (2–3)',  value: data.psHealth.drift,   color: '#D4B85A' },
              { label: 'Decay (1–2)',  value: data.psHealth.decay,   color: '#E58F4A' },
              { label: 'Lapsed (<1)',  value: data.psHealth.lapsed,  color: '#C27070' },
              { label: 'No prefs yet', value: data.psHealth.none,    color: 'rgba(229,212,194,0.20)' },
            ]}
          />
          <div style={panelTip}>
            Members in Drift/Decay need a touchpoint or revalidation soon — open the member profile and capture a fresh preference.
          </div>
        </Panel>

        <Panel title="Joins · 12 months" subtitle="New active members per month" href="/admin/mis">
          <LineChart data={data.joins12m} width={320} height={140} valueKey="count" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={statlet}>Total joins: <strong style={{ color: '#E5D4C2' }}>{data.joins12m.reduce((s, j) => s + j.count, 0)}</strong></span>
            <span style={statlet}>Peak month: <strong style={{ color: '#D4B85A' }}>{Math.max(0, ...data.joins12m.map(j => j.count))}</strong></span>
          </div>
        </Panel>
      </div>

      {/* ROW 3 — Pipeline intelligence */}
      <div style={sectionLabel}>Pipeline Intelligence</div>
      <div style={twoColGrid}>
        <Panel title="Funnel by stage" subtitle="Live prospects only — archived excluded" href="/admin/mis/pipeline">
          <Funnel stages={data.pipelineFunnel.stages} conversion={data.pipelineFunnel.overallConversion} />
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Source attribution" subtitle="Where prospects come from" href="/admin/mis/pipeline">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Donut
                data={data.pipelineSources.map((s, i) => ({ label: s.source, value: s.count, color: PALETTE[(i + 1) % PALETTE.length] }))}
                centerValue={data.pipelineSources.reduce((s, x) => s + x.count, 0)}
                centerLabel="Prospects"
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

          <Panel title="Top referrers" subtitle="Members bringing prospects" href="/admin/mis/pipeline">
            {data.referrers.length === 0 ? (
              <div style={emptyHint}>No referrers tracked yet.</div>
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
      <div style={sectionLabel}>Operational Health</div>
      <div style={threeColGrid}>
        <Panel title="Lapsed radar" subtitle="Active members without a recent visit" href="/admin/mx-daily">
          <HBars
            data={[
              { label: '30–59 days', value: data.lapsed.b30, color: '#D4B85A' },
              { label: '60–89 days', value: data.lapsed.b60, color: '#E58F4A' },
              { label: '90+ days',   value: data.lapsed.b90, color: '#C27070' },
            ]}
          />
          <div style={panelTip}>
            30d → friendly nudge. 60d → personal call. 90+ → escalate to GM.
          </div>
        </Panel>

        <Panel title="This week" subtitle="Birthdays & anniversaries" href="/admin/mx-daily">
          {data.thisWeek.length === 0 ? (
            <div style={emptyHint}>Nothing in the next 7 days.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.thisWeek.map((t, i) => (
                <Link key={i} href={`/admin/mis/${t.member_no}`} style={touchRow}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: t.kind === 'birthday' ? '#D4B85A' : '#7AB07A',
                  }} />
                  <span style={{ flex: 1, fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2' }}>
                    {t.name}
                    {t.kind === 'anniversary' && <span style={{ color: '#7AB07A', marginLeft: 6 }}>· {t.years}y</span>}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98' }}>
                    {t.days === 0 ? 'today' : t.days === 1 ? 'tomorrow' : `in ${t.days}d`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Live activity" subtitle="Latest pipeline events" href="/admin/mis/pipeline">
          {data.activity.length === 0 ? (
            <div style={emptyHint}>No recent activity.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {data.activity.map(a => (
                <Link key={a.id} href={`/admin/mis/pipeline/${a.prospect_id}`} style={activityRow}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2' }}>
                      {formatActivity(a)}
                    </span>
                    <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
                      {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', marginTop: 2 }}>
                    {a.prospect_id} · {a.actor || 'system'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ROW 5 — Whisky & cards */}
      <div style={sectionLabel}>Whisky & Cards</div>
      <div style={threeColGrid}>
        <Panel title="Bottle fill distribution" subtitle="Across every locker" href="/admin/lockers">
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
            Bottles ≤25% are the next sales opportunity — offer a top-up at next visit.
          </div>
        </Panel>

        <Panel title="Inventory by region" subtitle="Whiskies in stock — top regions" href="/admin/whisky">
          {data.whiskyByRegion.length === 0 ? (
            <div style={emptyHint}>No region data yet.</div>
          ) : (
            <HBars data={data.whiskyByRegion.map(r => ({ label: r.region, value: r.count }))} />
          )}
        </Panel>

        <Panel title="Card volume · 7d" subtitle="Top-ups (green) vs. charges (gold)" href="/admin/cards">
          <StackedBars data={data.cardVolume7d} labels width={300} height={120} />
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontFamily: "'Google Sans Code', monospace", fontSize: 10 }}>
            <span style={{ color: '#7AB07A' }}>
              ▇ Top-ups: {formatVnd(data.cardVolume7d.reduce((s, d) => s + d.topups, 0))}
            </span>
            <span style={{ color: '#D4B85A' }}>
              ▇ Charges: {formatVnd(data.cardVolume7d.reduce((s, d) => s + d.charges, 0))}
            </span>
          </div>
          {data.topCards.length > 0 && (
            <>
              <div style={{ ...sectionLabel, fontSize: 9, marginTop: 14, marginBottom: 6 }}>Top-credited cards</div>
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
          <span style={footerStat}><strong style={{ color: '#D4B85A' }}>{k.adminCount}</strong> Admin{k.adminCount === 1 ? '' : 's'}</span>
          <span style={footerStat}>·</span>
          <span style={footerStat}>{k.activeMembers} active · {k.pipelineCount} in pipeline · {k.openComplaints} complaints</span>
          <span style={footerStat}>·</span>
          <Link href="/admin/training" style={{ ...footerStat, color: '#7AB07A', textDecoration: 'none' }}>Training →</Link>
          <span style={footerStat}>·</span>
          <button
            onClick={() => setConfirmDigest(true)}
            style={{ ...footerStat, color: '#D4B85A', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Google Sans Code', monospace" }}
          >
            ↗ Send weekly digest
          </button>
        </div>
        <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
          Refreshed {refreshedAt} · GMT+7
        </div>
      </div>

      <ConfirmModal
        open={confirmDigest}
        tone="info"
        eyebrow="↗ WEEKLY DIGEST"
        title="Send the weekly digest now?"
        subject="To everyone on DIGEST_RECIPIENTS"
        body="Sends the weekly digest email immediately, outside the normal Monday schedule. Recipients receive it right away."
        confirmLabel="Send digest"
        busyLabel="Sending…"
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

function Panel({ title, subtitle, href, children }: {
  title: string
  subtitle?: string
  href?: string
  children: React.ReactNode
}) {
  const inner = (
    <>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>{title}</div>
          {subtitle && <div style={panelSubtitle}>{subtitle}</div>}
        </div>
        {href && <div style={panelArrow}>→</div>}
      </div>
      <div>{children}</div>
    </>
  )
  if (href) return <Link href={href} style={panel}>{inner}</Link>
  return <div style={panel}>{inner}</div>
}

function formatActivity(a: { event_type: string; from_value: string | null; to_value: string | null }): string {
  switch (a.event_type) {
    case 'created':             return `New prospect added`
    case 'stage_changed':       return `Stage → ${a.to_value}`
    case 'source_changed':      return `Source → ${a.to_value || '—'}`
    case 'decision_changed':    return `Decision → ${a.to_value || '—'}`
    case 'letter_sent':         return 'Letter sent'
    case 'scored':              return 'Score updated'
    case 'member_no_allocated': return `Provisional ${a.to_value} allocated`
    case 'invitation_sent':     return `Invitation sent`
    case 'invitation_resent':   return `Invitation resent`
    case 'signed':              return `Agreement signed${a.to_value ? ` → ${a.to_value}` : ''}`
    case 'converted':           return `Converted to ${a.to_value}`
    case 'archived':            return 'Archived'
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
