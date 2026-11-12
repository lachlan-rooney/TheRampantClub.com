'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 8 · THE MORNING AFTER — entering what was ticked on paper.
// ───────────────────────────────────────────────────────────────────────────
// Opens on the only list that matters: people who were booked and have no tick
// against them. Each one is one tap — came in, or did not — and the number who
// came in if it was not the whole party.
//
// ⚠ IT SHOUTS IF THE FOLLOW-UP HAS ALREADY GONE, because the follow-up only
// reaches people who were admitted. Entering a paper tick afterwards fixes the
// record but cannot un-send the email that person never got.
// ═══════════════════════════════════════════════════════════════════════════

interface B {
  id: string; name: string; email: string | null; party_size: number; status: string
  ticket_code: string; session_id: string; source: string
  admitted_at: string | null; admitted_by: string | null; admitted_party: number | null
  admitted_offline: boolean; reconciled_at: string | null; reconcile_note: string | null
  taken_by: string | null; consent_marketing: boolean; followup_sent_at: string | null
}
interface S { session_id: string; starts_at: string }
interface Sum {
  booked_people: number; arrived_people: number; never_ticked: number
  taken_offline: number; already_reconciled: number; followup_already_sent: number
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const hhmm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-GB',
  { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }) : '--:--'

export default function Reconcile() {
  const [rows, setRows] = useState<B[]>([])
  const [sessions, setSessions] = useState<S[]>([])
  const [sum, setSum] = useState<Sum | null>(null)
  const [gone, setGone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('ticked on the printed sheet')
  const [show, setShow] = useState<'missing' | 'all'>('missing')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/popup/reconcile', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Could not read the evening.'); return }
      setErr(null); setRows(j.bookings || []); setSessions(j.sessions || [])
      setSum(j.summary); setGone(!!j.followup_gone)
    } catch { setErr('Could not reach the server.') }
  }, [])
  useEffect(() => { load() }, [load])

  const one = async (b: B, arrived: boolean, party: number | null) => {
    setBusy(true)
    try {
      await fetch('/api/admin/popup/reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'one', booking_id: b.id, arrived, party, note }) })
      await load()
    } finally { setBusy(false) }
  }

  const timeOf = useMemo(() => {
    const m = new Map(sessions.map(s => [s.session_id, s.starts_at]))
    return (id: string) => hhmm(m.get(id) || null)
  }, [sessions])

  const list = useMemo(() => rows
    .filter(r => r.status === 'confirmed')
    .filter(r => show === 'all' || !r.admitted_at)
    .sort((a, b) => timeOf(a.session_id).localeCompare(timeOf(b.session_id))
      || a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
  [rows, show, timeOf])

  if (err) return <div style={bad}>{err}</div>

  return (
    <div style={{ maxWidth: 940 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, color: '#E5D4C2', margin: 0 }}>Reconciliation</h1>
        <Link href="/admin/popup" style={link}>← Run sheet</Link>
      </div>
      <p style={{ ...muted, margin: '6px 0 20px' }}>
        What was ticked on paper, entered before the follow-up goes out — because the follow-up only
        reaches people who were admitted. Anything entered here is marked as having come from the sheet,
        so it never reads as something the door saw live.
      </p>

      {gone && (
        <div style={{ ...card, borderColor: '#C27070', background: '#C2707014' }}>
          <b style={{ fontFamily: SERIF, color: '#E5D4C2' }}>The follow-up has already been sent.</b>
          <p style={{ ...muted, margin: '6px 0 0' }}>
            Entering a tick now corrects the record, but the person it belongs to did not get that email.
            Send them one by hand if it matters.
          </p>
        </div>
      )}

      {sum && (
        <div style={grid}>
          <Cell n={sum.booked_people} label="people booked" />
          <Cell n={sum.arrived_people} label="recorded as in" />
          <Cell n={sum.never_ticked} label="never ticked" warn={sum.never_ticked > 0} />
          <Cell n={sum.taken_offline} label="ticked offline" />
          <Cell n={sum.already_reconciled} label="from paper" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '18px 0 12px' }}>
        <button style={{ ...btn, ...(show === 'missing' ? btnOn : {}) }} onClick={() => setShow('missing')}>
          Not ticked ({rows.filter(r => r.status === 'confirmed' && !r.admitted_at).length})
        </button>
        <button style={{ ...btn, ...(show === 'all' ? btnOn : {}) }} onClick={() => setShow('all')}>Everybody</button>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="note kept against each entry"
               style={{ ...input, flex: '1 1 260px' }} />
      </div>

      {list.length === 0 && (
        <div style={{ ...card, textAlign: 'center' }}>
          <b style={{ fontFamily: SERIF, color: '#E5D4C2' }}>Nothing left to enter.</b>
          <p style={{ ...muted, margin: '6px 0 0' }}>Every booking has an answer against it.</p>
        </div>
      )}

      {list.map(b => (
        <div key={b.id} style={rowStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#E5D4C2', fontSize: 14 }}>
              {b.name}
              {b.admitted_at && <span style={pillIn}>IN {hhmm(b.admitted_at)}{b.admitted_party != null ? ` · ${b.admitted_party}` : ''}</span>}
              {b.reconciled_at && <span style={pillPaper}>FROM PAPER</span>}
              {b.admitted_offline && <span style={pillOff}>OFFLINE</span>}
            </div>
            <div style={{ fontSize: 10, color: '#7E7864', marginTop: 2 }}>
              {timeOf(b.session_id)} · {b.party_size > 1 ? `party of ${b.party_size}` : 'one'}
              {b.email ? ` · ${b.email}` : ' · no email'}
              {b.taken_by ? ` · taken by ${b.taken_by}` : ''}
              {b.admitted_by ? ` · ${b.admitted_by}` : ''}
              {b.reconcile_note ? ` · “${b.reconcile_note}”` : ''}
              {' · '}{b.ticket_code}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Array.from({ length: b.party_size }, (_, i) => i + 1).map(n => (
              <button key={n} disabled={busy} style={{ ...btn, minWidth: 40, ...(b.admitted_party === n ? btnOn : {}) }}
                      onClick={() => one(b, true, n)}>
                {b.party_size > 1 ? n : 'Came in'}
              </button>
            ))}
            <button disabled={busy} style={btnBad} onClick={() => one(b, false, null)}>Did not come</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Cell({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div style={{ border: '1px solid #ffffff1f', borderRadius: 8, padding: 14 }}>
      <div style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1, color: warn ? '#C9A84C' : '#E5D4C2' }}>{n}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7E7864', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: .8, lineHeight: 1.7, maxWidth: '76ch' }
const bad: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#C27070', padding: 20, border: '1px solid #C27070', borderRadius: 8 }
const card: React.CSSProperties = { border: '1px solid #ffffff1f', borderRadius: 8, padding: 16, marginBottom: 16 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #ffffff12', flexWrap: 'wrap' }
const btn: React.CSSProperties = { minHeight: 34, padding: '0 12px', borderRadius: 5, border: '1px solid #ffffff2e', background: 'transparent', color: '#E5D4C2', fontFamily: MONO, fontSize: 12, cursor: 'pointer' }
const btnOn: React.CSSProperties = { background: '#7FA86B', color: '#052E20', borderColor: '#7FA86B' }
const btnBad: React.CSSProperties = { ...btn, borderColor: '#C2707059', color: '#C27070' }
const input: React.CSSProperties = { minHeight: 34, padding: '0 10px', borderRadius: 5, border: '1px solid #ffffff2e', background: '#ffffff0a', color: '#E5D4C2', fontFamily: MONO, fontSize: 12 }
const link: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#C9A84C', textDecoration: 'none' }
const pillBase: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', padding: '2px 6px', borderRadius: 3, marginLeft: 8 }
const pillIn: React.CSSProperties = { ...pillBase, background: '#7FA86B', color: '#052E20' }
const pillPaper: React.CSSProperties = { ...pillBase, background: 'transparent', border: '1px solid #C9A84C', color: '#C9A84C' }
const pillOff: React.CSSProperties = { ...pillBase, background: 'transparent', border: '1px solid #B2AA98', color: '#B2AA98' }
