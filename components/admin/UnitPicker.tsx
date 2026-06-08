'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'

// Table-picker for member bookings. Shows ALL units in a room (staff see the
// whole room's state), greying the unavailable ones. Greyed = taken for this
// window (server availability) OR conflicts via the either-or with the current
// selection (client mirror of conflict() = {U} ∪ children ∪ parent, derived
// from parent_id). The SERVER guard is the source of truth; this is UX.

interface Unit { id: string; name: string; seats: number; parent_id: string | null; available: boolean }

interface Props {
  space: string
  date: string
  startTime: string
  endTime: string
  sessionLabel: string
  partySize: number
  selected: string[]
  onChange: (ids: string[]) => void
  onSeatsChange?: (seats: number) => void
  excludeBookingId?: string
  excludeEntryId?: string
  mode?: 'booking' | 'house'
}

export default function UnitPicker({ space, date, startTime, endTime, sessionLabel, partySize, selected, onChange, onSeatsChange, excludeBookingId, excludeEntryId, mode = 'booking' }: Props) {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!space) { setUnits([]); return }
    const params = new URLSearchParams({ space })
    if (date) params.set('date', date)
    if (startTime) params.set('start', startTime)
    if (endTime) params.set('end', endTime)
    if (sessionLabel) params.set('session', sessionLabel)
    if (excludeBookingId) params.set('booking', excludeBookingId)
    if (excludeEntryId) params.set('entry', excludeEntryId)
    setLoading(true)
    fetch(`/api/admin/bookings/availability?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setUnits(d.units || []) })
      .finally(() => setLoading(false))
  }, [space, date, startTime, endTime, sessionLabel, excludeBookingId, excludeEntryId])

  // Prune any selected ids that aren't in this room (e.g. after a room change).
  useEffect(() => {
    if (!units.length) return
    const present = new Set(units.map(u => u.id))
    const kept = selected.filter(id => present.has(id))
    if (kept.length !== selected.length) onChange(kept)
  }, [units]) // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(units.map(u => [u.id, u])), [units])
  // conflict(U) = {U} ∪ children ∪ parent — from parent_id (same as the server).
  const conflictOf = useCallback((id: string) => {
    const s = new Set<string>([id])
    const u = byId.get(id)
    if (u?.parent_id) s.add(u.parent_id)
    for (const c of units) if (c.parent_id === id) s.add(c.id)
    return s
  }, [byId, units])

  // Units in conflict with the current selection (greyed unless themselves selected).
  const selectedConflicts = useMemo(() => {
    const set = new Set<string>()
    for (const sid of selected) for (const c of conflictOf(sid)) set.add(c)
    return set
  }, [selected, conflictOf])

  const selectedSeats = useMemo(
    () => selected.reduce((sum, id) => sum + (byId.get(id)?.seats || 0), 0),
    [selected, byId]
  )
  useEffect(() => { onSeatsChange?.(selectedSeats) }, [selectedSeats]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (u: Unit) => {
    if (selected.includes(u.id)) { onChange(selected.filter(x => x !== u.id)); return }
    const blocked = !u.available || (selectedConflicts.has(u.id))
    if (blocked) return
    onChange([...selected, u.id])
  }

  if (!space) return null

  return (
    <div style={{ marginTop: 6 }}>
      <div style={labelRow}>
        <div style={editLabel}>{mode === 'house' ? 'Tables this occupies' : 'Tables'}</div>
        {selected.length > 0 && (
          mode === 'house' ? (
            <div style={{ ...seatCounter, color: '#B2AA98' }}>{selected.length} table{selected.length === 1 ? '' : 's'} selected</div>
          ) : (
            <div style={{ ...seatCounter, color: selectedSeats >= partySize ? '#7AB07A' : '#C27070' }}>
              {selectedSeats} seat{selectedSeats === 1 ? '' : 's'} selected · party {partySize}
              {selectedSeats < partySize ? ' — too few' : ''}
            </div>
          )
        )}
      </div>

      {loading ? (
        <div style={hint}>Checking availability…</div>
      ) : units.length === 0 ? (
        <div style={hint}>No bookable tables in this room.</div>
      ) : (
        <div style={grid}>
          {units.map(u => {
            const isSel = selected.includes(u.id)
            const conflictBlocked = !isSel && selectedConflicts.has(u.id)
            const takenBlocked = !isSel && !u.available
            const disabled = conflictBlocked || takenBlocked
            const reason = takenBlocked ? 'Taken for this time' : conflictBlocked ? 'Conflicts with your selection' : ''
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u)}
                title={reason}
                style={{
                  ...chip,
                  ...(u.parent_id ? { marginLeft: 16 } : null),
                  ...(isSel ? chipSelected : disabled ? chipDisabled : chipAvailable),
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ lineHeight: 1.2 }}>{u.parent_id ? '↳ ' : ''}{u.name}</span>
                  <span style={chipSeats}>{u.seats} seat{u.seats === 1 ? '' : 's'}{disabled ? ` · ${reason}` : ''}</span>
                </span>
                {isSel && <span style={{ color: '#D4B85A', fontSize: 13 }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ ...hint, marginTop: 8 }}>
        {mode === 'house'
          ? 'Pick the tables this entry occupies — only those are blocked (the rest of the room stays bookable). Pick none to close the whole room. Greyed = already taken for this time.'
          : 'Greyed = taken for this time or blocked by the either-or (booking the whole sofa frees no segments, and vice-versa). Pick one or more tables; their seats must cover the party.'}
      </div>
    </div>
  )
}

const labelRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }
const editLabel: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase' }
const seatCounter: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 10, letterSpacing: '0.04em' }
const grid: React.CSSProperties = { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginTop: 8 }
const chip: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
  padding: '10px 12px', borderRadius: 6, textAlign: 'left',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12, cursor: 'pointer',
  boxSizing: 'border-box', width: '100%',
}
const chipAvailable: React.CSSProperties = { background: 'rgba(5,46,32,0.4)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)' }
const chipSelected: React.CSSProperties = { background: 'rgba(212,184,90,0.14)', color: '#E5D4C2', border: '1px solid rgba(212,184,90,0.5)' }
const chipDisabled: React.CSSProperties = { background: 'rgba(5,46,32,0.2)', color: '#6E7A6E', border: '1px solid rgba(229,212,194,0.05)', cursor: 'not-allowed', opacity: 0.55 }
const chipSeats: React.CSSProperties = { fontSize: 9, color: '#B2AA98', opacity: 0.7 }
const hint: React.CSSProperties = { fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.7, letterSpacing: '0.03em' }
