'use client'

import { useEffect, useRef, useState } from 'react'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'

type Member = Record<string, string>

interface CardInfo {
  card_uid: string | null
  credit_vnd: number
  recent: { id: string; amount_vnd: number; kind: string; note: string | null; created_at: string; staff_email: string | null }[]
}

const fmtVnd = (vnd: number) => new Intl.NumberFormat('en-US').format(vnd) + ' ₫'

const SECTIONS = [
  {
    title: 'Food & Beverage',
    fields: ['Allergies', 'Dietary Requirements', 'Cuisine Preference', 'Spice Tolerance', 'Coffee/Tea', 'Comfort Food', 'Water Preference'],
  },
  {
    title: 'Whisky & Drinks',
    fields: ['Whisky Profile', 'Preferred Region', 'Favourite Expression', 'Default Serve', 'Flavour Loves', 'Flavour Avoids', 'Non-Alcoholic', 'Wine Preference', 'Cocktail Style'],
  },
  {
    title: 'Social & Environment',
    fields: ['Social Type', 'Preferred Group Size', 'Preferred Space', 'Seating Preference', 'Music/Volume', 'Greeting Preference', 'Introduction Rules', 'Celebration Preference'],
  },
  {
    title: 'Personal & Lifestyle',
    fields: ['Profession/Industry', 'Hobbies & Interests', 'Art/Culture', 'Whisky Education Level', 'Technology Comfort', 'Meeting Style', 'Client Entertainment', 'Billing Preference'],
  },
  {
    title: 'Service Intelligence',
    fields: ['Morning/Evening', 'Temperature', 'Comfort Notes', 'Preferred Merch', 'Surprise Preference', 'Family Inclusion'],
  },
]

