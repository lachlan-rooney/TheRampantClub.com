'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberModal from '@/components/MemberModal'

// A member's tasting notes on one whisky — their own (private or shared) + other
// members' Snug notes. Composer is the shared MemberModal (portal-to-body). Lazy:
// nothing is fetched until the section is opened. Default visibility is PRIVATE.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Note { id: string; note: string; flavour_tags: string[]; visibility: string; created_at: string; is_own: boolean; author_name: string; photo_url: string | null }
interface Family { slug: string; name: string }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function WhiskyNotes({ whiskyId }: { whiskyId: string }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [composer, setComposer] = useState(false)
  const [draft, setDraft] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'snug'>('private')
  const [tags, setTags] = useState<string[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/social/tasting-notes?whisky_id=${whiskyId}`)
    if (r.ok) setNotes((await r.json()).notes || [])
    setLoaded(true)
  }, [whiskyId])

  useEffect(() => {
    if (!open || loaded) return
    load()
    createBrowserSupabaseClient().from('flavour_categories').select('slug, name').not('quadrant', 'is', null).order('sort_order')
      .then(({ data }) => { if (data) setFamilies(data) })
  }, [open, loaded, load])

  const toggleTag = (slug: string) => setTags(t => t.includes(slug) ? t.filter(x => x !== slug) : [...t, slug])

  const save = useCallback(async () => {
    const note = draft.trim()
    if (!note || saving) return
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.set('whisky_id', whiskyId)
      fd.set('note', note)
      fd.set('visibility', visibility)
      fd.set('flavour_tags', JSON.stringify(tags))
      if (photo) fd.set('photo', photo)
      const r = await fetch('/api/social/tasting-notes', { method: 'POST', body: fd })
      if (r.ok) { setComposer(false); setDraft(''); setTags([]); setVisibility('private'); setPhoto(null); await load() }
      else setError((await r.json().catch(() => ({})))?.error || 'Could not save.')
    } finally { setSaving(false) }
  }, [draft, saving, whiskyId, visibility, tags, photo, load])

  const nameOf = (slug: string) => families.find(f => f.slug === slug)?.name || slug

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={toggleBtn}>
        {open ? '↑ Hide notes' : '✒ Your notes & the Snug'}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {!loaded ? (
            <div style={muted}>Fetching notes…</div>
          ) : notes.length === 0 ? (
            <div style={muted}>No notes yet — be the first to record this dram.</div>
          ) : notes.map(n => (
            <div key={n.id} style={noteCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: n.is_own ? '#D4B85A' : '#E5D4C2', letterSpacing: '0.04em' }}>
                  {n.author_name}{n.visibility === 'snug' && !n.is_own ? '' : ''}
                  {n.is_own && n.visibility === 'snug' && <span style={snugBadge}>Shared</span>}
                  {n.is_own && n.visibility === 'private' && <span style={privBadge}>Private</span>}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{fmtDate(n.created_at)}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.note}</div>
              {n.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.photo_url} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: 280, borderRadius: 8, marginTop: 10, objectFit: 'cover' }} />
              )}
              {n.flavour_tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                  {n.flavour_tags.map(t => <span key={t} style={tagChip}>{nameOf(t)}</span>)}
                </div>
              )}
            </div>
          ))}

          <button onClick={() => setComposer(true)} style={addBtn}>＋ Add a note</button>
        </div>
      )}

      <MemberModal open={composer} onClose={() => setComposer(false)} title="Your tasting note" subtitle="PRIVATE BY DEFAULT — SHARE IF YOU WISH">
        {error && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 8 }}>{error}</div>}
        <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 8000))} rows={4} placeholder="Nose, palate, finish — or simply how it struck you." style={textarea} />

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
            <div style={fieldLabel}>Flavour notes <span style={{ opacity: 0.5 }}>(optional)</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {families.map(f => (
                <button key={f.slug} onClick={() => toggleTag(f.slug)} style={{ ...chip, ...(tags.includes(f.slug) ? chipOn : null) }}>{f.name}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={fieldLabel}>Photo <span style={{ opacity: 0.5 }}>(optional — location data is stripped)</span></div>
          {photo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#E5D4C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{photo.name}</span>
              <button onClick={() => setPhoto(null)} style={{ ...chip, color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>Remove</button>
            </div>
          ) : (
            <label style={{ ...chip, cursor: 'pointer', display: 'inline-block' }}>
              ＋ Add a photo
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f) }} />
            </label>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={() => { setComposer(false); setPhoto(null) }} style={cancelBtn}>Cancel</button>
          <button onClick={save} disabled={saving || !draft.trim()} style={{ ...saveBtn, opacity: saving || !draft.trim() ? 0.4 : 1 }}>{saving ? 'Saving…' : 'Save note'}</button>
        </div>
      </MemberModal>
    </div>
  )
}

const toggleBtn: React.CSSProperties = { background: 'transparent', cursor: 'pointer', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 20, padding: '5px 14px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: '#B2AA98' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '6px 0' }
const noteCard: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10, background: 'rgba(229,212,194,0.03)', padding: '11px 13px', marginBottom: 8 }
const snugBadge: React.CSSProperties = { fontFamily: MONO, fontSize: 8, color: '#052E20', background: '#7AB07A', padding: '1px 6px', borderRadius: 7, marginLeft: 8, letterSpacing: '0.06em' }
const privBadge: React.CSSProperties = { fontFamily: MONO, fontSize: 8, color: '#B2AA98', border: '1px solid rgba(178,170,152,0.3)', padding: '1px 6px', borderRadius: 7, marginLeft: 8, letterSpacing: '0.06em' }
const tagChip: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#D4B85A', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 8, padding: '2px 8px' }
const addBtn: React.CSSProperties = { marginTop: 4, background: 'rgba(212,184,90,0.10)', cursor: 'pointer', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 20, padding: '6px 16px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: '#D4B85A' }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.6, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const fieldLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 7 }
const pill: React.CSSProperties = { background: 'transparent', cursor: 'pointer', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 18, padding: '6px 14px', fontFamily: MONO, fontSize: 11, color: '#B2AA98' }
const pillOn: React.CSSProperties = { border: '1px solid #D4B85A', color: '#D4B85A', background: 'rgba(212,184,90,0.10)' }
const chip: React.CSSProperties = { background: 'transparent', cursor: 'pointer', border: '1px solid rgba(178,170,152,0.25)', borderRadius: 16, padding: '4px 11px', fontFamily: MONO, fontSize: 10, color: '#B2AA98' }
const chipOn: React.CSSProperties = { border: '1px solid #D4B85A', color: '#D4B85A', background: 'rgba(212,184,90,0.10)' }
const cancelBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 12, color: '#B2AA98', cursor: 'pointer' }
const saveBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
