'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import MemberModal from '@/components/MemberModal'
import { useLang } from '@/lib/lang'
import { catLabel } from '@/components/whisky/flavour-data'
import { WhiskyStyle, bare } from '@/components/whisky/WhiskyStyle'
import { Rise, CREAM, MONO, SERIF } from '@/components/public/kit'

// A member's own tasting-note journal — every note they've logged (private + snug),
// newest first, each editable/deletable through the route (the spine logs it and
// the palate re-derives). Their personal record of the drams they've met.
//
// Set as a journal: each entry on a hairline, the date in its own column on a
// desk, the bottle's name in the display face, the note as reading text.

interface Note { id: string; note: string; flavour_tags: string[]; visibility: string; created_at: string; whisky_id: string; whisky_name: string; photo_url: string | null }
interface Family { slug: string; name: string }
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function MyNotes() {
  const { t, lang } = useLang()
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
    createBrowserSupabaseClient().from('flavour_categories').select('slug, name').not('quadrant', 'is', null).order('sort_order')
      .then(({ data }) => { if (data) setFamilies(data) })
  }, [load])

  const openEdit = (n: Note) => { setEdit(n); setDraft(n.note); setVisibility(n.visibility === 'snug' ? 'snug' : 'private'); setTags(n.flavour_tags || []); setError('') }
  const toggleTag = (slug: string) => setTags(prev => prev.includes(slug) ? prev.filter(x => x !== slug) : [...prev, slug])
  const nameOf = (slug: string) => { const f = families.find(x => x.slug === slug); return f ? catLabel(f, lang) : slug }

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
      else setError((await r.json().catch(() => ({})))?.error || t('Could not update.', 'Không thể cập nhật.'))
    } finally { setSaving(false) }
  }, [edit, draft, visibility, tags, saving, load, t])

  const del = useCallback(async (n: Note) => {
    if (!window.confirm(t('Delete this note? This cannot be undone.', 'Xóa ghi chú này? Thao tác không thể hoàn tác.'))) return
    const r = await fetch(`/api/social/tasting-notes/${n.id}`, { method: 'DELETE' })
    if (r.ok) await load()
  }, [load, t])

  return (
    <MemberPage title="Your Notes" subtitle="NHẬT KÝ NẾM THỬ" description={t("Every dram you've recorded — private to you, or shared to the Snug. Each one sharpens your palate.", 'Mọi ly bạn đã ghi lại — giữ riêng cho bạn, hoặc chia sẻ lên Phòng Khách. Mỗi ghi chú giúp khẩu vị của bạn thêm tinh tường.')}>
      <WhiskyStyle />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {loading ? (
        <p className="wl-text">{t('Gathering your notes…', 'Đang tập hợp ghi chú của bạn…')}</p>
      ) : notes.length === 0 ? (
        <section>
          <Rise>
            <p className="wn-empty-text">{t('No notes yet. Open any bottle’s story and record how it struck you — your journal starts there.', 'Chưa có ghi chú nào. Hãy mở câu chuyện của bất kỳ chai nào và ghi lại cảm nhận của bạn — nhật ký của bạn bắt đầu từ đó.')}</p>
            <Link href="/members/whisky" className="wl-link is-gold is-big" style={{ marginTop: 30 }}>
              {bare(t('Browse the Whisky Library →', 'Duyệt Thư Viện Whisky →'))} <span className="pk-go" aria-hidden="true">→</span>
            </Link>
          </Rise>
        </section>
      ) : (
        <div className="wn-list">
          {notes.map((n, i) => (
            <Rise as="article" key={n.id} delay={Math.min(i, 4) * .05} className="wn-entry">
              <div className="wn-when">
                <span className="wl-date">{fmtDate(n.created_at)}</span>
                <span className={`wn-vis ${n.visibility === 'snug' ? 'is-shared' : ''}`}>{n.visibility === 'snug' ? t('Shared to the Snug', 'Đã chia sẻ lên Phòng Khách') : t('Private', 'Riêng tư')}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <Link href={`/members/whisky/${n.whisky_id}`} className="wn-name">{n.whisky_name}</Link>
                <div className="wn-text">{n.note}</div>
                {n.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.photo_url} alt={t('Tasting note photograph', 'Ảnh ghi chú nếm thử')} loading="lazy" decoding="async" className="wl-photo" />
                )}
                {n.flavour_tags.length > 0 && (
                  <div className="wl-fams">{n.flavour_tags.map(nameOf).join('  ·  ')}</div>
                )}
                <div className="wl-acts">
                  <button type="button" onClick={() => openEdit(n)} className="wl-link is-quiet">{t('Edit', 'Sửa')}</button>
                  <button type="button" onClick={() => del(n)} className="wl-link is-danger">{t('Delete', 'Xóa')}</button>
                </div>
              </div>
            </Rise>
          ))}
        </div>
      )}

      <MemberModal open={!!edit} onClose={() => setEdit(null)} title={t('Edit your note', 'Sửa ghi chú của bạn')} subtitle={edit?.whisky_name?.toUpperCase()}>
        <div className="wl-form">
          {error && <div className="wl-error">{error}</div>}
          <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 8000))} rows={5} className="wl-textarea" />
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
              <div className="wl-field-label">{t('Flavour notes', 'Nhóm hương vị')}</div>
              <div className="wl-choices">
                {families.map(f => <button type="button" key={f.slug} onClick={() => toggleTag(f.slug)} aria-pressed={tags.includes(f.slug)} className={`wl-choice ${tags.includes(f.slug) ? 'is-on' : ''}`}>{catLabel(f, lang)}</button>)}
              </div>
            </div>
          )}
          <div className="wl-form-actions">
            <button type="button" onClick={() => setEdit(null)} className="wl-link is-quiet">{t('Cancel', 'Hủy')}</button>
            <button type="button" onClick={saveEdit} disabled={saving || !draft.trim()} className="wl-link is-gold is-big" style={{ opacity: saving || !draft.trim() ? 0.4 : 1 }}>
              {saving ? t('Saving…', 'Đang lưu…') : <>{t('Save changes', 'Lưu thay đổi')} <span className="pk-go" aria-hidden="true">→</span></>}
            </button>
          </div>
        </div>
      </MemberModal>
    </MemberPage>
  )
}

