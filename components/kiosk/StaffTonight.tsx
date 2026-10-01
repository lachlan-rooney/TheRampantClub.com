'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'

// TONIGHT — WHO IS BOOKED, AND WHO THEY ARE BRINGING.
//
// The three arrival buttons already live above this on the same screen. What
// they could never show is the GUEST LIST: members and the desk have been able
// to name a booking's guests since the door tablet was built, and the floor
// has been reading "party of 5" off a row that knew four of the five names.
//
// ── A NAME IS NOT THE SAME AS A PERSON WHO IS HERE ────────────────────────
// Each guest shows whether they have signed in downstairs. Those two states
// are completely different jobs on the floor — one is "take them up", the
// other is "they are still to arrive" — so they are drawn differently rather
// than listed together with a tick nobody reads mid-service.
//
// ── IT DRAWS THE DIARY ON THE SAME LIST ───────────────────────────────────
// A staff-booked private party is a calendar entry with no member behind it.
// On the floor it is indistinguishable from a booking, so it sits in the same
// ordered list with its own mark, not in a section somebody has to remember
// to scroll to.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GOLD = '#D4B85A'

export interface Guest { name: string; signed_in: boolean; by: 'member' | 'staff' }
export interface TonightRow {
  kind: 'booking' | 'party'
  id: string
  time: string | null
  name: string
  name_vn?: string | null
  nickname?: string | null
  space: string | null
  party: number | null
  arrived: boolean
  guests?: Guest[]
  awaited?: number
  arrived_covers?: number | null
}
export interface Tonight {
  date: string
  guest_names_ready: boolean
  rows: TonightRow[]
  whats_on: { kind: 'fixture' | 'house'; title: string; title_vn: string | null; type: string; time: string | null; space: string | null; taken: number | null; seats: number | null }[]
  totals: { booked: number; covers: number; guests_named: number; guests_awaited: number }
}

