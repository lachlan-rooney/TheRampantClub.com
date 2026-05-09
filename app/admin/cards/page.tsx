'use client'

// Admin → Member Cards
//
// HID-mode card reader. The Tagtix CK06 (and most cheap USB NFC readers) emulate
// a keyboard: when a card is tapped, the reader "types" the UID followed by Enter.
// We listen globally for keypresses, accumulate the buffer, and treat any
// alphanumeric run terminated by Enter (or 250ms of silence) as a UID.

import { useEffect, useRef, useState } from 'react'

interface CardLink {
  member_number: string
  card_uid: string
  credit_vnd: number
  linked_at: string
}
interface SheetMember {
  member_number: string
  full_name: string
  tier: string
  card_uid: string | null
  credit_vnd: number
}
interface Transaction {
  id: string
  amount_vnd: number
  kind: 'topup' | 'charge' | 'adjust' | 'refund'
  note: string | null
  staff_email: string | null
  balance_after_vnd: number
  created_at: string
}

const fmt = (vnd: number) => new Intl.NumberFormat('en-US').format(vnd) + ' ₫'

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}
const btnStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none',
  borderRadius: 6, padding: '8px 18px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
}
const btnPrimary: React.CSSProperties = { ...btnStyle, background: '#5E6650' }
const btnDanger: React.CSSProperties = { ...btnStyle, background: 'rgba(180, 70, 70, 0.2)' }

