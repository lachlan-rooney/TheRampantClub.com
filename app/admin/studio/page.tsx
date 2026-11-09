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
// A PIECE ON THE WALL, which is not the same object as a photograph of the
// room — see db/collaboration_pieces.sql. These feed the public gallery guide
// at /studio/<slug>/guide, in `sort` order, which is the WALKING order.
interface Piece { id: string; collaboration_id: string; sort: number
  title_en: string | null; title_vn: string | null; artist_name: string | null
  year: string | null; medium_en: string | null; medium_vn: string | null
  dimensions: string | null; image_path: string | null
  description_en: string | null; description_vn: string | null; provenance: string | null }

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
  const [pieces, setPieces] = useState<Piece[]>([])

  const loadPieces = useCallback((id: string | null) => {
    if (!id) { setPieces([]); return }
    fetch(`/api/admin/studio/pieces?collaboration=${id}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => setPieces(j.pieces || [])).catch(() => {})
  }, [])
  useEffect(() => { loadPieces(sel) }, [sel, loadPieces])

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
  // ── PIECES ──────────────────────────────────────────────────────────────
  const addPiece = async () => {
    if (!c) return
    setBusy(true); setMsg(null)
    const r = await fetch('/api/admin/studio/pieces', { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collaboration_id: c.id }) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? t('Piece added — fill it in below.', 'Đã thêm tác phẩm — điền thông tin bên dưới.')
                : (j.error || t('Could not add it.', 'Không thể thêm.')))
    if (r.ok) loadPieces(c.id)
    setBusy(false)
  }
  // Saved on blur, one field at a time. A single Save for a 20-piece catalogue
  // is a form somebody loses an afternoon of typing out of.
  const patchPiece = async (id: string, patch: Record<string, unknown>) => {
    await fetch('/api/admin/studio/pieces', { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    loadPieces(sel)
  }
  const movePiece = async (pc: Piece, dir: -1 | 1) => {
    const list = [...pieces].sort((a, b) => a.sort - b.sort)
    const i = list.findIndex(x => x.id === pc.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    await patchPiece(list[i].id, { sort: list[j].sort })
    await patchPiece(list[j].id, { sort: list[i].sort })
  }
  const pieceImage = async (id: string, f: File) => {
    setBusy(true); setMsg(null)
    const fd = new FormData(); fd.append('file', f); fd.append('id', id)
    const r = await fetch('/api/admin/studio/pieces', { method: 'POST', body: fd })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? t('Image added.', 'Đã thêm ảnh.') : (j.error || t('Could not add that image.', 'Không thể thêm ảnh.')))
    if (r.ok) loadPieces(sel)
    setBusy(false)
  }
  const removePiece = async (id: string) => {
    setBusy(true)
    await fetch(`/api/admin/studio/pieces?piece=${id}`, { method: 'DELETE' })
    loadPieces(sel); setBusy(false)
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

            <Row label={t('Film (YouTube link)', 'Phim (liên kết YouTube)')}>
              <input style={input} value={String(val('film_url'))}
                placeholder="https://www.youtube.com/watch?v=…"
                onChange={e => setDraft(s => ({ ...s, film_url: e.target.value }))} />
            </Row>

            <Row label={t('Signature image (path)', 'Ảnh chữ ký (đường dẫn)')}>
              <input style={input} value={String(val('signature_path'))}
                placeholder="/images/studio/…/signature.png"
                onChange={e => setDraft(s => ({ ...s, signature_path: e.target.value }))} />
              <div style={{ ...meta, marginTop: 4 }}>
                {t('Must be on a transparent ground, or it shows as a white box.',
                   'Phải có nền trong suốt, nếu không sẽ hiện thành ô trắng.')}
              </div>
            </Row>

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

          {/* ══ THE GALLERY GUIDE ══════════════════════════════════════════
              The pieces a guest walks past, in that order, with the label a
              gallery would print and the story behind it. This is what the QR
              in the printed booklet leads to. Saved field by field on blur —
              one Save button for a twenty-piece catalogue is an afternoon of
              typing somebody eventually loses. */}
          <div style={{ ...card, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={sectionLabel}>{t('Gallery guide — the pieces', 'Hướng dẫn tham quan — các tác phẩm')}</div>
              <a href={`/studio/${c.slug}/guide`} target="_blank" rel="noreferrer" style={{ ...mini, textDecoration: 'none' }}>
                {t('Open the guide', 'Mở hướng dẫn')} →
              </a>
            </div>
            <div style={{ ...meta, marginBottom: 10 }}>
              {t('In the order a guest walks past them. Each field saves when you click away. Anything left empty is simply left off the label — nothing is invented.',
                 'Theo thứ tự khách sẽ đi qua. Mỗi ô tự lưu khi bạn bấm ra ngoài. Ô để trống sẽ không hiện trên nhãn — hệ thống không tự điền.')}
            </div>

            {[...pieces].sort((a, b) => a.sort - b.sort).map((pc, i) => (
              <div key={pc.id} style={{ padding: '16px 0', borderTop: '1px solid rgba(229,212,194,0.09)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ ...meta, fontWeight: 700, color: '#E5D4C2' }}>
                    {String(i + 1).padStart(2, '0')} / {String(pieces.length).padStart(2, '0')}
                  </span>
                  <button style={mini} disabled={i === 0} onClick={() => movePiece(pc, -1)}>↑</button>
                  <button style={mini} disabled={i === pieces.length - 1} onClick={() => movePiece(pc, 1)}>↓</button>
                  <button style={{ ...mini, color: '#C27070', borderColor: '#C27070', marginLeft: 'auto' }}
                          onClick={() => removePiece(pc.id)}>{t('Remove', 'Xoá')}</button>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 96, flexShrink: 0 }}>
                    {pc.image_path
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={pc.image_path} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                      : <div style={{ width: 96, height: 96, borderRadius: 4, border: '1px dashed rgba(229,212,194,0.25)',
                                      display: 'grid', placeItems: 'center', ...meta, textAlign: 'center', padding: 6 }}>
                          {t('no image', 'chưa có ảnh')}
                        </div>}
                    <input type="file" accept="image/jpeg,image/png,image/webp"
                           onChange={e => { const f = e.target.files?.[0]; if (f) pieceImage(pc.id, f); e.target.value = '' }}
                           style={{ ...input, padding: 5, fontSize: 9, marginTop: 6 }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <Row label={t('Title — English', 'Tên — Tiếng Anh')}>
                      <input style={input} defaultValue={pc.title_en || ''} placeholder={t('As the label prints it', 'Như trên nhãn')}
                             onBlur={e => e.target.value !== (pc.title_en || '') && patchPiece(pc.id, { title_en: e.target.value })} />
                    </Row>
                    <Row label={t('Title — Vietnamese', 'Tên — Tiếng Việt')}>
                      <input style={input} defaultValue={pc.title_vn || ''}
                             onBlur={e => e.target.value !== (pc.title_vn || '') && patchPiece(pc.id, { title_vn: e.target.value })} />
                    </Row>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 110 }}>
                        <Row label={t('Year', 'Năm')}>
                          {/* Text, not a number: "2023–24", "n.d." and "c. 1890" are all real labels. */}
                          <input style={input} defaultValue={pc.year || ''} placeholder="2026"
                                 onBlur={e => e.target.value !== (pc.year || '') && patchPiece(pc.id, { year: e.target.value })} />
                        </Row>
                      </div>
                      <div style={{ flex: 2, minWidth: 140 }}>
                        <Row label={t('Dimensions', 'Kích thước')}>
                          <input style={input} defaultValue={pc.dimensions || ''} placeholder="120 × 90 cm"
                                 onBlur={e => e.target.value !== (pc.dimensions || '') && patchPiece(pc.id, { dimensions: e.target.value })} />
                        </Row>
                      </div>
                    </div>
                    <Row label={t('Medium — English', 'Chất liệu — Tiếng Anh')}>
                      <input style={input} defaultValue={pc.medium_en || ''} placeholder="Oil on linen"
                             onBlur={e => e.target.value !== (pc.medium_en || '') && patchPiece(pc.id, { medium_en: e.target.value })} />
                    </Row>
                    <Row label={t('Medium — Vietnamese', 'Chất liệu — Tiếng Việt')}>
                      <input style={input} defaultValue={pc.medium_vn || ''}
                             onBlur={e => e.target.value !== (pc.medium_vn || '') && patchPiece(pc.id, { medium_vn: e.target.value })} />
                    </Row>
                    <Row label={t('Artist — only if not the exhibition’s own', 'Nghệ sĩ — chỉ khi khác với nghệ sĩ của triển lãm')}>
                      <input style={input} defaultValue={pc.artist_name || ''} placeholder={c.artist_name}
                             onBlur={e => e.target.value !== (pc.artist_name || '') && patchPiece(pc.id, { artist_name: e.target.value })} />
                    </Row>
                    <Row label={t('Description — English', 'Mô tả — Tiếng Anh')}>
                      <textarea style={{ ...input, minHeight: 92, lineHeight: 1.7 }} defaultValue={pc.description_en || ''}
                                placeholder={t('What the guest is looking at, and what they would not see by looking.',
                                               'Khách đang xem gì, và điều gì họ sẽ không tự nhận ra.')}
                                onBlur={e => e.target.value !== (pc.description_en || '') && patchPiece(pc.id, { description_en: e.target.value })} />
                    </Row>
                    <Row label={t('Description — Vietnamese', 'Mô tả — Tiếng Việt')}>
                      <textarea style={{ ...input, minHeight: 92, lineHeight: 1.7 }} defaultValue={pc.description_vn || ''}
                                onBlur={e => e.target.value !== (pc.description_vn || '') && patchPiece(pc.id, { description_vn: e.target.value })} />
                    </Row>
                    <Row label={t('Provenance — optional', 'Nguồn gốc — không bắt buộc')}>
                      <input style={input} defaultValue={pc.provenance || ''}
                             onBlur={e => e.target.value !== (pc.provenance || '') && patchPiece(pc.id, { provenance: e.target.value })} />
                    </Row>
                  </div>
                </div>
              </div>
            ))}

            {pieces.length === 0 && (
              <div style={{ ...meta, marginTop: 10 }}>
                {t('No pieces yet. The guide tells a guest it is being written rather than showing placeholders under a real artist’s name.',
                   'Chưa có tác phẩm. Trang hướng dẫn sẽ thông báo đang được soạn, thay vì hiện nội dung mẫu dưới tên một nghệ sĩ thật.')}
              </div>
            )}
            <button disabled={busy} onClick={addPiece} style={{ ...btn, marginTop: 14 }}>
              {busy ? '…' : t('+ Add a piece', '+ Thêm tác phẩm')}
            </button>
            <div style={{ ...meta, marginTop: 10 }}>
              {t('The printed booklet’s QR points at /studio/guide, which always follows whichever exhibition is live. Regenerate it with: node scripts/studio-qr.mjs',
                 'Mã QR trong sách hướng dẫn in trỏ tới /studio/guide, luôn theo triển lãm đang diễn ra. Tạo lại bằng: node scripts/studio-qr.mjs')}
            </div>
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
