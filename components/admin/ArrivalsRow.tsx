'use client'

import { useCallback, useEffect, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ARRIVED · LEFT · +GUEST — the whole of marking someone in (2026-09-17)
// ───────────────────────────────────────────────────────────────────────────
// The owner: "Should be very easy for someone to mark guests arrived, booking
// beginning." One row per person, three buttons, no form and no second screen.
// Tap ARRIVED and their visit opens; tap LEFT and the departure is stamped,
// which is what finally gives the weekly report a length of stay.
//
// The same component serves the admin dashboard, the calendar and the tablet at
// the door — only the endpoint differs, because the door has a device rather
// than a login. Buttons are 44px tall: this is used standing up, on glass.

interface Row {
  key: string
  booking_id: string | null
  member_no: string | null
  name: string
  nickname: string | null
  time: string | null
  party: number | null
  space: string | null
  state: 'booked' | 'in' | 'left'
  visit_id: string | null
  since: string | null
  guests: number
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const MUTED = '#B2AA98'
const SAGE = '#7AB07A'

const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }) : ''

export default function ArrivalsRow({ endpoint = '/api/admin/arrivals', compact = false }: { endpoint?: string; compact?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [guestFor, setGuestFor] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch(endpoint, { cache: 'no-store' })
      if (!r.ok) { setRows([]); return }
      const j = await r.json()
      setRows(j.rows || []); setDate(j.date || '')
    } catch { setRows([]) }
  }, [endpoint])

  useEffect(() => {
    load()
    // Two members of staff may be marking people in at once, on a laptop and a
    // tablet. A minute's poll keeps them from undoing each other's work.
    const id = setInterval(load, 60_000)
    const onShow = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onShow)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onShow) }
  }, [load])

  const act = async (key: string, body: Record<string, unknown>) => {
    if (busy) return
    setBusy(key); setErr('')
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'That did not save.'); return }
      // Every action returns the fresh list, so the row updates without a reload.
      if (j.rows) { setRows(j.rows); setDate(j.date || date) } else load()
      setGuestFor(null); setGuestName('')
    } catch { setErr('That did not save.') }
    finally { setBusy(null) }
  }

  if (!rows) return null
  const here = rows.filter(r => r.state === 'in').length
  const waiting = rows.filter(r => r.state === 'booked').length

  return (
    <div style={wrap}>
      <div style={head}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: GOLD }}>
          Tonight{date ? ` · ${new Date(date + 'T00:00:00+07:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
          {here} in · {waiting} to come
        </span>
      </div>

      {rows.length === 0 && (
        <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, padding: '14px 2px' }}>
          Nobody booked today. Anyone who walks in appears here the moment their visit starts.
        </div>
      )}

      {rows.map(r => (
        <div key={r.key} style={{ ...row, opacity: r.state === 'left' ? .55 : 1 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: SERIF, fontSize: 17, color: CREAM, lineHeight: 1.2 }}>
              {r.name}{r.nickname ? <span style={{ color: MUTED, fontSize: 13 }}> · {r.nickname}</span> : null}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 3 }}>
              {[r.time, r.party ? `${r.party}p` : null, r.space, r.guests ? `${r.guests} guest${r.guests === 1 ? '' : 's'}` : null]
                .filter(Boolean).join(' · ') || 'walk-in'}
              {r.state === 'in' && r.since ? <span style={{ color: SAGE }}> · in since {hhmm(r.since)}</span> : null}
              {r.state === 'left' ? ' · left' : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {r.state === 'booked' && (
              <button onClick={() => act(r.key, {
                        action: 'arrived', member_no: r.member_no, booking_id: r.booking_id,
                        // A row keyed e:<id> is a diary party — a private booking
                        // with no member behind it (2026-09-25).
                        entry_id: r.key.startsWith('e:') ? r.key.slice(2) : undefined,
                      })}
                      disabled={busy === r.key} style={primary}>
                {busy === r.key ? '…' : 'Arrived'}
              </button>
            )}
            {/* A diary party has nobody to walk back out and no visit to
                close, so it is marked in and left at that — the entry's own
                end time is what the club has. */}
            {r.state === 'in' && !r.visit_id && r.key.startsWith('e:') && (
              <span style={{ ...ghost, opacity: .5, cursor: 'default' }}>In</span>
            )}
            {r.state === 'in' && r.visit_id && (
              <button onClick={() => act(r.key, { action: 'left', visit_id: r.visit_id })}
                      disabled={busy === r.key} style={ghost}>
                {busy === r.key ? '…' : 'Left'}
              </button>
            )}
            {r.state !== 'left' && (
              <button onClick={() => { setGuestFor(guestFor === r.key ? null : r.key); setGuestName('') }} style={ghost}>
                + Guest
              </button>
            )}
          </div>

          {guestFor === r.key && (
            // A NAME AND NOTHING ELSE — the owner's call. The door iPad still
            // takes a signature; this is for a guest already standing at the bar.
            <form
              style={{ flexBasis: '100%', display: 'flex', gap: 8, marginTop: 8 }}
              onSubmit={e => { e.preventDefault(); if (guestName.trim()) act(r.key, { action: 'guest', name: guestName, member_no: r.member_no }) }}
            >
              <input autoFocus value={guestName} onChange={e => setGuestName(e.target.value)}
                     placeholder="Guest's name" style={input} />
              <button type="submit" disabled={!guestName.trim() || busy === r.key} style={{ ...primary, opacity: guestName.trim() ? 1 : .4 }}>
                Add
              </button>
              <button type="button" onClick={() => { setGuestFor(null); setGuestName('') }} style={ghost}>Cancel</button>
            </form>
          )}
        </div>
      ))}

      {err && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginTop: 8 }}>{err}</div>}
      {!compact && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, opacity: .6, marginTop: 10 }}>
          Arrived opens their visit · Left records how long they stayed · guests need only a first name
        </div>
      )}
    </div>
  )
}

const wrap: React.CSSProperties = {
  border: '1px solid rgba(212,184,90,0.22)', borderRadius: 12, padding: '14px 16px',
  background: 'rgba(212,184,90,0.04)', marginBottom: 18,
}
const head: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  borderBottom: '1px solid rgba(229,212,194,0.12)', paddingBottom: 8, marginBottom: 6, gap: 12, flexWrap: 'wrap',
}
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  padding: '10px 0', borderBottom: '1px solid rgba(229,212,194,0.07)',
}
const primary: React.CSSProperties = {
  minHeight: 44, padding: '0 20px', borderRadius: 8, cursor: 'pointer',
  background: CREAM, color: '#052E20', border: 'none',
  fontFamily: MONO, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase',
}
const ghost: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 8, cursor: 'pointer',
  background: 'none', color: CREAM, border: '1px solid rgba(229,212,194,0.28)',
  fontFamily: MONO, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase',
}
const input: React.CSSProperties = {
  flex: 1, minWidth: 140, minHeight: 44, padding: '0 12px', borderRadius: 8,
  background: 'rgba(229,212,194,0.07)', border: '1px solid rgba(229,212,194,0.22)',
  color: CREAM, fontFamily: MONO, fontSize: 14, outline: 'none',
}
