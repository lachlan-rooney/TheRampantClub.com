'use client'

// Admin → Member Cards
//
// HID-mode card reader workflow. The Tagtix CK06 (and most cheap USB NFC
// readers) emulate a keyboard: when a card is tapped, the reader "types" the
// card's UID into the focused element followed by Enter.
//
// We listen globally for keypresses, accumulate the buffer, and treat any
// alphanumeric run terminated by Enter (or 250ms of silence) as a UID.
// All member data lives in Supabase, keyed by `profiles.card_uid`.

import { useEffect, useRef, useState } from 'react'

interface Member {
  id: string
  email: string
  display_name: string | null
  member_number: number | null
  admitted_at: string | null
  locker_number: string | null
  card_uid: string | null
  card_issued_at: string | null
}

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
const btnPrimary: React.CSSProperties = {
  ...btnStyle, background: '#5E6650',
}
const btnDanger: React.CSSProperties = {
  ...btnStyle, background: 'rgba(180, 70, 70, 0.2)',
}

export default function AdminCards() {
  const [uid, setUid] = useState<string | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [pickerId, setPickerId] = useState('')
  const [edit, setEdit] = useState<Partial<Member>>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [listening, setListening] = useState(true)

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
  useEffect(() => { loadMembers() }, [])

  // ── Card-reader keystroke listener ─────────────────────────────
  useEffect(() => {
    const ALNUM = /^[0-9A-Za-z]$/

    const flush = () => {
      const buf = bufferRef.current
      bufferRef.current = ''
      flushTimerRef.current = null
      if (!buf || buf.length < 4) return         // ignore stray short bursts
      handleScan(buf.toUpperCase())
    }

    const onKey = (e: KeyboardEvent) => {
      if (!listening) return
      // Don't hijack typing in inputs/textareas/contenteditable
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as HTMLElement).isContentEditable)) {
        return
      }
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
  }, [listening])

  const handleScan = async (scannedUid: string) => {
    setUid(scannedUid)
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/cards/lookup?uid=${encodeURIComponent(scannedUid)}`)
      const d = await r.json()
      const m = d.member as Member | null
      setMember(m)
      setPickerId(m?.id || '')
      setEdit(m ? {
        member_number: m.member_number,
        display_name: m.display_name,
        locker_number: m.locker_number,
      } : {})
    } catch {
      showToast('Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  const linkMember = async () => {
    if (!uid || !pickerId) return
    setBusy(true)
    const r = await fetch('/api/admin/cards/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, member_id: pickerId }),
    })
    setBusy(false)
    if (r.ok) {
      showToast('Card linked')
      const m = members.find(x => x.id === pickerId) || null
      setMember(m ? { ...m, card_uid: uid, card_issued_at: new Date().toISOString() } : null)
      loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Link failed: ${d.error || r.statusText}`)
    }
  }

  const unlinkMember = async () => {
    if (!uid) return
    if (!confirm('Unlink this card from its member?')) return
    setBusy(true)
    const r = await fetch('/api/admin/cards/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    })
    setBusy(false)
    if (r.ok) {
      showToast('Card unlinked')
      setMember(null)
      setPickerId('')
      loadMembers()
    }
  }

  const saveProfile = async () => {
    if (!member) return
    setBusy(true)
    const r = await fetch('/api/admin/cards/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: member.id,
        display_name: edit.display_name ?? null,
        member_number: edit.member_number ?? null,
        locker_number: edit.locker_number ?? null,
      }),
    })
    setBusy(false)
    if (r.ok) {
      showToast('Saved')
      setMember(m => m ? { ...m, ...edit } : m)
      loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`Save failed: ${d.error || r.statusText}`)
    }
  }

  const reset = () => {
    setUid(null); setMember(null); setEdit({}); setPickerId('')
  }

  return (
    <>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 8 }}>
        Member Cards
      </h1>
      <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 24, lineHeight: 1.6, maxWidth: 640 }}>
        Tap any member card on the USB reader. The reader emulates a keyboard, so the page just listens — no setup needed.
        Each card&rsquo;s factory UID is linked to a single member; all editable data lives in the database.
      </p>

      {/* Listening pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', marginBottom: 24,
        background: 'rgba(229,212,194,0.04)',
        border: '1px solid rgba(229,212,194,0.08)',
        borderRadius: 8,
        justifyContent: 'space-between',
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
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', opacity: 0.8, marginBottom: 8 }}>
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
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 18, color: '#E5D4C2', letterSpacing: '0.05em' }}>
                {uid}
              </div>
            </div>
            <button onClick={reset} style={btnStyle}>Clear</button>
          </div>

          {member ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Linked member</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
                    {member.member_number ? `#${String(member.member_number).padStart(3, '0')} ` : ''}
                    {member.display_name || member.email}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                    {member.email}
                  </span>
                  <button onClick={unlinkMember} disabled={busy} style={btnDanger}>Unlink card</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Member number</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={edit.member_number ?? ''}
                    onChange={e => setEdit(v => ({ ...v, member_number: e.target.value ? parseInt(e.target.value) : null }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Display name</label>
                  <input
                    style={inputStyle}
                    value={edit.display_name ?? ''}
                    onChange={e => setEdit(v => ({ ...v, display_name: e.target.value || null }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Locker</label>
                  <input
                    style={inputStyle}
                    value={edit.locker_number ?? ''}
                    onChange={e => setEdit(v => ({ ...v, locker_number: e.target.value || null }))}
                  />
                </div>
              </div>

              {member.card_issued_at && (
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.6, marginBottom: 16 }}>
                  Card issued {new Date(member.card_issued_at).toLocaleDateString()}
                </div>
              )}

              <button onClick={saveProfile} disabled={busy} style={btnPrimary}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <div>
              <label style={labelStyle}>This card isn&rsquo;t linked yet</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <select
                  value={pickerId}
                  onChange={e => setPickerId(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 280 }}
                >
                  <option value="">— select member to link —</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.member_number ? `#${String(m.member_number).padStart(3, '0')} ` : ''}
                      {m.display_name || m.email}
                      {m.card_uid ? ' · already has card' : ''}
                    </option>
                  ))}
                </select>
                <button onClick={linkMember} disabled={!pickerId || busy} style={btnPrimary}>
                  {busy ? 'Linking…' : 'Link'}
                </button>
              </div>
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
