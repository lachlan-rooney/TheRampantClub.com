'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'

const REGIONS = ['Highland', 'Speyside', 'Islay', 'Lowland', 'Campbeltown', 'Islands', 'Japan', 'Ireland', 'Australia', 'China', 'England', 'New Zealand', 'Poland', 'USA', 'Vietnam', 'Other'] as const

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}
const btnStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none',
  borderRadius: 6, padding: '10px 24px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
}

export default function AdminWhisky() {
  const [whiskies, setWhiskies] = useState<Whisky[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Whisky | null>(null)
  const [name, setName] = useState('')
  const [distillery, setDistillery] = useState('')
  const [region, setRegion] = useState('')
  const [caskType, setCaskType] = useState('')
  const [age, setAge] = useState('')
  const [abv, setAbv] = useState('')
  const [tastingNotes, setTastingNotes] = useState('')
  const [committeesPick, setCommitteesPick] = useState(false)
  const [inStock, setInStock] = useState(true)

  const supabase = createBrowserSupabaseClient()

  const load = async () => {
    const { data } = await supabase.from('whiskies').select('*').order('name')
    if (data) setWhiskies(data)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setName(''); setDistillery(''); setRegion(''); setCaskType(''); setAge(''); setAbv('')
    setTastingNotes(''); setCommitteesPick(false); setInStock(true)
    setEditing(null); setShowForm(false)
  }

  const startEdit = (w: Whisky) => {
    setName(w.name); setDistillery(w.distillery || ''); setRegion(w.region || '')
    setCaskType(w.cask_type || ''); setAge(w.age || ''); setAbv(w.abv || '')
    setTastingNotes(w.tasting_notes || ''); setCommitteesPick(w.committees_pick); setInStock(w.in_stock)
    setEditing(w); setShowForm(true)
  }

  const handleSubmit = async () => {
    const payload = {
      name, distillery: distillery || null, region: region || null,
      cask_type: caskType || null, age: age || null, abv: abv || null,
      tasting_notes: tastingNotes || null, committees_pick: committeesPick, in_stock: inStock,
    }
    if (editing) {
      await supabase.from('whiskies').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('whiskies').insert(payload)
    }
    resetForm(); load()
  }

  const toggleField = async (id: string, field: 'in_stock' | 'committees_pick', current: boolean) => {
    await supabase.from('whiskies').update({ [field]: !current }).eq('id', id)
    setWhiskies(prev => prev.map(w => w.id === id ? { ...w, [field]: !current } : w))
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this whisky?')) return
    await supabase.from('whiskies').delete().eq('id', id)
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          Whisky Library
        </h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>+ New Whisky</button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `Editing: ${editing.name}` : 'New Whisky'}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Distillery</label>
              <input style={inputStyle} value={distillery} onChange={e => setDistillery(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Region</label>
              <select style={inputStyle} value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">Select...</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Cask Type</label>
              <input style={inputStyle} value={caskType} onChange={e => setCaskType(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Age</label>
              <input style={inputStyle} value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ABV</label>
              <input style={inputStyle} value={abv} onChange={e => setAbv(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tasting Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={tastingNotes} onChange={e => setTastingNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={committeesPick} onChange={e => setCommitteesPick(e.target.checked)} /> Committee&rsquo;s Pick
            </label>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} /> In Stock
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>Cancel</button>
          </div>
        </div>
      )}

      <div>
        {whiskies.map(w => (
          <div key={w.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{w.name}</span>
                {w.distillery && <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>· {w.distillery}</span>}
                {w.region && <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, color: '#E5D4C2', background: 'rgba(229,212,194,0.1)', borderRadius: 4, padding: '2px 8px' }}>{w.region}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={() => toggleField(w.id, 'committees_pick', w.committees_pick)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: w.committees_pick ? '#E5D4C2' : '#B2AA98', opacity: w.committees_pick ? 1 : 0.4 }}
              >
                ◆ Pick
              </button>
              <button
                onClick={() => toggleField(w.id, 'in_stock', w.in_stock)}
                style={{ background: w.in_stock ? 'rgba(94,102,80,0.3)' : 'rgba(229,212,194,0.06)', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, color: '#E5D4C2' }}
              >
                {w.in_stock ? 'In Stock' : 'Out'}
              </button>
              <button onClick={() => startEdit(w)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => handleDelete(w.id)} style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
