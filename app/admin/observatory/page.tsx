'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  computePSt, decayCurve,
  type PrefInputs, type MemberEngagement,
} from '@/lib/mis/live-pst'

// Admin / Observatory
//
// A live, glass-box view of the Member Intelligence System's mathematics.
// Every number on this page traces to a real row or view; nothing is animated
// for show. Panel 1 (this turn) recomputes PS(t) client-side on a ~1s timer
// from stored inputs (λ, last_validated, validation_count, member visit
// cadence) using the SAME formulas as the preference_scores SQL view, so the
// number displayed equals the system's number — not a prettier approximation.
//
// Integer-day decay only steps at the UTC date boundary; the trajectory SVG
// shows the continuous curve the score is following, with a dot at the
// integer-day "today" — that's the system's value, the curve is where it's
// heading.

interface PreferenceRow {
  preference_id: string
  member_no: string
  category: string
  preference_name: string
  detail: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  validation_count: number
  last_validated: string | null
  lambda_origin: string | null
  status: string
}
interface MemberSummary {
  member_no: string
  full_name: string
  nickname: string | null
  avg_visits_per_month: number | null
  active_pref_count: number
}
interface Vitals {
  active_preferences: number
  total_exposure_days: number
  medical_locked: number
  lambda_origin_breakdown: Record<string, number>
  total_validation_events: number
}
interface Snapshot {
  timestamp: string
  members: MemberSummary[]
  preferences: PreferenceRow[]
  vitals: Vitals
}

export default function ObservatoryPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [selectedPref, setSelectedPref] = useState<string | null>(null)
  const [, setTick] = useState(0)  // forces 1s recompute

  // 1s recompute heartbeat — pure client math via computePSt, no DB poll.
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 1_000_000), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/observatory/snapshot', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) { setError(d.error); return }
        setSnap(d)
        // pick the most-active member by default, and their first pref
        if (d.members?.length) {
          setSelectedMember(d.members[0].member_no)
          const firstPref = d.preferences.find((p: PreferenceRow) => p.member_no === d.members[0].member_no)
          if (firstPref) setSelectedPref(firstPref.preference_id)
        }
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  const memberPrefs = useMemo(() => {
    if (!snap || !selectedMember) return []
    return snap.preferences.filter(p => p.member_no === selectedMember)
  }, [snap, selectedMember])

  const selectedMemberObj = useMemo(() =>
    snap?.members.find(m => m.member_no === selectedMember) || null,
    [snap, selectedMember]
  )

  const focusPref = useMemo(() =>
    memberPrefs.find(p => p.preference_id === selectedPref) || memberPrefs[0] || null,
    [memberPrefs, selectedPref]
  )

  if (error) return <div style={errorBox}>{error}</div>
  if (!snap) return <div style={empty}>Loading the live state…</div>

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>Intelligence · Live</div>
        <h1 style={pageTitle}>The Observatory</h1>
        <p style={lede}>
          A live, glass-box view of the system's mathematics. Every figure on this page traces to a real row.
          PS(t) is recomputed client-side from the stored inputs (λ, <code>last_validated</code>, validation
          count, member visit cadence) by the same formulas as the <code>preference_scores</code> SQL view,
          so the displayed number equals the system's number. The integer-day decay term only visibly steps
          at the UTC date boundary — the trajectory curve shows where the score is heading; the dot marks
          where it is now.
        </p>
      </div>

      {/* ─── Panel 1 — Live PS(t) decomposition ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Panel 1 · Live decomposition</div>
            <div style={panelTitle}>PS(t) = S₀ · C · e<sup>−λt</sup> · F · R · M, capped at 5</div>
          </div>
        </div>

        <div style={pickerRow}>
          <label style={pickerLabel}>
            Member
            <select
              value={selectedMember || ''}
              onChange={e => {
                setSelectedMember(e.target.value)
                const first = snap.preferences.find(p => p.member_no === e.target.value)
                setSelectedPref(first?.preference_id || null)
              }}
              style={pickerInput}
            >
              {snap.members.map(m => (
                <option key={m.member_no} value={m.member_no}>
                  {m.full_name} · {m.active_pref_count} prefs
                </option>
              ))}
            </select>
          </label>
          <label style={pickerLabel}>
            Preference
            <select
              value={selectedPref || ''}
              onChange={e => setSelectedPref(e.target.value)}
              style={pickerInput}
              disabled={memberPrefs.length === 0}
            >
              {memberPrefs.map(p => (
                <option key={p.preference_id} value={p.preference_id}>
                  [{p.category.slice(0, 14)}] {p.preference_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {focusPref ? (
          <Decomposition pref={focusPref} member={selectedMemberObj} />
        ) : (
          <div style={empty}>This member has no active preferences.</div>
        )}
      </section>

      {/* ─── Breadth table — all active preferences ─── */}
      <section style={panel}>
        <div style={panelHead}>
          <div>
            <div style={panelEyebrow}>Breadth · all {snap.preferences.length} active preferences</div>
            <div style={panelTitle}>Current PS(t) across the live profile</div>
          </div>
          <div style={metaText}>
            snapshot: {new Date(snap.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <BreadthTable preferences={snap.preferences} members={snap.members} onPick={(memberNo, prefId) => {
          setSelectedMember(memberNo)
          setSelectedPref(prefId)
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
        }} />
      </section>
    </>
  )
}

