'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { vnDateString, vnDateTimeString } from '@/lib/datetime'

// Admin / Floor / Tonight
//
// Two-section service surface. Top: a wall of pre-rendered Overture
// briefs for every member booked tonight + any walk-ins already in the
// cycle. Each card has one-click Start visit / Open visit. Bottom: the
// daily pick (dram, vinyl, member quote) editor for the homepage and
// members portal.

interface PrefRow {
  preference_id: string
  member_no: string
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  s0: number
  ps_t: number
  needs_revalidation: string | null
  last_validated: string
}
interface MemberLite {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
}
interface Booking {
  booking_id: string
  member_no: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string
  party_size: number
  notes: string | null
  status: string
  linked_visit_id: string | null
}
interface VisitToday {
  visit_id: string
  member_no: string
  phase: string
  arrival_time: string | null
}
interface MemberStats {
  total_visits: number
  last_visit: string | null
  days_since_visit: number | null
  avg_visits_per_month: number | null
}
interface LastNote {
  visit_id: string
  visit_date: string
  data_for_next_overture: string
}
interface GiftingSummary {
  annual_budget_vnd: number
  spent_vnd: number
  gift_count: number
}
interface OpenComplaint {
  id: string
  severity: number
  summary: string
  status: string
}
interface Brief {
  member: MemberLite
  booking: Booking | null
  visit: VisitToday | null
  occasion: string | null
  brief: { score5: PrefRow[]; revalidate: PrefRow[]; last_continuum_note: LastNote | null }
  stats: MemberStats | null
  gifting: GiftingSummary | null
  complaints: OpenComplaint[]
  preference_count: number
}

interface Pick {
  pick_date: string
  dram_label: string | null
  dram_note: string | null
  vinyl_label: string | null
  vinyl_note: string | null
  member_quote: string | null
  updated_at: string | null
}

