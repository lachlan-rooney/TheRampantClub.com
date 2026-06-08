'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, PromptModal, useToast } from '@/components/admin/dialogs'
import { vnDateString } from '@/lib/datetime'
import { createShift, updateShift, deleteShift, moveShift } from '@/lib/ops/api'
import type { RotaShift, RotaShiftType, TeamMember, CoverageTarget, ScalingRule } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Staff functions (confirmed set). A person can cover several.
const FUNCTIONS = ['bar', 'floor', 'host', 'gm'] as const
const FN_COLOR: Record<string, string> = { bar: '#D4B85A', floor: '#7AB07A', host: '#8FB3D9', gm: '#C2A0D9' }
const FN_LABEL: Record<string, string> = { bar: 'Bar', floor: 'Floor', host: 'Host', gm: 'GM' }

// Date-only maths in UTC to avoid local-tz off-by-one; the anchor is the VN day.
function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7   // 0=Mon … 6=Sun
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

interface Draft { member: string; shift_name: string; start_time: string; end_time: string; role: string; notes: string }
// Demand signal for the "What's on" line — member bookings + house events.
interface DemandBooking { booking_date: string; space: string; party_size: number; start_time: string | null; session_label: string | null }
interface DemandEntry { entry_date: string; title: string; space: string | null; kind: string; blocks_space: boolean }
// Short space label for the compact demand line.
const SPACE_SHORT: Record<string, string> = {
  'Library Bar': 'Library', 'The Studio': 'Studio', 'The Rampant Room': 'Rampant',
  'The Dining Room': 'Dining', 'Source & Origin Lab': 'Lab', 'Sports Club': 'Sports',
}
const shortSpace = (s: string | null) => (s ? (SPACE_SHORT[s] || s) : '—')
const HOUSE_KIND_SHORT: Record<string, string> = { closure: 'closed', private_hire: 'hire', supplier: 'visit', tasting: 'tasting', other: 'event' }
// Autofill draft types (proposed assignments + the gaps it couldn't fill).
interface Proposal { member: string; shift_date: string; shift_name: string; coverFn: string }
interface Gap { date: string; shift_name: string; function: string; still_needed: number }

