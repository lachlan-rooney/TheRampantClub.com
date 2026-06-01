'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { vnDateString } from '@/lib/datetime'

// MIS Pipeline — add new prospect form. Captures the upstream essentials;
// the rest is filled in on the detail page.

const SOURCES = ['Referral', 'Direct Approach', 'Event']

export default function NewProspectPage() {
  const router = useRouter()
  const [full_name, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [profession, setProfession] = useState('')
  const [referred_by_name, setReferredByName] = useState('')
  const [referral_relationship, setReferralRelationship] = useState('')
  const [source_channel, setSourceChannel] = useState('')
  const [first_contact_date, setFirstContactDate] = useState(vnDateString())
  const [next_action, setNextAction] = useState('')
  const [next_action_date, setNextActionDate] = useState('')
  const [assigned_to, setAssignedTo] = useState('')
  const [notes, setNotes] = useState('')
  const [contact_info, setContactInfo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!full_name.trim()) { setError('Full name required.'); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/admin/mis/prospects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name, nickname: nickname || null, profession: profession || null,
          referred_by_name: referred_by_name || null,
          referral_relationship: referral_relationship || null,
          source_channel: source_channel || null,
          first_contact_date: first_contact_date || null,
          next_action: next_action || null,
          next_action_date: next_action_date || null,
          assigned_to: assigned_to || null,
          notes: notes || null,
          contact_info: contact_info || null,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      router.push(`/admin/mis/pipeline/${j.prospect.prospect_id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }, [full_name, nickname, profession, referred_by_name, referral_relationship, source_channel, first_contact_date, next_action, next_action_date, assigned_to, notes, contact_info, router])

  return (
    <>
      <Link href="/admin/mis/pipeline" style={backLink}>← Pipeline</Link>

      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>Pipeline</div>
        <h1 style={pageTitle}>New prospect</h1>
        <p style={lede}>
          The minimum needed to start a pipeline card. Everything else — interview, scoring, decision — gets filled in on the detail page as you move them through stages.
        </p>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={formGrid}>
        <div style={fieldRow}>
          <div style={editLabel}>Full name *</div>
          <input value={full_name} onChange={e => setFullName(e.target.value)} autoFocus style={editInput} placeholder="Jane Doe" />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Position / title</div>
          <input value={nickname} onChange={e => setNickname(e.target.value)} style={editInput} placeholder="CEO, Acme Corp" />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Profession / sector</div>
          <input value={profession} onChange={e => setProfession(e.target.value)} style={editInput} placeholder="Banking · Law · Hospitality" />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Source channel</div>
          <select value={source_channel} onChange={e => setSourceChannel(e.target.value)} style={editInput}>
            <option value="">— select —</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Referred by</div>
          <input value={referred_by_name} onChange={e => setReferredByName(e.target.value)} style={editInput} placeholder="Lachlan's friend · AmCham" />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Relationship</div>
          <input value={referral_relationship} onChange={e => setReferralRelationship(e.target.value)} style={editInput} placeholder="Friend · Business associate" />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>First contact date</div>
          <input type="date" value={first_contact_date} onChange={e => setFirstContactDate(e.target.value)} style={editInput} />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Assigned to</div>
          <input value={assigned_to} onChange={e => setAssignedTo(e.target.value)} style={editInput} placeholder="Lachlan · Miss Châu" />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Next action</div>
          <input value={next_action} onChange={e => setNextAction(e.target.value)} style={editInput} placeholder="Offer membership · Schedule interview" />
        </div>

        <div style={fieldRow}>
          <div style={editLabel}>Next action date</div>
          <input type="date" value={next_action_date} onChange={e => setNextActionDate(e.target.value)} style={editInput} />
        </div>

        <div style={{ ...fieldRow, gridColumn: '1 / -1' }}>
          <div style={editLabel}>Contact info</div>
          <input value={contact_info} onChange={e => setContactInfo(e.target.value)} style={editInput} placeholder="Office address, phone, email" />
        </div>

        <div style={{ ...fieldRow, gridColumn: '1 / -1' }}>
          <div style={editLabel}>Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ ...editInput, resize: 'vertical' }} placeholder="Why are they interesting? What's the angle?" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button onClick={submit} disabled={saving || !full_name.trim()} style={{ ...btnPrimary, opacity: !full_name.trim() ? 0.4 : 1, cursor: !full_name.trim() ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : 'Add to pipeline'}
        </button>
        <Link href="/admin/mis/pipeline" style={btnGhost}>Cancel</Link>
      </div>
    </>
  )
}

const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 18, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 720, margin: 0,
}
const formGrid: React.CSSProperties = {
  display: 'grid', gap: 14,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}
const fieldRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const editInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', textDecoration: 'none',
}
