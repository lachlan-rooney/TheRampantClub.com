'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberModal from '@/components/MemberModal'
import { useLang } from '@/lib/lang'
import { catLabel } from './flavour-data'

// A member's tasting notes on one whisky — their own (private or shared) + other
// members' Snug notes. Composer is the shared MemberModal (portal-to-body). Lazy:
// nothing is fetched until the section is opened. Default visibility is PRIVATE.
// Set on hairlines in the whisky pages' vocabulary (WhiskyStyle): no cards, no
// pills — a name in tracked mono, the note as reading text, choices underlined.

interface Note { id: string; note: string; flavour_tags: string[]; visibility: string; created_at: string; is_own: boolean; author_name: string; photo_url: string | null }
interface Family { slug: string; name: string }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function WhiskyNotes({ whiskyId }: { whiskyId: string }) {
  const { t, lang } = useLang()
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

  const toggleTag = (slug: string) => setTags(prev => prev.includes(slug) ? prev.filter(x => x !== slug) : [...prev, slug])

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
      else setError((await r.json().catch(() => ({})))?.error || t('Could not save.', 'Không thể lưu.'))
    } finally { setSaving(false) }
  }, [draft, saving, whiskyId, visibility, tags, photo, load, t])

  const nameOf = (slug: string) => { const f = families.find(x => x.slug === slug); return f ? catLabel(f, lang) : slug }

  return (
    <div className="wl-notes">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="wl-link is-quiet">
        {open ? t('↑ Hide notes', '↑ Ẩn ghi chú') : t('✒ Your notes & the Snug', '✒ Ghi chú của bạn & Phòng Khách')}
      </button>

      {open && (
        <div className="wl-notes-list">
          {!loaded ? (
            <div className="wl-notes-empty">{t('Fetching notes…', 'Đang tải ghi chú…')}</div>
          ) : notes.length === 0 ? (
            <div className="wl-notes-empty">{t('No notes yet — be the first to record this dram.', 'Chưa có ghi chú — hãy là người đầu tiên ghi lại ly này.')}</div>
          ) : notes.map(n => (
            <div key={n.id} className="wl-n">
              <div className="wl-n-head">
                <span className={`wl-n-who ${n.is_own ? 'is-own' : ''}`}>
                  {n.author_name}
                  {n.is_own && n.visibility === 'snug' && <span className="wl-tag is-shared">{t('Shared', 'Đã chia sẻ')}</span>}
                  {n.is_own && n.visibility === 'private' && <span className="wl-tag is-private">{t('Private', 'Riêng tư')}</span>}
                </span>
                <span className="wl-date">{fmtDate(n.created_at)}</span>
              </div>
              <div className="wl-n-text">{n.note}</div>
              {n.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.photo_url} alt="" className="wl-photo" />
              )}
              {n.flavour_tags.length > 0 && (
                <div className="wl-fams">{n.flavour_tags.map(nameOf).join('  ·  ')}</div>
              )}
            </div>
          ))}

          <button type="button" onClick={() => setComposer(true)} className="wl-link is-gold" style={{ marginTop: 14 }}>
            {t('＋ Add a note', '＋ Thêm ghi chú')}
          </button>
        </div>
      )}

      <MemberModal open={composer} onClose={() => setComposer(false)} title={t('Your tasting note', 'Ghi chú nếm thử của bạn')} subtitle={t('PRIVATE BY DEFAULT — SHARE IF YOU WISH', 'MẶC ĐỊNH RIÊNG TƯ — CHIA SẺ NẾU MUỐN')}>
        <div className="wl-form">
          {error && <div className="wl-error">{error}</div>}
          <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 8000))} rows={5} placeholder={t('Nose, palate, finish — or simply how it struck you.', 'Hương, vị, hậu vị — hoặc đơn giản là cảm nhận của bạn.')} className="wl-textarea" />

          <div className="wl-field">
            <div className="wl-field-label">{t('Visibility', 'Chế độ hiển thị')}</div>
            <div className="wl-choices">
              {([['private', t('Keep private', 'Giữ riêng tư')], ['snug', t('Share to the Snug', 'Chia sẻ lên Phòng Khách')]] as const).map(([v, label]) => (
                <button type="button" key={v} onClick={() => setVisibility(v)} aria-pressed={visibility === v} className={`wl-choice ${visibility === v ? 'is-on' : ''}`}>{label}</button>
              ))}
            </div>
          </div>

          {families.length > 0 && (
            <div className="wl-field">
              <div className="wl-field-label">{t('Flavour notes', 'Nhóm hương vị')} <span>{t('(optional)', '(không bắt buộc)')}</span></div>
              <div className="wl-choices">
                {families.map(f => (
                  <button type="button" key={f.slug} onClick={() => toggleTag(f.slug)} aria-pressed={tags.includes(f.slug)} className={`wl-choice ${tags.includes(f.slug) ? 'is-on' : ''}`}>{catLabel(f, lang)}</button>
                ))}
              </div>
            </div>
          )}

          <div className="wl-field">
            <div className="wl-field-label">{t('Photo', 'Ảnh')} <span>{t('(optional — location data is stripped)', '(không bắt buộc — dữ liệu vị trí sẽ được xóa)')}</span></div>
            {photo ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
                <span className="wl-file">{photo.name}</span>
                <button type="button" onClick={() => setPhoto(null)} className="wl-link is-danger">{t('Remove', 'Xóa')}</button>
              </div>
            ) : (
              <label className="wl-link is-quiet">
                {t('＋ Add a photo', '＋ Thêm ảnh')}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f) }} />
              </label>
            )}
          </div>

          <div className="wl-form-actions">
            <button type="button" onClick={() => { setComposer(false); setPhoto(null) }} className="wl-link is-quiet">{t('Cancel', 'Hủy')}</button>
            <button type="button" onClick={save} disabled={saving || !draft.trim()} className="wl-link is-gold is-big" style={{ opacity: saving || !draft.trim() ? 0.4 : 1 }}>
              {saving ? t('Saving…', 'Đang lưu…') : <>{t('Save note', 'Lưu ghi chú')} <span className="pk-go" aria-hidden="true">→</span></>}
            </button>
          </div>
        </div>
      </MemberModal>
    </div>
  )
}
