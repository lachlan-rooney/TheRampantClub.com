'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import MemberModal from '@/components/MemberModal'
import ConfirmModal from '@/components/members/ConfirmModal'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'

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
    <MemberPage title={t('The Snug', surfaceName('/members/snug', 'vn'))} subtitle={t('THE CLUB, IN CONVERSATION', 'NƠI CÂU LẠC BỘ TRÒ CHUYỆN')} description={t('Drams worth mentioning, moments from the floor, a word between members. Unhurried — like the room itself.', 'Những ly đáng nhắc đến, khoảnh khắc trong câu lạc bộ, đôi lời giữa các hội viên. Thong thả — như chính căn phòng này.')}>
      {gate ? (
        <div style={gateWrap}>
          {gate === 'staff'
            ? <>{t('The Snug is the members’ room. You can post house moments from ', 'The Snug là phòng của hội viên. Bạn có thể đăng khoảnh khắc của câu lạc bộ từ ')}<Link href="/admin/snug" style={gateLink}>{t('the admin Snug →', 'trang Snug quản trị →')}</Link></>
            : <>{t('Your login isn’t linked to a membership yet. A word with the Club will set it right.', 'Tài khoản đăng nhập của bạn chưa được liên kết với tư cách thành viên. Chỉ cần báo với Câu lạc bộ, chúng tôi sẽ sắp xếp ngay.')}</>}
        </div>
      ) : (
        <>
          <button onClick={() => setComposer(true)} style={shareBtn}>✎ {t('Share something', 'Chia sẻ đôi điều')}</button>

          {pending > 0 && (
            <button onClick={refreshTop} style={nudge}>↑ {pending} {t(pending === 1 ? 'new arrival' : 'new arrivals', 'bài mới')} — {t('tap to catch up', 'chạm để xem')}</button>
          )}

          {loading ? (
            <p style={muted}>{t('Settling in…', 'Đang vào phòng…')}</p>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={muted}>{t('Quiet in here for the moment. Pour something, and tell the room about it.', 'Lúc này trong phòng còn yên ắng. Hãy rót một ly và kể cho mọi người nghe.')}</p>
            </div>
          ) : (
            <div>
              {items.map(it => <FeedCard key={`${it.item_type}:${it.id}`} it={it} onChanged={load} />)}
              {next && <button onClick={loadMore} disabled={loadingMore} style={moreBtn}>{loadingMore ? t('Pouring…', 'Đang rót…') : t('Earlier in the Snug', 'Bài cũ hơn trong The Snug')}</button>}
            </div>
          )}
        </>
      )}

      <MemberModal open={composer} onClose={() => { setComposer(false); setPhoto(null) }} title={t('Share with the Snug', 'Chia sẻ lên The Snug')} subtitle={t('THE ROOM WILL SEE THIS', 'MỌI NGƯỜI TRONG PHÒNG SẼ THẤY')}>
        {error && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 8 }}>{error}</div>}
        <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 8000))} rows={4} placeholder={t('A dram worth mentioning, a thought, a question for the room…', 'Một ly đáng nhắc đến, một suy nghĩ, một câu hỏi cho mọi người…')} style={textarea} />
        <div style={{ marginTop: 12 }}>
          {photo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#E5D4C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{photo.name}</span>
              <button onClick={() => setPhoto(null)} style={{ ...smallChip, color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>{t('Remove', 'Gỡ bỏ')}</button>
            </div>
          ) : (
            <label style={{ ...smallChip, cursor: 'pointer', display: 'inline-block' }}>
              ＋ {t('Add a photo', 'Thêm ảnh')} <span style={{ opacity: 0.5 }}>{t('(location stripped)', '(đã xoá vị trí)')}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f) }} />
            </label>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={() => { setComposer(false); setPhoto(null) }} style={cancelBtn}>{t('Cancel', 'Huỷ')}</button>
          <button onClick={post} disabled={posting || !draft.trim()} style={{ ...postBtn, opacity: posting || !draft.trim() ? 0.4 : 1 }}>{posting ? t('Sharing…', 'Đang chia sẻ…') : t('Share', 'Chia sẻ')}</button>
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
    <div style={{ ...card, ...(house ? houseCard : null) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: house ? '#D4B85A' : '#E5D4C2' }}>
          {it.author_name}{it.is_own && !house ? ` · ${t('you', 'bạn')}` : ''}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{when(it.created_at, lang)}</span>
      </div>

      {it.kind === 'tasting_note' ? (
        <>
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 6 }}>
            {t('noted', 'đã ghi chú về')} <Link href={`/members/whisky/${it.whisky_id}`} style={whiskyLink}>{it.whisky_name}</Link>
          </div>
          <div style={bodyText}>{it.note}</div>
          {(it.flavour_tags?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {it.flavour_tags!.map(tag => <span key={tag} style={tagChip}>{tag.replace(/_/g, ' ')}</span>)}
            </div>
          )}
        </>
      ) : (
        <div style={bodyText}>{it.body}</div>
      )}

      {it.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={it.photo_url} alt={t('Photograph shared in the Snug', 'Ảnh được chia sẻ trong The Snug')} loading="lazy" decoding="async" style={{ display: 'block', maxWidth: '100%', maxHeight: 320, borderRadius: 8, marginTop: 10, objectFit: 'cover' }} />
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {RX.map(r => {
          const on = mine.includes(r.key)
          return (
            <button key={r.key} onClick={() => toggle(r.key)} title={t(r.label, r.label_vn)} style={{ ...rxBtn, ...(on ? rxOn : null) }}>
              <span aria-hidden>{r.emoji}</span> {t(r.label, r.label_vn)}
            </button>
          )
        })}
      </div>
      {/* QUIET: only the poster sees the tally on their own item. */}
      {it.is_own && summary && (summary.raise_glass + summary.noted + summary.join_me > 0) && (
        <div style={ownTally}>
          {RX.filter(r => summary[r.key as keyof typeof summary] > 0).map(r => `${r.emoji} ${summary[r.key as keyof typeof summary]}`).join('  ·  ')}
        </div>
      )}

      {canManage && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <button onClick={() => { setEditDraft(it.body || ''); setEditing(true) }} style={manageBtn}>{t('Edit', 'Sửa')}</button>
          <button onClick={() => setConfirmDel(true)} style={{ ...manageBtn, color: '#C27070' }}>{t('Delete', 'Xoá')}</button>
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
        <textarea value={editDraft} onChange={e => setEditDraft(e.target.value.slice(0, 8000))} rows={4} style={textarea} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button onClick={() => setEditing(false)} style={cancelBtn}>{t('Cancel', 'Huỷ')}</button>
          <button onClick={saveEdit} disabled={!editDraft.trim()} style={{ ...postBtn, opacity: editDraft.trim() ? 1 : 0.4 }}>{t('Save', 'Lưu')}</button>
        </div>
      </MemberModal>
    </div>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', textAlign: 'center', opacity: 0.7, lineHeight: 1.7 }
const shareBtn: React.CSSProperties = { display: 'block', width: '100%', background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 12, padding: '12px', fontFamily: MONO, fontSize: 12, letterSpacing: '0.04em', color: '#D4B85A', cursor: 'pointer', marginBottom: 18 }
const nudge: React.CSSProperties = { display: 'block', width: '100%', background: 'transparent', border: '1px solid rgba(122,176,122,0.4)', borderRadius: 10, padding: '8px', fontFamily: MONO, fontSize: 11, color: '#7AB07A', cursor: 'pointer', marginBottom: 16 }
const card: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.10)', borderRadius: 14, background: 'rgba(229,212,194,0.03)', padding: '18px 20px', marginBottom: 16 }
const houseCard: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.3)', background: 'linear-gradient(135deg, rgba(212,184,90,0.08), rgba(212,184,90,0.02))' }
const bodyText: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#E5D4C2', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
const whiskyLink: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
const tagChip: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#D4B85A', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 8, padding: '2px 8px' }
const moreBtn: React.CSSProperties = { display: 'block', margin: '6px auto 0', background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 20, padding: '8px 20px', fontFamily: MONO, fontSize: 11, color: '#B2AA98', cursor: 'pointer' }
const rxBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.22)', borderRadius: 16, padding: '4px 11px', fontFamily: MONO, fontSize: 10, color: '#B2AA98', cursor: 'pointer', letterSpacing: '0.02em' }
const rxOn: React.CSSProperties = { border: '1px solid #D4B85A', color: '#D4B85A', background: 'rgba(212,184,90,0.12)' }
const ownTally: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#7E7864', marginTop: 8, letterSpacing: '0.04em' }
const manageBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: '#B2AA98', textDecoration: 'underline' }
const gateWrap: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.20)', borderRadius: 14, background: 'rgba(229,212,194,0.03)', padding: '40px 28px', textAlign: 'center', fontFamily: MONO, fontSize: 13, color: '#B2AA98', lineHeight: 1.8 }
const gateLink: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.4)' }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.6, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const smallChip: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.25)', borderRadius: 16, padding: '5px 12px', fontFamily: MONO, fontSize: 10, color: '#B2AA98' }
const cancelBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 12, color: '#B2AA98', cursor: 'pointer' }
const postBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 20px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