// ─── Decomposition card + trajectory SVG ─────────────────────────────────────

function Decomposition({ pref, member }: { pref: PreferenceRow; member: MemberSummary | null }) {
  const inputs: PrefInputs = {
    s0: pref.s0,
    confidence: pref.confidence,
    lambda: pref.lambda,
    frequency: pref.frequency,
    validationCount: pref.validation_count,
    lastValidatedISO: pref.last_validated || new Date().toISOString().slice(0, 10),
  }
  const engagement: MemberEngagement = { avgVisitsPerMonth: member?.avg_visits_per_month ?? null }
  const r = computePSt(inputs, engagement)
  const curve = useMemo(() => decayCurve(inputs, engagement, 365, 1), [
    inputs.s0, inputs.confidence, inputs.lambda, inputs.frequency,
    inputs.validationCount, inputs.lastValidatedISO,
    engagement.avgVisitsPerMonth,
  ])

  const factorRow = (label: string, value: string, note?: string, accent?: string) => (
    <div style={factorRowStyle}>
      <div style={factorLabel}>{label}</div>
      <div style={{ ...factorValue, color: accent || '#E5D4C2' }}>{value}</div>
      {note && <div style={factorNote}>{note}</div>}
    </div>
  )

  return (
    <div style={decompGrid}>
      <div style={decompLeft}>
        <div style={{ marginBottom: 12 }}>
          <div style={prefCategoryBadge}>{pref.category}</div>
          {pref.lambda_origin && <span style={originPill(pref.lambda_origin)}>{pref.lambda_origin.replace(/_/g, ' ')}</span>}
        </div>
        <div style={prefName}>{pref.preference_name}</div>
        {pref.detail && <div style={prefDetail}>{pref.detail}</div>}

        <div style={factorList}>
          {factorRow('S₀ — importance', pref.s0.toString())}
          {factorRow('C — confidence', pref.confidence.toFixed(2))}
          {factorRow('e^(−λt) — decay', r.decay.toFixed(4), `λ=${pref.lambda.toFixed(3)} · t=${r.daysSince}d (integer)`)}
          {factorRow('F — frequency', pref.frequency.toFixed(1))}
          {factorRow('R — reinforcement', r.reinforcement.toFixed(3), `vc=${pref.validation_count} · cap 1.30`)}
          {factorRow('M — engagement', r.engagement.toFixed(3),
            member?.avg_visits_per_month != null
              ? `avg ${member.avg_visits_per_month.toFixed(2)} visits/mo`
              : 'no visit history → neutral 1.0'
          )}
        </div>

        <div style={resultRow}>
          <div>
            <div style={factorLabel}>raw product</div>
            <div style={resultMid}>{r.rawProduct.toFixed(4)}</div>
          </div>
          <div>
            <div style={factorLabel}>PS(t) · capped at 5</div>
            <div style={resultBig}>{r.pst.toFixed(3)}</div>
          </div>
          <div>
            <div style={factorLabel}>0.7·S₀ threshold</div>
            <div style={resultMid}>{(0.7 * pref.s0).toFixed(2)}</div>
          </div>
        </div>

        <div style={flagRow}>
          {r.capped && <span style={flagPill('gold')}>cap binds — raw {r.rawProduct.toFixed(2)} {'>'} 5</span>}
          {r.needsRevalidation && <span style={flagPill('red')}>flagged for revalidation</span>}
          {pref.lambda === 0 && <span style={flagPill('red')}>medical · no decay</span>}
          {!r.capped && !r.needsRevalidation && pref.lambda > 0 && <span style={flagPill('green')}>healthy · within band</span>}
        </div>
      </div>

      <div style={decompRight}>
        <TrajectoryChart
          curve={curve}
          s0={pref.s0}
          currentPst={r.pst}
          daysSince={r.daysSince}
        />
        <div style={chartCaption}>
          Trajectory · {pref.lambda > 0 ? `half-life ≈ ${Math.round(Math.LN2 / pref.lambda)}d` : 'no decay'}
          {' · '}horizon 365d · dot = today (integer-day score)
        </div>
      </div>
    </div>
  )
}

