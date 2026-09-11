'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Notice } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import EmptyState from '@/components/members/EmptyState'
import { SURFACE } from '@/lib/members/surfaces'
import { useLang } from '@/lib/lang'

const CATEGORIES = ['all', 'committee', 'fixture', 'general', 'whisky'] as const
// Display labels only — the keys above are what is stored and filtered on.
const CATEGORY_LABEL: Record<string, { en: string; vn: string }> = {
  all: { en: 'All', vn: 'Tất cả' }, committee: { en: 'Committee', vn: 'Hội đồng' },
  fixture: { en: 'Fixture', vn: 'Thi đấu' }, general: { en: 'General', vn: 'Chung' },
  whisky: { en: 'Whisky', vn: 'Whisky' },
}
const catLabel = (c: string, t: (en: string, vn: string) => string) => {
  const l = CATEGORY_LABEL[c]
  return l ? t(l.en, l.vn) : c.charAt(0).toUpperCase() + c.slice(1)
}

function timeAgo(dateStr: string, t: (en: string, vn: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('just now', 'vừa xong')
  if (mins < 60) return t(`${mins} minute${mins === 1 ? '' : 's'} ago`, `${mins} phút trước`)
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t(`${hours} hour${hours === 1 ? '' : 's'} ago`, `${hours} giờ trước`)
  const days = Math.floor(hours / 24)
  if (days < 30) return t(`${days} day${days === 1 ? '' : 's'} ago`, `${days} ngày trước`)
  const months = Math.floor(days / 30)
  return t(`${months} month${months === 1 ? '' : 's'} ago`, `${months} tháng trước`)
}

export default function NoticesPage() {
  const { t } = useLang()
  const [notices, setNotices] = useState<Notice[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setNotices(data); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? notices : notices.filter(n => n.category === filter)

  return (
    <>
      <MemberPage title="The Notice Board" subtitle={SURFACE['/members/notices'].vn}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32, justifyContent: 'center' }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
                border: filter === c ? 'none' : '1px solid rgba(229,212,194,0.2)',
                background: filter === c ? 'rgba(229,212,194,0.12)' : 'transparent',
                color: filter === c ? '#E5D4C2' : '#B2AA98',
                transition: 'all 0.2s',
              }}
            >
              {catLabel(c, t)}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>{t('Loading...', 'Đang tải...')}</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            glyph="◆"
            title={filter === 'all' ? t('The board is quiet', 'Bảng tin đang yên ắng') : t(`Nothing under ${filter}`, `Chưa có gì trong mục ${catLabel(filter, t)}`)}
            body={filter === 'all'
              ? t('No notices posted just now. When the Committee has word — a fixture, a pour, a change to the house — it appears here first.', 'Hiện chưa có thông báo nào. Khi Hội đồng có tin — một trận đấu, một chai mới, một thay đổi trong câu lạc bộ — tin sẽ xuất hiện ở đây đầu tiên.')
              : t('Nothing in this category yet. Try another, or check back soon.', 'Mục này chưa có gì. Hãy thử mục khác, hoặc quay lại sau.')}
          />
        ) : (
          filtered.map(n => (
            <div key={n.id} style={{ padding: '24px 0', borderBottom: '1px solid rgba(229,212,194,0.1)' }}>
              {n.pinned && (
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98', marginBottom: 6 }}>
                  ◆ {t('Pinned', 'Đã ghim')}
                </div>
              )}
              <h3 style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 600,
                color: '#E5D4C2', marginBottom: 8, margin: 0,
              }}>
                {n.title}
              </h3>
              <p style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                color: '#B2AA98', lineHeight: 1.85, marginBottom: 12, margin: '0 0 12px',
              }}>
                {n.body}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: 'rgba(178,170,152,0.5)' }}>
                  {n.author && `${n.author} · `}{timeAgo(n.created_at, t)}
                </span>
                <span style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                  background: 'rgba(229,212,194,0.1)', color: '#B2AA98', borderRadius: 20, padding: '2px 10px',
                }}>
                  {t(n.category, CATEGORY_LABEL[n.category]?.vn || n.category)}
                </span>
              </div>
            </div>
          ))
        )}
      </MemberPage>
    </>
  )
}
