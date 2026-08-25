'use client'

import { useState } from 'react'

// Public receipt-verification page. Enter the receipt number + the verification
// code printed on the PDF; the endpoint recomputes the integrity hash from the
// ledger and confirms authenticity (and surfaces the authoritative amount/date
// so any tampering of the printed figures is visible).

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', 'Playfair Display', serif"

interface Result {
  verified: boolean
  reason?: string
  receipt_no?: string
  member_name?: string
  amount_display?: string
  payment_date?: string
  period?: { start: string; end: string }
  status?: string
  note?: string
}

const fmtDate = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export default function VerifyReceipt() {
  const [no, setNo] = useState('')
  const [code, setCode] = useState('')
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  const check = async () => {
    if (!no.trim() || !code.trim()) return
    setBusy(true); setRes(null)
    try {
      const r = await fetch(`/api/verify-receipt?no=${encodeURIComponent(no.trim())}&h=${encodeURIComponent(code.trim())}`)
      setRes(await r.json())
    } catch { setRes({ verified: false, reason: 'Could not reach the verifier. Try again.' }) }
    setBusy(false)
  }

  const ok = res?.verified && res.status === 'active'
  const voided = res?.verified && res.status === 'voided'

  return (
    <div style={wrap}>
      <div style={{ width: 'min(460px, 92vw)', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-mark-cream.svg" alt="The Rampant Club" style={{ height: 52, margin: '0 auto 20px', display: 'block', opacity: 0.9 }} />
        <div style={eyebrow}>The Rampant Club</div>
        <h1 style={title}>Verify a Receipt</h1>
        <p style={prompt}>Enter the receipt number and the verification code printed at the foot of your receipt.</p>

        <div style={{ textAlign: 'left', marginTop: 24 }}>
          <label style={label}>Receipt number</label>
          <input style={input} placeholder="TRC-R-2026-0001" value={no} onChange={e => setNo(e.target.value)} />
          <label style={{ ...label, marginTop: 14 }}>Verification code</label>
          <input style={input} placeholder="the code after the receipt number" value={code} onChange={e => setCode(e.target.value)} />
          <button onClick={check} disabled={busy || !no.trim() || !code.trim()} style={{ ...btn, opacity: busy || !no.trim() || !code.trim() ? 0.5 : 1 }}>
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </div>

        {res && (
          <div style={{ ...resultBox, borderColor: ok ? 'rgba(122,176,122,0.5)' : voided ? 'rgba(196,149,85,0.5)' : 'rgba(194,112,112,0.5)' }}>
            {res.verified ? (
              <>
                <div style={{ ...badge, color: ok ? '#7AB07A' : '#C49555' }}>{ok ? '✓ Authentic' : '⚠ Voided'}</div>
                <div style={detailName}>{res.member_name}</div>
                <div style={detailRow}><span style={dLabel}>Receipt</span><span style={dVal}>{res.receipt_no}</span></div>
                <div style={detailRow}><span style={dLabel}>Amount</span><span style={dVal}>{res.amount_display}</span></div>
                <div style={detailRow}><span style={dLabel}>Date</span><span style={dVal}>{fmtDate(res.payment_date)}</span></div>
                {res.period && <div style={detailRow}><span style={dLabel}>Covers</span><span style={dVal}>{fmtDate(res.period.start)} — {fmtDate(res.period.end)}</span></div>}
                <div style={noteLine}>{res.note}</div>
              </>
            ) : (
              <>
                <div style={{ ...badge, color: '#C27070' }}>✗ Not verified</div>
                <div style={noteLine}>{res.reason || 'This receipt could not be verified.'}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#052E20', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }
const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C9A84C' }
const title: React.CSSProperties = { fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: '#E5D4C2', margin: '8px 0 10px' }
const prompt: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, maxWidth: 380, margin: '0 auto' }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 8, padding: '11px 13px', fontFamily: MONO, fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' }
const btn: React.CSSProperties = { marginTop: 18, width: '100%', background: '#C9A84C', color: '#052E20', border: 'none', borderRadius: 24, padding: '13px', fontFamily: MONO, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const resultBox: React.CSSProperties = { marginTop: 26, padding: '20px 22px', borderRadius: 12, background: 'rgba(229,212,194,0.04)', border: '1px solid', textAlign: 'left' }
const badge: React.CSSProperties = { fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 12, textAlign: 'center' }
const detailName: React.CSSProperties = { fontFamily: SERIF, fontSize: 18, color: '#E5D4C2', textAlign: 'center', marginBottom: 14 }
const detailRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid rgba(229,212,194,0.08)' }
const dLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98' }
const dVal: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#E5D4C2' }
const noteLine: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', textAlign: 'center', marginTop: 14, lineHeight: 1.6, fontStyle: 'italic' }
