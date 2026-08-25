'use client'

// Admin → Membership Finance
//
// Record a member's annual fee → mints a branded receipt + starts a one-year
// membership period + emails the receipt. Mirrors the Member Cards page: same
// inline-style system, toast, and branded confirm modal. Money is recorded via
// the admin-gated /api/admin/membership/payments route (atomic SQL RPC).

import { useEffect, useMemo, useRef, useState } from 'react'

interface RosterRow {
  member_no: string
  full_name: string
  tier: string
  paid_through: string | null
  days_to_renewal: number | null
  complimentary: boolean
  state: 'paid' | 'due_soon' | 'grace' | 'overdue' | 'never'
  last_payment: { amount_vnd: number; payment_date: string; receipt_no: string } | null
  default_fee: number
}
interface PaymentRow {
  id: string
  receipt_no: string
  amount_vnd: number
  payment_method: string
  payment_date: string
  fee_kind: string
  status: string
  note: string | null
  staff_email: string | null
  pdf_path: string | null
  created_at: string
}

const fmt = (vnd: number) => new Intl.NumberFormat('en-US').format(vnd) + ' ₫'
const vnToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const STATE_META: Record<RosterRow['state'], { label: string; color: string }> = {
  paid:     { label: 'Paid',      color: '#7AB07A' },
  due_soon: { label: 'Due soon',  color: '#D4B85A' },
  grace:    { label: 'In grace',  color: '#C49555' },
  overdue:  { label: 'Overdue',   color: '#B45656' },
  never:    { label: 'No record', color: '#B2AA98' },
}
const METHODS = [
  { v: 'bank_transfer', l: 'Bank Transfer' },
  { v: 'cash', l: 'Cash' },
  { v: 'card_offline', l: 'Card' },
  { v: 'other', l: 'Other' },
]
const FEE_KINDS = [
  { v: 'membership_fee', l: 'Annual Membership Fee' },
  { v: 'renewal', l: 'Renewal' },
  { v: 'honorary', l: 'Honorary / Complimentary — no charge' },
  { v: 'joining_fee', l: 'Joining Fee (no period)' },
  { v: 'proration', l: 'Pro-rata' },
]

// days_to_renewal → a short, staff-facing renewal string.
function renewsIn(row: RosterRow): { text: string; color: string } {
  if (row.days_to_renewal == null) return { text: '—', color: '#7E7864' }
  const d = row.days_to_renewal
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, color: '#B45656' }
  if (d === 0) return { text: 'today', color: '#C49555' }
  const color = d <= 30 ? '#D4B85A' : '#B2AA98'
  return { text: `${d}d`, color }
}