export default function QuickRefPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  // Card + credit state
  const [card, setCard] = useState<{ card_uid: string | null; credit_vnd: number; expires_at: string | null; linked_at: string | null } | null>(null)
  const [editingExpiry, setEditingExpiry] = useState(false)
  const [expiryDraft, setExpiryDraft] = useState('')
  const [recentTxs, setRecentTxs] = useState<CardInfo['recent']>([])
  const [linkMode, setLinkMode] = useState(false)
  const [topup, setTopup] = useState('')
  const [charge, setCharge] = useState('')
  const [txNote, setTxNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const linkBufferRef = useRef('')
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { showToast, toastNode } = useToast()

  useEffect(() => {
    fetch('/api/member-profiles')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMembers(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Load card info whenever the selected member changes
  useEffect(() => {
    if (!selected) { setCard(null); setRecentTxs([]); return }
    const num = selected['Member No.']
    fetch(`/api/admin/cards/by-member?member_number=${encodeURIComponent(num)}`)
      .then(r => r.json())
      .then(d => {
        setCard(d.card || null)
        setRecentTxs(d.transactions || [])
      })
      .catch(() => { setCard(null); setRecentTxs([]) })
    setLinkMode(false)
    setTopup(''); setCharge(''); setTxNote('')
  }, [selected])

  // Keystroke listener — only active while linkMode is on
  useEffect(() => {
    if (!linkMode || !selected) return
    const ALNUM = /^[0-9A-Za-z]$/
    const flush = async () => {
      const buf = linkBufferRef.current
      linkBufferRef.current = ''
      linkTimerRef.current = null
      if (!buf || buf.length < 4) return
      const uid = buf.toUpperCase()
      setBusy(true)
      const r = await fetch('/api/admin/cards/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, member_number: selected['Member No.'] }),
      })
      setBusy(false)
      setLinkMode(false)
      if (r.ok) {
        showToast(`Card linked: ${uid}`)
        // Reload card info
        const cr = await fetch(`/api/admin/cards/by-member?member_number=${encodeURIComponent(selected['Member No.'])}`)
        const cd = await cr.json()
        setCard(cd.card || null)
        setRecentTxs(cd.transactions || [])
      } else {
        const d = await r.json().catch(() => ({}))
        showToast(`Link failed: ${d.error || r.statusText}`)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Enter') {
        if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
        flush()
        return
      }
      if (e.key.length === 1 && ALNUM.test(e.key)) {
        linkBufferRef.current += e.key
        if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
        linkTimerRef.current = setTimeout(flush, 250)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
    }
  }, [linkMode, selected])

  const requestUnlink = () => { if (selected && card?.card_uid) setConfirmUnlink(true) }
  const closeUnlink   = () => { if (!busy) setConfirmUnlink(false) }
  const runUnlink = async () => {
    if (!selected || !card?.card_uid) return
    setBusy(true)
    const r = await fetch('/api/admin/cards/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_number: selected['Member No.'] }),
    })
    setBusy(false)
    setConfirmUnlink(false)
    if (r.ok) {
      showToast('Card unlinked')
      setCard(null); setRecentTxs([])
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Unlink failed: ${d.error || r.statusText}`)
    }
  }

  const saveExpiry = async (override?: string | null) => {
    if (!selected) return
    const value = override !== undefined ? override : (expiryDraft || null)
    setBusy(true)
    const r = await fetch('/api/admin/cards/expiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_number: selected['Member No.'],
        expires_at: value,
      }),
    })
    setBusy(false)
    if (r.ok) {
      const d = await r.json()
      setCard(c => c ? { ...c, expires_at: d.expires_at } : c)
      setEditingExpiry(false)
      setExpiryDraft('')
      showToast(d.expires_at ? `Expiry set to ${new Date(d.expires_at).toLocaleDateString()}` : 'Expiry cleared')
    } else {
      showToast('Failed to save expiry')
    }
  }

  const transact = async (kind: 'topup' | 'charge', amountStr: string) => {
    if (!selected || !card) return
    const amt = parseInt(amountStr.replace(/[^0-9]/g, ''))
    if (!amt || amt <= 0) { showToast('Enter an amount'); return }
    setBusy(true)
    const r = await fetch('/api/admin/cards/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_number: selected['Member No.'],
        kind,
        amount_vnd: amt,
        note: txNote || null,
      }),
    })
    setBusy(false)
    if (r.ok) {
      const d = await r.json()
      showToast(kind === 'topup' ? `Topped up ${fmtVnd(amt)}` : `Charged ${fmtVnd(amt)}`)
      setCard(c => c ? { ...c, credit_vnd: d.balance_vnd } : c)
      setTopup(''); setCharge(''); setTxNote('')
      const cr = await fetch(`/api/admin/cards/by-member?member_number=${encodeURIComponent(selected['Member No.'])}`)
      const cd = await cr.json()
      setRecentTxs(cd.transactions || [])
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Failed: ${d.error || r.statusText}`)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          Member Quick Reference
        </h1>
      </div>

      {loading ? (
        <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98' }}>Loading...</p>
      ) : (
        <>
          {/* Member dropdown */}
          <div style={{ marginBottom: 32 }}>
            <select
              value={selected?.['Full Name'] || ''}
              onChange={e => {
                const m = members.find(m => m['Full Name'] === e.target.value)
                setSelected(m || null)
              }}
              style={{
                background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
                border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
                padding: '12px 16px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                fontSize: 12, width: '100%', maxWidth: 400, boxSizing: 'border-box',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: '#052E20' }}>Select a member...</option>
              {members.map((m, i) => (
                <option key={`${m['Member No.']}-${i}`} value={m['Full Name']} style={{ background: '#052E20' }}>
                  {m['Full Name']} — {m['Member No.']} ({m['Tier']})
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              {/* Header */}
              <div style={{
                padding: '24px 28px', marginBottom: 32,
                background: 'rgba(229,212,194,0.04)', borderRadius: 8,
                border: '1px solid rgba(229,212,194,0.06)',
              }}>
                <div style={{
                  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
                  color: '#E5D4C2', marginBottom: 4,
                }}>
                  {selected['Full Name']}
                </div>
                <div style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                  color: '#B2AA98', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12,
                }}>
                  <span>{selected['Member No.']}</span>
                  <span>·</span>
                  <span>{selected['Tier']}</span>
                  {selected['Last Updated'] && <>
                    <span>·</span>
                    <span>Updated: {selected['Last Updated']}</span>
                  </>}
                </div>
                {selected['Score 5 List'] && (
                  <div style={{
                    fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                    color: '#E5D4C2', letterSpacing: '0.02em',
                    padding: '8px 12px', background: 'rgba(229,212,194,0.06)', borderRadius: 4,
                    marginTop: 8,
                  }}>
                    <span style={{ color: '#B2AA98', marginRight: 8 }}>◆ KEY ALERTS:</span>
                    {selected['Score 5 List']}
                  </div>
                )}
              </div>

              {/* Card & Credit */}
              <div style={{
                padding: '20px 24px', marginBottom: 32,
                background: 'rgba(229,212,194,0.04)', borderRadius: 8,
                border: '1px solid rgba(229,212,194,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, marginBottom: 16 }}>
                  <div>
                    <div style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                      color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase',
                      opacity: 0.6, marginBottom: 6,
                    }}>
                      Member Card
                    </div>
                    {card?.card_uid ? (
                      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 14, color: '#E5D4C2', letterSpacing: '0.04em' }}>
                        {card.card_uid}
                      </div>
                    ) : card ? (
                      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#D4B85A', opacity: 0.85 }}>
                        Unlinked &mdash; credit preserved
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', opacity: 0.7 }}>
                        No card linked
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                      color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase',
                      opacity: 0.6, marginBottom: 6,
                    }}>
                      Credit Balance
                    </div>
                    {(() => {
                      const expired = !!card?.expires_at && new Date(card.expires_at) < new Date()
                      return (
                        <>
                          <div style={{
                            fontFamily: "'Rampant Sans', serif", fontSize: 28,
                            color: expired ? '#B2AA98' : (card?.credit_vnd ?? 0) > 0 ? '#7AB07A' : (card?.credit_vnd ?? 0) < 0 ? '#B45656' : '#E5D4C2',
                            textDecoration: expired ? 'line-through' : 'none',
                            opacity: expired ? 0.5 : 1,
                          }}>
                            {fmtVnd(card?.credit_vnd ?? 0)}
                          </div>
                          {expired && (
                            <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B45656', letterSpacing: '0.06em' }}>
                              EXPIRED
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Expiry row — visible whenever we have a credit account */}
                {card && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    paddingTop: 12, marginTop: 4,
                    borderTop: '1px solid rgba(229,212,194,0.06)',
                    fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                    marginBottom: 16,
                  }}>
                    <span style={{ color: '#B2AA98', opacity: 0.7 }}>Expires:</span>
                    {!editingExpiry ? (
                      <>
                        <span style={{ color: '#E5D4C2' }}>
                          {card.expires_at
                            ? new Date(card.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : 'Never'}
                        </span>
                        <button
                          onClick={() => {
                            setExpiryDraft(card.expires_at ? card.expires_at.slice(0, 10) : '')
                            setEditingExpiry(true)
                          }}
                          style={{ background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10 }}
                        >Edit</button>
                      </>
                    ) : (
                      <>
                        <input
                          type="date"
                          value={expiryDraft}
                          onChange={e => setExpiryDraft(e.target.value)}
                          style={{ background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 4, padding: '4px 8px', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11 }}
                        />
                        <button onClick={() => saveExpiry()} disabled={busy} style={{ background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10 }}>Save</button>
                        <button onClick={() => { setEditingExpiry(false); setExpiryDraft('') }} style={{ background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10 }}>Cancel</button>
                        {card.expires_at && (
                          <button
                            onClick={() => saveExpiry(null)}
                            style={{ background: 'transparent', color: '#B45656', border: '1px solid rgba(180,86,86,0.4)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10 }}
                          >Clear (no expiry)</button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Link prompt when no UID is currently attached */}
                {!card?.card_uid && (
                  linkMode ? (
                    <div style={{
                      padding: '14px 16px', marginBottom: card ? 16 : 0,
                      background: 'rgba(122,176,122,0.08)',
                      border: '1px dashed rgba(122,176,122,0.4)', borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#E5D4C2' }}>
                        Listening… tap a card on the reader to link it to this member.
                      </span>
                      <button
                        onClick={() => setLinkMode(false)}
                        style={{ background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11 }}
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setLinkMode(true)}
                      disabled={busy}
                      style={{ background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', marginBottom: card ? 16 : 0, cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11 }}
                    >{card ? 'Tap card to relink' : 'Tap card to link'}</button>
                  )
                )}

                {/* Balance controls — shown whenever a credit account exists,
                    whether or not a physical card is currently attached. */}
                {card && (
                  <>
                    {/* Top up + charge */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, display: 'block', marginBottom: 4 }}>Top up (VND)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text" inputMode="numeric" placeholder="500000"
                            value={topup} onChange={e => setTopup(e.target.value)}
                            style={{ background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 6, padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, flex: 1 }}
                          />
                          <button
                            onClick={() => transact('topup', topup)}
                            disabled={busy || !topup}
                            style={{ background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11 }}
                          >Top up</button>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, display: 'block', marginBottom: 4 }}>Charge (VND)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text" inputMode="numeric" placeholder="120000"
                            value={charge} onChange={e => setCharge(e.target.value)}
                            style={{ background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 6, padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, flex: 1 }}
                          />
                          <button
                            onClick={() => transact('charge', charge)}
                            disabled={busy || !charge}
                            style={{ background: 'rgba(180, 70, 70, 0.2)', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11 }}
                          >Charge</button>
                        </div>
                      </div>
                    </div>
                    <input
                      placeholder="Note (e.g. 2 drams Lagavulin)"
                      value={txNote} onChange={e => setTxNote(e.target.value)}
                      style={{ background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 6, padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, width: '100%', boxSizing: 'border-box', marginBottom: 12 }}
                    />

                    {recentTxs.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {recentTxs.map(t => (
                          <div key={t.id} style={{
                            display: 'flex', justifyContent: 'space-between', gap: 12,
                            padding: '6px 0', borderTop: '1px solid rgba(229,212,194,0.04)',
                            fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98',
                          }}>
                            <span style={{ minWidth: 100 }}>{new Date(t.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            <span style={{ color: t.amount_vnd > 0 ? '#7AB07A' : '#E5D4C2', minWidth: 100, textAlign: 'right' }}>
                              {t.amount_vnd > 0 ? '+' : ''}{fmtVnd(t.amount_vnd)}
                            </span>
                            <span style={{ flex: 1, textAlign: 'right', opacity: 0.7 }}>{t.note || t.kind}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {card.card_uid && (
                      <button
                        onClick={requestUnlink} disabled={busy}
                        style={{ background: 'rgba(180, 70, 70, 0.2)', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10 }}
                      >Unlink card</button>
                    )}
                  </>
                )}
              </div>

              {/* Sections */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                {SECTIONS.map(section => (
                  <div key={section.title} style={{
                    padding: '20px 24px',
                    background: 'rgba(229,212,194,0.03)', borderRadius: 8,
                    border: '1px solid rgba(229,212,194,0.04)',
                  }}>
                    <div style={{
                      fontFamily: "'Rampant Sans', serif", fontSize: 14, fontWeight: 500,
                      color: '#E5D4C2', marginBottom: 16, letterSpacing: '0.04em',
                    }}>
                      {section.title}
                    </div>
                    {section.fields.map(field => {
                      const val = selected[field]
                      if (!val) return null
                      return (
                        <div key={field} style={{ marginBottom: 14 }}>
                          <div style={{
                            fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                            color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase',
                            marginBottom: 3, opacity: 0.6,
                          }}>
                            {field}
                          </div>
                          <div style={{
                            fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                            color: '#E5D4C2', lineHeight: 1.7, opacity: 0.85,
                          }}>
                            {val}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <ConfirmModal
        open={confirmUnlink && !!card?.card_uid}
        eyebrow="⚠ UNLINK CARD"
        title="Unlink this card?"
        subject={card?.card_uid ? `${card.card_uid} · ${selected?.['Full Name'] ?? ''}` : undefined}
        body="Detaches the physical card from this member. The credit balance is preserved on the account — a new card can be linked later. The card will no longer work at kiosks."
        confirmLabel="Unlink card"
        busyLabel="Unlinking…"
        busy={busy}
        onCancel={closeUnlink}
        onConfirm={runUnlink}
      />

      {toastNode}
    </>
  )
}
