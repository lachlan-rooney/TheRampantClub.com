'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// THE STUDIO, EDITABLE — so a wording change is typing, not a migration.
// ───────────────────────────────────────────────────────────────────────────
// The collaborations table shipped without this, which made every content
// change a hand-written SQL file. An admin portal you cannot administer from is
// a database with extra steps. Everything the public page renders is here.
const MONO = "'Google Sans Code', monospace"
const SERIF = "'Rampant Sans', serif"

interface Collab { id: string; slug: string; artist_name: string; artist_name_vn: string | null
  title_en: string | null; title_vn: string | null; status: string
  opens_on: string | null; closes_on: string | null; opening_from: string | null; opening_to: string | null
  auction_on: string | null; accent: string | null; hero_path: string | null; sort: number
  [k: string]: unknown }
interface Img { id: string; collaboration_id: string; storage_path: string
  caption_en: string | null; caption_vn: string | null; orientation: string; sort: number }

const SECTIONS = [
  ['collaboration', 'The collaboration'], ['inspiration', 'In the artist’s words'],
  ['event', 'The event'], ['food', 'The food'], ['drinks', 'The drinks'], ['bio', 'Biography'],
] as const

export default function StudioAdmin() {
  const { t } = useLang()
  const [d, setD] = useState<{ collaborations: Collab[]; images: Img[] } | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch('/api/admin/studio', { cache: 'no-store' }).then(r => r.json())
      .then(j => { setD(j); if (!sel && j.collaborations?.[0]) setSel(j.collaborations[0].id) })
      .catch(() => {})
  }, [sel])
  useEffect(load, [load])

  const c = d?.collaborations.find(x => x.id === sel) || null
  const imgs = (d?.images || []).filter(i => i.collaboration_id === sel)
  const val = (k: string) => (k in draft ? draft[k] : c?.[k]) ?? ''

  const save = async () => {
    if (!c) return
    setBusy(true); setMsg(null)
    const r = await fetch('/api/admin/studio', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'collaboration', id: c.id, ...draft }) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? t('Saved.', 'Đã lưu.') : (j.error || t('Could not save.', 'Không thể lưu.')))
    if (r.ok) { setDraft({}); load() }
    setBusy(false)
  }

  const upload = async (f: File) => {
    if (!c) return
    setBusy(true); setMsg(null)
    const fd = new FormData(); fd.append('file', f); fd.append('collaboration_id', c.id)
    const r = await fetch('/api/admin/studio', { method: 'POST', body: fd })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? t('Image added.', 'Đã thêm ảnh.') : (j.error || t('Could not add that image.', 'Không thể thêm ảnh.')))
    if (r.ok) load()
    setBusy(false); if (fileRef.current) fileRef.current.value = ''
  }

  const patchImg = async (id: string, patch: Record<string, unknown>) => {
    await fetch('/api/admin/studio', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'image', id, ...patch }) })
    load()
  }
  const move = async (im: Img, dir: -1 | 1) => {
    const list = [...imgs].sort((a, b) => a.sort - b.sort)
    const i = list.findIndex(x => x.id === im.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    await patchImg(list[i].id, { sort: list[j].sort })
    await patchImg(list[j].id, { sort: list[i].sort })
  }
  const removeImg = async (id: string) => {
    setBusy(true)
    await fetch(`/api/admin/studio?image=${id}`, { method: 'DELETE' })
    load(); setBusy(false)
  }

  if (!d) return null
  const dirty = Object.keys(draft).length > 0

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#E5D4C2' }}>{t('The Studio', 'Phòng Studio')}</h1>
        <a href="/studio" target="_blank" rel="noreferrer" style={ghost}>{t('View the page', 'Xem trang')} →</a>
      </div>
      <p style={meta}>{t('Everything the public page shows is edited here. No SQL.',
                         'Mọi nội dung hiển thị công khai đều chỉnh sửa tại đây. Không cần SQL.')}</p>

      {msg && <div style={warn}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 4px' }}>
        {d.collaborations.map(x => (
          <button key={x.id} onClick={() => { setSel(x.id); setDraft({}) }}
            style={{ ...tab, ...(x.id === sel ? tabOn : null) }}>
            {x.artist_name}
            <span style={{ opacity: .6 }}> · {x.status}</span>
          </button>
        ))}
      </div>

      {c && (
        <>
          <div style={card}>
            <Row label={t('Artist', 'Nghệ sĩ')}><input style={input} value={String(val('artist_name'))}
              onChange={e => setDraft(s => ({ ...s, artist_name: e.target.value }))} /></Row>
            <Row label={t('Exhibition title', 'Tên triển lãm')}><input style={input} value={String(val('title_en'))}
              onChange={e => setDraft(s => ({ ...s, title_en: e.target.value }))} /></Row>

            <Row label={t('Visible', 'Hiển thị')}>
              <select style={input} value={String(val('status'))}
                onChange={e => setDraft(s => ({ ...s, status: e.target.value }))}>
                <option value="draft">{t('Draft — nobody can see it', 'Nháp — chưa ai xem được')}</option>
                <option value="live">{t('Published', 'Đã đăng')}</option>
                <option value="past">{t('Published (archive)', 'Đã đăng (lưu trữ)')}</option>
              </select>
              <div style={{ ...meta, marginTop: 4 }}>
                {t('Published does not mean “on now” — the dates decide that.',
                   '“Đã đăng” không có nghĩa là “đang diễn ra” — ngày tháng quyết định điều đó.')}
              </div>
            </Row>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <Row label={t('Run opens', 'Bắt đầu trưng bày')}><input type="date" style={input}
                value={String(val('opens_on')).slice(0, 10)}
                onChange={e => setDraft(s => ({ ...s, opens_on: e.target.value }))} /></Row>
              <Row label={t('Run closes', 'Kết thúc trưng bày')}><input type="date" style={input}
                value={String(val('closes_on')).slice(0, 10)}
                onChange={e => setDraft(s => ({ ...s, closes_on: e.target.value }))} /></Row>
              <Row label={t('Opening night from', 'Khai mạc từ')}><input type="date" style={input}
                value={String(val('opening_from')).slice(0, 10)}
                onChange={e => setDraft(s => ({ ...s, opening_from: e.target.value }))} /></Row>
              <Row label={t('Opening night to', 'Khai mạc đến')}><input type="date" style={input}
                value={String(val('opening_to')).slice(0, 10)}
                onChange={e => setDraft(s => ({ ...s, opening_to: e.target.value }))} /></Row>
            </div>
            <div style={{ ...meta, marginTop: -4 }}>
              {t('The run is what a member can walk in and see. The opening is the night itself.',
                 'Thời gian trưng bày là lúc hội viên có thể vào xem. Khai mạc là buổi tối đó.')}
            </div>
          </div>

          {SECTIONS.map(([key, label]) => (
            <div key={key} style={{ ...card, marginTop: 12 }}>
              <div style={sectionLabel}>{label}</div>
              <textarea style={{ ...input, minHeight: 130, lineHeight: 1.7 }} value={String(val(`${key}_en`))}
                onChange={e => setDraft(s => ({ ...s, [`${key}_en`]: e.target.value }))}
                placeholder={t('English — leave empty and this section does not appear at all.',
                               'Tiếng Anh — để trống thì mục này sẽ không hiển thị.')} />
              <textarea style={{ ...input, minHeight: 100, marginTop: 8, lineHeight: 1.7 }} value={String(val(`${key}_vn`))}
                onChange={e => setDraft(s => ({ ...s, [`${key}_vn`]: e.target.value }))}
                placeholder={t('Tiếng Việt — empty falls back to English.',
                               'Tiếng Việt — để trống sẽ hiển thị tiếng Anh.')} />
            </div>
          ))}

          {dirty && (
            <div style={{ position: 'sticky', bottom: 0, padding: '12px 0', background: '#052E20' }}>
              <button disabled={busy} onClick={save} style={{ ...btn, borderColor: '#7AB07A', color: '#7AB07A' }}>
                {busy ? '…' : t('Save changes', 'Lưu thay đổi')}
              </button>
              <button onClick={() => setDraft({})} style={{ ...btn, marginLeft: 8 }}>{t('Discard', 'Bỏ')}</button>
            </div>
          )}

          {/* ── IMAGES ─────────────────────────────────────────────────── */}
          <div style={{ ...card, marginTop: 16 }}>
            <div style={sectionLabel}>{t('Images', 'Hình ảnh')}</div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
              style={{ ...input, padding: 8 }} />
            <div style={{ ...meta, marginTop: 6 }}>
              {t('JPEG, PNG or WebP, up to 4MB. Re-encoded and stripped of location data on the way in.',
                 'JPEG, PNG hoặc WebP, tối đa 4MB. Ảnh được mã hoá lại và xoá dữ liệu vị trí khi tải lên.')}
            </div>

            {imgs.sort((a, b) => a.sort - b.sort).map((im, i) => (
              <div key={im.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                                        padding: '14px 0', borderBottom: '1px solid rgba(229,212,194,0.07)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.storage_path} alt="" style={{ width: 82, height: 82, objectFit: 'cover',
                                                           borderRadius: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input style={{ ...input, fontSize: 12 }} defaultValue={im.caption_en || ''}
                    placeholder={t('Caption', 'Chú thích')}
                    onBlur={e => e.target.value !== (im.caption_en || '') && patchImg(im.id, { caption_en: e.target.value })} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={meta}>{im.orientation}</span>
                    <button style={mini} disabled={i === 0} onClick={() => move(im, -1)}>↑</button>
                    <button style={mini} disabled={i === imgs.length - 1} onClick={() => move(im, 1)}>↓</button>
                    <button style={mini} onClick={() => setDraft(s => ({ ...s, hero_path: im.storage_path }))}>
                      {t('Use as hero', 'Dùng làm ảnh bìa')}
                    </button>
                    <button style={{ ...mini, color: '#C27070', borderColor: '#C27070' }}
                      onClick={() => removeImg(im.id)}>{t('Remove', 'Xoá')}</button>
                  </div>
                </div>
              </div>
            ))}
            {imgs.length === 0 && <div style={{ ...meta, marginTop: 10 }}>
              {t('No images yet — the page will read as a wall of text until there are some.',
                 'Chưa có ảnh — trang sẽ chỉ toàn chữ cho đến khi có ảnh.')}</div>}
          </div>
        </>
      )}

      <div style={{ marginTop: 18 }}><Link href="/admin" style={ghost}>← {t('Admin', 'Quản trị')}</Link></div>
    </>
  )
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={sectionLabel}>{label}</div>{children}
  </div>
)

const meta: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', lineHeight: 1.7 }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 5 }
const card: React.CSSProperties = { padding: '14px 16px', borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)' }
const input: React.CSSProperties = { width: '100%', fontFamily: MONO, fontSize: 12.5, padding: '10px 12px', borderRadius: 7, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const btn: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, padding: '10px 16px', borderRadius: 6, border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer' }
const mini: React.CSSProperties = { ...btn, fontSize: 10, padding: '5px 10px' }
const ghost: React.CSSProperties = { ...btn, textDecoration: 'none', display: 'inline-block' }
const tab: React.CSSProperties = { ...btn, fontSize: 11 }
const tabOn: React.CSSProperties = { background: 'rgba(229,212,194,0.10)', color: '#E5D4C2', borderColor: 'rgba(229,212,194,0.4)' }
const warn: React.CSSProperties = { ...meta, color: '#D4B85A', marginTop: 10, padding: '9px 12px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
