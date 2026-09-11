'use client'

import { useState } from 'react'
import { PublicPage, Rise } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

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
  const tone = ok ? '#8FC48F' : voided ? '#D9A866' : '#E89B9B'

  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Words and a drawing on the left, the check on the right: underlined
           fields and a mono submit, the verdict written out beneath on
           hairlines — never a box. */
        .vr { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: start;
              padding-top: 120px; padding-bottom: 120px; min-height: 100vh; min-height: 100svh; box-sizing: border-box; }
        .vr-words { position: relative; }
        .vr-eyebrow { color: #D4B85A; opacity: 1; }
        .vr-art { width: clamp(170px, 18vw, 250px); margin: 40px 0 0 clamp(30px, 6vw, 90px); }
        .vr-form { padding-top: 30px; }
        .vr-label { display: block; font-family: ${MONO}; font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase;
                    color: #D4B85A; margin: 0; }
        .vr-input { display: block; width: 100%; box-sizing: border-box; background: transparent; color: #E5D4C2;
                    border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; outline: none;
                    padding: 12px 0; margin: 4px 0 26px; font-family: ${MONO}; font-size: 14px; letter-spacing: .02em;
                    transition: border-color .25s; }
        .vr-input::placeholder { color: rgba(229,212,194,.5); }
        .vr-input:focus { border-bottom-color: #D4B85A; }
        .vr-btn { display: inline-block; margin-top: 6px; background: none; color: #D4B85A; border: none;
                  border-bottom: 1px solid #D4B85A; border-radius: 0; padding: 6px 0 7px; cursor: pointer;
                  font-family: ${MONO}; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; }
        .vr-btn:hover:not(:disabled) .pk-go { transform: translateX(7px); }
        .vr-btn:disabled { cursor: not-allowed; }

        .vr-result { margin-top: 56px; padding-top: 22px; border-top: 2px solid var(--vr-tone); }
        .vr-badge { font-family: ${MONO}; font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
                    color: var(--vr-tone); }
        .vr-name { font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); line-height: 1.02; margin: 14px 0 22px; }
        .vr-note { font-family: ${MONO}; font-size: 12px; line-height: 1.9; font-style: italic; opacity: .82; margin: 18px 0 0; }

        @media (max-width: 860px) {
          .vr { grid-template-columns: 1fr; align-content: start; gap: 24px; padding-top: 72px; padding-bottom: 96px; }
          .vr-art { position: absolute; top: -8px; right: -6px; width: 112px; margin: 0; }
          .vr-words > :first-child, .vr-words > :nth-child(2) { max-width: 70%; }
          .vr-input { font-size: 16px; }
          .vr-input::placeholder { font-size: 13px; }
          .vr-result { margin-top: 44px; }
        }
      ` }} />
      <CreamInkDefs />

      <div className="pk-wrap vr">
        <div className="vr-words">
          <Rise><div className="pk-eyebrow vr-eyebrow">The Rampant Club</div></Rise>
          <Rise delay={.06}><h1 className="pk-h1">Verify a Receipt</h1></Rise>
          <Rise delay={.12}>
            <p className="pk-lede">Enter the receipt number and the verification code printed at the foot of your receipt.</p>
          </Rise>
          <Rise delay={.2} className="vr-art"><CreamInk name="newspaper" width="100%" rot={-5} dur={9} /></Rise>
        </div>

        <Rise delay={.16}>
          <div className="vr-form">
            <label className="vr-label" htmlFor="vr-no">Receipt number</label>
            <input id="vr-no" className="vr-input" placeholder="TRC-R-2026-0001" value={no} onChange={e => setNo(e.target.value)} />
            <label className="vr-label" htmlFor="vr-code">Verification code</label>
            <input id="vr-code" className="vr-input" placeholder="the code after the receipt number" value={code} onChange={e => setCode(e.target.value)} />
            <button onClick={check} disabled={busy || !no.trim() || !code.trim()} className="vr-btn"
                    style={{ opacity: busy || !no.trim() || !code.trim() ? 0.5 : 1 }}>
              {busy ? 'Checking…' : <>Verify <span className="pk-go" aria-hidden="true">→</span></>}
            </button>
          </div>

          {res && (
            <div className="vr-result pk-rise is-in" role="status" style={{ ['--vr-tone' as string]: tone }}>
              {res.verified ? (
                <>
                  <div className="vr-badge">{ok ? '✓ Authentic' : '⚠ Voided'}</div>
                  <div className="vr-name">{res.member_name}</div>
                  <dl className="pk-details">
                    <div><dt>Receipt</dt><dd>{res.receipt_no}</dd></div>
                    <div><dt>Amount</dt><dd>{res.amount_display}</dd></div>
                    <div><dt>Date</dt><dd>{fmtDate(res.payment_date)}</dd></div>
                    {res.period && <div><dt>Covers</dt><dd>{fmtDate(res.period.start)} — {fmtDate(res.period.end)}</dd></div>}
                  </dl>
                  <p className="vr-note">{res.note}</p>
                </>
              ) : (
                <>
                  <div className="vr-badge">✗ Not verified</div>
                  <p className="vr-note">{res.reason || 'This receipt could not be verified.'}</p>
                </>
              )}
            </div>
          )}
        </Rise>
      </div>
    </PublicPage>
  )
}
