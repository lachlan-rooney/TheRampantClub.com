'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, PromptModal, useToast } from '@/components/admin/dialogs'
import { vnDateString } from '@/lib/datetime'
import { createShift, updateShift, deleteShift, moveShift } from '@/lib/ops/api'
import type { RotaShift, RotaShiftType, TeamMember, CoverageTarget, StaffTimeOff, TimeOffKind } from '@/lib/ops/types'
import { checkWeek, WEEKDAYS, type RotaStaff } from '@/lib/rota/policy'
import { useLang } from '@/lib/admin-lang'

const FAMILY = "'Google Sans Code', monospace"
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Staff functions (confirmed set). A person can cover several.
// 'clean' added 2026-09-14 with the cleaning shifts (db/rota_cleaning.sql) —
// without it a cleaner has no function, and a person with no function can be
// dropped into a bar shift by anyone who clicks the wrong cell.
const FUNCTIONS = ['bar', 'floor', 'host', 'gm', 'clean'] as const
const FN_COLOR: Record<string, string> = { bar: '#D4B85A', floor: '#7AB07A', host: '#8FB3D9', gm: '#C2A0D9', clean: '#C99A6E' }
const FN_LABEL: Record<string, string> = { bar: 'Bar', floor: 'Floor', host: 'Host', gm: 'GM', clean: 'Clean' }

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
interface DemandEntry { id: string; entry_date: string; title: string; space: string | null; kind: string; blocks_space: boolean }
// Short space label for the compact demand line.
const SPACE_SHORT: Record<string, string> = {
  'Library Bar': 'Library', 'The Studio': 'Studio', 'The Rampant Room': 'Rampant',
  'The Dining Room': 'Dining', 'Source & Origin Lab': 'Lab', 'Sports Club': 'Sports',
}
const shortSpace = (s: string | null) => (s ? (SPACE_SHORT[s] || s) : '—')
// Time-off kinds, labelled as /admin/calendar labels them — it is the same row.
const OFF_KIND: Record<TimeOffKind, { en: string; vi: string }> = {
  annual_leave:   { en: 'Annual leave',   vi: 'Nghỉ phép' },
  sick:           { en: 'Sick leave',     vi: 'Nghỉ ốm' },
  unpaid:         { en: 'Unpaid / other', vi: 'Không lương' },
  public_holiday: { en: 'Public holiday', vi: 'Ngày lễ' },
}
const offRange = (o: StaffTimeOff) => o.start_date === o.end_date ? dayLabel(o.start_date) : `${dayLabel(o.start_date)} – ${dayLabel(o.end_date)}`
const HOUSE_KIND_SHORT: Record<string, string> = { closure: 'closed', private_hire: 'hire', supplier: 'visit', tasting: 'tasting', other: 'event' }
// Autofill draft types (proposed assignments + the gaps it couldn't fill).
// coverFn 'standing' = a person's every-week shift, carrying its own times.
interface Proposal { member: string; shift_date: string; shift_name: string; coverFn: string; start_time?: string | null; end_time?: string | null }
interface Gap { date: string; shift_name: string; function: string; still_needed: number }