const CSS = `
  .wn-list { border-bottom: 1px solid rgba(229,212,194,.16); }
  .wn-entry { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 20px 40px; align-items: baseline;
              padding: 30px 0 32px; border-top: 1px solid rgba(229,212,194,.16); }
  .wn-when { display: flex; flex-direction: column; gap: 8px; }
  .wn-vis { font-family: ${MONO}; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: ${CREAM}; opacity: .7; }
  .wn-vis.is-shared { color: #9CC79C; opacity: 1; }
  .wn-name { font-family: ${SERIF}; font-weight: 400; font-size: clamp(24px, 2.6vw, 34px); line-height: 1.04; color: ${CREAM};
             text-decoration: none; background-image: linear-gradient(currentColor, currentColor); background-size: 0 1px;
             background-repeat: no-repeat; background-position: 0 100%; transition: background-size .45s cubic-bezier(.16,.84,.44,1);
             overflow-wrap: anywhere; }
  .wn-name:hover { background-size: 100% 1px; }
  .wn-text { font-family: ${MONO}; font-size: 13.5px; line-height: 1.95; color: ${CREAM}; opacity: .9; white-space: pre-wrap;
             max-width: 680px; margin-top: 14px; }

  .wn-empty-text { font-family: ${MONO}; font-size: 14px; line-height: 2; color: ${CREAM}; opacity: .9; max-width: 560px; margin: 0; }

  @media (max-width: 760px) {
    .wn-entry { grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 24px 0 26px; }
    .wn-when { flex-direction: row; justify-content: space-between; align-items: baseline; gap: 12px; }
  }
  @media (max-width: 600px) {
    .wn-empty-text { font-size: 13.5px; line-height: 1.95; }
  }
`
