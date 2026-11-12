'use client'

import { useEffect, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// THE PRINTABLE DOOR SHEETS — one A4 page per session.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ IT LIVES IN THE ADMIN AND NOT ON THE DOOR PHONE, which is where the brief
// put it, because the thing that needs it is a PRINTER. A phone cannot print,
// and a door device paired as `popup` cannot open a laptop's admin anyway. So
// this is printed at the club, on the way out, by whoever is carrying the
// folder — which is also the only moment it can be printed, since after that
// the phones are the live copy.
//
// WHAT IT IS FOR: the evening where a phone is flat, or the pocket router is
// down and stays down. Names, times, party sizes and a box to tick. Whatever
// is ticked on paper is entered the morning after through Reconciliation,
// which records that it came from paper rather than pretending the door
// scanned it.
//
// One page per session, forced, so the 19:00 sheet is never half-way down the
// 18:40 one with a queue outside.
// ═══════════════════════════════════════════════════════════════════════════

interface B {
  id: string; name: string; email: string | null; party_size: number
  status: string; ticket_code: string; session_id: string; source: string
}
interface S { session_id: string; idx: number; starts_at: string; ends_at: string; cap: number; booked: number }

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB',
  { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' })
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB',
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

export default function PopupPrint() {
  const [sessions, setSessions] = useState<S[]>([])
  const [bookings, setBookings] = useState<B[]>([])
  const [title, setTitle] = useState('')
  const [venue, setVenue] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [at, setAt] = useState('')

  useEffect(() => {
    fetch('/api/admin/popup', { cache: 'no-store' }).then(async r => {
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Could not read the pop-up.'); return }
      setSessions(j.sessions || []); setBookings(j.bookings || [])
      setTitle(j.event?.title_en || ''); setVenue(j.event?.venue_en || '')
      setAt(new Date(j.now).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' }))
    }).catch(() => setErr('Could not reach the server.'))
  }, [])

  if (err) return <div style={{ padding: 40, fontFamily: 'monospace', color: '#E5D4C2' }}>{err}</div>

  return (
    <>
      <div className="pp-bar">
        <button onClick={() => window.print()}>Print all {sessions.length} sheets</button>
        <span>One A4 page per session. Printed {at}.</span>
      </div>

      {sessions.map(s => {
        const rows = bookings
          .filter(b => b.session_id === s.session_id && b.status !== 'cancelled')
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        const confirmed = rows.filter(r => r.status === 'confirmed')
        const waiting = rows.filter(r => r.status === 'waiting')
        return (
          <article className="pp-page" key={s.session_id}>
            <header>
              <div className="pp-time">{hhmm(s.starts_at)}–{hhmm(s.ends_at)}</div>
              <div className="pp-meta">
                <div className="pp-title">{title}</div>
                <div>{venue}</div>
                <div>{day(s.starts_at)}</div>
                <div><b>{confirmed.reduce((n, r) => n + r.party_size, 0)}</b> booked of {s.cap} · session {s.idx + 1} of {sessions.length}</div>
              </div>
            </header>

            <table>
              <thead>
                <tr><th className="pp-tick">In</th><th>Name</th><th className="pp-n">Party</th><th className="pp-n">How many came</th><th>Code</th></tr>
              </thead>
              <tbody>
                {confirmed.map(r => (
                  <tr key={r.id}>
                    <td className="pp-tick"><span className="pp-box" /></td>
                    <td className="pp-name">{r.name}{r.source === 'door' ? ' (walk-up)' : ''}</td>
                    <td className="pp-n">{r.party_size}</td>
                    <td className="pp-n"><span className="pp-rule" /></td>
                    <td className="pp-code">{r.ticket_code}</td>
                  </tr>
                ))}
                {/* Room to write in anybody who turns up without a booking. */}
                {Array.from({ length: Math.max(3, 14 - confirmed.length) }, (_, i) => (
                  <tr key={`blank-${i}`} className="pp-blank">
                    <td className="pp-tick"><span className="pp-box" /></td>
                    <td><span className="pp-rule" /></td>
                    <td className="pp-n"><span className="pp-rule" /></td>
                    <td className="pp-n"><span className="pp-rule" /></td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>

            {waiting.length > 0 && (
              <section className="pp-wait">
                <h2>Waiting list — NOT a ticket</h2>
                <p>Only let these people in if the run sheet says a place has opened.</p>
                <ol>{waiting.map(r => <li key={r.id}>{r.name} · party of {r.party_size} · {r.ticket_code}</li>)}</ol>
              </section>
            )}

            <footer>
              <span>Door staff: ________________________</span>
              <span>Anything ticked here must be entered in Reconciliation afterwards — the door did not see it.</span>
            </footer>
          </article>
        )
      })}

      <style dangerouslySetInnerHTML={{ __html: `
        .pp-bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 14px;
                  padding: 12px 16px; background: #052E20; color: #E5D4C2;
                  font-family: 'Google Sans Code', monospace; font-size: 12px; }
        .pp-bar button { min-height: 40px; padding: 0 18px; border: none; border-radius: 6px;
                         background: #C9A84C; color: #052E20; font-family: 'Rampant Sans', serif;
                         font-size: 14px; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
        .pp-page { background: #fff; color: #111; width: 210mm; min-height: 297mm; box-sizing: border-box;
                   padding: 16mm 14mm; margin: 14px auto; font-family: 'Google Sans Code', monospace; }
        .pp-page header { display: flex; align-items: flex-start; gap: 14mm;
                          border-bottom: 2px solid #111; padding-bottom: 6mm; margin-bottom: 6mm; }
        .pp-time { font-family: 'Rampant Sans', serif; font-size: 52pt; line-height: .9; letter-spacing: -.02em; }
        .pp-meta { font-size: 9pt; line-height: 1.7; padding-top: 3mm; }
        .pp-title { font-family: 'Rampant Sans', serif; font-size: 13pt; letter-spacing: .06em; }
        table { width: 100%; border-collapse: collapse; font-size: 11pt; }
        th { text-align: left; font-size: 8pt; letter-spacing: .14em; text-transform: uppercase;
             font-weight: 400; border-bottom: 1px solid #111; padding: 2mm 1mm; }
        td { padding: 3.2mm 1mm; border-bottom: 1px solid #ccc; vertical-align: middle; }
        .pp-tick { width: 12mm; } .pp-n { width: 22mm; text-align: center; }
        .pp-name { font-size: 12pt; }
        .pp-code { font-size: 8pt; color: #666; letter-spacing: .1em; }
        .pp-box { display: block; width: 7mm; height: 7mm; border: 1.5px solid #111; }
        .pp-rule { display: block; height: 1px; background: #ddd; }
        .pp-blank td { border-bottom: 1px solid #e8e8e8; }
        .pp-wait { margin-top: 6mm; padding: 4mm; border: 1.5px solid #111; }
        .pp-wait h2 { font-family: 'Rampant Sans', serif; font-size: 11pt; margin: 0 0 1mm;
                      letter-spacing: .1em; text-transform: uppercase; }
        .pp-wait p { font-size: 8.5pt; margin: 0 0 2mm; }
        .pp-wait ol { font-size: 10pt; margin: 0; padding-left: 6mm; line-height: 1.8; }
        .pp-page footer { display: flex; justify-content: space-between; gap: 10mm; margin-top: 8mm;
                          padding-top: 3mm; border-top: 1px solid #111; font-size: 8pt; color: #444; }
        /* ⚠ ONE SESSION PER SHEET, FORCED. The 19:00 list half-way down the
           18:40 one is how the wrong names get read out at a door. */
        @media print {
          .pp-bar { display: none; }
          .pp-page { margin: 0; width: auto; min-height: auto; padding: 12mm;
                     break-after: page; page-break-after: always; }
          .pp-page:last-child { break-after: auto; page-break-after: auto; }
          @page { size: A4; margin: 0; }
        }
      ` }} />
    </>
  )
}