export default function AdminCards() {
  const [uid, setUid] = useState<string | null>(null)
  const [link, setLink] = useState<CardLink | null>(null)
  const [member, setMember] = useState<Record<string, string> | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [members, setMembers] = useState<SheetMember[]>([])
  const [pickerNumber, setPickerNumber] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [listening, setListening] = useState(true)
  const [orphans, setOrphans] = useState<{ member_number: string; card_uid: string | null; credit_vnd: number; expires_at: string | null; updated_at: string }[]>([])
  const [showOrphans, setShowOrphans] = useState(false)

  const bufferRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  const loadMembers = async () => {
    const r = await fetch('/api/admin/cards/members')
    const d = await r.json()
    setMembers(d.members || [])
  }
  const loadOrphans = async () => {
    const r = await fetch('/api/admin/cards/orphans')
    const d = await r.json()
    setOrphans(d.orphans || [])
  }
  useEffect(() => { loadMembers(); loadOrphans() }, [])

  const purgeAccount = async (memberNumber: string) => {
    if (!confirm(`Permanently delete the credit account for member ${memberNumber}? This wipes the row and all transaction history. Cannot be undone.`)) return
    setBusy(true)
    const r = await fetch('/api/admin/cards/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_number: memberNumber }),
    })
    setBusy(false)
    if (r.ok) {
      showToast('Account purged')
      loadOrphans(); loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Purge failed: ${d.error || r.statusText}`)
    }
  }

  // Card-reader keystroke listener
  useEffect(() => {
    const ALNUM = /^[0-9A-Za-z]$/
    const flush = () => {
      const buf = bufferRef.current
      bufferRef.current = ''
      flushTimerRef.current = null
      if (!buf || buf.length < 4) return
      handleScan(buf.toUpperCase())
    }
    const onKey = (e: KeyboardEvent) => {
      if (!listening) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Enter') {
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        flush()
        return
      }
      if (e.key.length === 1 && ALNUM.test(e.key)) {
        bufferRef.current += e.key
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        flushTimerRef.current = setTimeout(flush, 250)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  const handleScan = async (scannedUid: string) => {
    setUid(scannedUid)
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/cards/lookup?uid=${encodeURIComponent(scannedUid)}`)
      const d = await r.json()
      setLink(d.link || null)
      setMember(d.member || null)
      setTxs(d.transactions || [])
      setPickerNumber('')

      // Log presence so the members portal "X in clubhouse" is live.
      if (d.link?.member_number) {
        fetch('/api/admin/cards/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_number: d.link.member_number }),
        }).catch(() => {})
      }
    } catch {
      showToast('Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  const linkCard = async () => {
    if (!uid || !pickerNumber) return
    // Confirm before stealing a card from another member.
    const currentOwner = members.find(m => m.card_uid === uid && m.member_number !== pickerNumber)
    if (currentOwner) {
      const ok = confirm(
        `Card ${uid} is currently linked to ${currentOwner.full_name} (${currentOwner.member_number}).\n\n` +
        `Reassign it to ${members.find(m => m.member_number === pickerNumber)?.full_name || pickerNumber}?\n\n` +
        `Their credit balance (${fmt(currentOwner.credit_vnd)}) will be preserved on their account.`
      )
      if (!ok) return
    }
    setBusy(true)
    const r = await fetch('/api/admin/cards/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, member_number: pickerNumber }),
    })
    setBusy(false)
    if (r.ok) {
      showToast('Card linked')
      handleScan(uid)
      loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Link failed: ${d.error || r.statusText}`)
    }
  }

  const unlinkCard = async () => {
    if (!uid) return
    if (!confirm('Unlink this card from its member? Credit balance will be preserved if relinked to the same member.')) return
    setBusy(true)
    const r = await fetch('/api/admin/cards/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    })
    setBusy(false)
    if (r.ok) {
      showToast('Card unlinked')
      handleScan(uid)
      loadMembers()
    }
  }

  const transact = async (kind: 'topup' | 'charge', amountStr: string) => {
    if (!link) return
    const amt = parseInt(amountStr.replace(/[^0-9]/g, ''))
    if (!amt || amt <= 0) { showToast('Enter an amount'); return }
    setBusy(true)
    const r = await fetch('/api/admin/cards/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_number: link.member_number,
        kind,
        amount_vnd: amt,
        note: note || null,
      }),
    })
    setBusy(false)
    if (r.ok) {
      const d = await r.json()
      showToast(kind === 'topup' ? `Topped up ${fmt(amt)}` : `Charged ${fmt(amt)}`)
      setLink(l => l ? { ...l, credit_vnd: d.balance_vnd } : l)
      setTopupAmount(''); setChargeAmount(''); setNote('')
      // Refresh history
      if (uid) {
        const lr = await fetch(`/api/admin/cards/lookup?uid=${encodeURIComponent(uid)}`)
        const ld = await lr.json()
        setTxs(ld.transactions || [])
      }
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Failed: ${d.error || r.statusText}`)
    }
  }

  const reset = () => {
    setUid(null); setLink(null); setMember(null); setTxs([]); setPickerNumber('')
    setTopupAmount(''); setChargeAmount(''); setNote('')
  }

  return (
    <>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 8 }}>
        Member Cards
      </h1>
      <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 24, lineHeight: 1.6, maxWidth: 640 }}>
        Tap a member card on the USB reader to view balance, top up, or charge. Cards link to members from the Google Sheet roster by Member No.
      </p>

      {/* Listening pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', marginBottom: 24,
        background: 'rgba(229,212,194,0.04)',
        border: '1px solid rgba(229,212,194,0.08)',
        borderRadius: 8, justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: listening ? '#7AB07A' : '#B2AA98',
            boxShadow: listening ? '0 0 8px #7AB07A' : 'none',
          }} />
          <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#E5D4C2' }}>
            {listening ? 'Listening for card taps' : 'Paused'}
          </span>
        </div>
        <button onClick={() => setListening(l => !l)} style={btnStyle}>
          {listening ? 'Pause' : 'Resume'}
        </button>
      </div>

      {!uid ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          background: 'rgba(229,212,194,0.04)',
          border: '1px dashed rgba(229,212,194,0.15)',
          borderRadius: 12,
        }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', opacity: 0.8, marginBottom: 8 }}>
            Place a card on the reader
          </div>
          <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.7 }}>
            Make sure this page has focus, then tap.
          </div>
        </div>
      ) : (
        <div style={{
          padding: 24,
          background: 'rgba(229,212,194,0.04)',
          border: '1px solid rgba(229,212,194,0.1)',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Card UID</label>
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 20, color: '#E5D4C2', letterSpacing: '0.05em' }}>
                {uid}
              </div>
            </div>
            <button onClick={reset} style={btnStyle}>Clear</button>
          </div>

          {link ? (
            <>
              {/* Member + balance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Linked member</label>
                  {member ? (
                    <>
                      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', marginBottom: 4 }}>
                        {member['Full Name']}
                      </div>
                      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98' }}>
                        {member['Member No.']} · {member['Tier']}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 4 }}>
                        Member {link.member_number}
                      </div>
                      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#D4B85A' }}>
                        Sheet lookup failed — name unavailable
                      </div>
                    </>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ ...labelStyle, textAlign: 'right' }}>Credit balance</label>
                  <div style={{
                    fontFamily: "'Rampant Sans', serif", fontSize: 32,
                    color: link.credit_vnd > 0 ? '#7AB07A' : link.credit_vnd < 0 ? '#B45656' : '#E5D4C2',
                  }}>
                    {fmt(link.credit_vnd)}
                  </div>
                </div>
              </div>

              {/* Top up + charge */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Top up (VND)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text" inputMode="numeric"
                      style={inputStyle}
                      placeholder="e.g. 500000"
                      value={topupAmount}
                      onChange={e => setTopupAmount(e.target.value)}
                    />
                    <button
                      onClick={() => transact('topup', topupAmount)}
                      disabled={busy || !topupAmount}
                      style={btnPrimary}
                    >Top up</button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Charge (VND)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text" inputMode="numeric"
                      style={inputStyle}
                      placeholder="e.g. 120000"
                      value={chargeAmount}
                      onChange={e => setChargeAmount(e.target.value)}
                    />
                    <button
                      onClick={() => transact('charge', chargeAmount)}
                      disabled={busy || !chargeAmount}
                      style={btnDanger}
                    >Charge</button>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Note (optional, attached to next transaction)</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Kitchen — 2 drams Lagavulin"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {/* Quick presets */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {[100000, 200000, 500000, 1000000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(String(amt))}
                    style={{ ...btnStyle, fontSize: 10, padding: '6px 12px' }}
                  >+ {fmt(amt)}</button>
                ))}
              </div>

              {/* Transaction history */}
              {txs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Recent transactions</label>
                  <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: '4px 0' }}>
                    {txs.map(t => (
                      <div key={t.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderTop: '1px solid rgba(229,212,194,0.04)',
                        fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      }}>
                        <div style={{ color: '#B2AA98', minWidth: 100 }}>
                          {new Date(t.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        <div style={{
                          color: t.amount_vnd > 0 ? '#7AB07A' : '#E5D4C2',
                          fontWeight: 600, minWidth: 110, textAlign: 'right',
                        }}>
                          {t.amount_vnd > 0 ? '+' : ''}{fmt(t.amount_vnd)}
                        </div>
                        <div style={{ flex: 1, color: '#B2AA98', textAlign: 'right', paddingLeft: 12, fontSize: 10 }}>
                          {t.note || t.kind}
                          {t.staff_email && <span style={{ opacity: 0.5 }}> · {t.staff_email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={unlinkCard} disabled={busy} style={btnDanger}>Unlink card</button>
            </>
          ) : (
            <div>
              <label style={labelStyle}>This card isn&rsquo;t linked yet</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <select
                  value={pickerNumber}
                  onChange={e => setPickerNumber(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 280 }}
                >
                  <option value="">— select member to link —</option>
                  {members.map((m, i) => (
                    <option key={`${m.member_number}-${i}`} value={m.member_number}>
                      {m.member_number} · {m.full_name} ({m.tier})
                      {m.card_uid ? ' · already has card' : m.credit_vnd > 0 ? ` · ${fmt(m.credit_vnd)} credit preserved` : ''}
                    </option>
                  ))}
                </select>
                <button onClick={linkCard} disabled={!pickerNumber || busy} style={btnPrimary}>
                  {busy ? 'Linking…' : 'Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orphan accounts — credit on members no longer in the sheet */}
      {orphans.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <button
            onClick={() => setShowOrphans(s => !s)}
            style={{
              background: 'rgba(212,184,90,0.12)', color: '#D4B85A',
              border: '1px solid rgba(212,184,90,0.3)', borderRadius: 6,
              padding: '8px 14px', cursor: 'pointer',
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
            }}
          >
            {showOrphans ? '▾' : '▸'} {orphans.length} orphan account{orphans.length === 1 ? '' : 's'} (member no longer in sheet)
          </button>
          {showOrphans && (
            <div style={{
              marginTop: 12, padding: 16,
              background: 'rgba(212,184,90,0.04)',
              border: '1px solid rgba(212,184,90,0.15)', borderRadius: 8,
            }}>
              {orphans.map(o => (
                <div key={o.member_number} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderTop: '1px solid rgba(212,184,90,0.1)',
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, gap: 16, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ color: '#E5D4C2' }}>Member {o.member_number}</div>
                    <div style={{ color: '#B2AA98', opacity: 0.7, fontSize: 10 }}>
                      {o.card_uid ? `card ${o.card_uid}` : 'no card'}
                      {' · '}updated {new Date(o.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ color: o.credit_vnd > 0 ? '#7AB07A' : '#B2AA98', minWidth: 120, textAlign: 'right' }}>
                    {fmt(o.credit_vnd)}
                  </div>
                  <button
                    onClick={() => purgeAccount(o.member_number)}
                    disabled={busy}
                    style={{ background: 'rgba(180, 70, 70, 0.2)', color: '#E5D4C2', border: 'none', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10 }}
                  >Purge</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32,
          background: '#28483C', color: '#E5D4C2',
          padding: '10px 16px', borderRadius: 6,
          fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}
    </>
  )
}
