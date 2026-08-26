'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { OCCASIONS, OCCASION_LABELS, CATEGORIES, CATEGORY_LABELS, formatVnd, percentUsed, type Occasion, type Category } from '@/lib/gifting'
import { vnDateString } from '@/lib/datetime'
import { useLang } from '@/lib/admin-lang'

// Admin / Intelligence / Gifts
//
// Org-wide gifting ledger. Filters by occasion / category / member.
// Add-new form supports photo upload via the signed-URL flow.

interface Gift {
  id: string
  member_no: string
  gift_date: string
  occasion: string
  category: string | null
  description: string
  source: string | null
  cost_vnd: number
  expected_value: string | null
  given_by: string | null
  notes: string | null
  photo_url: string | null
  created_at: string
  member: { member_no: string; full_name: string; tier: string } | null
  edit_count?: number
  last_edited_at?: string | null
}

interface GiftEdit {
  id: string
  edited_by_email: string | null
  before_state: Record<string, unknown> | null
  after_state:  Record<string, unknown> | null
  changed_fields: string[] | null
  created_at: string
}

interface MemberLite {
  member_no: string
  full_name: string
  tier: string
  email: string | null
}

interface OrgSummary {
  totals: {
    members: number
    total_annual_budget_vnd: number
    total_spent_vnd: number
    remaining_vnd: number
    pct_used: number
  }
  unloved: Array<{ member_no: string; full_name: string; tier: string; annual_budget_vnd: number; window_end: string | null }>
  by_occasion_90d: Array<{ occasion: string; total: number }>
  by_category_90d: Array<{ category: string; total: number }>
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function GiftsPage() {
  const { t } = useLang()
  const [gifts, setGifts] = useState<Gift[]>([])
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [members, setMembers] = useState<MemberLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [occFilter, setOccFilter] = useState<string>('all')
  // Signed URLs from the server expire in 1h; cache each one with its own
  // soft expiry so a long-lived session refreshes them.
  const [photoCache, setPhotoCache] = useState<Record<string, { url: string; expires: number }>>({})
  // Edit + delete state.
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null)
  const [confirmDeleteGift, setConfirmDeleteGift] = useState<Gift | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  // Edit history viewer — keyed per gift, lazy-loaded.
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [historyByGift, setHistoryByGift] = useState<Record<string, GiftEdit[] | null>>({})