export default function AdminMembership() {
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // form
  const [memberNo, setMemberNo] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [date, setDate] = useState(vnToday())
  const [feeKind, setFeeKind] = useState('membership_fee')
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')
  const idempotencyRef = useRef<string>(cryptoUuid())

  // history
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [history, setHistory] = useState<PaymentRow[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  const loadRoster = async () => {
    const r = await fetch('/api/admin/membership/roster', { cache: 'no-store' })
    const d = await r.json()
    setRoster(d.roster || [])
    setLoading(false)
  }
  useEffect(() => { loadRoster() }, [])

  const selected = useMemo(() => roster.find(m => m.member_no === memberNo) || null, [roster, memberNo])

  const onPickMember = (no: string) => {
    setMemberNo(no)
    const m = roster.find(r => r.member_no === no)
    if (m && (feeKind === 'membership_fee' || feeKind === 'renewal') && m.default_fee > 0) {
      setAmount(String(m.default_fee))
    }
  }

  const honorary = feeKind === 'honorary'
  const amountNum = Math.round(Number(amount.replace(/[^0-9]/g, '')))
  const canSubmit = !!memberNo && /^\d{4}-\d{2}-\d{2}$/.test(date) && (honorary || (Number.isFinite(amountNum) && amountNum > 0))

  const doRecord = async () => {
    if (!selected || !canSubmit) return
    setBusy(true)
    const endpoint = honorary ? '/api/admin/membership/activate' : '/api/admin/membership/payments'
    const payload = honorary
      ? { member_no: selected.member_no, member_name: selected.full_name, tier: selected.tier, start_date: date, note: note || null }
      : {
          member_no: selected.member_no, member_name: selected.full_name, tier: selected.tier,
          amount_vnd: amountNum, payment_method: method, payment_date: date,
          fee_kind: feeKind, note: note || null, email: email || null,
          idempotency_key: idempotencyRef.current,
        }
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setBusy(false); setConfirmOpen(false)
    if (r.ok) {
      const d = await r.json()
      showToast(honorary
        ? `Activated ${selected.full_name}${d.period ? ` — through ${fmtDate(d.period.end)}` : ''}`
        : `Recorded ${d.receipt_no}${d.period ? ` · paid through ${fmtDate(d.period.end)}` : ''}`)
      setAmount(''); setNote(''); setEmail(''); idempotencyRef.current = cryptoUuid()
      loadRoster()
      if (historyFor === selected.member_no) openHistory(selected.member_no)
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Failed: ${d.error || r.statusText}`)
    }
  }

  const openHistory = async (no: string) => {
    setHistoryFor(no); setHistory([])
    const r = await fetch(`/api/admin/membership/payments?member_no=${encodeURIComponent(no)}`, { cache: 'no-store' })
    const d = await r.json()
    setHistory(d.payments || [])
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { paid: 0, due_soon: 0, grace: 0, overdue: 0, never: 0 }
    for (const m of roster) c[m.state]++
    return c
  }, [roster])

  return (
    <>
      <h1 style={h1}>Membership Finance</h1>
      <p style={sub}>
        Record membership fees, issue branded receipts, and track renewals. Recording a fee mints a
        receipt and starts a one-year membership period from the payment date.
      </p>

      {/* Record payment */}
      <div style={card}>
        <div style={sectionLabel}>Record a payment</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <label style={label}>Member</label>
            <select style={input} value={memberNo} onChange={e => onPickMember(e.target.value)}>
              <option value="">— select member —</option>
              {roster.map(m => (
                <option key={m.member_no} value={m.member_no}>
                  {m.member_no} · {m.full_name} ({m.tier || 'No tier'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Fee type</label>
            <select style={input} value={feeKind} onChange={e => {
              const v = e.target.value
              setFeeKind(v)
              if (v === 'honorary') { setAmount(''); setEmail('') }
              else if ((v === 'membership_fee' || v === 'renewal') && selected?.default_fee) setAmount(String(selected.default_fee))
            }}>
              {FEE_KINDS.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Amount (VND){!honorary && selected && selected.default_fee > 0 ? ` · tier default ${fmt(selected.default_fee)}` : ''}</label>
            {honorary ? (
              <div style={{ ...input, opacity: 0.55, display: 'flex', alignItems: 'center' }}>No charge — complimentary</div>
            ) : (
              <>
                <input style={input} inputMode="numeric" placeholder="e.g. 130000000" value={amount} onChange={e => setAmount(e.target.value)} />
                {amountNum > 0 && <div style={hint}>{fmt(amountNum)}</div>}
              </>
            )}
          </div>
          <div>
            <label style={label}>Payment method</label>
            <select style={{ ...input, opacity: honorary ? 0.5 : 1 }} value={method} disabled={honorary} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>{honorary ? 'Start date' : 'Payment date'}</label>
            <input style={input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={label}>Member email {honorary ? '(not needed)' : '(optional override)'}</label>
            <input style={{ ...input, opacity: honorary ? 0.5 : 1 }} disabled={honorary} placeholder={honorary ? 'no email required' : 'leave blank to use their on-file email'} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={label}>Note (optional)</label>
          <input style={input} placeholder="e.g. Founding member — negotiated dues" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...btnPrimary, opacity: canSubmit && !busy ? 1 : 0.4 }} disabled={!canSubmit || busy} onClick={() => setConfirmOpen(true)}>
            {honorary ? 'Activate membership' : 'Record payment & issue receipt'}
          </button>
          {selected && <span style={hint}>{honorary
            ? `Starts a complimentary one-year membership — no charge, no email, no reminders.`
            : `Receipt will be emailed and appear in ${selected.full_name}’s My Membership.`}</span>}
        </div>
      </div>

      {/* Roster summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '24px 0 12px' }}>
        {(['paid', 'due_soon', 'grace', 'overdue', 'never'] as const).map(s => (
          <div key={s} style={pill}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_META[s].color, display: 'inline-block' }} />
            <span>{STATE_META[s].label}</span>
            <strong style={{ color: '#E5D4C2' }}>{counts[s]}</strong>
          </div>
        ))}
      </div>

      {/* Roster table */}
      <div style={card}>
        <div style={sectionLabel}>Members</div>
        {loading ? <div style={hint}>Loading…</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr>{['Member', 'Tier', 'Status', 'End date', 'Renews in', 'Last payment', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {roster.map(m => {
                  const r = renewsIn(m)
                  return (
                  <tr key={m.member_no} style={{ borderTop: '1px solid rgba(229,212,194,0.06)' }}>
                    <td style={td}><span style={{ color: '#E5D4C2' }}>{m.full_name}</span><span style={{ color: '#7E7864' }}> · {m.member_no}</span></td>
                    <td style={td}>{m.tier || '—'}</td>
                    <td style={td}>
                      <span style={{ color: STATE_META[m.state].color }}>● {STATE_META[m.state].label}</span>
                      {m.complimentary && <span style={honTag}>Honorary</span>}
                    </td>
                    <td style={{ ...td, color: '#E5D4C2' }}>{fmtDate(m.paid_through)}</td>
                    <td style={{ ...td, color: r.color }}>{m.complimentary ? `${r.text} · manual` : r.text}</td>
                    <td style={td}>{m.last_payment ? `${fmt(m.last_payment.amount_vnd)} · ${fmtDate(m.last_payment.payment_date)}` : (m.complimentary ? 'complimentary' : '—')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button style={btnGhost} onClick={() => openHistory(m.member_no)}>History</button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-member history */}
      {historyFor && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={sectionLabel}>History — {roster.find(r => r.member_no === historyFor)?.full_name || historyFor}</div>
            <button style={btnGhost} onClick={() => setHistoryFor(null)}>Close</button>
          </div>
          {history.length === 0 ? <div style={hint}>No payments recorded.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead><tr>{['Receipt', 'Date', 'Amount', 'Method', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {history.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid rgba(229,212,194,0.06)', opacity: p.status === 'voided' ? 0.5 : 1 }}>
                      <td style={td}>{p.receipt_no}</td>
                      <td style={td}>{fmtDate(p.payment_date)}</td>
                      <td style={{ ...td, color: p.amount_vnd < 0 ? '#B45656' : '#E5D4C2' }}>{fmt(p.amount_vnd)}</td>
                      <td style={td}>{METHODS.find(m => m.v === p.payment_method)?.l || p.payment_method}</td>
                      <td style={td}>{p.status}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {p.pdf_path ? <a style={btnGhost} href={`/api/admin/membership/receipt/${p.id}`} target="_blank" rel="noreferrer">Receipt</a> : <span style={hint}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {toast && <div style={toastStyle}>{toast}</div>}

      {/* Confirm modal */}
      {confirmOpen && selected && (
        <>
          <div style={backdrop} onClick={() => !busy && setConfirmOpen(false)} />
          <div style={modal} role="dialog">
            <div style={{ ...eyebrow, color: '#D4B85A' }}>{honorary ? 'CONFIRM ACTIVATION' : 'CONFIRM PAYMENT'}</div>
            <div style={modalTitle}>{honorary ? `Activate ${selected.full_name}?` : `Record ${fmt(amountNum)}?`}</div>
            <div style={modalSub}>{selected.full_name} ({selected.member_no}) · {FEE_KINDS.find(k => k.v === feeKind)?.l} · {fmtDate(date)}</div>
            <p style={modalBody}>
              {honorary
                ? 'Starts a complimentary one-year membership from this date — no charge, no receipt, no email, and no renewal reminders. You’ll renew manually if appropriate.'
                : <>This mints an official receipt, {feeKind === 'joining_fee' ? 'records the payment' : 'starts a one-year membership period'}, emails the member, and posts to the activity log. Corrections are done by voiding, never editing.</>}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnCancel} disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button style={{ ...btnGo, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={doRecord}>{busy ? (honorary ? 'Activating…' : 'Recording…') : (honorary ? 'Activate' : 'Record payment')}</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function cryptoUuid(): string {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.round(Math.random() * 1e9)}` }
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const h1: React.CSSProperties = { fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 8 }
const sub: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 24, lineHeight: 1.6, maxWidth: 680 }
const card: React.CSSProperties = { padding: 22, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 12, marginBottom: 16 }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#D4B85A', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block' }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8, padding: '9px 12px', fontFamily: MONO, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }
const hint: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#7E7864', marginTop: 6 }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 8, padding: '11px 22px', cursor: 'pointer', fontFamily: MONO, fontSize: 12, letterSpacing: '0.04em' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: MONO, fontSize: 10, textDecoration: 'none', display: 'inline-block' }
const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 20, fontFamily: MONO, fontSize: 11, color: '#B2AA98' }
const th: React.CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 9, color: '#7E7864', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 10px' }
const td: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', padding: '9px 10px' }
const honTag: React.CSSProperties = { marginLeft: 8, fontFamily: MONO, fontSize: 8, color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 10, padding: '1px 7px', letterSpacing: '0.06em', textTransform: 'uppercase' }
const toastStyle: React.CSSProperties = { position: 'fixed', bottom: 32, right: 32, background: '#28483C', color: '#E5D4C2', padding: '12px 18px', borderRadius: 6, fontFamily: MONO, fontSize: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxWidth: 360, zIndex: 400 }
const backdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300 }
const modal: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, 92vw)', background: '#0A3526', border: '1px solid rgba(212,184,90,0.45)', borderLeft: '3px solid #D4B85A', borderRadius: 8, padding: '22px 24px', zIndex: 301, boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }
const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }
const modalTitle: React.CSSProperties = { fontFamily: SERIF, fontSize: 18, color: '#E5D4C2', letterSpacing: '0.02em', marginBottom: 6 }
const modalSub: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 12 }
const modalBody: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', lineHeight: 1.65, marginBottom: 16 }
const btnCancel: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.2)', borderRadius: 4, padding: '8px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }
const btnGo: React.CSSProperties = { border: 'none', borderRadius: 4, padding: '8px 18px', fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', cursor: 'pointer', background: '#D4B85A', color: '#052E20' }