// ─── Trajectory SVG ──────────────────────────────────────────────────────────

function TrajectoryChart({
  curve, s0, currentPst, daysSince,
}: {
  curve: { points: { day: number; pst: number }[]; todayIndex: number }
  s0: number
  currentPst: number
  daysSince: number
}) {
  const W = 460, H = 220
  const padL = 36, padR = 12, padT = 14, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxDay = curve.points[curve.points.length - 1]?.day || 1
  const yMax = 5
  const x = (d: number) => padL + (d / maxDay) * innerW
  const y = (v: number) => padT + (1 - v / yMax) * innerH

  const pathD = curve.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.pst).toFixed(1)}`)
    .join(' ')

  const threshold = 0.7 * s0
  const todayX = x(daysSince)
  const todayY = y(currentPst)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {/* y-axis ticks */}
      {[0, 1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="rgba(229,212,194,0.06)" strokeWidth={1} />
          <text x={padL - 6} y={y(v) + 4} fill="#7E7864" fontSize="9" textAnchor="end" fontFamily="Google Sans Code, monospace">{v}</text>
        </g>
      ))}
      {/* x-axis ticks */}
      {[0, 90, 180, 270, 365].map(d => d <= maxDay && (
        <g key={d}>
          <line x1={x(d)} y1={padT} x2={x(d)} y2={H - padB} stroke="rgba(229,212,194,0.04)" strokeWidth={1} />
          <text x={x(d)} y={H - padB + 14} fill="#7E7864" fontSize="9" textAnchor="middle" fontFamily="Google Sans Code, monospace">{d}d</text>
        </g>
      ))}
      {/* 0.7·S0 threshold */}
      <line x1={padL} y1={y(threshold)} x2={W - padR} y2={y(threshold)}
            stroke="#C27070" strokeWidth={1} strokeDasharray="3 4" opacity={0.85} />
      <text x={W - padR - 4} y={y(threshold) - 4} fill="#C27070" fontSize="9" textAnchor="end" fontFamily="Google Sans Code, monospace">
        0.7·S₀ = {threshold.toFixed(2)} (revalidation line)
      </text>
      {/* trajectory */}
      <path d={pathD} fill="none" stroke="#D4B85A" strokeWidth={1.5} />
      {/* today line + dot */}
      <line x1={todayX} y1={padT} x2={todayX} y2={H - padB} stroke="rgba(212,184,90,0.30)" strokeWidth={1} />
      <circle cx={todayX} cy={todayY} r={4.5} fill="#E5D4C2" stroke="#052E20" strokeWidth={1.5} />
      <text x={todayX + 8} y={todayY - 6} fill="#E5D4C2" fontSize="10" fontFamily="Google Sans Code, monospace">
        today · {currentPst.toFixed(2)}
      </text>
    </svg>
  )
}

// ─── Breadth table ───────────────────────────────────────────────────────────

function BreadthTable({
  preferences, members, onPick,
}: {
  preferences: PreferenceRow[]
  members: MemberSummary[]
  onPick: (memberNo: string, prefId: string) => void
}) {
  const statByMember = useMemo(() => {
    const m = new Map<string, MemberSummary>()
    for (const x of members) m.set(x.member_no, x)
    return m
  }, [members])

  const [sortBy, setSortBy] = useState<'category' | 'pst' | 'days' | 'origin'>('category')
  const [filterText, setFilterText] = useState('')

  const rows = useMemo(() => {
    const enriched = preferences.map(p => {
      const mem = statByMember.get(p.member_no) || null
      const r = computePSt({
        s0: p.s0, confidence: p.confidence, lambda: p.lambda, frequency: p.frequency,
        validationCount: p.validation_count,
        lastValidatedISO: p.last_validated || new Date().toISOString().slice(0, 10),
      }, { avgVisitsPerMonth: mem?.avg_visits_per_month ?? null })
      return {
        ...p,
        member_name: mem?.full_name || p.member_no,
        pst: r.pst,
        days: r.daysSince,
        needsRevalidation: r.needsRevalidation,
      }
    })

    const q = filterText.trim().toLowerCase()
    const filtered = q ? enriched.filter(r =>
      `${r.preference_name} ${r.category} ${r.member_name} ${r.lambda_origin || ''}`.toLowerCase().includes(q)
    ) : enriched

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'pst':      return b.pst - a.pst
        case 'days':     return b.days - a.days
        case 'origin':   return (a.lambda_origin || 'z').localeCompare(b.lambda_origin || 'z')
        default:         return a.category.localeCompare(b.category) || b.pst - a.pst
      }
    })
    return filtered
  }, [preferences, statByMember, sortBy, filterText])

  return (
    <>
      <div style={breadthControls}>
        <input
          type="text"
          placeholder="Filter by name, category, member, or origin…"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          style={breadthFilter}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['category', 'pst', 'days', 'origin'] as const).map(key => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={sortBy === key ? sortChipActive : sortChip}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div style={breadthScroll}>
        <table style={breadthTable}>
          <thead>
            <tr>
              <th style={thLeft}>Preference</th>
              <th style={th}>Member</th>
              <th style={th}>Category</th>
              <th style={thNum}>λ</th>
              <th style={thNum}>days</th>
              <th style={thNum}>PS(t)</th>
              <th style={th}>origin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.preference_id} onClick={() => onPick(r.member_no, r.preference_id)} style={tr}>
                <td style={tdLeft}>
                  {r.preference_name}
                  {r.needsRevalidation && <span style={{ color: '#C27070', marginLeft: 6 }}>·flag</span>}
                </td>
                <td style={td}>{r.member_name}</td>
                <td style={td}>{r.category}</td>
                <td style={tdNum}>{r.lambda.toFixed(3)}</td>
                <td style={tdNum}>{r.days}</td>
                <td style={tdNum}>
                  <span style={{ color: r.pst >= 0.7 * r.s0 ? '#E5D4C2' : '#C27070' }}>
                    {r.pst.toFixed(2)}
                  </span>
                </td>
                <td style={td}>
                  <span style={originPill(r.lambda_origin || '(null)')}>{(r.lambda_origin || 'none').replace(/_/g, ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={metaText}>{rows.length} row{rows.length === 1 ? '' : 's'} · click any row to focus the decomposition above.</div>
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 14px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 880, margin: 0,
}
const panel: React.CSSProperties = {
  marginTop: 24, padding: 24,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10,
}
const panelHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  marginBottom: 16, gap: 16, flexWrap: 'wrap',
}
const panelEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const panelTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', marginTop: 4,
}
const metaText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#7E7864',
}
const pickerRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18,
}
const pickerLabel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const pickerInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, outline: 'none',
}
const decompGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 24, alignItems: 'start',
}
const decompLeft: React.CSSProperties = { minWidth: 0 }
const decompRight: React.CSSProperties = { minWidth: 0 }
const prefCategoryBadge: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.10em', textTransform: 'uppercase',
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.30)',
  borderRadius: 3, marginRight: 6,
}
const prefName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', marginTop: 6,
}
const prefDetail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.85, marginTop: 4, lineHeight: 1.6,
}
const factorList: React.CSSProperties = {
  marginTop: 14, display: 'flex', flexDirection: 'column', gap: 2,
}
const factorRowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '180px 100px 1fr',
  alignItems: 'baseline', padding: '6px 0',
  borderBottom: '1px solid rgba(229,212,194,0.05)',
}
const factorLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.06em',
}
const factorValue: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 13,
}
const factorNote: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.65,
}
const resultRow: React.CSSProperties = {
  marginTop: 14, padding: '12px 0',
  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
  borderTop: '1px solid rgba(229,212,194,0.10)',
  borderBottom: '1px solid rgba(229,212,194,0.10)',
}
const resultMid: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 14,
  color: '#B2AA98', marginTop: 4,
}
const resultBig: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 600,
  color: '#D4B85A', marginTop: 4,
}
const flagRow: React.CSSProperties = {
  marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap',
}
const flagPill = (tone: 'gold' | 'red' | 'green'): React.CSSProperties => {
  const p = {
    gold:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.12)', bd: 'rgba(212,184,90,0.35)' },
    red:   { fg: '#C27070', bg: 'rgba(194,112,112,0.12)', bd: 'rgba(194,112,112,0.40)' },
    green: { fg: '#7AB07A', bg: 'rgba(122,176,122,0.12)', bd: 'rgba(122,176,122,0.30)' },
  }[tone]
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 10,
    color: p.fg, background: p.bg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '3px 8px',
    letterSpacing: '0.06em',
  }
}
function originPill(o: string): React.CSSProperties {
  const palette: Record<string, { fg: string; bg: string; bd: string }> = {
    ai_specific:                { fg: '#D4B85A', bg: 'rgba(212,184,90,0.10)', bd: 'rgba(212,184,90,0.30)' },
    category_baseline_learned:  { fg: '#7AB07A', bg: 'rgba(122,176,122,0.10)', bd: 'rgba(122,176,122,0.30)' },
    category_baseline_designed: { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.18)' },
    forced_medical:             { fg: '#C27070', bg: 'rgba(194,112,112,0.12)', bd: 'rgba(194,112,112,0.40)' },
    '(null)':                   { fg: '#7E7864', bg: 'rgba(229,212,194,0.04)', bd: 'rgba(229,212,194,0.10)' },
  }
  const p = palette[o] || palette['(null)']
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    color: p.fg, background: p.bg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '2px 7px',
    letterSpacing: '0.06em', textTransform: 'uppercase', display: 'inline-block',
  }
}
const chartCaption: React.CSSProperties = {
  marginTop: 8, fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const breadthControls: React.CSSProperties = {
  display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap',
}
const breadthFilter: React.CSSProperties = {
  flex: 1, minWidth: 220,
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, outline: 'none',
}
const sortChip: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
  textTransform: 'lowercase',
}
const sortChipActive: React.CSSProperties = {
  ...sortChip, color: '#D4B85A',
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.35)',
}
const breadthScroll: React.CSSProperties = {
  maxHeight: 480, overflowY: 'auto', overflowX: 'auto',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
  marginBottom: 8,
}
const breadthTable: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px',
  color: '#7E7864', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 9,
  background: 'rgba(5,46,32,0.6)', position: 'sticky', top: 0,
  borderBottom: '1px solid rgba(229,212,194,0.10)',
}
const thLeft: React.CSSProperties = { ...th, paddingLeft: 14 }
const thNum: React.CSSProperties = { ...th, textAlign: 'right' }
const tr: React.CSSProperties = {
  cursor: 'pointer',
}
const td: React.CSSProperties = {
  padding: '6px 10px', color: '#B2AA98',
  borderBottom: '1px solid rgba(229,212,194,0.04)',
}
const tdLeft: React.CSSProperties = { ...td, paddingLeft: 14, color: '#E5D4C2' }
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' }
const empty: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