  // "What is Unreasonable Hospitality?" info popover next to the page title.
  const [infoOpen, setInfoOpen] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!infoOpen) return
    const onDown = (e: MouseEvent) => { if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [infoOpen])

  // Toast for non-blocking notices.
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 4200)
  }

  const toggleHistory = async (gift: Gift) => {
    setExpandedHistory(prev => {
      const next = new Set(prev)
      if (next.has(gift.id)) next.delete(gift.id); else next.add(gift.id)
      return next
    })
    if (!historyByGift[gift.id]) {
      try {
        const r = await fetch(`/api/admin/gifts/${gift.id}`, { cache: 'no-store' })
        const j = await r.json()
        if (r.ok) setHistoryByGift(prev => ({ ...prev, [gift.id]: j.edits || [] }))
      } catch { /* */ }
    }
  }

  const runDelete = async () => {
    if (!confirmDeleteGift) return
    setDeleteBusy(true)
    try {
      const r = await fetch(`/api/admin/gifts/${confirmDeleteGift.id}`, { method: 'DELETE' })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        showToast(`${t('Delete failed', 'Xóa thất bại')}: ${j.error || r.statusText}`, 'error')
        return
      }
      setConfirmDeleteGift(null)
      showToast(t('Gift deleted.', 'Đã xóa quà tặng.'))
      load()
    } finally {
      setDeleteBusy(false)
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (occFilter !== 'all') params.set('occasion', occFilter)
    Promise.all([
      fetch(`/api/admin/gifts?${params}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/gifts/summary', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([g, s]) => {
      setGifts(g.gifts || [])
      setSummary(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [occFilter])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.members) setMembers(d.members.map((m: { member_no: string; full_name: string; tier: string; email: string | null }) => ({
          member_no: m.member_no, full_name: m.full_name, tier: m.tier, email: m.email,
        })))
      })
  }, [])

  // Fetch signed read URLs for any gift photos lazily. We re-fetch entries
  // whose soft expiry has passed (signed URLs are valid for 1h server-side,
  // so we refresh after 50 minutes to stay ahead of token expiry).
  useEffect(() => {
    const now = Date.now()
    const need = gifts.filter(g => g.photo_url && (!photoCache[g.photo_url] || photoCache[g.photo_url].expires < now))
    if (need.length === 0) return
    need.forEach(async g => {
      try {
        const r = await fetch(`/api/admin/gifts/photo-upload?path=${encodeURIComponent(g.photo_url!)}`)
        const j = await r.json()
        if (j.url) setPhotoCache(c => ({ ...c, [g.photo_url!]: { url: j.url, expires: Date.now() + 50 * 60 * 1000 } }))
      } catch { /* ignore */ }
    })
  }, [gifts, photoCache])

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>{t('Intelligence · Member Experience', 'Phân tích · Trải nghiệm hội viên')}</div>
          <h1 style={pageTitle}>{t('Gifting', 'Quà tặng')}</h1>
          <p style={lede}>
            <span ref={infoRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
              {t('Unreasonable Hospitality', 'Lòng hiếu khách phi thường')}
              <button
                onClick={() => setInfoOpen(o => !o)}
                style={infoBtn}
                aria-label={t('About Unreasonable Hospitality', 'Về Lòng hiếu khách phi thường')}
                aria-expanded={infoOpen}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D4B85A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'translateY(2px)' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="11" x2="12" y2="16" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              {infoOpen && (
                <div style={infoPopover} role="dialog" aria-label={t('Unreasonable Hospitality', 'Lòng hiếu khách phi thường')}>
                  <div style={infoTitle}>{t('Unreasonable Hospitality', 'Lòng hiếu khách phi thường')}</div>
                  <p style={infoPara}>{t('The phrase comes from restaurateur Will Guidara, who built the world’s best restaurant on a simple idea: there’s a difference between service and hospitality. Service is doing your job well. Hospitality is making someone feel genuinely cared for — doing the unexpected, generous thing precisely because no one asked you to.', 'Cụm từ này bắt nguồn từ nhà hàng gia Will Guidara, người đã xây dựng nhà hàng tốt nhất thế giới dựa trên một ý tưởng đơn giản: có sự khác biệt giữa phục vụ và hiếu khách. Phục vụ là làm tốt công việc của mình. Hiếu khách là khiến ai đó cảm thấy thực sự được quan tâm — làm điều bất ngờ, hào phóng chính vì không ai yêu cầu bạn làm vậy.')}</p>
                  <p style={infoPara}>{t('We hold to it closely because it’s the whole point of The Rampant Club. We don’t reward loyalty with a points card — a free sticker on the tenth visit, a discount on the twentieth. We treat every member like royalty from the first day, because the gestures that cost a little more and surprise a little deeper are the ones people remember for the rest of their lives.', 'Chúng tôi luôn giữ vững điều này vì đó chính là tinh thần cốt lõi của The Rampant Club. Chúng tôi không tưởng thưởng lòng trung thành bằng thẻ tích điểm — một sticker miễn phí ở lần ghé thứ mười, một khoản giảm giá ở lần thứ hai mươi. Chúng tôi đối đãi mỗi hội viên như bậc vương giả ngay từ ngày đầu tiên, bởi những cử chỉ tốn kém hơn một chút và bất ngờ sâu sắc hơn một chút mới là điều người ta ghi nhớ suốt đời.')}</p>
                  <p style={{ ...infoPara, marginBottom: 0 }}>{t('When a member walks through our doors, everything should feel as though it was designed around them — because it was. That’s not extravagance for its own sake. It’s the belief that how you make someone feel is what they carry home. We go further than we have to, on purpose, because that’s what turns a visit into a memory and a member into family.', 'Khi một hội viên bước qua cửa, mọi thứ phải mang lại cảm giác như được thiết kế riêng cho họ — vì đúng là như vậy. Đó không phải sự xa hoa vì bản thân sự xa hoa. Đó là niềm tin rằng cảm giác bạn tạo ra cho ai đó chính là điều họ mang về nhà. Chúng tôi đi xa hơn mức cần thiết, một cách có chủ đích, bởi đó là điều biến một lần ghé thăm thành một kỷ niệm và một hội viên thành người thân.')}</p>
                </div>
              )}
            </span>{' '}— {t('the small, thoughtful gestures that make a member feel cared for. The budget is set by tier (', 'những cử chỉ nhỏ, chu đáo khiến hội viên cảm thấy được quan tâm. Ngân sách được đặt theo hạng (')}{' '}
            <Link href="/admin/tier-budgets" style={linkStyle}>{t('tier budgets →', 'ngân sách theo hạng →')}</Link>{' '}
            {t(') and runs anniversary to anniversary. Each gift carries a cost, a source, and the “why” we did it.', ') và tính theo chu kỳ từ ngày kỷ niệm này đến ngày kỷ niệm sau. Mỗi món quà đều ghi rõ chi phí, nguồn, và “lý do” chúng tôi tặng.')}
          </p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} style={btnPrimary}>
          {showAdd ? t('Cancel', 'Hủy') : t('＋ Log a gift', '＋ Ghi nhận quà tặng')}
        </button>
      </div>

      {/* Org-wide budget strip */}
      {summary && (
        <div style={strip}>
          <StatTile label={t('Active members', 'Hội viên đang hoạt động')} value={String(summary.totals.members)} color="#E5D4C2" />
          <StatTile label={t('Annual budget', 'Ngân sách năm')} value={formatVnd(summary.totals.total_annual_budget_vnd)} color="#D4B85A" />
          <StatTile label={t('Spent', 'Đã chi')} value={formatVnd(summary.totals.total_spent_vnd)} color="#7AB07A" sub={`${summary.totals.pct_used}% ${t('used', 'đã dùng')}`} />
          <StatTile label={t('Remaining', 'Còn lại')} value={formatVnd(summary.totals.remaining_vnd)} color="#9E8FC4" />
          <StatTile
            label={t('Unloved members', 'Hội viên chưa được tặng')}
            value={String(summary.unloved.length)}
            color={summary.unloved.length > 0 ? '#C27070' : '#7AB07A'}
            sub={summary.unloved.length > 0 ? t('no gift this year yet', 'chưa có quà nào năm nay') : t('everyone has received something', 'mọi người đều đã nhận quà')}
          />
        </div>
      )}

      {/* Unloved alarm */}
      {summary && summary.unloved.length > 0 && (
        <div style={alarmBox}>
          <div style={alarmHeader}>{t('Members with budget but no gift this year', 'Hội viên còn ngân sách nhưng chưa có quà năm nay')}</div>
          <div style={unlovedRow}>
            {summary.unloved.map(u => (
              <Link key={u.member_no} href={`/admin/mis/${u.member_no}`} style={unlovedChip}>
                <strong style={{ color: '#E5D4C2' }}>{u.full_name}</strong>
                <span style={{ color: '#B2AA98', fontSize: 10, marginLeft: 6 }}>{u.tier} · {formatVnd(u.annual_budget_vnd)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddGiftForm
          members={members}
          onCancel={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {/* Filters */}
      <div style={filterRow}>
        <button onClick={() => setOccFilter('all')} style={{ ...filterChip, ...(occFilter === 'all' ? filterChipActive : null) }}>{t('All', 'Tất cả')}</button>
        {OCCASIONS.map(o => (
          <button key={o} onClick={() => setOccFilter(o)} style={{ ...filterChip, ...(occFilter === o ? filterChipActive : null) }}>
            {OCCASION_LABELS[o]}
          </button>
        ))}
      </div>

      {/* Ledger */}
      {loading ? (
        <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
      ) : gifts.length === 0 ? (
        <div style={emptyBlock}>
          {occFilter === 'all' ? t('No gifts logged yet.', 'Chưa ghi nhận quà tặng nào.') : t(`No ${OCCASION_LABELS[occFilter as Occasion] || occFilter} gifts.`, `Không có quà ${OCCASION_LABELS[occFilter as Occasion] || occFilter}.`)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {gifts.map(g => {
            const photoUrl = g.photo_url ? photoCache[g.photo_url]?.url || null : null
            // Edit-mode renders the inline form in place of the card.
            if (editingGiftId === g.id) {
              return (
                <AddGiftForm
                  key={`edit-${g.id}`}
                  members={members}
                  initial={g}
                  onCancel={() => setEditingGiftId(null)}
                  onSaved={() => { setEditingGiftId(null); load() }}
                />
              )
            }
            return (
              <div key={g.id} style={giftCard}>
                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" style={giftPhoto} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={occasionPill}>{OCCASION_LABELS[g.occasion as Occasion] || g.occasion}</span>
                    {g.category && <span style={categoryPill}>{CATEGORY_LABELS[g.category as Category] || g.category}</span>}
                    <span style={costChip}>{formatVnd(g.cost_vnd)}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
                      {g.gift_date}
                    </span>
                  </div>
                  <Link href={`/admin/mis/${g.member_no}`} style={giftMember}>
                    {g.member?.full_name || g.member_no}
                  </Link>
                  <div style={giftDescription}>{g.description}</div>
                  {g.source && <div style={giftMeta}>{t('via', 'qua')} {g.source}</div>}
                  {g.expected_value && (
                    <div style={whyBox}>
                      <span style={whyLabel}>{t('Why · ', 'Lý do · ')}</span>{g.expected_value}
                    </div>
                  )}

                  <div style={giftRowActions}>
                    {(g.edit_count ?? 0) > 0 && (
                      <button onClick={() => toggleHistory(g)} style={giftSmallBtn} title={t('Show edit history', 'Xem lịch sử chỉnh sửa')}>
                        ⏱ {g.edit_count} {g.edit_count === 1 ? t('edit', 'lần sửa') : t('edits', 'lần sửa')}
                      </button>
                    )}
                    <button onClick={() => setEditingGiftId(g.id)} style={giftSmallBtn}>{t('Edit', 'Sửa')}</button>
                    <button onClick={() => setConfirmDeleteGift(g)} style={{ ...giftSmallBtn, color: '#C27070' }}>{t('Delete', 'Xóa')}</button>
                  </div>

                  {expandedHistory.has(g.id) && (
                    <div style={giftHistoryBlock}>
                      {historyByGift[g.id] == null ? (
                        <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', fontStyle: 'italic' }}>{t('Loading history…', 'Đang tải lịch sử…')}</div>
                      ) : historyByGift[g.id]!.length === 0 ? (
                        <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', fontStyle: 'italic' }}>{t('No edits recorded.', 'Chưa ghi nhận chỉnh sửa nào.')}</div>
                      ) : (
                        historyByGift[g.id]!.map(e => (
                          <div key={e.id} style={giftHistoryRow}>
                            <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#7E7864' }}>
                              {new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {e.edited_by_email && <span> · {e.edited_by_email}</span>}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              {(e.changed_fields || []).map(f => {
                                const before = e.before_state?.[f]
                                const after  = e.after_state?.[f]
                                return (
                                  <div key={f} style={giftHistoryField}>
                                    <span style={giftHistoryFieldLabel}>{f}</span>
                                    <span style={giftHistoryFieldBefore}>{formatHistoryValue(before)}</span>
                                    <span style={{ color: '#7E7864' }}>→</span>
                                    <span style={giftHistoryFieldAfter}>{formatHistoryValue(after)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────── */}
      {confirmDeleteGift && (
        <>
          <div style={giftConfirmBackdrop} onClick={() => !deleteBusy && setConfirmDeleteGift(null)} />
          <div style={giftConfirmModalBox} role="dialog">
            <div style={giftConfirmEyebrow}>⚠ {t('PERMANENT', 'VĨNH VIỄN')}</div>
            <div style={giftConfirmTitle}>{t('Delete gift record?', 'Xóa bản ghi quà tặng?')}</div>
            <div style={giftConfirmSubject}>
              {confirmDeleteGift.member?.full_name || confirmDeleteGift.member_no} · {formatVnd(confirmDeleteGift.cost_vnd)} · {confirmDeleteGift.gift_date}
            </div>
            <p style={giftConfirmBody}>
              {t('Removes the gift from the ledger AND the audit trail of edits it accumulated. The associated photo (if any) is also unlinked from storage. Cannot be undone — consider editing instead if the values just need correcting.', 'Xóa món quà khỏi sổ ghi VÀ toàn bộ nhật ký chỉnh sửa đã tích lũy. Ảnh liên quan (nếu có) cũng sẽ được gỡ khỏi kho lưu trữ. Không thể hoàn tác — hãy cân nhắc chỉnh sửa nếu chỉ cần sửa lại giá trị.')}
            </p>
            <div style={giftConfirmActions}>
              <button onClick={() => setConfirmDeleteGift(null)} disabled={deleteBusy} style={giftConfirmCancelBtn}>{t('Cancel', 'Hủy')}</button>
              <button onClick={runDelete} disabled={deleteBusy} style={{ ...giftConfirmGoBtn, opacity: deleteBusy ? 0.5 : 1 }}>
                {deleteBusy ? t('Deleting…', 'Đang xóa…') : t('Delete gift', 'Xóa quà tặng')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div style={toast.tone === 'error' ? giftToastErrorBox : giftToastInfoBox} role="status">
          <span style={{ marginRight: 8, color: toast.tone === 'error' ? '#C27070' : '#7AB07A' }}>
            {toast.tone === 'error' ? '✕' : '✓'}
          </span>
          {toast.message}
        </div>
      )}
    </>
  )
}

// Format a value pulled from gift_edits' before/after_state jsonb. The
// jsonb keeps native JSON types, so a null cost becomes JSON null and
// dates are ISO strings. Render them in compact, scannable form.
function formatHistoryValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') {
    // Heuristic: large integers are VND amounts; format with commas.
    if (Number.isInteger(v) && v >= 1000) return new Intl.NumberFormat('en-US').format(v)
    return String(v)
  }
  if (typeof v === 'string') return v.length > 60 ? v.slice(0, 57) + '…' : v
  return JSON.stringify(v)
}

// ── AddGiftForm ───────────────────────────────────────────────────────
function AddGiftForm({ members, onCancel, onSaved, initial }: {
  members: MemberLite[]
  onCancel: () => void
  onSaved: () => void
  initial?: Gift | null
}) {
  const today = vnDateString()
  const editMode = !!initial
  const [memberQuery, setMemberQuery] = useState('')
  const [memberNo, setMemberNo] = useState(initial?.member_no ?? '')
  const [giftDate, setGiftDate] = useState(initial?.gift_date ?? today)
  const [occasion, setOccasion] = useState<Occasion>((initial?.occasion as Occasion) ?? 'thoughtful')
  const [category, setCategory] = useState<Category | ''>((initial?.category as Category) ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [source, setSource] = useState(initial?.source ?? '')
  const [costVnd, setCostVnd] = useState(initial ? String(initial.cost_vnd) : '')
  const [expectedValue, setExpectedValue] = useState(initial?.expected_value ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(initial?.photo_url ?? null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Each photo upload bumps this counter. The in-flight upload checks
  // its own id against the latest before setting photoPath — if the user
  // picked a newer file mid-upload, the stale upload's result is dropped.
  const uploadIdRef = useRef(0)

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members.slice(0, 10)
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.member_no.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [members, memberQuery])

  const selectedMember = useMemo(() => members.find(m => m.member_no === memberNo) || null, [members, memberNo])

  const choosePhoto = async (file: File) => {
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    // Clear any previous upload so the gift won't save the wrong path if
    // the user picked a new file before the previous one finished.
    setPhotoPath(null)
    if (!memberNo) return  // wait until a member is picked
    await uploadPhoto(file)
  }

  const uploadPhoto = useCallback(async (file: File) => {
    if (!memberNo) return
    const myId = ++uploadIdRef.current
    setUploadingPhoto(true); setError(null)
    try {
      const r = await fetch('/api/admin/gifts/photo-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: memberNo, filename: file.name }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not get upload URL')
      const { error: upErr } = await sb.storage.from('gift-photos').uploadToSignedUrl(j.path, j.token, file)
      if (upErr) throw upErr
      // If a newer upload has started while we were in flight, drop this
      // result rather than overwriting the newer photo's path.
      if (myId === uploadIdRef.current) setPhotoPath(j.path)
    } catch (e) {
      if (myId === uploadIdRef.current) setError(`Photo upload failed: ${(e as Error).message}`)
    } finally {
      if (myId === uploadIdRef.current) setUploadingPhoto(false)
    }
  }, [memberNo])

  // If user picks the member after choosing the photo, upload it now.
  useEffect(() => {
    if (photoFile && memberNo && !photoPath && !uploadingPhoto) {
      uploadPhoto(photoFile)
    }
  }, [photoFile, memberNo, photoPath, uploadingPhoto, uploadPhoto])

  const submit = async () => {
    if (!memberNo) { setError('Pick a member.'); return }
    if (!description.trim()) { setError('Description required.'); return }
    if (!costVnd) { setError('Cost required.'); return }
    setSubmitting(true); setError(null)
    try {
      const url    = editMode ? `/api/admin/gifts/${initial!.id}` : '/api/admin/gifts'
      const method = editMode ? 'PATCH' : 'POST'
      // In edit mode the API ignores member_no (member can't be moved
      // post-fact; that would invalidate the gifting summary). New-gift
      // mode still needs it.
      const body: Record<string, unknown> = {
        gift_date: giftDate,
        occasion,
        category: category || null,
        description,
        source: source || null,
        cost_vnd: Number(costVnd),
        expected_value: expectedValue || null,
        photo_url: photoPath || null,
      }
      if (!editMode) body.member_no = memberNo
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={addBlock}>
      <div style={addHeader}>{editMode ? `Edit gift · ${initial?.gift_date}` : 'Log a gift'}</div>
      {error && <div style={errorBox}>{error}</div>}

      <div style={fieldRow}>
        <div style={editLabel}>Member *</div>
        {selectedMember ? (
          <div style={selectedMemberRow}>
            <div>
              <strong>{selectedMember.full_name}</strong>
              <span style={{ marginLeft: 8, color: '#B2AA98', fontSize: 11 }}>{selectedMember.member_no} · {selectedMember.tier}</span>
            </div>
            <button onClick={() => { setMemberNo(''); setMemberQuery('') }} style={tinyBtn}>Change</button>
          </div>
        ) : (
          <>
            <input value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Search…" style={inputStyle} />
            <div style={memberList}>
              {filteredMembers.map(m => (
                <button key={m.member_no} onClick={() => setMemberNo(m.member_no)} style={memberRow}>
                  <span>{m.full_name}</span>
                  <span style={{ color: '#B2AA98', fontSize: 11 }}>{m.member_no} · {m.tier}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={metaGrid}>
        <div>
          <div style={editLabel}>Date *</div>
          <input type="date" value={giftDate} onChange={e => setGiftDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={editLabel}>Occasion *</div>
          <select value={occasion} onChange={e => setOccasion(e.target.value as Occasion)} style={inputStyle}>
            {OCCASIONS.map(o => <option key={o} value={o}>{OCCASION_LABELS[o]}</option>)}
          </select>
        </div>
        <div>
          <div style={editLabel}>Category</div>
          <select value={category} onChange={e => setCategory(e.target.value as Category | '')} style={inputStyle}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <div style={editLabel}>Cost (VND) *</div>
          <input
            type="number" min={0} step={50000}
            value={costVnd}
            onChange={e => setCostVnd(e.target.value)}
            placeholder="e.g. 1500000"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>What was the gift? *</div>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Hand-written birthday card with a bottle of Hibiki 17"
          style={inputStyle}
        />
      </div>

      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>Source / supplier</div>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="Optional — vendor name" style={inputStyle} />
      </div>

      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>Why we did this</div>
        <textarea
          value={expectedValue}
          onChange={e => setExpectedValue(e.target.value)}
          rows={2}
          placeholder="The reasoning. Strengthen Bowmore-club affinity. Thank-you for the Mike Tran intro. Recover from the music incident."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Photo */}
      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>Photo (optional)</div>
        <input
          type="file"
          accept="image/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) choosePhoto(f) }}
          style={{ ...inputStyle, padding: 6 }}
        />
        {photoPreview && (
          <div style={{ marginTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="" style={previewImg} />
            <div style={hintText}>
              {uploadingPhoto ? 'Uploading…' : photoPath ? 'Uploaded' : memberNo ? 'Ready to upload' : 'Pick a member to enable upload'}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={submit} disabled={submitting || uploadingPhoto || !memberNo} style={{ ...btnPrimary, opacity: !memberNo ? 0.4 : 1 }}>
          {submitting ? 'Saving…' : (editMode ? 'Save changes' : 'Save gift')}
        </button>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
      </div>
    </div>
  )
}

// ── small components ──────────────────────────────────────────────────
function StatTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color }}>{value}</div>
      {sub && <div style={statSub}>{sub}</div>}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 20, marginBottom: 20,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const linkStyle: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'underline', textDecorationStyle: 'dotted',
}
// "i" info trigger + its popover — cream card / deep-green text, reads as a
// card on the dark admin page. Anchored under the Gifting title.
const infoBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 2, margin: 0, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', lineHeight: 0, borderRadius: '50%',
}
const infoPopover: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 10px)', left: 0, zIndex: 60,
  width: 560, maxWidth: '92vw',
  background: '#E5D4C2', color: '#052E20',
  border: '1px solid rgba(5,46,32,0.18)', borderRadius: 12,
  boxShadow: '0 18px 50px rgba(0,0,0,0.45)', padding: '16px 22px',
}
const infoTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 17, fontWeight: 500,
  letterSpacing: '0.03em', color: '#052E20', margin: '0 0 8px',
}
const infoPara: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11.5,
  lineHeight: 1.5, color: '#052E20', margin: '0 0 8px',
}
const strip: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 10, marginBottom: 16,
}
const statTile: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, padding: '14px 16px',
}
const statLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const statValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 600,
  marginTop: 4,
}
const statSub: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', marginTop: 2, letterSpacing: '0.04em',
}
const alarmBox: React.CSSProperties = {
  marginBottom: 16, padding: 14,
  background: 'rgba(194,112,112,0.08)', border: '1px solid rgba(194,112,112,0.25)',
  borderLeft: '3px solid #C27070', borderRadius: 6,
}
const alarmHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#C27070', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 8,
}
const unlovedRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6,
}
const unlovedChip: React.CSSProperties = {
  padding: '6px 10px', textDecoration: 'none',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap',
}
const filterChip: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: 'pointer',
}
const filterChipActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)',
}
const giftCard: React.CSSProperties = {
  display: 'flex', gap: 14, padding: 14,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const giftPhoto: React.CSSProperties = {
  width: 100, height: 100, objectFit: 'cover', borderRadius: 6,
  border: '1px solid rgba(229,212,194,0.10)', flexShrink: 0,
}
const occasionPill: React.CSSProperties = {
  background: 'rgba(212,184,90,0.16)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}
const categoryPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.04em',
}
const costChip: React.CSSProperties = {
  background: 'rgba(122,176,122,0.10)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, fontWeight: 600,
}
const giftMember: React.CSSProperties = {
  display: 'block', marginTop: 6,
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
  color: '#E5D4C2', textDecoration: 'none',
}
const giftDescription: React.CSSProperties = {
  marginTop: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', lineHeight: 1.55,
}
const giftMeta: React.CSSProperties = {
  marginTop: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const whyBox: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px',
  background: 'rgba(212,184,90,0.06)',
  borderLeft: '2px solid #D4B85A', borderRadius: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', lineHeight: 1.55, fontStyle: 'italic',
}
const whyLabel: React.CSSProperties = { fontStyle: 'normal', fontWeight: 600, opacity: 0.7 }
const addBlock: React.CSSProperties = {
  padding: 18, marginBottom: 18,
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 8,
}
const addHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 14,
}
const fieldRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const memberList: React.CSSProperties = {
  marginTop: 6, maxHeight: 200, overflowY: 'auto',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
}
const memberRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  width: '100%', padding: '10px 12px',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(229,212,194,0.06)',
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  cursor: 'pointer', textAlign: 'left',
}
const selectedMemberRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 12px',
  background: 'rgba(122,176,122,0.10)',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 6,
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 12,
}
const tinyBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  padding: '4px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, cursor: 'pointer',
}
const metaGrid: React.CSSProperties = {
  display: 'grid', gap: 10, marginTop: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
}
const previewImg: React.CSSProperties = {
  maxWidth: 200, maxHeight: 200, borderRadius: 6,
  border: '1px solid rgba(229,212,194,0.10)',
}
const hintText: React.CSSProperties = {
  marginTop: 4, fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7,
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textDecoration: 'none', textAlign: 'center',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyBlock: React.CSSProperties = {
  padding: '60px 20px', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98',
  background: 'rgba(229,212,194,0.02)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 8,
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
// percentUsed not used in this file yet, but kept available for future per-member panel reuse
void percentUsed

// ── Edit-mode + history + confirm + toast styles ────────────────────
const giftRowActions: React.CSSProperties = {
  display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap',
}
const giftSmallBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.16)', borderRadius: 4,
  padding: '4px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.04em', cursor: 'pointer',
}
const giftHistoryBlock: React.CSSProperties = {
  marginTop: 10, padding: '10px 12px',
  background: 'rgba(5,46,32,0.55)',
  border: '1px solid rgba(229,212,194,0.10)',
  borderLeft: '2px solid #9E8FC4',
  borderRadius: 4,
}
const giftHistoryRow: React.CSSProperties = {
  padding: '6px 0',
  borderBottom: '1px solid rgba(229,212,194,0.06)',
}
const giftHistoryField: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  padding: '2px 0',
}
const giftHistoryFieldLabel: React.CSSProperties = {
  color: '#9E8FC4', minWidth: 110, fontWeight: 600, letterSpacing: '0.04em',
}
const giftHistoryFieldBefore: React.CSSProperties = {
  color: '#C27070', background: 'rgba(194,112,112,0.08)',
  padding: '1px 6px', borderRadius: 2,
}
const giftHistoryFieldAfter: React.CSSProperties = {
  color: '#7AB07A', background: 'rgba(122,176,122,0.08)',
  padding: '1px 6px', borderRadius: 2,
}

// Delete-confirm modal + toast — same visual language as the other admin pages.
const giftConfirmBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300,
}
const giftConfirmModalBox: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(520px, 92vw)',
  background: '#0A3526',
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
  borderRadius: 8,
  padding: '22px 24px',
  zIndex: 301,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
}
const giftConfirmEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#C27070', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
  marginBottom: 8,
}
const giftConfirmTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#E5D4C2', letterSpacing: '0.02em', marginBottom: 6,
}
const giftConfirmSubject: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', marginBottom: 12,
}
const giftConfirmBody: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.65, marginBottom: 14,
}
const giftConfirmActions: React.CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
}
const giftConfirmCancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const giftConfirmGoBtn: React.CSSProperties = {
  background: '#C27070', color: '#FFFFFF',
  border: 'none', borderRadius: 4,
  padding: '8px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const giftToastBase: React.CSSProperties = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 400,
  padding: '12px 18px',
  background: '#0A3526',
  borderRadius: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', letterSpacing: '0.02em',
  display: 'flex', alignItems: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
}
const giftToastInfoBox: React.CSSProperties = {
  ...giftToastBase,
  border: '1px solid rgba(122,176,122,0.45)',
  borderLeft: '3px solid #7AB07A',
}
const giftToastErrorBox: React.CSSProperties = {
  ...giftToastBase,
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
}
