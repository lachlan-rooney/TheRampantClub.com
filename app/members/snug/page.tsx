'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import MemberModal from '@/components/MemberModal'
import ConfirmModal from '@/components/members/ConfirmModal'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'
import { CreamInk } from '@/components/public/CreamInk'

// The Snug — a salon, not a timeline. A single unhurried column of house posts,
// member posts and snug tasting-notes (union-at-read), equal visual weight. No
// aggressive live-prepend; a gentle "new arrivals" nudge instead. Composer on the
// shared MemberModal.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Item {
  kind: 'house_post' | 'member_post' | 'tasting_note'
  item_type: string; id: string; created_at: string; author_name: string; is_own: boolean
  body?: string; note?: string; flavour_tags?: string[]; whisky_id?: string; whisky_name?: string; photo_url: string | null
  my_reactions: string[]; reaction_summary?: { raise_glass: number; noted: number; join_me: number }
}

const RX = [
  { key: 'raise_glass', emoji: '🥃', label: 'raise a glass', label_vn: 'nâng ly' },
  { key: 'noted', emoji: '🔖', label: 'noted', label_vn: 'đánh dấu' },
  { key: 'join_me', emoji: '🤝', label: 'join me', label_vn: 'cùng tôi nhé' },
] as const

const when = (iso: string, lang: Lang = 'en') => {
  const vn = lang === 'vn'
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return vn ? 'vừa xong' : 'just now'
  const m = Math.floor(s / 60); if (m < 60) return vn ? `${m} phút trước` : `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return vn ? `${h} giờ trước` : `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return vn ? `${d} ngày trước` : `${d}d ago`
  return new Date(iso).toLocaleDateString(vn ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short' })
}

export default function Snug() {
  const { t } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pending, setPending] = useState(0)            // gentle "new arrivals" nudge
  const [gate, setGate] = useState<'staff' | 'unlinked' | null>(null)
  const [composer, setComposer] = useState(false)
  const [draft, setDraft] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/social/snug')
    if (r.status === 403) { const j = await r.json().catch(() => ({})); setGate(j.reason === 'staff' ? 'staff' : 'unlinked'); setLoading(false); return }
    if (r.ok) { const j = await r.json(); setItems(j.items || []); setNext(j.next); setGate(null) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Quiet polling: don't prepend; just count what's new and offer a nudge.
  useEffect(() => {
    const t = setInterval(async () => {
      if (!items.length) return
      const r = await fetch('/api/social/snug')
      if (!r.ok) return
      const j = await r.json()
      const newest = items[0]?.created_at
      const n = (j.items || []).filter((it: Item) => newest && new Date(it.created_at) > new Date(newest)).length
      setPending(n)
    }, 30000)
    return () => clearInterval(t)
  }, [items])

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await fetch(`/api/social/snug?before=${encodeURIComponent(next)}`)
      if (r.ok) { const j = await r.json(); setItems(prev => [...prev, ...(j.items || [])]); setNext(j.next) }
    } finally { setLoadingMore(false) }
  }, [next, loadingMore])

  const refreshTop = useCallback(async () => { setPending(0); await load() }, [load])

  const post = useCallback(async () => {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true); setError('')
    try {
      const fd = new FormData(); fd.set('body', body); if (photo) fd.set('photo', photo)
      const r = await fetch('/api/social/posts', { method: 'POST', body: fd })
      if (r.ok) { setComposer(false); setDraft(''); setPhoto(null); await load() }
      else setError((await r.json().catch(() => ({})))?.error || t('Could not post.', 'Chưa đăng được.'))
    } finally { setPosting(false) }
  }, [draft, photo, posting, load, t])

  return (
    // The room carries its own drawing (beside the feed on a desk, beside the
    // invitation on a phone), so the masthead goes without one — unless the
    // room is closed to this login, when the masthead keeps the page's ink.
    <MemberPage art={gate ? undefined : null} title={t('The Snug', surfaceName('/members/snug', 'vn'))} subtitle={t('THE CLUB, IN CONVERSATION', 'NƠI CÂU LẠC BỘ TRÒ CHUYỆN')} description={t('Drams worth mentioning, moments from the floor, a word between members. Unhurried — like the room itself.', 'Những ly đáng nhắc đến, khoảnh khắc trong câu lạc bộ, đôi lời giữa các hội viên. Thong thả — như chính căn phòng này.')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {gate ? (
        <p className="sn-quiet sn-gate">
          {gate === 'staff'
            ? <>{t('The Snug is the members’ room. You can post house moments from ', 'The Snug là phòng của hội viên. Bạn có thể đăng khoảnh khắc của câu lạc bộ từ ')}<Link href="/admin/snug" className="sn-link">{t('the admin Snug →', 'trang Snug quản trị →')}</Link></>
            : <>{t('Your login isn’t linked to a membership yet. A word with the Club will set it right.', 'Tài khoản đăng nhập của bạn chưa được liên kết với tư cách thành viên. Chỉ cần báo với Câu lạc bộ, chúng tôi sẽ sắp xếp ngay.')}</>}
        </p>
      ) : (
        <div className="sn-grid">
          {/* The invitation to speak — first on a phone, beside the room on a desk. */}
          <aside className="sn-aside">
            <button onClick={() => setComposer(true)} className="sn-share pk-hover">
              <span>✎ {t('Share something', 'Chia sẻ đôi điều')}</span> <span className="pk-go">→</span>
            </button>
            {pending > 0 && (
              <button onClick={refreshTop} className="sn-nudge">↑ {pending} {t(pending === 1 ? 'new arrival' : 'new arrivals', 'bài mới')} — {t('tap to catch up', 'chạm để xem')}</button>
            )}
            <CreamInk name="girl-toast" width="100%" rot={5} dur={10} className="sn-art" />
          </aside>

          {/* The room: one unhurried column, house and members at equal weight. */}
          <div className="sn-feed">
            {loading ? (
              <p className="sn-quiet">{t('Settling in…', 'Đang vào phòng…')}</p>
            ) : items.length === 0 ? (
              <p className="sn-quiet">{t('Quiet in here for the moment. Pour something, and tell the room about it.', 'Lúc này trong phòng còn yên ắng. Hãy rót một ly và kể cho mọi người nghe.')}</p>
            ) : (
              <>
                {items.map(it => <FeedCard key={`${it.item_type}:${it.id}`} it={it} onChanged={load} />)}
                {next && (
                  <button onClick={loadMore} disabled={loadingMore} className="pk-cta sn-more">
                    {loadingMore ? t('Pouring…', 'Đang rót…') : <>{t('Earlier in the Snug', 'Bài cũ hơn trong The Snug')} <span className="pk-go">→</span></>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <MemberModal open={composer} onClose={() => { setComposer(false); setPhoto(null) }} title={t('Share with the Snug', 'Chia sẻ lên The Snug')} subtitle={t('THE ROOM WILL SEE THIS', 'MỌI NGƯỜI TRONG PHÒNG SẼ THẤY')}>
        {error && <div className="sn-err">{error}</div>}
        <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 8000))} rows={4} placeholder={t('A dram worth mentioning, a thought, a question for the room…', 'Một ly đáng nhắc đến, một suy nghĩ, một câu hỏi cho mọi người…')} className="sn-field" />
        <div className="sn-photo-row">
          {photo ? (
            <>
              <span className="sn-photo-name">{photo.name}</span>
              <button onClick={() => setPhoto(null)} className="sn-quietbtn is-danger">{t('Remove', 'Gỡ bỏ')}</button>
            </>
          ) : (
            <label className="sn-quietbtn sn-add">
              ＋ {t('Add a photo', 'Thêm ảnh')} <span className="sn-add-note">{t('(location stripped)', '(đã xoá vị trí)')}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f) }} />
            </label>
          )}
        </div>
        <div className="sn-actions">
          <button onClick={() => { setComposer(false); setPhoto(null) }} className="sn-quietbtn is-plain">{t('Cancel', 'Huỷ')}</button>
          <button onClick={post} disabled={posting || !draft.trim()} className="pk-cta sn-cta">
            {posting ? t('Sharing…', 'Đang chia sẻ…') : <>{t('Share', 'Chia sẻ')} <span className="pk-go">→</span></>}
          </button>
        </div>
      </MemberModal>
    </MemberPage>
  )
}

function FeedCard({ it, onChanged }: { it: Item; onChanged: () => void }) {
  const { t, lang } = useLang()
  const house = it.kind === 'house_post'
  const [mine, setMine] = useState<string[]>(it.my_reactions || [])
  const [summary, setSummary] = useState(it.reaction_summary)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(it.body || '')
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const canManage = it.is_own && it.kind === 'member_post'

  const saveEdit = async () => {
    const body = editDraft.trim(); if (!body) return
    const r = await fetch(`/api/social/posts/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
    if (r.ok) { setEditing(false); onChanged() }
  }
  const doDelete = async () => {
    setDeleting(true)
    const r = await fetch(`/api/social/posts/${it.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (r.ok) { setConfirmDel(false); onChanged() }
  }

  const toggle = async (reaction: string) => {
    const had = mine.includes(reaction)
    const optimistic = had ? mine.filter(r => r !== reaction) : [...mine, reaction]
    setMine(optimistic)
    if (it.is_own && summary) setSummary({ ...summary, [reaction]: Math.max(0, summary[reaction as keyof typeof summary] + (had ? -1 : 1)) })
    const r = await fetch('/api/social/reactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_type: it.item_type, item_id: it.id, reaction }),
    })
    if (!r.ok) { setMine(mine); setSummary(it.reaction_summary) }   // revert
  }

  return (
    <article className={`sn-item ${house ? 'is-house' : ''}`}>
      <div className="sn-top">
        <span className="sn-author">
          {it.author_name}{it.is_own && !house ? ` · ${t('you', 'bạn')}` : ''}
        </span>
        <span className="sn-when">{when(it.created_at, lang)}</span>
      </div>

      {it.kind === 'tasting_note' ? (
        <>
          <div className="sn-noted">
            {t('noted', 'đã ghi chú về')} <Link href={`/members/whisky/${it.whisky_id}`} className="sn-link">{it.whisky_name}</Link>
          </div>
          <div className="sn-body">{it.note}</div>
          {(it.flavour_tags?.length ?? 0) > 0 && (
            <div className="sn-tags">
              {it.flavour_tags!.map(tag => <span key={tag} className="sn-tag">{tag.replace(/_/g, ' ')}</span>)}
            </div>
          )}
        </>
      ) : (
        <div className="sn-body">{it.body}</div>
      )}

      {it.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={it.photo_url} alt={t('Photograph shared in the Snug', 'Ảnh được chia sẻ trong The Snug')} loading="lazy" decoding="async" className="sn-photo" />
      )}

      <div className="sn-rx">
        {RX.map(r => {
          const on = mine.includes(r.key)
          return (
            <button key={r.key} onClick={() => toggle(r.key)} title={t(r.label, r.label_vn)} className={`sn-rxbtn ${on ? 'is-on' : ''}`} aria-pressed={on}>
              <span aria-hidden>{r.emoji}</span> {t(r.label, r.label_vn)}
            </button>
          )
        })}
      </div>
      {/* QUIET: only the poster sees the tally on their own item. */}
      {it.is_own && summary && (summary.raise_glass + summary.noted + summary.join_me > 0) && (
        <div className="sn-tally">
          {RX.filter(r => summary[r.key as keyof typeof summary] > 0).map(r => `${r.emoji} ${summary[r.key as keyof typeof summary]}`).join('  ·  ')}
        </div>
      )}

      {canManage && (
        <div className="sn-manage">
          <button onClick={() => { setEditDraft(it.body || ''); setEditing(true) }} className="sn-quietbtn">{t('Edit', 'Sửa')}</button>
          <button onClick={() => setConfirmDel(true)} className="sn-quietbtn is-danger">{t('Delete', 'Xoá')}</button>
        </div>
      )}

      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={doDelete}
        busy={deleting}
        danger
        title={t('Delete this post?', 'Xoá bài đăng này?')}
        body={t("This removes your post from the Snug for everyone. This can't be undone.", 'Bài đăng sẽ bị xoá khỏi The Snug với tất cả mọi người. Không thể hoàn tác.')}
        confirmLabel={t('Delete', 'Xoá')}
        cancelLabel={t('Cancel', 'Huỷ')}
      />

      <MemberModal open={editing} onClose={() => setEditing(false)} title={t('Edit your post', 'Sửa bài đăng')}>
        <textarea value={editDraft} onChange={e => setEditDraft(e.target.value.slice(0, 8000))} rows={4} className="sn-field" />
        <div className="sn-actions">
          <button onClick={() => setEditing(false)} className="sn-quietbtn is-plain">{t('Cancel', 'Huỷ')}</button>
          <button onClick={saveEdit} disabled={!editDraft.trim()} className="pk-cta sn-cta">{t('Save', 'Lưu')} <span className="pk-go">→</span></button>
        </div>
      </MemberModal>
    </article>
  )
}

const SERIF = "'Rampant Sans', serif"
const LINE = 'rgba(229,212,194,.18)'

// The composer and the edit sheet are portalled to <body>, so every rule here
// names its own colour rather than inheriting one from the page.
const CSS = `
  .sn-grid { display: grid; grid-template-columns: minmax(0, 720px) minmax(200px, 1fr); gap: 80px; align-items: start; }
  .sn-feed { grid-column: 1; grid-row: 1; min-width: 0; }
  .sn-aside { grid-column: 2; grid-row: 1; position: sticky; top: 110px; }

  .sn-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8; max-width: 560px; margin: 0; }
  .sn-gate { max-width: 620px; }
  .sn-link { color: #D4B85A; text-decoration: none; border-bottom: 1px solid rgba(212,184,90,.5); padding-bottom: 1px; }
  .sn-link:hover { border-bottom-color: #D4B85A; }

  .sn-share { display: inline-flex; align-items: baseline; gap: 14px; background: none; border: none; cursor: pointer; text-align: left;
              padding: 0 0 8px; border-bottom: 1px solid #D4B85A; border-radius: 0; color: #E5D4C2; white-space: nowrap;
              font-family: ${SERIF}; font-size: clamp(24px, 2.3vw, 32px); line-height: 1.05; }
  .sn-share .pk-go { font-family: ${MONO}; font-size: 16px; color: #D4B85A; }
  .sn-nudge { display: block; margin-top: 22px; background: none; border: none; padding: 0; cursor: pointer; text-align: left;
              font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; color: #D4B85A; }
  .sn-nudge:hover { text-decoration: underline; text-underline-offset: 4px; }
  .sn-art { width: min(100%, 240px); margin: 64px 0 0 10%; }

  .sn-item { padding: 30px 0 32px; border-top: 1px solid ${LINE}; }
  .sn-item.is-house { border-top-color: rgba(212,184,90,.55); }
  .sn-item:last-of-type { border-bottom: 1px solid ${LINE}; }
  .sn-top { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 14px; }
  .sn-author { font-family: ${SERIF}; font-size: clamp(24px, 2.4vw, 30px); line-height: 1.05; color: #E5D4C2; min-width: 0; overflow-wrap: anywhere; }
  .sn-item.is-house .sn-author { color: #D4B85A; }
  .sn-when { flex: 0 0 auto; font-family: ${MONO}; font-size: 11.5px; letter-spacing: .06em; color: #E5D4C2; opacity: .65; }
  .sn-noted { font-family: ${MONO}; font-size: 13px; line-height: 1.7; color: #E5D4C2; opacity: .85; margin-bottom: 10px; }
  .sn-body { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; white-space: pre-wrap; word-break: break-word; }
  .sn-tags { display: flex; flex-wrap: wrap; margin-top: 12px; font-family: ${MONO}; font-size: 12px; line-height: 1.8; color: #D4B85A; }
  .sn-tag + .sn-tag::before { content: '·'; margin: 0 9px; opacity: .6; }
  .sn-photo { display: block; width: 100%; max-height: 520px; object-fit: cover; border-radius: 6px; margin-top: 18px;
              box-shadow: 0 14px 34px rgba(0,0,0,.25); }

  .sn-rx { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 20px; }
  .sn-rxbtn { background: none; border: none; border-bottom: 1px solid transparent; border-radius: 0; padding: 0 0 4px; cursor: pointer;
              font-family: ${MONO}; font-size: 12px; letter-spacing: .02em; color: #E5D4C2; opacity: .72;
              transition: opacity .2s ease, color .2s ease, border-color .2s ease; }
  .sn-rxbtn:hover { opacity: 1; }
  .sn-rxbtn.is-on { color: #D4B85A; opacity: 1; border-bottom-color: #D4B85A; }
  .sn-tally { font-family: ${MONO}; font-size: 12px; letter-spacing: .04em; color: #E5D4C2; opacity: .7; margin-top: 12px; }
  .sn-manage { display: flex; gap: 22px; margin-top: 16px; }

  .sn-quietbtn { background: none; border: none; padding: 0 0 4px; cursor: pointer; color: #E5D4C2; opacity: .78;
                 font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
                 border-bottom: 1px solid rgba(229,212,194,.35); border-radius: 0; transition: opacity .2s ease; }
  .sn-quietbtn:hover { opacity: 1; }
  .sn-quietbtn.is-danger { color: #E89B9B; border-bottom-color: rgba(232,155,155,.4); }
  .sn-quietbtn.is-plain { border-bottom-color: transparent; }

  .pk-cta.sn-more { color: #E5D4C2; margin-top: 34px; }
  .pk-cta.sn-more:disabled { opacity: .5; cursor: default; }
  .pk-cta.sn-cta { margin-top: 0; color: #D4B85A; }
  .pk-cta.sn-cta:disabled { opacity: .4; cursor: not-allowed; }
  .pk-cta.sn-cta:disabled .pk-go { transform: none; }

  .sn-err { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; color: #E89B9B; margin-bottom: 10px; }
  .sn-field { display: block; width: 100%; box-sizing: border-box; resize: vertical; background: transparent; color: #E5D4C2;
              border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; padding: 12px 0;
              font-family: ${MONO}; font-size: 14px; line-height: 1.8; outline: none; transition: border-color .25s ease; }
  .sn-field::placeholder { color: rgba(229,212,194,.5); }
  .sn-field:focus { border-bottom-color: #D4B85A; }
  /* beats the portal's keyboard ring (layout: [class*=member] textarea:focus-visible) — the gold underline is the focus mark */
  .sn-field.sn-field:focus-visible { outline: none; border-radius: 0; }
  .sn-photo-row { display: flex; align-items: baseline; gap: 16px; margin-top: 18px; min-width: 0; }
  .sn-photo-name { font-family: ${MONO}; font-size: 12.5px; color: #E5D4C2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
  .sn-add { display: inline-block; text-transform: none; letter-spacing: .04em; font-size: 12.5px; }
  .sn-add-note { opacity: .7; }
  .sn-actions { display: flex; justify-content: flex-end; align-items: baseline; gap: 28px; margin-top: 26px; flex-wrap: wrap; }

  @media (max-width: 960px) {
    .sn-grid { grid-template-columns: minmax(0, 1fr); gap: 36px; }
    .sn-feed, .sn-aside { grid-column: 1; grid-row: auto; }
    /* on a phone the drawing sits beside the invitation, the way the
       masthead's does beside the way back */
    .sn-aside { position: static; display: grid; grid-template-columns: minmax(0, 1fr) 92px; align-items: end; gap: 16px; }
    .sn-share, .sn-nudge { grid-column: 1; justify-self: start; }
    .sn-art { grid-column: 2; grid-row: 1 / span 2; width: 92px; margin: 0; }
  }
  @media (max-width: 760px) {
    .sn-item { padding: 26px 0 28px; }
    .sn-field { font-size: 16px; }
  }
`