export default function AdminTonight() {
  const router = useRouter()
  const [date, setDate] = useState(vnDateString())
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [loadingBriefs, setLoadingBriefs] = useState(true)
  const [pick, setPick] = useState<Pick | null>(null)
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }

  const loadBriefs = useCallback(async () => {
    setLoadingBriefs(true)
    const r = await fetch(`/api/admin/tonight/briefs?date=${date}`, { cache: 'no-store' })
    const j = await r.json()
    setBriefs(j.briefs || [])
    setLoadingBriefs(false)
  }, [date])

  const loadPick = useCallback(async () => {
    const r = await fetch(`/api/admin/tonight?date=${date}`, { cache: 'no-store' })
    const j = await r.json()
    setPick(j.pick || {
      pick_date: date,
      dram_label: null, dram_note: null,
      vinyl_label: null, vinyl_note: null,
      member_quote: null, updated_at: null,
    })
  }, [date])

  useEffect(() => { loadBriefs(); loadPick() }, [loadBriefs, loadPick])

  const startVisit = async (memberNo: string) => {
    if (starting) return
    setStarting(memberNo)
    try {
      const r = await fetch('/api/admin/visits/start-from-card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: memberNo }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not start visit')
      router.push(`/admin/mis/visits/${j.visit_id}`)
    } catch (e) {
      showToast((e as Error).message)
      setStarting(null)
    }
  }

  const savePick = async () => {
    if (!pick) return
    setBusy(true)
    const r = await fetch('/api/admin/tonight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pick_date: date,
        dram_label: pick.dram_label || null,
        dram_note: pick.dram_note || null,
        vinyl_label: pick.vinyl_label || null,
        vinyl_note: pick.vinyl_note || null,
        member_quote: pick.member_quote || null,
      }),
    })
    setBusy(false)
    if (r.ok) { showToast('Pick saved'); loadPick() }
    else showToast('Save failed')
  }

  const counts = {
    booked: briefs.filter(b => b.booking).length,
    walkins: briefs.filter(b => !b.booking && b.visit).length,
    arrived: briefs.filter(b => b.visit).length,
    needs_attention: briefs.filter(b => b.brief.revalidate.length > 0 || b.complaints.length > 0).length,
  }
  const today = vnDateString()
  const isToday = date === today

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Floor</div>
          <h1 style={pageTitle}>Tonight at The Rampant Club</h1>
          <p style={lede}>
            Pre-shift briefs for every booked member + walk-ins already on the floor. One-click into the Guardian Angel cycle. Curate the dram, vinyl and member quote for the homepage below.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={dateStepper}>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value || today)}
              style={{ ...inputStyle, width: 'auto' }}
            />
            {!isToday && (
              <button onClick={() => setDate(today)} style={smallBtn}>Today</button>
            )}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={strip}>
        <Stat label="Booked tonight"  value={counts.booked} />
        <Stat label="Walk-ins"        value={counts.walkins} />
        <Stat label="Already arrived" value={counts.arrived} color="#7AB07A" />
        <Stat label="Needs attention" value={counts.needs_attention} color={counts.needs_attention > 0 ? '#D4B85A' : '#7AB07A'} />
      </div>

      {/* BRIEFS */}
      <div style={sectionLabel}>The Wall · Tonight&apos;s Briefs</div>
      {loadingBriefs ? (
        <div style={emptyText}>Loading briefs…</div>
      ) : briefs.length === 0 ? (
        <div style={emptyBlock}>
          No bookings or walk-ins for {isToday ? 'tonight' : date}. Create a booking from{' '}
          <Link href="/admin/calendar" style={linkInline}>the calendar</Link>.
        </div>
      ) : (
        <div style={briefGrid}>
          {briefs.map(b => (
            <BriefCard
              key={b.member.member_no}
              brief={b}
              isStarting={starting === b.member.member_no}
              onStart={() => startVisit(b.member.member_no)}
            />
          ))}
        </div>
      )}

      {/* DAILY PICK */}
      <div style={{ ...sectionLabel, marginTop: 32 }}>The Daily Pick</div>
      <p style={sectionLede}>
        Curate the dram, the vinyl, and the member quote that show on the homepage and members portal. Leave any field blank and the seed-list fallback rotates in for that day.
      </p>

      {pick && (
        <div style={pickBlock}>
          <PickSection title="Dram of the day">
            <PickField label="Whisky" value={pick.dram_label} onChange={v => setPick(p => p ? { ...p, dram_label: v } : p)} placeholder="Lagavulin 16" />
            <PickField label="Note"   value={pick.dram_note}  onChange={v => setPick(p => p ? { ...p, dram_note:  v } : p)} placeholder="Peat, iodine, smoke. The Islay benchmark." />
          </PickSection>
          <PickSection title="On the turntable">
            <PickField label="Record" value={pick.vinyl_label} onChange={v => setPick(p => p ? { ...p, vinyl_label: v } : p)} placeholder="Bill Evans Trio — Sunday at the Village Vanguard" />
            <PickField label="Note"   value={pick.vinyl_note}  onChange={v => setPick(p => p ? { ...p, vinyl_note:  v } : p)} placeholder="Live, intimate, 1961." />
          </PickSection>
          <PickSection title="Member quote">
            <PickField label="Quote" value={pick.member_quote} onChange={v => setPick(p => p ? { ...p, member_quote: v } : p)} placeholder="There are no whisky snobs here. Only enthusiasts." multiline />
          </PickSection>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
            <button onClick={savePick} disabled={busy} style={btnPrimary}>
              {busy ? 'Saving…' : 'Save pick'}
            </button>
            {pick.updated_at && (
              <span style={pickMeta}>last saved {vnDateTimeString(pick.updated_at)}</span>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={toastBox}>{toast}</div>
      )}
    </>
  )
}

