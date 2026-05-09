'use client'

import { useEffect, useState } from 'react'

interface Pick {
  pick_date: string
  dram_label: string | null
  dram_note: string | null
  vinyl_label: string | null
  vinyl_note: string | null
  member_quote: string | null
  updated_at: string | null
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

function saigonToday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  return fmt.format(new Date())
}

export default function AdminTonight() {
  const [date, setDate] = useState(saigonToday())
  const [pick, setPick] = useState<Pick | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }

  const load = async (d: string) => {
    const r = await fetch(`/api/admin/tonight?date=${d}`)
    const j = await r.json()
    setPick(j.pick || {
      pick_date: d,
      dram_label: null, dram_note: null,
      vinyl_label: null, vinyl_note: null,
      member_quote: null, updated_at: null,
    })
  }

  useEffect(() => { load(date) }, [date])

  const save = async () => {
    if (!pick) return
    setBusy(true)
    const r = await fetch('/api/admin/tonight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pick_date: date,
        dram_label: pick.dram_label || null,
        dram_note: pick.dram_note || null,
        vinyl_label: pick.vinyl_label || null,
        vinyl_note: pick.vinyl_note || null,
        member_quote: pick.member_quote || null,
      }),
    })
    setBusy(false)
    if (r.ok) showToast('Saved')
    else showToast('Save failed')
  }

  const clearAll = async () => {
    if (!confirm('Clear all picks for this date? The seed-list fallback will show instead.')) return
    setPick(p => p ? {
      ...p,
      dram_label: null, dram_note: null,
      vinyl_label: null, vinyl_note: null,
      member_quote: null,
    } : p)
  }

  return (
    <>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 8 }}>
        Tonight at The Rampant Club
      </h1>
      <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 24, lineHeight: 1.6, maxWidth: 640 }}>
        Curate the dram, the vinyl on the turntable, and the member quote that show on the homepage and members portal.
        Leave any field blank and the seed-list fallback will rotate in for that day.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <label style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', letterSpacing: '0.06em' }}>
          Date:
        </label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value || saigonToday())}
          style={{ ...inputStyle, width: 'auto' }}
        />
        <button
          onClick={() => setDate(saigonToday())}
          style={{ background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: "'Google Sans Code', monospace", fontSize: 10 }}
        >Today</button>
      </div>

      {pick && (
        <div style={{
          padding: 24,
          background: 'rgba(229,212,194,0.04)',
          border: '1px solid rgba(229,212,194,0.1)',
          borderRadius: 12,
          maxWidth: 640,
        }}>
          <Section title="Dram of the day">
            <Field label="Whisky" value={pick.dram_label} onChange={v => setPick(p => p ? { ...p, dram_label: v } : p)} placeholder="Lagavulin 16" />
            <Field label="Note" value={pick.dram_note} onChange={v => setPick(p => p ? { ...p, dram_note: v } : p)} placeholder="Peat, iodine, smoke. The Islay benchmark." />
          </Section>

          <Section title="On the turntable">
            <Field label="Record" value={pick.vinyl_label} onChange={v => setPick(p => p ? { ...p, vinyl_label: v } : p)} placeholder="Bill Evans Trio — Sunday at the Village Vanguard" />
            <Field label="Note" value={pick.vinyl_note} onChange={v => setPick(p => p ? { ...p, vinyl_note: v } : p)} placeholder="Live, intimate, 1961." />
          </Section>

          <Section title="Member quote">
            <Field label="Quote" value={pick.member_quote} onChange={v => setPick(p => p ? { ...p, member_quote: v } : p)} placeholder="There are no whisky snobs here. Only enthusiasts." multiline />
          </Section>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button
              onClick={save} disabled={busy}
              style={{ background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: "'Google Sans Code', monospace", fontSize: 11 }}
            >{busy ? 'Saving…' : 'Save'}</button>
            <button
              onClick={clearAll}
              style={{ background: 'rgba(180, 70, 70, 0.2)', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: "'Google Sans Code', monospace", fontSize: 11 }}
            >Clear all</button>
            {pick.updated_at && (
              <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.6, alignSelf: 'center', marginLeft: 'auto' }}>
                last saved {new Date(pick.updated_at).toLocaleString('en-GB')}
              </span>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32,
          background: '#28483C', color: '#E5D4C2',
          padding: '10px 16px', borderRadius: 6,
          fontFamily: "'Google Sans Code', monospace", fontSize: 11,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontFamily: "'Google Sans Code', monospace", fontSize: 10,
        color: '#B2AA98', letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 12, opacity: 0.7,
      }}>{title}</div>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string | null
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {multiline ? (
        <textarea
          rows={3}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      ) : (
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
    </div>
  )
}
