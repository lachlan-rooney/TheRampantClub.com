import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────
// Named-table booking availability — the ONE guard used by both the POST
// (create) and PATCH (edit) booking routes. A silent double-book is the
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

const ACTIVE_STATUS = ['pending', 'confirmed', 'arrived']

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

export async function checkBookingAvailability(input: AvailabilityInput): Promise<AvailabilityResult> {
  const { sb, booking_date, start_time, end_time, session_label, party_size, excludeBookingId } = input
  const unitIds = [...new Set(input.unit_ids || [])]
  const reqWindow: BookingWindow = { start_time, end_time, session_label }
  let space = input.space

  // ── Unit-level checks (only when specific units were requested) ──────────
  if (unitIds.length > 0) {
    const { data: allUnits, error: uErr } = await sb
      .from('space_tables')
      .select('id, space, name, seats, parent_id')
    if (uErr) return { ok: false, status: 500, error: uErr.message }
    const units = (allUnits || []) as Unit[]
    const byId = new Map(units.map(u => [u.id, u]))
    const childrenOf = (id: string) => units.filter(u => u.parent_id === id)

    // Every requested unit must exist.
    const requested = unitIds.map(id => byId.get(id))
    const missingIdx = requested.findIndex(u => !u)
    if (missingIdx >= 0) return { ok: false, status: 400, error: `Unknown table (${unitIds[missingIdx]}).` }
    const reqUnits = requested as Unit[]

    // A booking lives in ONE room — all units must share a space.
    const spaces = [...new Set(reqUnits.map(u => u.space))]
    if (spaces.length > 1) return { ok: false, status: 400, error: `A booking can't span rooms (${spaces.join(', ')}). Pick tables in one room.` }
    space = spaces[0]

    // conflict(U) = {U} ∪ children(U) ∪ {parent(U)}  — derived from parent_id.
    const conflictSet = (id: string): Set<string> => {
      const s = new Set<string>([id])
      const u = byId.get(id)
      if (u?.parent_id) s.add(u.parent_id)
      for (const c of childrenOf(id)) s.add(c.id)
      return s
    }

    // (1) Inter-request: no two requested units may conflict with each other
    //     (e.g. Sofa-whole + a Sofa-segment in one booking).
    for (let i = 0; i < reqUnits.length; i++) {
      const ci = conflictSet(reqUnits[i].id)
      for (let j = 0; j < reqUnits.length; j++) {
        if (i !== j && ci.has(reqUnits[j].id)) {
          return { ok: false, status: 400, error: `${reqUnits[i].name} and ${reqUnits[j].name} can't be booked together — one contains the other.` }
        }
      }
    }

    // (2) Party ≤ seats: party must fit the combined seats of the chosen units.
    const totalSeats = reqUnits.reduce((sum, u) => sum + u.seats, 0)
    if (party_size > totalSeats) {
      return { ok: false, status: 409, error: `Party of ${party_size} exceeds the ${totalSeats} seat${totalSeats === 1 ? '' : 's'} of the chosen table${reqUnits.length === 1 ? '' : 's'}. Pick a larger table or add one.` }
    }

    // (3) Per-unit availability: an active booking on this date that holds any
    //     unit in conflict(Tᵢ) AND overlaps this window makes Tᵢ unavailable.
    const blockedIds = [...new Set(reqUnits.flatMap(u => [...conflictSet(u.id)]))]
    const { data: holds, error: hErr } = await sb
      .from('booking_tables')
      .select('unit_id, bookings!inner(booking_id, booking_date, start_time, end_time, session_label, status)')
      .in('unit_id', blockedIds)
      .eq('bookings.booking_date', booking_date)
      .in('bookings.status', ACTIVE_STATUS)
    if (hErr) return { ok: false, status: 500, error: hErr.message }

    for (const h of (holds || []) as unknown as { unit_id: string; bookings: (BookingWindow & { booking_id: string }) | (BookingWindow & { booking_id: string })[] }[]) {
      // PostgREST types a to-one embed as an array; it arrives as an object.
      const b = Array.isArray(h.bookings) ? h.bookings[0] : h.bookings
      if (!b) continue
      if (excludeBookingId && b.booking_id === excludeBookingId) continue   // editing a booking can't conflict with itself
      if (!windowsOverlap(reqWindow, b)) continue
      // Which requested unit does this existing hold block?
      const hit = reqUnits.find(u => conflictSet(u.id).has(h.unit_id))
      const heldName = byId.get(h.unit_id)?.name || 'another table'
      return { ok: false, status: 409, error: `${hit?.name || 'That table'} is already booked for that time (held as “${heldName}”). Pick another table or time.` }
    }
  }

  // ── Room closure (always — layered atop the unit check). Reuses timeOverlaps. ──
  const { data: blockers, error: cErr } = await sb
    .from('calendar_entries')
    .select('title, start_time, end_time, blocks_space')
    .eq('space', space).eq('entry_date', booking_date).eq('blocks_space', true)
  if (cErr) return { ok: false, status: 500, error: cErr.message }
  const blocked = (blockers || []).find(b => timeOverlaps(b as TimeWindow, { start_time, end_time }))
  if (blocked) {
    return { ok: false, status: 409, error: `${space} is closed on ${booking_date}${blocked.title ? ` — ${blocked.title}` : ''}. Pick another space or time.` }
  }

  return { ok: true, resolvedSpace: space }
}