// ── BriefCard ─────────────────────────────────────────────────────────
function BriefCard({ brief, isStarting, onStart }: { brief: Brief; isStarting: boolean; onStart: () => void }) {
  const b = brief
  const arrived = !!b.visit
  const timeLine = b.booking
    ? (b.booking.start_time
        ? (b.booking.end_time ? `${b.booking.start_time.slice(0, 5)}–${b.booking.end_time.slice(0, 5)}` : b.booking.start_time.slice(0, 5))
        : (b.booking.session_label || '—'))
    : 'walk-in'

  return (
    <div style={cardBlock}>
      <div style={cardHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/admin/mis/${b.member.member_no}`} style={memberLink}>
            {b.member.full_name}
          </Link>
          <div style={cardMeta}>
            {b.member.tier} · {b.member.member_no}
            {b.stats?.days_since_visit != null && <> · last {b.stats.days_since_visit}d ago</>}
            {b.stats?.total_visits != null && b.stats.total_visits > 0 && <> · {b.stats.total_visits} visits</>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={timePill(arrived)}>
            {arrived ? `✓ ${b.visit?.phase}` : timeLine}
          </span>
          {b.booking && <span style={cardMeta}>{b.booking.space} · {b.booking.party_size}p</span>}
        </div>
      </div>

      {b.occasion && (
        <div style={occasionBadge}>{b.occasion}</div>
      )}

      {/* Action row */}
      <div style={actionRow}>
        {arrived && b.visit ? (
          <Link href={`/admin/mis/visits/${b.visit.visit_id}`} style={btnOpen}>
            Open visit · {b.visit.phase} →
          </Link>
        ) : (
          <button onClick={onStart} disabled={isStarting} style={btnStart}>
            {isStarting ? 'Starting…' : '◉ Start visit →'}
          </button>
        )}
      </div>

      {/* Score-5 non-negotiables */}
      {b.brief.score5.length > 0 && (
        <BriefSection label="Non-negotiables · S₀=5" count={b.brief.score5.length}>
          {b.brief.score5.slice(0, 4).map(p => (
            <div key={p.preference_id} style={prefRow}>
              <div style={prefName}>{p.preference_name}</div>
              {p.detail && <div style={prefDetail}>{p.detail}</div>}
            </div>
          ))}
          {b.brief.score5.length > 4 && <div style={moreText}>+{b.brief.score5.length - 4} more</div>}
        </BriefSection>
      )}

      {/* Revalidate */}
      {b.brief.revalidate.length > 0 && (
        <BriefSection label="⚠ Confirm tonight" count={b.brief.revalidate.length} accent="#D4B85A">
          {b.brief.revalidate.slice(0, 4).map(p => (
            <div key={p.preference_id} style={{ ...prefRow, borderLeft: '2px solid #D4B85A' }}>
              <div style={prefName}>{p.preference_name}</div>
              <div style={prefDetailSmall}>last validated {p.last_validated}</div>
            </div>
          ))}
          {b.brief.revalidate.length > 4 && <div style={moreText}>+{b.brief.revalidate.length - 4} more</div>}
        </BriefSection>
      )}

      {/* Last continuum note */}
      {b.brief.last_continuum_note && (
        <BriefSection label="From the previous visit" accent="#7AB07A">
          <div style={lastNoteBox}>
            <div style={lastNoteText}>{b.brief.last_continuum_note.data_for_next_overture}</div>
            <div style={lastNoteMeta}>
              {b.brief.last_continuum_note.visit_date} · {' '}
              <Link href={`/admin/mis/visits/${b.brief.last_continuum_note.visit_id}`} style={lastNoteLink}>open</Link>
            </div>
          </div>
        </BriefSection>
      )}

      {/* Open complaints */}
      {b.complaints.length > 0 && (
        <BriefSection label="Open complaints" count={b.complaints.length} accent="#C27070">
          {b.complaints.slice(0, 3).map(c => (
            <div key={c.id} style={{ ...prefRow, borderLeft: '2px solid #C27070' }}>
              <div style={prefName}>S{c.severity} · {c.summary}</div>
            </div>
          ))}
        </BriefSection>
      )}

      {/* Gifting strip — only when budget exists */}
      {b.gifting && b.gifting.annual_budget_vnd > 0 && (
        <div style={giftingStrip}>
          <div style={giftingTrack}>
            <div style={{
              ...giftingFill,
              width: `${Math.min(100, Math.round((b.gifting.spent_vnd / b.gifting.annual_budget_vnd) * 100))}%`,
              background: b.gifting.gift_count === 0 ? '#C27070' : '#7AB07A',
            }} />
          </div>
          <div style={giftingLabel}>
            <strong style={{ color: b.gifting.gift_count === 0 ? '#C27070' : '#E5D4C2' }}>
              {formatVndCompact(b.gifting.spent_vnd)}
            </strong>
            <span style={{ opacity: 0.6 }}> of {formatVndCompact(b.gifting.annual_budget_vnd)} gifting used</span>
            {b.gifting.gift_count === 0 && <span style={{ color: '#C27070' }}> · overdue</span>}
          </div>
        </div>
      )}

      {b.booking?.notes && (
        <div style={bookingNotes}>
          <strong style={{ opacity: 0.7 }}>Booking note:</strong> {b.booking.notes}
        </div>
      )}
    </div>
  )
}

function BriefSection({ label, count, accent, children }: { label: string; count?: number; accent?: string; children: React.ReactNode }) {
  return (
    <div style={briefSection}>
      <div style={{ ...briefSectionLabel, color: accent || '#D4B85A' }}>
        {label}
        {count != null && <span style={countBadge}>{count}</span>}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: color || '#E5D4C2' }}>{value}</div>
    </div>
  )
}

function PickSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontFamily: "'Google Sans Code', monospace", fontSize: 10,
        color: '#B2AA98', letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 10, opacity: 0.7,
      }}>{title}</div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  )
}

function PickField({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string | null
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      {multiline ? (
        <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical' }} />
      ) : (
        <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  )
}

function formatVndCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ₫`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k ₫`
  return `${v} ₫`
}

function timePill(arrived: boolean): React.CSSProperties {
  return arrived ? {
    background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
    border: '1px solid rgba(122,176,122,0.40)', borderRadius: 3,
    padding: '2px 8px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
  } : {
    background: 'rgba(212,184,90,0.16)', color: '#D4B85A',
    border: '1px solid rgba(212,184,90,0.40)', borderRadius: 3,
    padding: '2px 8px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
  }
}

// ── styles ────────────────────────────────────────────────────────────
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 20, marginBottom: 20,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const dateStepper: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const smallBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em',
}
const strip: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 10, marginBottom: 18,
}
const statTile: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, padding: '12px 14px',
}
const statLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const statValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 600,
  marginTop: 4,
}
const sectionLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.20em', textTransform: 'uppercase',
  marginTop: 18, marginBottom: 12,
  paddingLeft: 10, borderLeft: '2px solid #D4B85A',
}
const sectionLede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.6, opacity: 0.75, maxWidth: 660,
  marginTop: 0, marginBottom: 16,
}
const briefGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
  gap: 14, marginBottom: 16,
}
const cardBlock: React.CSSProperties = {
  padding: 18,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
  display: 'flex', flexDirection: 'column', gap: 10,
}
const cardHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 12,
}
const memberLink: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', textDecoration: 'none', letterSpacing: '0.02em',
}
const cardMeta: React.CSSProperties = {
  marginTop: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const occasionBadge: React.CSSProperties = {
  padding: '6px 10px',
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.30)',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', letterSpacing: '0.04em',
}
const actionRow: React.CSSProperties = {
  display: 'flex', gap: 8,
}
const btnStart: React.CSSProperties = {
  flex: 1, padding: '10px 14px',
  background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.08em', cursor: 'pointer', textAlign: 'center', fontWeight: 600,
}
const btnOpen: React.CSSProperties = {
  flex: 1, padding: '10px 14px',
  background: 'rgba(212,184,90,0.12)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.35)', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer', textDecoration: 'none',
  textAlign: 'center', fontWeight: 600, textTransform: 'capitalize',
}
const briefSection: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
}
const briefSectionLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  display: 'flex', alignItems: 'center', gap: 6,
}
const countBadge: React.CSSProperties = {
  background: 'rgba(212,184,90,0.20)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 10,
  padding: '0 6px', fontSize: 9, fontWeight: 600,
}
const prefRow: React.CSSProperties = {
  padding: '6px 10px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const prefName: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', fontWeight: 500,
}
const prefDetail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', lineHeight: 1.5, marginTop: 3,
}
const prefDetailSmall: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', marginTop: 2,
}
const moreText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', opacity: 0.7, fontStyle: 'italic', paddingLeft: 10,
}
const lastNoteBox: React.CSSProperties = {
  padding: 10,
  background: 'rgba(122,176,122,0.08)', border: '1px solid rgba(122,176,122,0.25)',
  borderLeft: '2px solid #7AB07A', borderRadius: 4,
}
const lastNoteText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.55, whiteSpace: 'pre-wrap',
}
const lastNoteMeta: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.04em',
}
const lastNoteLink: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'none',
}
const giftingStrip: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  paddingTop: 8, borderTop: '1px solid rgba(229,212,194,0.06)',
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
const bookingNotes: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.55, padding: '6px 10px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const pickBlock: React.CSSProperties = {
  padding: 20, maxWidth: 700,
  background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const fieldLabel: React.CSSProperties = {
  display: 'block', marginBottom: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '10px 18px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
}
const pickMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7,
}
const linkInline: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'underline', textDecorationStyle: 'dotted',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyBlock: React.CSSProperties = {
  padding: '40px 20px', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98',
  background: 'rgba(229,212,194,0.02)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 8, marginBottom: 16,
}
const toastBox: React.CSSProperties = {
  position: 'fixed', bottom: 32, right: 32,
  background: '#28483C', color: '#E5D4C2',
  padding: '10px 16px', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
}