export default function RotaPage() {
  const { t } = useLang()
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()

  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(vnDateString()))
  const [types, setTypes] = useState<RotaShiftType[]>([])
  const [shifts, setShifts] = useState<RotaShift[]>([])
  // Last week, member + date only — enough to work out who was off, which is
  // all the two cross-week rules need.
  const [prevShifts, setPrevShifts] = useState<{ member: string; shift_date: string }[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [bookings, setBookings] = useState<DemandBooking[]>([])
  const [entries, setEntries] = useState<DemandEntry[]>([])
  const [targets, setTargets] = useState<CoverageTarget[]>([])
  // Time off comes from staff_time_off — the same rows /admin/calendar shows.
  // Until 2026-09-14 the rota kept its own per-day table the calendar never saw.
  const [timeOff, setTimeOff] = useState<StaffTimeOff[]>([])       // overlapping this week
  const [upcomingOff, setUpcomingOff] = useState<StaffTimeOff[]>([]) // ending today or later
  const [offMember, setOffMember] = useState('')
  const [offKind, setOffKind] = useState<TimeOffKind>('annual_leave')
  const [offStart, setOffStart] = useState('')
  const [offEnd, setOffEnd] = useState('')
  const [offNote, setOffNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // assign/edit modal
  const [cell, setCell] = useState<{ date: string; shift_name: string; editing: RotaShift | null } | null>(null)
  const [draft, setDraft] = useState<Draft>({ member: '', shift_name: '', start_time: '', end_time: '', role: '', notes: '' })
  const [confirmRemove, setConfirmRemove] = useState<RotaShift | null>(null)
  const [addTypeOpen, setAddTypeOpen] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [showCoverage, setShowCoverage] = useState(false)
  const [showTimeOff, setShowTimeOff] = useState(false)

  // Drag state. dragId = the shift being dragged; didDrag distinguishes a real
  // drag from a click (so click-to-edit still works alongside drag-to-move).
  const [dragId, setDragId] = useState<string | null>(null)
  const didDrag = useRef(false)

  // Autofill draft (proposed, not saved until Accept).
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [gaps, setGaps] = useState<Gap[]>([])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // ── THE POLICY, CHECKED AGAINST THIS WEEK ────────────────────────────────
  // The rules live in lib/rota/policy.ts and read the columns db/rota_policy.sql
  // adds. They are checked against whatever is on screen — generated, dragged
  // or typed — because a rota that is only correct when a script writes it is
  // not a rota anyone can edit.
  const policyStaff: RotaStaff[] = team
    .filter(m => m.weekly_hours != null || m.morning_weekday != null)
    .map(m => ({
      id: m.id,
      name: m.display_name,
      isSupervisor: !!m.is_shift_supervisor,
      weeklyHours: m.weekly_hours ?? null,
      morningWeekday: m.morning_weekday ?? null,
      fixedDaysOff: m.fixed_days_off ?? [],
      alwaysShift: m.always_shift ?? null,
      pairedWith: m.rota_partner ?? null,
    }))
  // Who was off last week, per person — only for people who appear on last
  // week's rota at all. Somebody absent from it was not "off seven days"; they
  // were on leave, or not yet employed, and neither is a pattern to compare to.
  const previousDaysOff: Record<string, number[]> = {}
  for (const p of policyStaff) {
    const worked = prevShifts.filter(s2 => s2.member === p.id)
    if (!worked.length) continue
    const days2 = new Set(worked.map(s2 => new Date(s2.shift_date + 'T00:00:00Z').getUTCDay()))
    previousDaysOff[p.id] = [0, 1, 2, 3, 4, 5, 6].filter(d => !days2.has(d))
  }
  const policyTypes = types.map(t => ({ name: t.name, hours: Number(t.hours ?? 0), sortOrder: t.sort_order, weekdays: t.weekdays ?? null }))
  const policyShifts = shifts.map(s2 => ({ member: s2.member, shiftDate: s2.shift_date, shiftName: s2.shift_name }))
  const violations = policyStaff.length && policyTypes.some(t => t.hours > 0)
    ? checkWeek({ weekStart, staff: policyStaff, shiftTypes: policyTypes, shifts: policyShifts, previousDaysOff })
    : []
  const blocking = violations.filter(v => v.severity === 'blocking')
  const warnings = violations.filter(v => v.severity === 'warning')
  const hoursFor = (id: string) => policyShifts
    .filter(x => x.member === id)
    .reduce((tot, x) => tot + (policyTypes.find(t => t.name === x.shiftName)?.hours ?? 0), 0)
  const dayOffFor = (id: string) => {
    const worked = new Set(policyShifts.filter(x => x.member === id)
      .map(x => new Date(x.shiftDate + 'T00:00:00Z').getUTCDay()))
    return [0, 1, 2, 3, 4, 5, 6].filter(d => !worked.has(d)).map(d => WEEKDAYS[d]).join(', ') || '—'
  }
  const weekEnd = addDays(weekStart, 6)

  // Rows = current shift-type names PLUS any snapshotted shift_name still present
  // in the week's shifts. So a shift assigned as "Mid" stays visible even after
  // the "Mid" type is renamed/removed — the snapshot is shown, never hidden.
  const typeNames = types.map(t => t.name)
  // Who can be rostered. A director is an active team member (kiosks, boards,
  // checklists) but not rota cover; `team` stays whole so their name still
  // resolves on anything already written.
  const rotaTeam = team.filter(m => m.on_rota !== false)
  // "15:00–23:30" for a shift: its own times where it has them, else its
  // type's — a chip showing only when someone arrives never said when they leave.
  const hhmm = (v?: string | null) => v ? v.slice(0, 5) : ''
  const typeTimes = (name: string) => {
    const ty = types.find(x => x.name === name)
    return ty?.start_time ? `${hhmm(ty.start_time)}–${hhmm(ty.end_time)}` : ''
  }
  const shiftTimes = (s: RotaShift) => {
    const ty = types.find(x => x.name === s.shift_name)
    const start = s.start_time || ty?.start_time
    const end = s.end_time || ty?.end_time
    return start || end ? `${hhmm(start) || '?'}–${hhmm(end) || '?'}` : ''
  }
  const rowNames = [
    ...typeNames,
    ...[...new Set(shifts.map(s => s.shift_name))].filter(n => !typeNames.includes(n)),
  ]

  const load = useCallback(async () => {
    const [{ data: ty }, { data: sh }, { data: pv }, { data: tm }, { data: bk }, { data: en }, { data: ct }, { data: ua }, { data: up }] = await Promise.all([
      supabase.from('rota_shift_types').select('*').order('sort_order'),
      supabase.from('rota_shifts').select('*').gte('shift_date', weekStart).lte('shift_date', weekEnd),
      // LAST week too — two rules can only be judged across a pair of weeks:
      // "days off did not move", and the fortnightly day off Hiếu and Bình are
      // owed. Kept in its own state rather than widening the query above, which
      // feeds the grid and the policy check and must stay to this week alone.
      supabase.from('rota_shifts').select('member, shift_date')
        .gte('shift_date', addDays(weekStart, -7)).lt('shift_date', weekStart),
      supabase.from('team_members').select('*').eq('active', true).order('display_name'),
      // Demand signal: member bookings + house events for the week (admin RLS).
      supabase.from('bookings').select('booking_date, space, party_size, start_time, session_label')
        .gte('booking_date', weekStart).lte('booking_date', weekEnd).in('status', ['confirmed', 'pending', 'arrived']),
      supabase.from('calendar_entries').select('id, entry_date, title, space, kind, blocks_space')
        .gte('entry_date', weekStart).lte('entry_date', weekEnd),
      supabase.from('rota_coverage_targets').select('*'),
      // Time off OVERLAPPING the week: leave that began last Friday still covers Monday.
      supabase.from('staff_time_off').select('*').lte('start_date', weekEnd).gte('end_date', weekStart),
      // Upcoming time off (anything not yet over) — for the list under the grid.
      supabase.from('staff_time_off').select('*').gte('end_date', vnDateString()).order('start_date'),
    ])
    if (ty) setTypes(ty as RotaShiftType[])
    if (sh) setShifts(sh as RotaShift[])
    setPrevShifts((pv || []) as { member: string; shift_date: string }[])
    if (tm) setTeam(tm as TeamMember[])
    setBookings((bk || []) as DemandBooking[])
    setEntries((en || []) as DemandEntry[])
    setTargets((ct || []) as CoverageTarget[])
    setTimeOff((ua || []) as StaffTimeOff[])
    setUpcomingOff((up || []) as StaffTimeOff[])
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

  // ── Coverage: base target per shift × function ──
  //
  // DEMAND-SCALING RULES WERE REMOVED 2026-09-14 (Lachlan: "get rid of the
  // demand rules"). They added to a target when bookings crossed a threshold,
  // and in fifteen bookings since June no day passed 10 covers against
  // thresholds of 12 and 24 — the only one that ever fired was "event → +1
  // host", which asked for a second closer the rota cannot supply. How many
  // work each night is decided by EVENING_DEMAND in lib/rota/policy.ts.
  // THE WAY BACK: the three rows are still in rota_scaling_rules, switched
  // off (active = false); revert this commit and set them active again.
  const baseTarget = (shiftName: string, fn: string) =>
    targets.find(t => t.shift_name === shiftName && t.function === fn)?.count ?? 0
  // Does this shift run on this date? A type with no weekdays runs every day;
  // on a day it doesn't run its target is zero — no red cell, nothing to fill.
  const runsOn = (shiftName: string, date: string) => {
    const wd = types.find(x => x.name === shiftName)?.weekdays
    return !wd?.length || wd.includes(new Date(date + 'T00:00:00Z').getUTCDay())
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

  const proposedIn = (date: string, name: string) => proposals.filter(p => p.shift_date === date && p.shift_name === name)

  // Availability: the person's leave row covering this date, if any. A range
  // check, since staff_time_off holds ranges. Public holidays are excluded on
  // purpose — the club opens seven days, so a holiday takes nobody off; they
  // show in the Time off panel as information only.
  const offRow = (memberId: string, date: string) => timeOff.find(o =>
    o.team_member_id === memberId && o.kind !== 'public_holiday' && o.start_date <= date && o.end_date >= date)
  const isOff = (memberId: string, date: string) => !!offRow(memberId, date)
  const holidaysOn = (date: string) => timeOff.filter(o => o.kind === 'public_holiday' && o.start_date <= date && o.end_date >= date)

  // Every time-off write goes through /api/admin/time-off, the same route the
  // calendar uses, so the name snapshot and created_by are written one way.
  const timeOffApi = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { cache: 'no-store', ...init })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
    return j
  }
  const postTimeOff = (body: Record<string, unknown>) =>
    timeOffApi('/api/admin/time-off', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  // The weekly grid. Marking writes a one-day annual-leave row. Clearing takes
  // only THAT day out: a one-day row goes, a longer booking shrinks or splits
  // (the route does it) — un-ticking Thursday must not cancel a ten-day holiday.
  const toggleOff = (memberId: string, date: string) => {
    const existing = offRow(memberId, date)
    if (existing) {
      wrap(() => timeOffApi(`/api/admin/time-off?team_member_id=${encodeURIComponent(memberId)}&date=${date}`, { method: 'DELETE' }),
        () => { if (existing.start_date !== existing.end_date) showToast(`${t('Cleared', 'Đã xóa')} ${dayLabel(date)} ${t('from', 'khỏi')} ${memberName(memberId)} · ${offRange(existing)}.`, 'success') })
    } else {
      wrap(() => postTimeOff({ kind: 'annual_leave', team_member_id: memberId, start_date: date, end_date: date }))
    }
  }
  // Book a range ahead (any start ≥ today; end defaults to the start).
  // Public holidays aren't offered: they belong on the calendar, and take nobody off.
  const markOffRange = () => {
    const end = offEnd || offStart
    if (!offMember || !offStart) { showToast(t('Pick a person and a date.', 'Chọn một người và một ngày.'), 'error'); return }
    if (end < offStart) { showToast(t('End date is before start date.', 'Ngày kết thúc trước ngày bắt đầu.'), 'error'); return }
    wrap(() => postTimeOff({ kind: offKind, team_member_id: offMember, start_date: offStart, end_date: end, note: offNote.trim() || undefined }),
      () => { setOffNote(''); setOffStart(''); setOffEnd('') })
  }
  // Remove a whole booking from the upcoming list.
  const removeOff = (id: string) => wrap(() => timeOffApi(`/api/admin/time-off/${id}`, { method: 'DELETE' }))

  // ── Autofill (greedy, propose-a-draft) ──
  // For each active shift cell short of its effective target, pick function-
  // capable people — never lacking the function, never twice in a cell, never
  // two shifts in one day. Fairness: fewest shifts so far this week (stable by
  // id). Unfillable gaps are LABELLED, never crammed. Anyone isOff() is skipped.
  const runAutofill = () => {
    const newProps: Proposal[] = []
    const newGaps: Gap[] = []
    const weekCount = new Map<string, number>()
    const dayMembers = new Map<string, Set<string>>()
    const weekDays = new Map<string, Set<string>>()   // member → distinct dates this week (the 5-day cap)
    for (const s of shifts) {
      weekCount.set(s.member, (weekCount.get(s.member) || 0) + 1)
      if (!dayMembers.has(s.shift_date)) dayMembers.set(s.shift_date, new Set())
      dayMembers.get(s.shift_date)!.add(s.member)
      if (!weekDays.has(s.member)) weekDays.set(s.member, new Set())
      weekDays.get(s.member)!.add(s.shift_date)
    }
    // Standing shifts first: they are not a choice autofill makes, they are
    // the week as agreed (Miss Ni in the office 08–16 every weekday). Proposed
    // for any day the person has nothing yet and is not marked off.
    for (const m of rotaTeam) {
      if (!m.standing_shift || !typeNames.includes(m.standing_shift) || !m.standing_weekdays?.length) continue
      for (const d of days) {
        if (!m.standing_weekdays.includes(new Date(d + 'T00:00:00Z').getUTCDay())) continue
        if (dayMembers.get(d)?.has(m.id) || isOff(m.id, d)) continue
        newProps.push({ member: m.id, shift_date: d, shift_name: m.standing_shift, coverFn: 'standing',
          start_time: m.standing_start?.slice(0, 5) ?? null, end_time: m.standing_end?.slice(0, 5) ?? null })
        if (!dayMembers.has(d)) dayMembers.set(d, new Set())
        dayMembers.get(d)!.add(m.id)
        if (!weekDays.has(m.id)) weekDays.set(m.id, new Set())
        weekDays.get(m.id)!.add(d)
        weekCount.set(m.id, (weekCount.get(m.id) || 0) + 1)
      }
    }
    for (const d of days) {
      for (const name of typeNames) {                 // active shift types only
        const real = inCell(d, name)
        const cellMembers = new Set(real.map(s => s.member))
        const proposedHere: Proposal[] = []
        for (const fn of FUNCTIONS) {
          const target = runsOn(name, d) ? baseTarget(name, fn) : 0
          if (target <= 0) continue
          let present = real.filter(s => memberFns(s.member).includes(fn)).length
                      + proposedHere.filter(p => p.coverFn === fn).length
          while (present < target) {
            const cand = rotaTeam
              .filter(m => (m.functions || []).includes(fn) && !cellMembers.has(m.id) && !dayMembers.get(d)?.has(m.id) && !isOff(m.id, d)
                && ((weekDays.get(m.id)?.has(d)) || (weekDays.get(m.id)?.size ?? 0) < 5))   // ≤5 distinct days/week
              .sort((a, b) => (weekCount.get(a.id) || 0) - (weekCount.get(b.id) || 0) || a.id.localeCompare(b.id))
            if (cand.length === 0) { newGaps.push({ date: d, shift_name: name, function: fn, still_needed: target - present }); break }
            const pick = cand[0]
            const prop: Proposal = { member: pick.id, shift_date: d, shift_name: name, coverFn: fn }
            proposedHere.push(prop); newProps.push(prop)
            cellMembers.add(pick.id)
            if (!dayMembers.has(d)) dayMembers.set(d, new Set())
            dayMembers.get(d)!.add(pick.id)
            if (!weekDays.has(pick.id)) weekDays.set(pick.id, new Set())
            weekDays.get(pick.id)!.add(d)
            weekCount.set(pick.id, (weekCount.get(pick.id) || 0) + 1)
            present++
          }
        }
      }
    }
    setProposals(newProps); setGaps(newGaps)
    if (newProps.length === 0 && newGaps.length === 0) showToast(t('Every shift already meets its targets.', 'Mọi ca đã đạt mục tiêu.'), 'success')
  }
  const acceptAutofill = () => {
    if (proposals.length === 0) return
    wrap(async () => {
      for (const p of proposals) await createShift({ member: p.member, shift_name: p.shift_name, shift_date: p.shift_date, start_time: p.start_time ?? null, end_time: p.end_time ?? null })
    }, () => { setProposals([]); setGaps([]) })
  }
  const discardAutofill = () => { setProposals([]); setGaps([]) }


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
      : { member: rotaTeam[0]?.id || '', shift_name, start_time: '', end_time: '', role: '', notes: '' })
  }
  const saveAssign = () => {
    if (!cell || !draft.member) { showToast(t('Pick a team member.', 'Chọn một nhân sự.'), 'error'); return }
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

  // Take someone off the rota, or put them back. Only hides them here — they
  // stay active everywhere else team_members is read.
  const toggleOnRota = async (memberId: string) => {
    const m = team.find(t => t.id === memberId); if (!m) return
    const next = m.on_rota === false
    setTeam(ts => ts.map(t => t.id === memberId ? { ...t, on_rota: next } : t))   // optimistic
    const { error } = await supabase.from('team_members').update({ on_rota: next }).eq('id', memberId)
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
    if (lost.length) showToast(`${t('Heads up: that was the only', 'Lưu ý: đó là người duy nhất')} ${lost.map(f => FN_LABEL[f] || f).join(' / ')} ${t('on', 'ở')} ${shift.shift_name} · ${dayLabel(shift.shift_date)}.`, 'error')
  }
  // Soft-warn when a drag puts someone onto a 6th distinct day this week (the
  // autofill hard-caps at 5; a manual drag may override but is flagged).
  const warn6thDay = (memberId: string, toDate: string) => {
    const wkDays = new Set(shifts.filter(s => s.member === memberId && days.includes(s.shift_date)).map(s => s.shift_date))
    if (!wkDays.has(toDate) && wkDays.size >= 5) showToast(`${memberName(memberId)} ${t('would be on a 6th day this week.', 'sẽ làm ngày thứ 6 trong tuần này.')}`, 'error')
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
    if (isOff(dragged.member, toDate)) showToast(`${memberName(dragged.member)} ${t('is marked off', 'được đánh dấu nghỉ')} ${dayLabel(toDate)} — ${t('assigned anyway.', 'vẫn được xếp.')}`, 'error')
    warn6thDay(dragged.member, toDate)
    doMove(dragged.id, toDate, toName)
  }
  // Drop onto a chip → swap the two chips' (date, shift_name) slots.
  const onDropChip = (target: RotaShift) => {
    const dragged = shifts.find(s => s.id === dragId); setDragId(null)
    if (!dragged || dragged.id === target.id) return
    if (dragged.shift_date === target.shift_date && dragged.shift_name === target.shift_name) return
    warnIfLost(dragged)
    if (isOff(dragged.member, target.shift_date)) showToast(`${memberName(dragged.member)} ${t('is marked off', 'được đánh dấu nghỉ')} ${dayLabel(target.shift_date)} — ${t('assigned anyway.', 'vẫn được xếp.')}`, 'error')
    if (isOff(target.member, dragged.shift_date)) showToast(`${memberName(target.member)} ${t('is marked off', 'được đánh dấu nghỉ')} ${dayLabel(dragged.shift_date)} — ${t('assigned anyway.', 'vẫn được xếp.')}`, 'error')
    warn6thDay(dragged.member, target.shift_date)
    warn6thDay(target.member, dragged.shift_date)
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
      <Link href="/admin/ops" style={backLink}>{t('← Boards', '← Bảng')}</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0 4px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={eyebrow}>{t('Operations Hub', 'Trung tâm Vận hành')}</div>
          <h1 style={pageTitle}>{t('Rota', 'Lịch làm việc')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setWeekStart(w => addDays(w, -7))} style={tinyBtn}>{t('‹ Prev', '‹ Trước')}</button>
          <button onClick={() => setWeekStart(mondayOf(vnDateString()))} style={tinyBtn}>{t('This week', 'Tuần này')}</button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} style={tinyBtn}>{t('Next ›', 'Sau ›')}</button>
          <button onClick={runAutofill} disabled={busy} style={{ ...tinyBtn, color: '#D4B85A', borderColor: 'rgba(212,184,90,0.45)' }}>{t('✦ Autofill week', '✦ Tự động xếp tuần')}</button>
        </div>
      </div>
      <p style={lede}>{t("Club-wide weekly rota — who's on which shift. Drag a name to move it across shifts or days; drop onto another name to swap. Week of", 'Lịch làm việc tuần toàn câu lạc bộ — ai làm ca nào. Kéo một tên để chuyển sang ca hoặc ngày khác; thả lên một tên khác để hoán đổi. Tuần của')} {dayLabel(weekStart)} – {dayLabel(weekEnd)}.</p>

      {/* The week against the rules: hours, days off, and what is broken. */}
      {policyStaff.length > 0 && (
        <div data-rota-policy={blocking.length ? 'broken' : 'kept'}
             style={{ margin: '14px 0 6px', padding: '14px 16px', borderRadius: 6,
                      border: `1px solid ${blocking.length ? 'rgba(194,112,112,0.45)' : 'rgba(229,212,194,0.14)'}`,
                      background: blocking.length ? 'rgba(194,112,112,0.07)' : 'rgba(229,212,194,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={eyebrow}>{t('This week against the rules', 'Tuần này so với quy định')}</span>
            <span style={{ ...metaText, color: blocking.length ? '#E8A6A6' : '#9FBF8F' }}>
              {blocking.length
                ? `${blocking.length} ${t('to fix', 'cần sửa')}`
                : t('all rules kept', 'đạt tất cả quy định')}
              {warnings.length ? ` · ${warnings.length} ${t('to note', 'ghi chú')}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: blocking.length || warnings.length ? 12 : 0 }}>
            {policyStaff.map(p => {
              const h = hoursFor(p.id)
              const over = p.weeklyHours != null && h > p.weeklyHours
              const short = p.weeklyHours != null && h + 1.001 < p.weeklyHours
              return (
                <div key={p.id} style={{ minWidth: 128 }}>
                  <div style={{ fontFamily: FAMILY, fontSize: 11.5, color: '#E5D4C2' }}>
                    {p.name}{p.isSupervisor ? ' ·' : ''}
                    {p.isSupervisor && <span style={{ color: '#D4B85A' }}> {t('supervisor', 'giám sát')}</span>}
                  </div>
                  <div style={{ fontFamily: FAMILY, fontSize: 11, color: over || short ? '#E8A6A6' : '#B2AA98' }}>
                    {h.toFixed(2)}h{p.weeklyHours != null ? ` / ${p.weeklyHours}` : ''}
                  </div>
                  <div style={{ ...metaText, opacity: 0.72 }}>{t('off', 'nghỉ')} {dayOffFor(p.id)}</div>
                </div>
              )
            })}
          </div>
          {[...blocking, ...warnings].slice(0, 8).map((v, i) => (
            <div key={i} style={{ ...metaText, color: v.severity === 'blocking' ? '#E8A6A6' : '#B2AA98', lineHeight: 1.75 }}>
              {v.severity === 'blocking' ? '✗ ' : '· '}{v.detail}
            </div>
          ))}
        </div>
      )}

      {(proposals.length > 0 || gaps.length > 0) && (
        <div style={autofillBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ color: '#D4B85A' }}>{t('Autofill draft:', 'Bản nháp tự động:')} {proposals.length} {proposals.length === 1 ? t('proposed assignment', 'phân ca đề xuất') : t('proposed assignments', 'phân ca đề xuất')}</strong>
            <span style={{ ...metaText, opacity: 0.7 }}>{t('Draft only — fills by role to meet targets, skipping anyone marked off. Drop any chip with its × before accepting; review the rest.', 'Chỉ là bản nháp — xếp theo vai trò để đạt mục tiêu, bỏ qua ai đã đánh dấu nghỉ. Bỏ bất kỳ ô nào bằng dấu × trước khi chấp nhận; xem lại phần còn lại.')}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={acceptAutofill} disabled={busy || proposals.length === 0} style={{ ...btnPrimary, opacity: proposals.length === 0 ? 0.5 : 1 }}>{busy ? t('Saving…', 'Đang lưu…') : `${t('Accept kept', 'Chấp nhận đã giữ')} (${proposals.length})`}</button>
              <button onClick={discardAutofill} disabled={busy} style={tinyBtn}>{t('Discard all', 'Bỏ tất cả')}</button>
            </span>
          </div>
          {gaps.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <span style={{ ...metaText, color: '#C27070', marginRight: 4 }}>{t("Couldn't fill (sort by hand):", 'Không thể xếp (sắp bằng tay):')}</span>
              {gaps.map((g, i) => <span key={i} style={gapTag}>{g.shift_name} {dayLabel(g.date)} · +{g.still_needed} {FN_LABEL[g.function] || g.function}</span>)}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: 90 }}>{t('Shift', 'Ca')}</th>
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
                <td style={{ ...td, ...onLabelCell }}>{t("What's on", 'Lịch trong ngày')}</td>
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
                            <Link key={`e${i}`} href={`/admin/bookings/new?entry=${e.id}`} style={{ ...onEvent, textDecoration: 'none' }} title={`${e.title} · ${e.space || t('no room', 'không có phòng')} — ${t('open entry', 'mở mục')}`}>
                              ◆ {shortSpace(e.space)} · {e.title} <span style={{ opacity: 0.65 }}>({HOUSE_KIND_SHORT[e.kind] || 'event'})</span>
                            </Link>
                          ))}
                          {[...bySpace.entries()].map(([sp, v]) => (
                            <span key={sp} style={onBooking}>{shortSpace(sp)} · {v.n} {v.n === 1 ? t('bkg', 'đặt') : t('bkgs', 'đặt')} · {v.covers}p</span>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
              {rowNames.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, ...metaText, opacity: 0.6, fontStyle: 'italic' }}>{t('No shift names yet — add one below.', 'Chưa có tên ca — thêm một cái bên dưới.')}</td></tr>
              ) : rowNames.map(name => {
                const isType = typeNames.includes(name)
                return (
                <tr key={name}>
                  <td style={{ ...td, fontFamily: FAMILY, fontSize: 12, color: isType ? '#E5D4C2' : '#7E7864' }}>
                    {name}{isType && typeTimes(name) && <div style={{ ...metaText, opacity: 0.6, marginTop: 2 }}>{typeTimes(name)}</div>}{!isType && <span title={t('retired shift name — kept on existing shifts', 'tên ca đã ngừng — giữ trên các ca hiện có')} style={{ ...metaText, opacity: 0.5 }}> · {t('retired', 'đã ngừng')}</span>}
                  </td>
                  {days.map(d => {
                    // Under-staffing: required (base target) vs present (assigned who HAVE the function).
                    const ghosts = proposedIn(d, name)
                    const cov = isType
                      ? FUNCTIONS.map(fn => {
                          const req = runsOn(name, d) ? baseTarget(name, fn) : 0
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
                            title={[shiftTimes(s), fns.length ? fns.map(f => FN_LABEL[f] || f).join('/') : null].filter(Boolean).join(' · ')}
                          >
                            <span>{memberName(s.member)}{shiftTimes(s) ? <span style={{ opacity: 0.6 }}> · {shiftTimes(s)}</span> : null}</span>
                            {fns.length > 0 && (
                              <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, flexShrink: 0 }}>
                                {fns.map(f => <span key={f} title={FN_LABEL[f] || f} style={{ ...fnDot, background: FN_COLOR[f] || '#B2AA98' }} />)}
                              </span>
                            )}
                          </button>
                          )
                        })}
                        {ghosts.map((g, gi) => (
                          <div key={`g${gi}`} style={ghostChip} title={`${t('Proposed', 'Đề xuất')} · ${FN_LABEL[g.coverFn] || g.coverFn}`}>
                            <span>{memberName(g.member)}</span>
                            <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ ...fnDot, background: FN_COLOR[g.coverFn] || '#B2AA98' }} />
                              <span style={{ fontSize: 8, opacity: 0.7, letterSpacing: '0.08em' }}>{t('NEW', 'MỚI')}</span>
                              <button onClick={() => setProposals(ps => ps.filter(p => p !== g))} title={t('Drop this proposal', 'Bỏ đề xuất này')} style={ghostDrop}>×</button>
                            </span>
                          </div>
                        ))}
                        {isType && <button onClick={() => openAssign(d, name, null)} style={addCellBtn}>{t('+ assign', '+ xếp')}</button>}
                        {cov.length > 0 && (
                          <div style={covStrip}>
                            {cov.map(c => (
                              <span key={c.fn} style={{ ...covTag, color: c.pres >= c.req ? '#7AB07A' : '#C27070' }}
                                title={`${FN_LABEL[c.fn]}: ${c.pres} ${t('on', 'đang làm')}, ${c.req} ${t('wanted', 'cần')}`}>
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
        <span style={{ ...metaText, opacity: 0.7 }}>{t('Shift names:', 'Tên ca:')}</span>
        {types.map(ty => (
          <span key={ty.name} style={typePill}>
            {ty.name}
            <button onClick={() => removeType(ty.name)} title={t('Remove', 'Xóa')} style={typeRemove}>×</button>
          </span>
        ))}
        <button onClick={() => setAddTypeOpen(true)} style={tinyBtn}>{t('+ add', '+ thêm')}</button>
      </div>

      {/* Team & functions — the roles each person can cover (shown as dots on shifts) */}
      <div style={{ marginTop: 14 }}>
        <button onClick={() => setShowTeam(v => !v)} style={tinyBtn}>{showTeam ? '▾' : '▸'} {t('Team & functions', 'Nhân sự & vai trò')}</button>
        {showTeam && (
          <div style={teamPanel}>
            <div style={{ ...metaText, opacity: 0.7, marginBottom: 10 }}>{t('Tick the roles each person can cover. They show as coloured dots on their shifts; dragging the only person of a role off a shift gives a heads-up.', 'Đánh dấu các vai trò mỗi người có thể đảm nhận. Chúng hiện dưới dạng chấm màu trên ca của họ; kéo người duy nhất của một vai trò ra khỏi ca sẽ có lưu ý.')}</div>
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
                  <button onClick={() => toggleOnRota(m.id)}
                    title={t('Off = still on the team (kiosk, boards, checklists), but never rostered', 'Tắt = vẫn trong nhân sự (kiosk, bảng, checklist), nhưng không xếp ca')}
                    style={{ ...fnToggle, marginLeft: 8, ...(m.on_rota !== false ? { borderColor: '#E5D4C2', color: '#E5D4C2' } : { opacity: 0.5, textDecoration: 'line-through' }) }}>
                    {t('On rota', 'Trong lịch')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coverage — base targets per shift × function */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowCoverage(v => !v)} style={tinyBtn}>{showCoverage ? '▾' : '▸'} {t('Coverage targets', 'Mục tiêu nhân lực')}</button>
        {showCoverage && (
          <div style={teamPanel}>
            <div style={{ ...metaText, opacity: 0.7, marginBottom: 10 }}>{t('How many of each function a shift wants. The grid shows', 'Mỗi ca cần bao nhiêu người cho từng vai trò. Lưới hiển thị')} <span style={{ color: '#7AB07A' }}>{t('on/wanted', 'đang làm/cần')}</span> {t('per shift, tinting any that fall short — guidance, not a block.', 'cho mỗi ca, tô màu những ca chưa đủ — chỉ là gợi ý, không chặn.')}</div>

            <div style={{ ...fieldLabel, marginBottom: 6 }}>{t('Base targets (per shift)', 'Mục tiêu cơ bản (mỗi ca)')}</div>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...covTh, textAlign: 'left' }}>{t('Shift', 'Ca')}</th>{FUNCTIONS.map(f => <th key={f} style={covTh}>{FN_LABEL[f]}</th>)}</tr></thead>
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
                  {types.length === 0 && <tr><td colSpan={FUNCTIONS.length + 1} style={{ ...covTd, ...metaText, opacity: 0.6 }}>{t('Add a shift name first.', 'Thêm tên ca trước.')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Time off — who can't work each day this week (autofill skips; drag warns) */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowTimeOff(v => !v)} style={tinyBtn}>{showTimeOff ? '▾' : '▸'} {t('Time off', 'Nghỉ phép')}</button>
        {showTimeOff && (
          <div style={teamPanel}>
            <div style={{ ...metaText, opacity: 0.7, marginBottom: 10 }}>{t("Mark who can't work each day this week. Autofill won't roster them that day; dragging someone onto their day off warns (you can still override). This is the same time off as the calendar. Public holidays (◆) are shown for information — the club opens seven days, so they take nobody off.", 'Đánh dấu ai không thể làm mỗi ngày trong tuần này. Tự động xếp sẽ không xếp họ ngày đó; kéo ai đó vào ngày nghỉ của họ sẽ cảnh báo (bạn vẫn có thể ghi đè). Đây cũng là lịch nghỉ trên trang Lịch. Ngày lễ (◆) chỉ để tham khảo — câu lạc bộ mở cửa bảy ngày, nên không ai được tính là nghỉ.')}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...covTh, textAlign: 'left' }}>{t('Person', 'Người')}</th>
                    {days.map((d, i) => {
                      const hols = holidaysOn(d)
                      return (
                        <th key={d} style={covTh}>{DOW[i]}<div style={{ ...metaText, opacity: 0.5, fontSize: 9 }}>{new Date(d + 'T00:00:00Z').getUTCDate()}</div>
                          {hols.length > 0 && <div title={hols.map(h => h.note || t('Public holiday', 'Ngày lễ')).join(' · ')} style={{ color: '#D4B85A', fontSize: 9, cursor: 'help' }}>◆</div>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rotaTeam.map(m => (
                    <tr key={m.id}>
                      <td style={{ ...covTd, textAlign: 'left', color: '#E5D4C2' }}>{m.display_name}</td>
                      {days.map(d => {
                        const row = offRow(m.id, d)
                        const off = !!row
                        return (
                          <td key={d} style={covTd}>
                            <button onClick={() => toggleOff(m.id, d)} disabled={busy}
                              title={row
                                ? `${t(OFF_KIND[row.kind].en, OFF_KIND[row.kind].vi)} · ${offRange(row)}${row.note ? ` · ${row.note}` : ''} — ${t('click to clear this day only', 'nhấn để chỉ xóa ngày này')}`
                                : t('Available — click to mark off', 'Có mặt — nhấn để đánh dấu nghỉ')}
                              style={off ? offBtnOn : offBtnOff}>{off ? t('off', 'nghỉ') : '·'}</button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {team.length === 0 && <tr><td colSpan={8} style={{ ...covTd, ...metaText, opacity: 0.6 }}>{t('No team members.', 'Chưa có nhân sự.')}</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Ahead-of-time: book a range off (leave booked weeks out) */}
            <div style={{ ...fieldLabel, marginTop: 16, marginBottom: 6 }}>{t('Book time off ahead', 'Đăng ký nghỉ trước')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={offMember} onChange={e => setOffMember(e.target.value)} style={ruleSelect}>
                <option value="" style={opt}>{t('— person —', '— người —')}</option>
                {rotaTeam.map(m => <option key={m.id} value={m.id} style={opt}>{m.display_name}</option>)}
              </select>
              <select value={offKind} onChange={e => setOffKind(e.target.value as TimeOffKind)} style={ruleSelect}>
                {(['annual_leave', 'sick', 'unpaid'] as TimeOffKind[]).map(k => <option key={k} value={k} style={opt}>{t(OFF_KIND[k].en, OFF_KIND[k].vi)}</option>)}
              </select>
              <input type="date" min={vnDateString()} value={offStart} title={t('From', 'Từ')}
                onChange={e => { const v = e.target.value; setOffStart(v); setOffEnd(end => !end || end < v ? v : end) }}
                style={{ ...ruleSelect, colorScheme: 'dark' }} />
              <span style={{ ...metaText, opacity: 0.6 }}>{t('to', 'đến')}</span>
              <input type="date" min={offStart || vnDateString()} value={offEnd || offStart} title={t('To', 'Đến')}
                onChange={e => setOffEnd(e.target.value)} style={{ ...ruleSelect, colorScheme: 'dark' }} />
              <input value={offNote} onChange={e => setOffNote(e.target.value)} placeholder={t('note (optional)', 'ghi chú (tùy chọn)')} maxLength={200} style={{ ...ruleSelect, minWidth: 130 }} />
              <button onClick={markOffRange} disabled={busy} style={tinyBtn}>{t('Mark off', 'Đánh dấu nghỉ')}</button>
            </div>

            <div style={{ ...fieldLabel, marginTop: 16, marginBottom: 6 }}>{t('Upcoming time off', 'Nghỉ phép sắp tới')}</div>
            {upcomingOff.length === 0 ? (
              <div style={{ ...metaText, opacity: 0.55, fontStyle: 'italic' }}>{t('Nothing booked ahead.', 'Chưa đặt gì trước.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {upcomingOff.map(o => {
                  const holiday = o.kind === 'public_holiday'
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: FAMILY, fontSize: 11, color: holiday ? '#D4B85A' : '#E5D4C2' }}>
                      {/* A name that has left the active team still reads from the snapshot. */}
                      <span style={{ minWidth: 120 }}>{holiday ? `◆ ${t('Club-wide', 'Toàn câu lạc bộ')}` : (team.find(m => m.id === o.team_member_id)?.display_name ?? o.member_name ?? '—')}</span>
                      <span style={{ ...metaText }}>{offRange(o)}</span>
                      <span style={{ ...metaText, opacity: 0.75 }}>· {t(OFF_KIND[o.kind].en, OFF_KIND[o.kind].vi)}</span>
                      {o.note && <span style={{ ...metaText, opacity: 0.6 }}>· {o.note}</span>}
                      {holiday
                        ? <span title={t('Managed on the calendar. Takes nobody off the rota.', 'Quản lý trên trang Lịch. Không tính ai là nghỉ.')} style={{ ...metaText, opacity: 0.5, marginLeft: 'auto' }}>{t('info only', 'chỉ tham khảo')}</span>
                        : <button onClick={() => removeOff(o.id)} disabled={busy} title={t('Remove this booking', 'Xóa đăng ký này')} style={{ ...typeRemove, marginLeft: 'auto' }}>×</button>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign / edit modal */}
      {cell && (
        <>
          <div style={modalBackdrop} onClick={() => { if (!busy) setCell(null) }} />
          <div style={modalBox} role="dialog">
            <div style={eyebrow}>{cell.editing ? t('Edit shift', 'Sửa ca') : t('Assign shift', 'Xếp ca')}</div>
            <div style={{ ...metaText, marginBottom: 12 }}>{cell.shift_name} · {dayLabel(cell.date)}</div>
            <div style={fieldLabel}>{t('Team member', 'Nhân sự')}</div>
            <select style={input} value={draft.member} onChange={e => setDraft(d => ({ ...d, member: e.target.value }))}>
              <option value="" style={opt}>{t('— pick —', '— chọn —')}</option>
              {rotaTeam.map(m => <option key={m.id} value={m.id} style={opt}>{m.display_name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Shift', 'Ca')}</div>
                <select style={input} value={draft.shift_name} onChange={e => setDraft(d => ({ ...d, shift_name: e.target.value }))}>
                  {types.map(ty => <option key={ty.name} value={ty.name} style={opt}>{ty.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Role (optional)', 'Vai trò (tùy chọn)')}</div>
                <input style={input} value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} placeholder="Bar, Floor…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Start (optional)', 'Bắt đầu (tùy chọn)')}</div>
                <input type="time" style={input} value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('End (optional)', 'Kết thúc (tùy chọn)')}</div>
                <input type="time" style={input} value={draft.end_time} onChange={e => setDraft(d => ({ ...d, end_time: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={fieldLabel}>{t('Notes (optional)', 'Ghi chú (tùy chọn)')}</div>
              <input style={input} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={saveAssign} disabled={busy} style={btnPrimary}>{busy ? t('Saving…', 'Đang lưu…') : cell.editing ? t('Save', 'Lưu') : t('Assign', 'Xếp')}</button>
              <button onClick={() => setCell(null)} style={tinyBtn}>{t('Cancel', 'Hủy')}</button>
              {cell.editing && (
                <button onClick={() => { const s = cell.editing; setCell(null); setConfirmRemove(s) }} style={{ ...tinyBtn, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>{t('Remove', 'Xóa')}</button>
              )}
            </div>
          </div>
        </>
      )}

      <PromptModal
        open={addTypeOpen}
        eyebrow={t('＋ SHIFT NAME', '＋ TÊN CA')}
        title={t('Add a shift name', 'Thêm tên ca')}
        label={t('Name (e.g. Brunch, Late) — editable anytime, no migration', 'Tên (vd. Brunch, Ca muộn) — sửa được bất cứ lúc nào, không cần di chuyển dữ liệu')}
        confirmLabel={t('Add', 'Thêm')}
        onCancel={() => setAddTypeOpen(false)}
        onConfirm={addType}
      />
      <ConfirmModal
        open={!!confirmRemove}
        eyebrow={t('⚠ REMOVE SHIFT', '⚠ XÓA CA')}
        title={t('Remove this shift?', 'Xóa ca này?')}
        subject={confirmRemove ? `${memberName(confirmRemove.member)} · ${confirmRemove.shift_name} · ${dayLabel(confirmRemove.shift_date)}` : undefined}
        body={t('Removes the assignment from the rota. The change is recorded in the activity log.', 'Xóa phân ca khỏi lịch làm việc. Thay đổi được ghi lại trong nhật ký hoạt động.')}
        confirmLabel={t('Remove shift', 'Xóa ca')}
        busyLabel={t('Removing…', 'Đang xóa…')}
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
const ruleSelect: React.CSSProperties = { background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 5, padding: '5px 8px', fontFamily: FAMILY, fontSize: 11, outline: 'none' }
const ghostChip: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, background: 'rgba(212,184,90,0.06)', color: '#E5D4C2', border: '1px dashed rgba(212,184,90,0.5)', borderRadius: 4, padding: '4px 8px', fontFamily: FAMILY, fontSize: 11, opacity: 0.9 }
const ghostDrop: React.CSSProperties = { background: 'transparent', border: 'none', color: '#C27070', cursor: 'pointer', fontFamily: FAMILY, fontSize: 13, lineHeight: 1, padding: '0 1px' }
const autofillBanner: React.CSSProperties = { marginTop: 12, padding: '12px 16px', background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 8, fontFamily: FAMILY, fontSize: 12, color: '#E5D4C2' }
const gapTag: React.CSSProperties = { display: 'inline-block', fontFamily: FAMILY, fontSize: 10, color: '#C27070', border: '1px solid rgba(194,112,112,0.4)', borderRadius: 4, padding: '2px 7px', margin: '0 6px 4px 0' }
const offBtnOff: React.CSSProperties = { width: 30, background: 'transparent', color: '#7E7864', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 5, padding: '4px 0', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const offBtnOn: React.CSSProperties = { width: 30, background: 'rgba(194,112,112,0.25)', color: '#E5D4C2', border: '1px solid rgba(194,112,112,0.55)', borderRadius: 5, padding: '4px 0', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
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
