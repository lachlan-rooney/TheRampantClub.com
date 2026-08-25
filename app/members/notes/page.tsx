'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import MemberModal from '@/components/MemberModal'

// A member's own tasting-note journal — every note they've logged (private + snug),
// newest first, each editable/deletable through the route (the spine logs it and
// the palate re-derives). Their personal record of the drams they've met.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Note { id: string; note: string; flavour_tags: string[]; visibility: string; created_at: string; whisky_id: string; whisky_name: string; photo_url: string | null }
interface Family { slug: string; name: string }
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function MyNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [families, setFamilies] = useState<Family[]>([])
  const [edit, setEdit] = useState<Note | null>(null)
  const [draft, setDraft] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'snug'>('private')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/social/tasting-notes')
    if (r.ok) setNotes((await r.json()).notes || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    createBrowserSupabaseClient().from('flavour_categories').select('slug, name').order('sort_order')
      .then(({ data }) => { if (data) setFamilies(data) })
  }, [load])

  const openEdit = (n: Note) => { setEdit(n); setDraft(n.note); setVisibility(n.visibility === 'snug' ? 'snug' : 'private'); setTags(n.flavour_tags || []); setError('') }
  const toggleTag = (slug: string) => setTags(t => t.includes(slug) ? t.filter(x => x !== slug) : [...t, slug])
  const nameOf = (slug: string) => families.find(f => f.slug === slug)?.name || slug

  const saveEdit = useCallback(async () => {
    if (!edit || saving) return
    const note = draft.trim(); if (!note) return
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/social/tasting-notes/${edit.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, visibility, flavour_tags: tags }),
      })
      if (r.ok) { setEdit(null); await load() }
      else setError((await r.json().catch(() => ({})))?.error || 'Could not update.')
    } finally { setSaving(false) }
  }, [edit, draft, visibility, tags, saving, load])

  const del = useCallback(async (n: Note) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    const r = await fetch(`/api/social/tasting-notes/${n.id}`, { method: 'DELETE' })
    if (r.ok) await load()
  }, [load])

  return (
    <MemberPage title="Your Notes" subtitle="NHẬT KÝ NẾM THỬ" description="Every dram you've recorded — private to you, or shared to the Snug. Each one sharpens your palate.">
      {loading ? (
        <p style={muted}>Gathering your notes…</p>
      ) : notes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={muted}>No notes yet. Open any bottle’s story and record how it struck you — your journal starts there.</p>
          <Link href="/members/whisky" style={link}>Browse the Whisky Library →</Link>
        </div>
      ) : notes.map(n => (
        <div key={n.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <Link href={`/members/whisky/${n.whisky_id}`} style={whiskyLink}>{n.whisky_name}</Link>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{fmtDate(n.created_at)}</span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={n.visibility === 'snug' ? snugBadge : privBadge}>{n.visibility === 'snug' ? 'Shared to the Snug' : 'Private'}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.note}</div>
          {n.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.photo_url} alt="Tasting note photograph" loading="lazy" decoding="async" style={{ display: 'block', maxWidth: '100%', maxHeight: 260, borderRadius: 8, marginTop: 10, objectFit: 'cover' }} />
          )}
          {n.flavour_tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {n.flavour_tags.map(t => <span key={t} style={tagChip}>{nameOf(t)}</span>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <button onClick={() => openEdit(n)} style={textBtn}>Edit</button>
            <button onClick={() => del(n)} style={{ ...textBtn, color: '#C27070' }}>Delete</button>
          </div>
        </div>
      ))}

      <MemberModal open={!!edit} onClose={() => setEdit(null)} title="Edit your note" subtitle={edit?.whisky_name?.toUpperCase()}>
        {error && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 8 }}>{error}</div>}
        <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 8000))} rows={4} style={textarea} />
        <div style={{ marginTop: 14 }}>
          <div style={fieldLabel}>Visibility</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['private', 'Keep private'], ['snug', 'Share to the Snug']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setVisibility(v)} style={{ ...pill, ...(visibility === v ? pillOn : null) }}>{label}</button>
            ))}
          </div>
        </div>
        {families.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={fieldLabel}>Flavour notes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {families.map(f => <button key={f.slug} onClick={() => toggleTag(f.slug)} style={{ ...chip, ...(tags.includes(f.slug) ? chipOn : null) }}>{f.name}</button>)}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={() => setEdit(null)} style={cancelBtn}>Cancel</button>
          <button onClick={saveEdit} disabled={saving || !draft.trim()} style={{ ...saveBtn, opacity: saving || !draft.trim() ? 0.4 : 1 }}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </MemberModal>
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', textAlign: 'center', opacity: 0.7, lineHeight: 1.7 }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)', fontFamily: MONO, fontSize: 12 }
const card: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.10)', borderRadius: 12, background: 'rgba(229,212,194,0.03)', padding: '14px 16px', marginBottom: 12 }
const whiskyLink: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.3)' }
const snugBadge: React.CSSProperties = { fontFamily: MONO, fontSize: 8, color: '#052E20', background: '#7AB07A', padding: '2px 7px', borderRadius: 7, letterSpacing: '0.06em' }
const privBadge: React.CSSProperties = { fontFamily: MONO, fontSize: 8, color: '#B2AA98', border: '1px solid rgba(178,170,152,0.3)', padding: '2px 7px', borderRadius: 7, letterSpacing: '0.06em' }
const tagChip: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#D4B85A', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 8, padding: '2px 8px' }
const textBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: '#B2AA98', textDecoration: 'underline', letterSpacing: '0.04em' }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.6, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const fieldLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 7 }
const pill: React.CSSProperties = { background: 'transparent', cursor: 'pointer', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 18, padding: '6px 14px', fontFamily: MONO, fontSize: 11, color: '#B2AA98' }
const pillOn: React.CSSProperties = { border: '1px solid #D4B85A', color: '#D4B85A', background: 'rgba(212,184,90,0.10)' }
const chip: React.CSSProperties = { background: 'transparent', cursor: 'pointer', border: '1px solid rgba(178,170,152,0.25)', borderRadius: 16, padding: '4px 11px', fontFamily: MONO, fontSize: 10, color: '#B2AA98' }
const chipOn: React.CSSProperties = { border: '1px solid #D4B85A', color: '#D4B85A', background: 'rgba(212,184,90,0.10)' }
const cancelBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 12, color: '#B2AA98', cursor: 'pointer' }
const saveBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
