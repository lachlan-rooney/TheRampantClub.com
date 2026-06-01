'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

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

interface Data {
  birthdays: Birthday[]
  anniversaries: Anniversary[]
  lapsed: { bucket_30: LapsedRow[]; bucket_60: LapsedRow[]; bucket_90: LapsedRow[] }
  complaints: Complaint[]
  counts: { birthdays: number; anniversaries: number; lapsed_total: number; complaints_open: number }
}

export default function MXDailyPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddComplaint, setShowAddComplaint] = useState(false)
  const [c, setC] = useState({ member_no: '', member_name: '', summary: '', severity: 2, category: '', details: '' })
  const [submitting, setSubmitting] = useState(false)

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

  const setComplaintStatus = async (id: string, status: string, resolution?: string) => {
    await fetch(`/api/admin/complaints/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution }),
    })
    load()
  }

  if (loading || !data) return <div style={emptyText}>Loading MX Daily…</div>

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>Floor · Member Experience</div>
        <h1 style={pageTitle}>MX Daily</h1>
        <p style={lede}>
          The morning check-in. Birthdays, anniversaries, members slipping out of the rhythm, and any friction we need to clear. Action one thing from each panel before service.
        </p>
        <div style={{ ...lede, marginTop: 8, color: '#7E7864', fontSize: 11 }}>{today}</div>
      </div>

      {/* Stat strip */}
      <div style={statStrip}>
        <StatTile label="Birthdays (7d)"     value={data.counts.birthdays} color="#D4B85A" />
        <StatTile label="Anniversaries (7d)" value={data.counts.anniversaries} color="#7AB07A" />
        <StatTile label="Lapsed members"     value={data.counts.lapsed_total} color="#C27070" />
        <StatTile label="Open complaints"    value={data.counts.complaints_open} color="#C27070" />
      </div>

      <div style={twoCol}>
        {/* LEFT: Birthdays + Anniversaries + Tonight */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel
            title="Tonight"
            eyebrow="Pre-shift"
            action={<Link href="/admin/tonight" style={panelActionLink}>Full brief →</Link>}
          >
            <div style={panelHint}>
              The Tonight page has the full breakdown of bookings, last-visit notes, and preferences. Use that for service prep. Bring back here anything that needs MX intervention.
            </div>
          </Panel>

          <Panel
            title="Birthdays this week"
            eyebrow="Touchpoint"
            badge={data.counts.birthdays > 0 ? String(data.counts.birthdays) : undefined}
          >
            {data.birthdays.length === 0 ? (
              <div style={panelEmpty}>No birthdays in the next 7 days.</div>
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
              Action: hand-written card + a comp pour at next visit. Note it in the journal afterwards.
            </div>
          </Panel>

          <Panel
            title="Membership anniversaries"
            eyebrow="Milestone"
            badge={data.counts.anniversaries > 0 ? String(data.counts.anniversaries) : undefined}
          >
            {data.anniversaries.length === 0 ? (
              <div style={panelEmpty}>No anniversaries in the next 7 days.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.anniversaries.map(a => (
                  <Link key={a.member_no} href={`/admin/mis/${a.member_no}`} style={memberRow}>
                    <div>
                      <div style={memberName}>{a.full_name}</div>
                      <div style={memberMeta}>{a.member_no} · {a.tier}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...dayBadge(a.days_until), background: 'rgba(122,176,122,0.18)', color: '#7AB07A', borderColor: 'rgba(122,176,122,0.40)' }}>
                        {a.years}y · {labelForDays(a.days_until)}
                      </div>
                      <div style={memberMeta}>since {a.join_date.slice(0, 10)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div style={panelTip}>
              Action: gift or hosted experience for 1/3/5-year marks. Smaller acknowledgement for 2/4-year.
            </div>
          </Panel>
        </div>

        {/* RIGHT: Lapsed + Complaints */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Lapsed radar" eyebrow="Retention" badge={data.counts.lapsed_total > 0 ? String(data.counts.lapsed_total) : undefined}>
            <LapsedBucket title="30–59 days" rows={data.lapsed.bucket_30} tone="#D4B85A" />
            <LapsedBucket title="60–89 days" rows={data.lapsed.bucket_60} tone="#E58F4A" />
            <LapsedBucket title="90+ days"   rows={data.lapsed.bucket_90} tone="#C27070" />
            <div style={panelTip}>
              Action: 30d gets a casual text or invite to the next event. 60d gets a personal call from MX. 90+ gets escalated to the GM.
            </div>
          </Panel>

          <Panel
            title="Complaint queue"
            eyebrow="Triage"
            badge={data.counts.complaints_open > 0 ? String(data.counts.complaints_open) : undefined}
            action={
              <button onClick={() => setShowAddComplaint(s => !s)} style={panelActionBtn}>
                {showAddComplaint ? 'Cancel' : '＋ Log complaint'}
              </button>
            }
          >
            {showAddComplaint && (
              <div style={complaintForm}>
                <div style={editLabel}>Summary *</div>
                <input value={c.summary} onChange={e => setC({ ...c, summary: e.target.value })} placeholder="One-line description of the friction" style={inputStyle} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>Member no.</div>
                    <input value={c.member_no} onChange={e => setC({ ...c, member_no: e.target.value })} placeholder="optional" style={inputStyle} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <div style={editLabel}>Member name</div>
                    <input value={c.member_name} onChange={e => setC({ ...c, member_name: e.target.value })} placeholder="optional" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>Severity</div>
                    <select value={c.severity} onChange={e => setC({ ...c, severity: Number(e.target.value) })} style={inputStyle}>
                      <option value={1}>1 · Minor</option>
                      <option value={2}>2 · Notable</option>
                      <option value={3}>3 · Material</option>
                      <option value={4}>4 · Serious</option>
                      <option value={5}>5 · Critical</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>Category</div>
                    <select value={c.category} onChange={e => setC({ ...c, category: e.target.value })} style={inputStyle}>
                      <option value="">—</option>
                      <option value="service">Service</option>
                      <option value="product">Product</option>
                      <option value="facility">Facility</option>
                      <option value="billing">Billing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div style={editLabel}>Details</div>
                <textarea rows={3} value={c.details} onChange={e => setC({ ...c, details: e.target.value })} placeholder="What happened, who said what, current state…" style={{ ...inputStyle, resize: 'vertical' }} />
                <button onClick={submitComplaint} disabled={!c.summary.trim() || submitting} style={{ ...btnPrimary, marginTop: 6, opacity: !c.summary.trim() ? 0.4 : 1 }}>
                  {submitting ? 'Saving…' : 'Log complaint'}
                </button>
              </div>
            )}

            {data.complaints.length === 0 ? (
              <div style={panelEmpty}>No open or acknowledged complaints. Quiet week.</div>
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
                          Reported {new Date(c.reported_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {c.reported_by && ` · ${c.reported_by}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.status === 'open' && (
                          <button onClick={() => setComplaintStatus(c.id, 'acknowledged')} style={tinyBtn}>Acknowledge</button>
                        )}
                        {c.status !== 'resolved' && (
                          <button onClick={() => {
                            const r = prompt('Resolution note (what was done):')
                            if (r != null) setComplaintStatus(c.id, 'resolved', r)
                          }} style={{ ...tinyBtn, color: '#7AB07A', borderColor: 'rgba(122,176,122,0.30)' }}>Resolve</button>
                        )}
                        {c.status !== 'dismissed' && (
                          <button onClick={() => setComplaintStatus(c.id, 'dismissed')} style={{ ...tinyBtn, color: '#7E7864' }}>Dismiss</button>
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