export default function RotaPage() {
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()

  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(vnDateString()))
  const [types, setTypes] = useState<RotaShiftType[]>([])
  const [shifts, setShifts] = useState<RotaShift[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [bookings, setBookings] = useState<DemandBooking[]>([])
  const [entries, setEntries] = useState<DemandEntry[]>([])
  const [targets, setTargets] = useState<CoverageTarget[]>([])
  const [rules, setRules] = useState<ScalingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // assign/edit modal
  const [cell, setCell] = useState<{ date: string; shift_name: string; editing: RotaShift | null } | null>(null)
  const [draft, setDraft] = useState<Draft>({ member: '', shift_name: '', start_time: '', end_time: '', role: '', notes: '' })
  const [confirmRemove, setConfirmRemove] = useState<RotaShift | null>(null)
  const [addTypeOpen, setAddTypeOpen] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [showCoverage, setShowCoverage] = useState(false)

  // Drag state. dragId = the shift being dragged; didDrag distinguishes a real
  // drag from a click (so click-to-edit still works alongside drag-to-move).
  const [dragId, setDragId] = useState<string | null>(null)
  const didDrag = useRef(false)

  // Autofill draft (proposed, not saved until Accept).
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [gaps, setGaps] = useState<Gap[]>([])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 6)

  // Rows = current shift-type names PLUS any snapshotted shift_name still present
  // in the week's shifts. So a shift assigned as "Mid" stays visible even after
  // the "Mid" type is renamed/removed — the snapshot is shown, never hidden.
  const typeNames = types.map(t => t.name)
  const rowNames = [
    ...typeNames,
    ...[...new Set(shifts.map(s => s.shift_name))].filter(n => !typeNames.includes(n)),
  ]

  const load = useCallback(async () => {
    const [{ data: ty }, { data: sh }, { data: tm }, { data: bk }, { data: en }, { data: ct }, { data: sr }] = await Promise.all([
      supabase.from('rota_shift_types').select('*').order('sort_order'),
      supabase.from('rota_shifts').select('*').gte('shift_date', weekStart).lte('shift_date', weekEnd),
      supabase.from('team_members').select('*').eq('active', true).order('display_name'),
      // Demand signal: member bookings + house events for the week (admin RLS).
      supabase.from('bookings').select('booking_date, space, party_size, start_time, session_label')
        .gte('booking_date', weekStart).lte('booking_date', weekEnd).in('status', ['confirmed', 'pending', 'arrived']),
      supabase.from('calendar_entries').select('entry_date, title, space, kind, blocks_space')
        .gte('entry_date', weekStart).lte('entry_date', weekEnd),
      supabase.from('rota_coverage_targets').select('*'),
      supabase.from('rota_scaling_rules').select('*').order('sort_order'),
    ])
    if (ty) setTypes(ty as RotaShiftType[])
    if (sh) setShifts(sh as RotaShift[])
    if (tm) setTeam(tm as TeamMember[])
    setBookings((bk || []) as DemandBooking[])
    setEntries((en || []) as DemandEntry[])
    setTargets((ct || []) as CoverageTarget[])
    setRules((sr || []) as ScalingRule[])
    setLoading(false)
  }, [weekStart])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  useEffect(() => { setProposals([]); setGaps([]) }, [weekStart])  // a draft is for one week

  const memberName = (id: string) => team.find(t => t.id === id)?.display_name ?? '—'
  const inCell = (date: string, name: string) => shifts.filter(s => s.shift_date === date && s.shift_name === name)
  const demandFor = (date: string) => ({
    bookings: bookings.filter(b => b.booking_date === date),
    entries: entries.filter(e => e.entry_date === date),
  })

  // ── Coverage: base target + demand-scaled bumps from the active rules ──
  const baseTarget = (shiftName: string, fn: string) =>
    targets.find(t => t.shift_name === shiftName && t.function === fn)?.count ?? 0

  // Which rules fire for a date (from the "What's on" demand) → bump per function.
  const dayBumps = (date: string): Record<string, number> => {
    const dq = demandFor(date)
    const dayCovers = dq.bookings.reduce((s, b) => s + (b.party_size || 0), 0)
    const sess = new Map<string, number>()
    for (const b of dq.bookings) { const k = b.session_label || 'unspec'; sess.set(k, (sess.get(k) || 0) + (b.party_size || 0)) }
    const maxSession = sess.size ? Math.max(...sess.values()) : 0
    const hasEvent = dq.entries.length > 0
    const out: Record<string, number> = {}
    for (const r of rules) {
      if (!r.active) continue
      const fires = r.trigger_type === 'day_covers' ? dayCovers >= r.threshold
        : r.trigger_type === 'session_covers' ? maxSession >= r.threshold
        : hasEvent  // event_present
      if (fires) out[r.function] = (out[r.function] || 0) + r.delta
    }
    return out
  }

  // Config writes (admin-RLS direct; config, no spine event — like shift names).
  const setTarget = async (shiftName: string, fn: string, count: number) => {
    setTargets(ts => {
      const others = ts.filter(t => !(t.shift_name === shiftName && t.function === fn))
      return count > 0 ? [...others, { shift_name: shiftName, function: fn, count }] : others
    })
    if (count > 0) await supabase.from('rota_coverage_targets').upsert({ shift_name: shiftName, function: fn, count }, { onConflict: 'shift_name,function' })
    else await supabase.from('rota_coverage_targets').delete().eq('shift_name', shiftName).eq('function', fn)
  }
  const updateRule = async (id: string, patch: Partial<ScalingRule>) => {
    setRules(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
    const { error } = await supabase.from('rota_scaling_rules').update(patch).eq('id', id)
    if (error) { showToast(error.message, 'error'); load() }
  }
  const addRule = async () => {
    const { data, error } = await supabase.from('rota_scaling_rules')
      .insert({ trigger_type: 'day_covers', threshold: 20, function: 'floor', delta: 1, sort_order: rules.length }).select().single()
    if (error) { showToast(error.message, 'error'); return }
    if (data) setRules(rs => [...rs, data as ScalingRule])
  }
  const removeRule = async (id: string) => {
    setRules(rs => rs.filter(r => r.id !== id))
    await supabase.from('rota_scaling_rules').delete().eq('id', id)
  }

  const proposedIn = (date: string, name: string) => proposals.filter(p => p.shift_date === date && p.shift_name === name)

  // ── Autofill (greedy, propose-a-draft) ──
  // For each active shift cell short of its effective target, pick function-
  // capable people — never lacking the function, never twice in a cell, never
  // two shifts in one day. Fairness: fewest shifts so far this week (stable by
  // id). Unfillable gaps are LABELLED, never crammed. Availability isn't known.
  const runAutofill = () => {
    const newProps: Proposal[] = []
    const newGaps: Gap[] = []
    const weekCount = new Map<string, number>()
    const dayMembers = new Map<string, Set<string>>()
    for (const s of shifts) {
      weekCount.set(s.member, (weekCount.get(s.member) || 0) + 1)
      if (!dayMembers.has(s.shift_date)) dayMembers.set(s.shift_date, new Set())
      dayMembers.get(s.shift_date)!.add(s.member)
    }
    for (const d of days) {
      const bumps = dayBumps(d)
      for (const name of typeNames) {                 // active shift types only
        const real = inCell(d, name)
        const cellMembers = new Set(real.map(s => s.member))
        const proposedHere: Proposal[] = []
        for (const fn of FUNCTIONS) {
          const target = baseTarget(name, fn) + (bumps[fn] || 0)
          if (target <= 0) continue
          let present = real.filter(s => memberFns(s.member).includes(fn)).length
                      + proposedHere.filter(p => p.coverFn === fn).length
          while (present < target) {
            const cand = team
              .filter(m => (m.functions || []).includes(fn) && !cellMembers.has(m.id) && !dayMembers.get(d)?.has(m.id))
              .sort((a, b) => (weekCount.get(a.id) || 0) - (weekCount.get(b.id) || 0) || a.id.localeCompare(b.id))
            if (cand.length === 0) { newGaps.push({ date: d, shift_name: name, function: fn, still_needed: target - present }); break }
            const pick = cand[0]
            const prop: Proposal = { member: pick.id, shift_date: d, shift_name: name, coverFn: fn }
            proposedHere.push(prop); newProps.push(prop)
            cellMembers.add(pick.id)
            if (!dayMembers.has(d)) dayMembers.set(d, new Set())
            dayMembers.get(d)!.add(pick.id)
            weekCount.set(pick.id, (weekCount.get(pick.id) || 0) + 1)
            present++
          }
        }
      }
    }
    setProposals(newProps); setGaps(newGaps)
    if (newProps.length === 0 && newGaps.length === 0) showToast('Every shift already meets its targets.', 'success')
  }
  const acceptAutofill = () => {
    if (proposals.length === 0) return
    wrap(async () => {
      for (const p of proposals) await createShift({ member: p.member, shift_name: p.shift_name, shift_date: p.shift_date })
    }, () => { setProposals([]); setGaps([]) })
  }
  const discardAutofill = () => { setProposals([]); setGaps([]) }

  // Per-day demand bumps, precomputed once per render.
  const bumpsByDay: Record<string, Record<string, number>> = {}
  for (const d of days) bumpsByDay[d] = dayBumps(d)

  const wrap = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    try { await fn(); after?.(); load() }
    catch (e) { showToast((e as Error).message, 'error') }
    finally { setBusy(false) }
  }

  const openAssign = (date: string, shift_name: string, editing: RotaShift | null) => {
    setCell({ date, shift_name, editing })
    setDraft(editing
      ? { member: editing.member, shift_name: editing.shift_name, start_time: editing.start_time?.slice(0, 5) || '', end_time: editing.end_time?.slice(0, 5) || '', role: editing.role || '', notes: editing.notes || '' }
      : { member: team[0]?.id || '', shift_name, start_time: '', end_time: '', role: '', notes: '' })
  }
  const saveAssign = () => {
    if (!cell || !draft.member) { showToast('Pick a team member.', 'error'); return }
    const common = {
      member: draft.member, shift_name: draft.shift_name,
      start_time: draft.start_time || null, end_time: draft.end_time || null,
      role: draft.role.trim() || null, notes: draft.notes.trim() || null,
    }
    if (cell.editing) {
      wrap(() => updateShift({ id: cell.editing!.id, ...common }), () => setCell(null))
    } else {
      wrap(() => createShift({ ...common, shift_date: cell.date }), () => setCell(null))
    }
  }

  const memberFns = (id: string) => team.find(t => t.id === id)?.functions || []

  // Toggle a function on a team member (admin-RLS direct write; config, no event).
  const toggleFunction = async (memberId: string, fn: string) => {
    const m = team.find(t => t.id === memberId); if (!m) return
    const has = (m.functions || []).includes(fn)
    const next = has ? (m.functions || []).filter(f => f !== fn) : [...(m.functions || []), fn]
    setTeam(ts => ts.map(t => t.id === memberId ? { ...t, functions: next } : t))   // optimistic
    const { error } = await supabase.from('team_members').update({ functions: next }).eq('id', memberId)
    if (error) { showToast(error.message, 'error'); load() }
  }

  // Soft role check: would moving `shift` out of its cell strip the ONLY person
  // of some function from a cell that still has others? Returns the lost
  // functions, for a non-blocking heads-up (no formal coverage targets here).
  const lostOnlyFunctions = (shift: RotaShift): string[] => {
    const mates = inCell(shift.shift_date, shift.shift_name).filter(s => s.id !== shift.id)
    if (mates.length === 0) return []
    const mateFns = new Set(mates.flatMap(s => memberFns(s.member)))
    return memberFns(shift.member).filter(fn => !mateFns.has(fn))
  }
  const warnIfLost = (shift: RotaShift) => {
    const lost = lostOnlyFunctions(shift)
    if (lost.length) showToast(`Heads up: that was the only ${lost.map(f => FN_LABEL[f] || f).join(' / ')} on ${shift.shift_name} · ${dayLabel(shift.shift_date)}.`, 'error')
  }

  // Move (optimistic local update → RPC → reconcile via load() in wrap).
  const doMove = (id: string, toDate: string, toName: string) => {
    setShifts(ss => ss.map(s => s.id === id ? { ...s, shift_date: toDate, shift_name: toName } : s))
    wrap(() => moveShift({ id, shift_date: toDate, shift_name: toName }))
  }
  // Drop into a cell (move/join). A cell can hold several people, so this never
  // "swaps the cell" — dropping onto a specific CHIP swaps those two (onDropChip).
  const onDropCell = (toDate: string, toName: string) => {
    const dragged = shifts.find(s => s.id === dragId); setDragId(null)
    if (!dragged || (dragged.shift_date === toDate && dragged.shift_name === toName)) return
    warnIfLost(dragged)
    doMove(dragged.id, toDate, toName)
  }
  // Drop onto a chip → swap the two chips' (date, shift_name) slots.
  const onDropChip = (target: RotaShift) => {
    const dragged = shifts.find(s => s.id === dragId); setDragId(null)
    if (!dragged || dragged.id === target.id) return
    if (dragged.shift_date === target.shift_date && dragged.shift_name === target.shift_name) return
    warnIfLost(dragged)
    setShifts(ss => ss.map(s =>
      s.id === dragged.id ? { ...s, shift_date: target.shift_date, shift_name: target.shift_name }
      : s.id === target.id ? { ...s, shift_date: dragged.shift_date, shift_name: dragged.shift_name } : s))
    wrap(async () => {
      await moveShift({ id: dragged.id, shift_date: target.shift_date, shift_name: target.shift_name })
      await moveShift({ id: target.id, shift_date: dragged.shift_date, shift_name: dragged.shift_name })
    })
  }

  // Shift-name list — editable, persistent, shared. Direct client writes (admin RLS); no events (config).
  const addType = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const sort = types.length ? Math.max(...types.map(t => t.sort_order)) + 1 : 0
    const { error } = await supabase.from('rota_shift_types').insert({ name: trimmed, sort_order: sort })
    setAddTypeOpen(false)
    if (error) { showToast(error.message, 'error'); return }
    load()
  }
  const removeType = async (name: string) => {
    const { error } = await supabase.from('rota_shift_types').delete().eq('name', name)
    if (error) { showToast(error.message, 'error'); return }
    load()
  }

  return (
    <>
      <Link href="/admin/ops" style={backLink}>← Boards</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0 4px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={eyebrow}>Operations Hub</div>
          <h1 style={pageTitle}>Rota</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setWeekStart(w => addDays(w, -7))} style={tinyBtn}>‹ Prev</button>
          <button onClick={() => setWeekStart(mondayOf(vnDateString()))} style={tinyBtn}>This week</button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} style={tinyBtn}>Next ›</button>
          <button onClick={runAutofill} disabled={busy} style={{ ...tinyBtn, color: '#D4B85A', borderColor: 'rgba(212,184,90,0.45)' }}>✦ Autofill week</button>
        </div>
      </div>
      <p style={lede}>Club-wide weekly rota — who&apos;s on which shift. Drag a name to move it across shifts or days; drop onto another name to swap. Week of {dayLabel(weekStart)} – {dayLabel(weekEnd)}.</p>

      {(proposals.length > 0 || gaps.length > 0) && (
        <div style={autofillBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ color: '#D4B85A' }}>Autofill draft: {proposals.length} proposed assignment{proposals.length === 1 ? '' : 's'}</strong>
            <span style={{ ...metaText, opacity: 0.7 }}>Draft only — doesn&apos;t account for time off. Review &amp; drag off anyone who&apos;s away before accepting.</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={acceptAutofill} disabled={busy || proposals.length === 0} style={{ ...btnPrimary, opacity: proposals.length === 0 ? 0.5 : 1 }}>{busy ? 'Saving…' : `Accept all (${proposals.length})`}</button>
              <button onClick={discardAutofill} disabled={busy} style={tinyBtn}>Discard</button>
            </span>
          </div>
          {gaps.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <span style={{ ...metaText, color: '#C27070', marginRight: 4 }}>Couldn&apos;t fill (sort by hand):</span>
              {gaps.map((g, i) => <span key={i} style={gapTag}>{g.shift_name} {dayLabel(g.date)} · +{g.still_needed} {FN_LABEL[g.function] || g.function}</span>)}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: 90 }}>Shift</th>
                {days.map((d, i) => (
                  <th key={d} style={{ ...th, background: d === vnDateString() ? 'rgba(212,184,90,0.10)' : undefined }}>
                    <div>{DOW[i]}</div>
                    <div style={{ ...metaText, opacity: 0.6 }}>{dayLabel(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* What's on — the day's demand (member bookings + house events) by space */}
              <tr>
                <td style={{ ...td, ...onLabelCell }}>What&apos;s on</td>
                {days.map(d => {
                  const dq = demandFor(d)
                  const bySpace = new Map<string, { n: number; covers: number }>()
                  for (const b of dq.bookings) {
                    const cur = bySpace.get(b.space) || { n: 0, covers: 0 }
                    cur.n += 1; cur.covers += b.party_size || 0
                    bySpace.set(b.space, cur)
                  }
                  const quiet = dq.bookings.length === 0 && dq.entries.length === 0
                  return (
                    <td key={d} style={{ ...td, verticalAlign: 'top', background: d === vnDateString() ? 'rgba(212,184,90,0.04)' : undefined }}>
                      {quiet ? <span style={{ ...metaText, opacity: 0.35 }}>·</span> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {dq.entries.map((e, i) => (
                            <span key={`e${i}`} style={onEvent} title={`${e.title} · ${e.space || 'no room'}`}>
                              ◆ {shortSpace(e.space)} · {e.title} <span style={{ opacity: 0.65 }}>({HOUSE_KIND_SHORT[e.kind] || 'event'})</span>
                            </span>
                          ))}
                          {[...bySpace.entries()].map(([sp, v]) => (
                            <span key={sp} style={onBooking}>{shortSpace(sp)} · {v.n} {v.n === 1 ? 'bkg' : 'bkgs'} · {v.covers}p</span>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
              {rowNames.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, ...metaText, opacity: 0.6, fontStyle: 'italic' }}>No shift names yet — add one below.</td></tr>
              ) : rowNames.map(name => {
                const isType = typeNames.includes(name)
                return (
                <tr key={name}>
                  <td style={{ ...td, fontFamily: FAMILY, fontSize: 12, color: isType ? '#E5D4C2' : '#7E7864' }}>
                    {name}{!isType && <span title="retired shift name — kept on existing shifts" style={{ ...metaText, opacity: 0.5 }}> · retired</span>}
                  </td>
                  {days.map(d => {
                    // Under-staffing: required (base + day bumps) vs present (assigned who HAVE the function).
                    const ghosts = proposedIn(d, name)
                    const cov = isType
                      ? FUNCTIONS.map(fn => {
                          const req = baseTarget(name, fn) + (bumpsByDay[d]?.[fn] || 0)
                          const pres = inCell(d, name).filter(s => memberFns(s.member).includes(fn)).length
                                     + ghosts.filter(g => g.coverFn === fn).length   // count pending proposals
                          return { fn, req, pres }
                        }).filter(c => c.req > 0)
                      : []
                    const short = cov.some(c => c.pres < c.req)
                    return (
                    <td
                      key={d}
                      onDragOver={e => { if (dragId) e.preventDefault() }}
                      onDrop={() => onDropCell(d, name)}
                      style={{ ...td, verticalAlign: 'top', background: d === vnDateString() ? 'rgba(212,184,90,0.04)' : undefined, ...(short ? shortCell : null), ...(dragId ? dropHint : null) }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {inCell(d, name).map(s => {
                          const fns = memberFns(s.member)
                          return (
                          <button
                            key={s.id}
                            draggable
                            onDragStart={() => { setDragId(s.id); didDrag.current = false }}
                            onDrag={() => { didDrag.current = true }}
                            onDragEnd={() => { setDragId(null); didDrag.current = false }}
                            onDragOver={e => { if (dragId && dragId !== s.id) e.preventDefault() }}
                            onDrop={e => { e.stopPropagation(); onDropChip(s) }}
                            onClick={() => { if (didDrag.current) { didDrag.current = false; return } openAssign(d, name, s) }}
                            style={{ ...chip, ...(dragId === s.id ? chipDragging : null) }}
                            title={[s.start_time && `${s.start_time.slice(0, 5)}–${s.end_time?.slice(0, 5) || ''}`, fns.length ? fns.map(f => FN_LABEL[f] || f).join('/') : null].filter(Boolean).join(' · ')}
                          >
                            <span>{memberName(s.member)}{s.start_time ? <span style={{ opacity: 0.6 }}> · {s.start_time.slice(0, 5)}</span> : null}</span>
                            {fns.length > 0 && (
                              <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, flexShrink: 0 }}>
                                {fns.map(f => <span key={f} title={FN_LABEL[f] || f} style={{ ...fnDot, background: FN_COLOR[f] || '#B2AA98' }} />)}
                              </span>
                            )}
                          </button>
                          )
                        })}
                        {ghosts.map((g, gi) => (
                          <div key={`g${gi}`} style={ghostChip} title={`Proposed · ${FN_LABEL[g.coverFn] || g.coverFn}`}>
                            <span>{memberName(g.member)}</span>
                            <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ ...fnDot, background: FN_COLOR[g.coverFn] || '#B2AA98' }} />
                              <span style={{ fontSize: 8, opacity: 0.7, letterSpacing: '0.08em' }}>NEW</span>
                            </span>
                          </div>
                        ))}
                        {isType && <button onClick={() => openAssign(d, name, null)} style={addCellBtn}>+ assign</button>}
                        {cov.length > 0 && (
                          <div style={covStrip}>
                            {cov.map(c => (
                              <span key={c.fn} style={{ ...covTag, color: c.pres >= c.req ? '#7AB07A' : '#C27070' }}
                                title={`${FN_LABEL[c.fn]}: ${c.pres} on, ${c.req} wanted`}>
                                {FN_LABEL[c.fn]} {c.pres}/{c.req}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    )
                  })}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editable shift names */}
      <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...metaText, opacity: 0.7 }}>Shift names:</span>
        {types.map(t => (
          <span key={t.name} style={typePill}>
            {t.name}
            <button onClick={() => removeType(t.name)} title="Remove" style={typeRemove}>×</button>
          </span>
        ))}
        <button onClick={() => setAddTypeOpen(true)} style={tinyBtn}>+ add</button>
      </div>

      {/* Team & functions — the roles each person can cover (shown as dots on shifts) */}
      <div style={{ marginTop: 14 }}>
        <button onClick={() => setShowTeam(v => !v)} style={tinyBtn}>{showTeam ? '▾' : '▸'} Team &amp; functions</button>
        {showTeam && (
          <div style={teamPanel}>
            <div style={{ ...metaText, opacity: 0.7, marginBottom: 10 }}>Tick the roles each person can cover. They show as coloured dots on their shifts; dragging the only person of a role off a shift gives a heads-up.</div>
            {team.map(m => (
              <div key={m.id} style={teamRow}>
                <span style={{ flex: 1, color: '#E5D4C2', fontSize: 12, minWidth: 120 }}>{m.display_name}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FUNCTIONS.map(f => {
                    const on = (m.functions || []).includes(f)
                    return (
                      <button key={f} onClick={() => toggleFunction(m.id, f)}
                        style={{ ...fnToggle, ...(on ? { background: FN_COLOR[f], color: '#052E20', borderColor: FN_COLOR[f] } : null) }}>
                        {FN_LABEL[f]}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coverage — base targets per shift × function + demand-scaling rules (tunable) */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowCoverage(v => !v)} style={tinyBtn}>{showCoverage ? '▾' : '▸'} Coverage targets</button>
        {showCoverage && (
          <div style={teamPanel}>
            <div style={{ ...metaText, opacity: 0.7, marginBottom: 10 }}>How many of each function a shift wants. The grid shows <span style={{ color: '#7AB07A' }}>on/wanted</span> per shift, tinting any that fall short — guidance, not a block.</div>

            <div style={{ ...fieldLabel, marginBottom: 6 }}>Base targets (per shift)</div>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...covTh, textAlign: 'left' }}>Shift</th>{FUNCTIONS.map(f => <th key={f} style={covTh}>{FN_LABEL[f]}</th>)}</tr></thead>
                <tbody>
                  {types.map(t => (
                    <tr key={t.name}>
                      <td style={{ ...covTd, color: '#E5D4C2' }}>{t.name}</td>
                      {FUNCTIONS.map(f => (
                        <td key={f} style={covTd}>
                          <input type="number" min={0} value={baseTarget(t.name, f) || 0}
                            onChange={e => setTarget(t.name, f, Math.max(0, parseInt(e.target.value) || 0))}
                            style={covInput} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {types.length === 0 && <tr><td colSpan={FUNCTIONS.length + 1} style={{ ...covTd, ...metaText, opacity: 0.6 }}>Add a shift name first.</td></tr>}
                </tbody>
              </table>
            </div>

            <div style={{ ...fieldLabel, marginBottom: 6 }}>Demand-scaling rules</div>
            <div style={{ ...metaText, opacity: 0.6, marginBottom: 8, fontSize: 10 }}>When a day&apos;s demand crosses a threshold, add to a function&apos;s target. Tune freely — these are data, not code.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rules.map(r => (
                <div key={r.id} style={ruleRow}>
                  <button onClick={() => updateRule(r.id, { active: !r.active })} title={r.active ? 'Active — click to disable' : 'Disabled — click to enable'}
                    style={{ ...fnToggle, ...(r.active ? { background: '#7AB07A', color: '#052E20', borderColor: '#7AB07A' } : { opacity: 0.5 }) }}>
                    {r.active ? 'on' : 'off'}
                  </button>
                  <span style={{ ...metaText, fontSize: 11 }}>When</span>
                  <select value={r.trigger_type} onChange={e => updateRule(r.id, { trigger_type: e.target.value as ScalingRule['trigger_type'] })} style={ruleSelect}>
                    <option value="session_covers" style={opt}>covers in a session</option>
                    <option value="day_covers" style={opt}>covers in the day</option>
                    <option value="event_present" style={opt}>an event is on</option>
                  </select>
                  {r.trigger_type !== 'event_present' && (
                    <>
                      <span style={{ ...metaText, fontSize: 11 }}>≥</span>
                      <input type="number" min={0} value={r.threshold} onChange={e => updateRule(r.id, { threshold: Math.max(0, parseInt(e.target.value) || 0) })} style={{ ...covInput, width: 52 }} />
                    </>
                  )}
                  <span style={{ ...metaText, fontSize: 11 }}>→ +</span>
                  <input type="number" min={1} value={r.delta} onChange={e => updateRule(r.id, { delta: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...covInput, width: 44 }} />
                  <select value={r.function} onChange={e => updateRule(r.id, { function: e.target.value })} style={ruleSelect}>
                    {FUNCTIONS.map(f => <option key={f} value={f} style={opt}>{FN_LABEL[f]}</option>)}
                  </select>
                  <button onClick={() => removeRule(r.id)} title="Remove rule" style={{ ...typeRemove, marginLeft: 'auto' }}>×</button>
                </div>
              ))}
              <button onClick={addRule} style={{ ...tinyBtn, alignSelf: 'flex-start', marginTop: 4 }}>+ add rule</button>
            </div>
          </div>
        )}
      </div>

      {/* Assign / edit modal */}
      {cell && (
        <>
          <div style={modalBackdrop} onClick={() => { if (!busy) setCell(null) }} />
          <div style={modalBox} role="dialog">
            <div style={eyebrow}>{cell.editing ? 'Edit shift' : 'Assign shift'}</div>
            <div style={{ ...metaText, marginBottom: 12 }}>{cell.shift_name} · {dayLabel(cell.date)}</div>
            <div style={fieldLabel}>Team member</div>
            <select style={input} value={draft.member} onChange={e => setDraft(d => ({ ...d, member: e.target.value }))}>
              <option value="" style={opt}>— pick —</option>
              {team.map(m => <option key={m.id} value={m.id} style={opt}>{m.display_name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Shift</div>
                <select style={input} value={draft.shift_name} onChange={e => setDraft(d => ({ ...d, shift_name: e.target.value }))}>
                  {types.map(t => <option key={t.name} value={t.name} style={opt}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Role (optional)</div>
                <input style={input} value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} placeholder="Bar, Floor…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Start (optional)</div>
                <input type="time" style={input} value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>End (optional)</div>
                <input type="time" style={input} value={draft.end_time} onChange={e => setDraft(d => ({ ...d, end_time: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={fieldLabel}>Notes (optional)</div>
              <input style={input} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={saveAssign} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : cell.editing ? 'Save' : 'Assign'}</button>
              <button onClick={() => setCell(null)} style={tinyBtn}>Cancel</button>
              {cell.editing && (
                <button onClick={() => { const s = cell.editing; setCell(null); setConfirmRemove(s) }} style={{ ...tinyBtn, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>Remove</button>
              )}
            </div>
          </div>
        </>
      )}

      <PromptModal
        open={addTypeOpen}
        eyebrow="＋ SHIFT NAME"
        title="Add a shift name"
        label="Name (e.g. Brunch, Late) — editable anytime, no migration"
        confirmLabel="Add"
        onCancel={() => setAddTypeOpen(false)}
        onConfirm={addType}
      />
      <ConfirmModal
        open={!!confirmRemove}
        eyebrow="⚠ REMOVE SHIFT"
        title="Remove this shift?"
        subject={confirmRemove ? `${memberName(confirmRemove.member)} · ${confirmRemove.shift_name} · ${dayLabel(confirmRemove.shift_date)}` : undefined}
        body="Removes the assignment from the rota. The change is recorded in the activity log."
        confirmLabel="Remove shift"
        busyLabel="Removing…"
        busy={busy}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => { const s = confirmRemove; if (s) wrap(() => deleteShift(s.id), () => setConfirmRemove(null)) }}
      />
      {toastNode}
    </>
  )
}

const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }
const backLink: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em', textDecoration: 'none', opacity: 0.7 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: 0 }
const lede: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, margin: '8px 0 0' }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const fieldLabel: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }
const th: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2', fontWeight: 500, padding: '8px 10px', borderBottom: '1px solid rgba(229,212,194,0.12)', textAlign: 'left' }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid rgba(229,212,194,0.06)', borderLeft: '1px solid rgba(229,212,194,0.04)' }
const chip: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, textAlign: 'left', background: 'rgba(94,102,80,0.35)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4, padding: '4px 8px', fontFamily: FAMILY, fontSize: 11, cursor: 'grab' }
const chipDragging: React.CSSProperties = { opacity: 0.4 }
const dropHint: React.CSSProperties = { outline: '1px dashed rgba(212,184,90,0.30)', outlineOffset: -3 }
const fnDot: React.CSSProperties = { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }
const teamPanel: React.CSSProperties = { marginTop: 10, padding: 14, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }
const teamRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '5px 0', borderBottom: '1px solid rgba(229,212,194,0.05)' }
const fnToggle: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.2)', borderRadius: 12, padding: '3px 11px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const onLabelCell: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase', verticalAlign: 'top', opacity: 0.7 }
const onEvent: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9.5, color: '#D4B85A', lineHeight: 1.4, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }
const onBooking: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9.5, color: '#B2AA98', lineHeight: 1.4, letterSpacing: '0.02em' }
const shortCell: React.CSSProperties = { boxShadow: 'inset 3px 0 0 rgba(194,112,112,0.55)' }
const covStrip: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 3, paddingTop: 4, borderTop: '1px solid rgba(229,212,194,0.06)' }
const covTag: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, letterSpacing: '0.02em' }
const covTh: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#B2AA98', fontWeight: 500, padding: '4px 8px', letterSpacing: '0.06em' }
const covTd: React.CSSProperties = { padding: '3px 8px', textAlign: 'center', fontFamily: FAMILY, fontSize: 11 }
const covInput: React.CSSProperties = { width: 46, background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 5, padding: '5px 6px', fontFamily: FAMILY, fontSize: 12, textAlign: 'center', outline: 'none' }
const ruleRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', padding: '4px 0' }
const ruleSelect: React.CSSProperties = { background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 5, padding: '5px 8px', fontFamily: FAMILY, fontSize: 11, outline: 'none' }
const ghostChip: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, background: 'rgba(212,184,90,0.06)', color: '#E5D4C2', border: '1px dashed rgba(212,184,90,0.5)', borderRadius: 4, padding: '4px 8px', fontFamily: FAMILY, fontSize: 11, opacity: 0.9 }
const autofillBanner: React.CSSProperties = { marginTop: 12, padding: '12px 16px', background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 8, fontFamily: FAMILY, fontSize: 12, color: '#E5D4C2' }
const gapTag: React.CSSProperties = { display: 'inline-block', fontFamily: FAMILY, fontSize: 10, color: '#C27070', border: '1px solid rgba(194,112,112,0.4)', borderRadius: 4, padding: '2px 7px', margin: '0 6px 4px 0' }
const addCellBtn: React.CSSProperties = { textAlign: 'left', background: 'transparent', color: '#7E7864', border: '1px dashed rgba(229,212,194,0.18)', borderRadius: 4, padding: '3px 8px', fontFamily: FAMILY, fontSize: 10, cursor: 'pointer' }
const typePill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4, padding: '3px 4px 3px 9px', fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2' }
const typeRemove: React.CSSProperties = { background: 'transparent', border: 'none', color: '#C27070', cursor: 'pointer', fontFamily: FAMILY, fontSize: 13, lineHeight: 1, padding: '0 2px' }
const tinyBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4, padding: '5px 10px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: FAMILY, fontSize: 11, letterSpacing: '0.06em' }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '8px 10px', fontFamily: FAMILY, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }
const opt: React.CSSProperties = { background: '#052E20' }
const emptyText: React.CSSProperties = { padding: '24px 0', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500 }
const modalBox: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(460px, 92vw)', background: '#0A3526', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 8, padding: '22px 24px', zIndex: 501, boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }
