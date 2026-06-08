import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────
// Named-table booking availability — the ONE guard used by both the POST
// (create) and PATCH (edit) booking routes, AND the read-only availability
// endpoint that drives the form's live greying. A silent double-book is the
// failure this exists to prevent, so the logic lives here once, not copied.
//
// A booking holds one-or-more UNITS (space_tables rows). The either-or
// (Sofa-whole ⟷ its 3 segments; Studio-whole ⟷ A/B/C) is DERIVED from the
// parent_id graph — never hand-entered pairs:
//     conflict(U) = {U} ∪ children(U) ∪ {parent(U)}
// Booking U makes U, its children, and its parent unavailable; siblings stay
// independent (3+2+3 can be three parties).
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_BOOKING_MINUTES = 120
// Session-label → [start, end] window (club-confirmed), used when a booking has
// no precise time. Lets early/evening/late not collide with each other.
export const SESSION_WINDOWS: Record<string, [string, string]> = {
  early:   ['12:00', '17:00'],
  evening: ['17:00', '21:00'],
  late:    ['21:00', '23:59'],
}

export interface TimeWindow { start_time: string | null; end_time: string | null }

// Conservative overlap for ROOM CLOSURES: if either side lacks a precise start,
// treat as whole-day (a timeless closure closes all day; a session-only booking
// on a closed day conflicts). Both precise → interval overlap on HH:MM.
// (Reused verbatim from the verified room-closure check — 6/6 cases.)
export function timeOverlaps(closure: TimeWindow, booking: TimeWindow): boolean {
  const hm = (t: string | null) => (t ? t.slice(0, 5) : null)
  const cs = hm(closure.start_time), bs = hm(booking.start_time)
  if (!cs || !bs) return true
  const ce = hm(closure.end_time) || '23:59'
  const be = hm(booking.end_time) || bs
  return cs <= be && bs < ce
}

export interface BookingWindow { start_time: string | null; end_time: string | null; session_label: string | null }

// A booking's effective [startMin, endMin] minutes-from-midnight. Precise times
// win; a start with no end gets DEFAULT_BOOKING_MINUTES; a session-only booking
// uses its window; nothing usable → whole day (conservative).
export function effectiveWindow(b: BookingWindow): [number, number] {
  const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
  if (b.start_time) {
    const s = toMin(b.start_time)
    const e = b.end_time ? toMin(b.end_time) : s + DEFAULT_BOOKING_MINUTES
    return [s, Math.max(e, s + 1)]
  }
  if (b.session_label && SESSION_WINDOWS[b.session_label]) {
    const [s, e] = SESSION_WINDOWS[b.session_label]
    return [toMin(s), toMin(e)]
  }
  return [0, 24 * 60]
}

// Two bookings collide in time iff their effective windows intersect.
function windowsOverlap(a: BookingWindow, b: BookingWindow): boolean {
  const [as, ae] = effectiveWindow(a)
  const [bs, be] = effectiveWindow(b)
  return as < be && bs < ae
}

interface Unit { id: string; space: string; name: string; seats: number; parent_id: string | null }

// conflict(U) = {U} ∪ children(U) ∪ {parent(U)} — derived from parent_id.
// Single source of the either-or, shared by the guard and the availability read.
function makeConflictSet(units: Unit[]) {
  const byId = new Map(units.map(u => [u.id, u]))
  return (id: string): Set<string> => {
    const s = new Set<string>([id])
    const u = byId.get(id)
    if (u?.parent_id) s.add(u.parent_id)
    for (const c of units) if (c.parent_id === id) s.add(c.id)
    return s
  }
}

const ACTIVE_STATUS = ['pending', 'confirmed', 'arrived']

interface HoldRow { unit_id: string; bookings: (BookingWindow & { booking_id: string }) | (BookingWindow & { booking_id: string })[] }
const oneBooking = (h: HoldRow) => (Array.isArray(h.bookings) ? h.bookings[0] : h.bookings)

export interface AvailabilityInput {
  sb: SupabaseClient
  unit_ids: string[]                  // may be empty → legacy/space-only path (no unit guard)
  space: string                       // room string; with units it must be consistent and is re-derived
  booking_date: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  party_size: number
  excludeBookingId?: string | null    // PATCH: ignore this booking's own current holds
}
export interface AvailabilityResult {
  ok: boolean
  status?: number                     // 400 (bad request) | 409 (conflict)
  error?: string
  resolvedSpace?: string              // the room derived from the units (set bookings.space to this)
}

// House calendar_entries that BLOCK in a room/window. An entry with NO units
// closes the WHOLE room (the original closure behaviour). An entry WITH units
// blocks only those specific units (e.g. a private hire of just the sofa) —
// the rest of the room stays bookable. Returns the whole-room flag (+ its title
// for the message) and the set of specifically-blocked unit ids.
async function houseEntryBlocks(sb: SupabaseClient, space: string, booking_date: string, win: TimeWindow, excludeEntryId?: string | null):
  Promise<{ wholeRoomClosed: boolean; closureTitle: string | null; occupied: Set<string> }> {
  const occupied = new Set<string>()
  const { data: entries } = await sb
    .from('calendar_entries')
    .select('id, title, start_time, end_time, blocks_space')
    .eq('space', space).eq('entry_date', booking_date).eq('blocks_space', true)
  const blocking = (entries || []).filter(e => e.id !== excludeEntryId && timeOverlaps(e as TimeWindow, win))
  if (blocking.length === 0) return { wholeRoomClosed: false, closureTitle: null, occupied }

  const { data: ets } = await sb
    .from('calendar_entry_tables')
    .select('entry_id, unit_id')
    .in('entry_id', blocking.map(e => e.id as string))
  const unitsByEntry = new Map<string, string[]>()
  for (const r of (ets || []) as { entry_id: string; unit_id: string }[]) {
    const a = unitsByEntry.get(r.entry_id) || []; a.push(r.unit_id); unitsByEntry.set(r.entry_id, a)
  }
  let wholeRoomClosed = false, closureTitle: string | null = null
  for (const e of blocking as { id: string; title: string | null }[]) {
    const us = unitsByEntry.get(e.id) || []
    if (us.length === 0) { wholeRoomClosed = true; closureTitle = e.title }   // no units → whole room
    else us.forEach(u => occupied.add(u))                                     // units → just those
  }
  return { wholeRoomClosed, closureTitle, occupied }
}

export async function checkBookingAvailability(input: AvailabilityInput): Promise<AvailabilityResult> {
  const { sb, booking_date, start_time, end_time, session_label, party_size, excludeBookingId } = input
  const unitIds = [...new Set(input.unit_ids || [])]
  const reqWindow: BookingWindow = { start_time, end_time, session_label }
  let space = input.space
  let reqUnits: Unit[] = []
  let byId = new Map<string, Unit>()
  let conflictSet: (id: string) => Set<string> = () => new Set()
  const occupied = new Set<string>()   // unit ids taken by overlapping bookings + blocking house entries

  // ── Unit-level checks (only when specific units were requested) ──────────
  if (unitIds.length > 0) {
    const { data: allUnits, error: uErr } = await sb
      .from('space_tables')
      .select('id, space, name, seats, parent_id')
    if (uErr) return { ok: false, status: 500, error: uErr.message }
    const units = (allUnits || []) as Unit[]
    byId = new Map(units.map(u => [u.id, u]))
    conflictSet = makeConflictSet(units)

    // Every requested unit must exist.
    const requested = unitIds.map(id => byId.get(id))
    const missingIdx = requested.findIndex(u => !u)
    if (missingIdx >= 0) return { ok: false, status: 400, error: `Unknown table (${unitIds[missingIdx]}).` }
    reqUnits = requested as Unit[]

    // A booking lives in ONE room — all units must share a space.
    const spaces = [...new Set(reqUnits.map(u => u.space))]
    if (spaces.length > 1) return { ok: false, status: 400, error: `A booking can't span rooms (${spaces.join(', ')}). Pick tables in one room.` }
    space = spaces[0]

    // (1) Inter-request: no two requested units may conflict with each other.
    for (let i = 0; i < reqUnits.length; i++) {
      const ci = conflictSet(reqUnits[i].id)
      for (let j = 0; j < reqUnits.length; j++) {
        if (i !== j && ci.has(reqUnits[j].id)) {
          return { ok: false, status: 400, error: `${reqUnits[i].name} and ${reqUnits[j].name} can't be booked together — one contains the other.` }
        }
      }
    }

    // (2) Party ≤ seats.
    const totalSeats = reqUnits.reduce((sum, u) => sum + u.seats, 0)
    if (party_size > totalSeats) {
      return { ok: false, status: 409, error: `Party of ${party_size} exceeds the ${totalSeats} seat${totalSeats === 1 ? '' : 's'} of the chosen table${reqUnits.length === 1 ? '' : 's'}. Pick a larger table or add one.` }
    }

    // (3) Occupancy from active bookings overlapping this window.
    const blockedIds = [...new Set(reqUnits.flatMap(u => [...conflictSet(u.id)]))]
    const { data: holds, error: hErr } = await sb
      .from('booking_tables')
      .select('unit_id, bookings!inner(booking_id, booking_date, start_time, end_time, session_label, status)')
      .in('unit_id', blockedIds)
      .eq('bookings.booking_date', booking_date)
      .in('bookings.status', ACTIVE_STATUS)
    if (hErr) return { ok: false, status: 500, error: hErr.message }
    for (const h of (holds || []) as unknown as HoldRow[]) {
      const b = oneBooking(h)
      if (!b) continue
      if (excludeBookingId && b.booking_id === excludeBookingId) continue   // an edit can't conflict with itself
      if (windowsOverlap(reqWindow, b)) occupied.add(h.unit_id)
    }
  }

  // ── House entries (closures / table-scoped hires), layered on top. ───────
  // Whole-room closure (an entry with no units) blocks any booking in the room;
  // a table-scoped entry adds its units to the occupied set.
  const house = await houseEntryBlocks(sb, space, booking_date, { start_time, end_time })
  if (house.wholeRoomClosed) {
    return { ok: false, status: 409, error: `${space} is closed on ${booking_date}${house.closureTitle ? ` — ${house.closureTitle}` : ''}. Pick another space or time.` }
  }
  for (const u of house.occupied) occupied.add(u)

  // ── Per-unit conflict: a requested unit is taken if anything in conflict(Tᵢ)
  //    is occupied (by a booking OR a blocking house entry). ──
  for (const u of reqUnits) {
    const clash = [...conflictSet(u.id)].find(cid => occupied.has(cid))
    if (clash) {
      const heldName = byId.get(clash)?.name || 'another table'
      return { ok: false, status: 409, error: `${u.name} is unavailable for that time (held as “${heldName}”). Pick another table or time.` }
    }
  }

  return { ok: true, resolvedSpace: space }
}

// ── Read-only availability (drives the form's live greying) ────────────────
// Reuses the SAME conflict()/overlap logic — a unit is available iff nothing in
// conflict(U) is held by an overlapping active booking. excludeBookingId lets the
// edit form ignore the booking's own holds (so it isn't greyed as taken-by-self).

export interface UnitAvailability { id: string; name: string; seats: number; parent_id: string | null; available: boolean }

export async function bookableRooms(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb.from('space_tables').select('space').eq('bookable', true)
  return [...new Set((data || []).map(r => r.space as string))].sort()
}

export async function roomUnitAvailability(sb: SupabaseClient, opts: {
  space: string
  booking_date: string | null
  start_time: string | null
  end_time: string | null
  session_label: string | null
  excludeBookingId?: string | null
  excludeEntryId?: string | null      // editing a house entry: ignore its own table holds
}): Promise<UnitAvailability[]> {
  const { data: rows } = await sb
    .from('space_tables')
    .select('id, space, name, seats, parent_id, bookable, sort')
    .eq('space', opts.space).order('sort', { ascending: true })
  const roomUnits = ((rows || []) as (Unit & { bookable: boolean; sort: number })[]).filter(u => u.bookable)
  const conflictSet = makeConflictSet(roomUnits)

  // No date → can't compute occupancy; list all as available (greying starts
  // once a date is set).
  if (!opts.booking_date) {
    return roomUnits.map(u => ({ id: u.id, name: u.name, seats: u.seats, parent_id: u.parent_id, available: true }))
  }

  const ids = roomUnits.map(u => u.id)
  const reqWindow: BookingWindow = { start_time: opts.start_time, end_time: opts.end_time, session_label: opts.session_label }
  const occupied = new Set<string>()
  if (ids.length > 0) {
    const { data: holds } = await sb
      .from('booking_tables')
      .select('unit_id, bookings!inner(booking_id, booking_date, start_time, end_time, session_label, status)')
      .in('unit_id', ids)
      .eq('bookings.booking_date', opts.booking_date)
      .in('bookings.status', ACTIVE_STATUS)
    for (const h of (holds || []) as unknown as HoldRow[]) {
      const b = oneBooking(h)
      if (!b) continue
      if (opts.excludeBookingId && b.booking_id === opts.excludeBookingId) continue
      if (windowsOverlap(reqWindow, b)) occupied.add(h.unit_id)
    }
  }

  // House entries: a no-units entry closes the whole room; a table-scoped entry
  // marks just its units occupied (same model as the booking guard).
  const house = await houseEntryBlocks(sb, opts.space, opts.booking_date, { start_time: opts.start_time, end_time: opts.end_time }, opts.excludeEntryId)
  const roomClosed = house.wholeRoomClosed
  for (const u of house.occupied) occupied.add(u)

  return roomUnits.map(u => ({
    id: u.id, name: u.name, seats: u.seats, parent_id: u.parent_id,
    available: !roomClosed && [...conflictSet(u.id)].every(cid => !occupied.has(cid)),
  }))
}
