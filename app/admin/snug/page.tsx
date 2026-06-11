'use client'

import { useCallback, useEffect, useState } from 'react'

// Staff Snug — the cadence tool + the safety valve. Compose house posts (member
// side shows "The Club", never a staff name) to keep the feed alive, and moderate:
// soft-hide a post (it leaves the member feed quietly) or remove a tasting note
// from the Snug (it reverts to the member's private note — never deleted).

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Row { item_type: string; id: string; created_at: string; hidden: boolean; kind: string; author_name: string; preview: string }
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AdminSnug() {
  const [rows, setRows] = useState<Row[]>([])
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/snug')
    if (r.ok) setRows((await r.json()).items || [])
  }, [])
  useEffect(() => { load() }, [load])

  const postHouse = useCallback(async () => {
    const b = body.trim()
    if (!b || posting) return
    setPosting(true); setErr('')
    try {
      const fd = new FormData(); fd.set('body', b); if (photo) fd.set('photo', photo)
      const r = await fetch('/api/social/posts', { method: 'POST', body: fd })
      if (r.ok) { setBody(''); setPhoto(null); await load() }
      else setErr((await r.json().catch(() => ({})))?.error || 'Could not post.')
    } finally { setPosting(false) }
  }, [body, photo, posting, load])

  const moderate = useCallback(async (action: string, item: Row) => {
    const verb = action === 'hide' ? 'Hide this post from the Snug?' : action === 'unhide' ? 'Return this post to the Snug?' : 'Remove this note from the Snug? (it stays the member’s private note)'
    if (!window.confirm(verb)) return
    const r = await fetch('/api/admin/snug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, item_type: item.item_type, item_id: item.id }) })
    if (r.ok) await load()
  }, [load])

  return (
    <div>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>The Snug</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 24, letterSpacing: '0.04em' }}>Keep the room alive · members see house posts as “The Club”</p>

      <div style={composer}>
        {err && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 8 }}>{err}</div>}
        <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 8000))} rows={3} placeholder="A house moment — a bottle landed, a vignette from last night, a welcome…" style={textarea} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <label style={{ ...chip, cursor: 'pointer' }}>
            {photo ? photo.name.slice(0, 24) : '＋ photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f) }} />
          </label>
          <button onClick={postHouse} disabled={posting || !body.trim()} style={{ ...postBtn, opacity: posting || !body.trim() ? 0.4 : 1 }}>{posting ? 'Posting…' : 'Post as The Club'}</button>
        </div>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7E7864', margin: '24px 0 10px' }}>Recent in the Snug</div>
      {rows.map(it => (
        <div key={`${it.item_type}:${it.id}`} style={{ ...rowCard, opacity: it.hidden ? 0.5 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: it.kind === 'house_post' ? '#D4B85A' : '#E5D4C2' }}>
              {it.author_name}
              <span style={{ color: '#7E7864', marginLeft: 8 }}>{it.kind === 'tasting_note' ? 'note' : it.kind === 'house_post' ? 'house' : 'member'}{it.hidden ? ' · hidden' : ''}</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{fmt(it.created_at)}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.6, margin: '5px 0 8px' }}>{it.preview}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {it.item_type === 'post'
              ? <button onClick={() => moderate(it.hidden ? 'unhide' : 'hide', it)} style={modBtn}>{it.hidden ? 'Unhide' : 'Hide'}</button>
              : <button onClick={() => moderate('unsnug', it)} style={modBtn}>Remove from Snug</button>}
          </div>
        </div>
      ))}
      {rows.length === 0 && <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }}>Nothing in the Snug yet.</div>}
    </div>
  )
}

const composer: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.2)', borderRadius: 12, background: 'rgba(229,212,194,0.03)', padding: 16 }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.6, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const chip: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 16, padding: '5px 12px', fontFamily: MONO, fontSize: 10, color: '#B2AA98' }
const postBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const rowCard: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10, padding: '11px 13px', marginBottom: 8 }
const modBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '5px 12px', fontFamily: MONO, fontSize: 10, color: '#B2AA98', cursor: 'pointer' }