export default function StaffTonight({ initial }: { initial?: Tonight | null }) {
  const { t } = useLang()
  const [data, setData] = useState<Tonight | null>(initial || null)
  const [err, setErr] = useState('')

  // Refreshed on open even when the hub handed one down: the hub's copy may be
  // half a minute old, and half a minute is two arrivals on a busy Friday.
  useEffect(() => {
    let live = true
    const read = () => fetch('/api/kiosk/staff/tonight', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no'))))
      .then(j => { if (live) setData(j) })
      .catch(() => { if (live && !initial) setErr(t('Could not read tonight.', 'Không đọc được dữ liệu tối nay.')) })
    read()
    const id = setInterval(read, 45_000)
    return () => { live = false; clearInterval(id) }
  }, [initial, t])

  if (err) return <p className="st-quiet">{err}</p>
  if (!data) return <p className="st-quiet">…</p>

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="st-sum">
        <Sum n={data.totals.booked} label={t('booked', 'đã đặt')} />
        <Sum n={data.totals.covers} label={t('covers', 'suất')} />
        {data.totals.guests_named > 0 && <Sum n={data.totals.guests_named} label={t('guests named', 'khách có tên')} />}
        {data.totals.guests_awaited > 0 && <Sum n={data.totals.guests_awaited} label={t('still to come', 'chưa đến')} gold />}
      </div>

      {!data.guest_names_ready && (
        <p className="st-quiet">{t('Guest names are not switched on yet — party sizes only.',
                                   'Chức năng tên khách chưa bật — chỉ có số suất.')}</p>
      )}

      {data.rows.length === 0 && (
        <p className="st-quiet">{t('Nothing in the book for tonight. Walk-ins go on the list above.',
                                   'Tối nay chưa có đặt chỗ nào. Khách tự đến ghi ở danh sách phía trên.')}</p>
      )}

      <ul className="st-list">
        {data.rows.map(r => (
          <li key={`${r.kind}:${r.id}`} className="st-row">
            <div className="st-when">
              <span className="st-time">{r.time || '—'}</span>
              {r.space && <span className="st-space">{r.space}</span>}
            </div>
            <div className="st-who">
              <div className="st-name">
                {r.kind === 'party' ? (t(r.name, r.name_vn || r.name)) : r.name}
                {r.nickname && <span className="st-nick">{r.nickname}</span>}
              </div>
              <div className="st-meta">
                {r.kind === 'party' && <span className="st-tag">{t('Private party', 'Tiệc riêng')}</span>}
                {r.party != null && <span>{r.party} {t('covers', 'suất')}</span>}
                <span className={r.arrived ? 'st-in' : 'st-out'}>
                  {r.arrived ? t('in', 'đã vào') : t('not in yet', 'chưa vào')}
                </span>
              </div>

              {/* THE GUESTS, BY NAME. Here and nowhere else on this screen —
                  the member dossier is a separate view behind the same PIN. */}
              {!!r.guests?.length && (
                <ul className="st-guests">
                  {r.guests.map((g, i) => (
                    <li key={i} className={g.signed_in ? 'st-g st-g-in' : 'st-g'}>
                      <span className="st-g-dot" />
                      <span className="st-g-name">{g.name}</span>
                      <span className="st-g-state">
                        {g.signed_in
                          ? t('signed in', 'đã ký')
                          : g.by === 'member' ? t('named by the member', 'hội viên đã báo') : t('named by us', 'chúng ta đã ghi')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Sum({ n, label, gold }: { n: number; label: string; gold?: boolean }) {
  return (
    <div className="st-sum-i">
      <div className="st-sum-n" style={gold ? { color: GOLD } : undefined}>{n}</div>
      <div className="st-sum-l">{label}</div>
    </div>
  )
}

const CSS = `
.st-quiet { font-family: ${MONO}; font-size: 12px; line-height: 1.85; color: #B2AA98; opacity: .72; margin: 14px 0 0; max-width: 58ch; }

.st-sum { display: flex; gap: 28px; flex-wrap: wrap; margin: 4px 0 18px; }
.st-sum-n { font-family: ${SERIF}; font-size: 26px; color: ${INK}; line-height: 1; }
.st-sum-l { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
            color: rgba(229,212,194,.45); margin-top: 6px; }

.st-list { list-style: none; margin: 0; padding: 0; }
.st-row { display: flex; gap: 18px; align-items: flex-start; padding: 15px 2px;
          border-top: 1px solid rgba(229,212,194,.12); }
.st-row:last-child { border-bottom: 1px solid rgba(229,212,194,.12); }
.st-when { flex: 0 0 76px; }
.st-time { display: block; font-family: ${SERIF}; font-size: 20px; color: ${INK}; }
.st-space { display: block; font-family: ${MONO}; font-size: 9.5px; letter-spacing: .1em;
            text-transform: uppercase; color: rgba(229,212,194,.45); margin-top: 4px; }
.st-who { flex: 1 1 auto; min-width: 0; }
.st-name { font-family: ${SERIF}; font-size: 19px; color: ${INK}; }
.st-nick { font-family: ${MONO}; font-size: 11px; color: rgba(229,212,194,.5); margin-left: 9px; }
.st-meta { display: flex; gap: 14px; flex-wrap: wrap; font-family: ${MONO}; font-size: 10px;
           letter-spacing: .1em; text-transform: uppercase; color: rgba(229,212,194,.5); margin-top: 6px; }
.st-tag { color: ${GOLD}; opacity: .85; }
.st-in { color: #8FC48F; }
.st-out { color: rgba(229,212,194,.4); }

.st-guests { list-style: none; margin: 11px 0 0; padding: 0 0 0 1px; }
.st-g { display: flex; align-items: baseline; gap: 9px; padding: 5px 0; }
.st-g-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(229,212,194,.3); flex: 0 0 5px; }
.st-g-in .st-g-dot { background: #8FC48F; }
.st-g-name { font-family: ${SERIF}; font-size: 16px; color: rgba(229,212,194,.72); }
.st-g-in .st-g-name { color: ${INK}; }
.st-g-state { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase;
              color: rgba(229,212,194,.38); }
.st-g-in .st-g-state { color: #8FC48F; opacity: .8; }

@media (max-width: 560px) {
  .st-row { gap: 12px; }
  .st-when { flex: 0 0 58px; }
  .st-time { font-size: 17px; }
}
`
