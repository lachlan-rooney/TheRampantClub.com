'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Notice } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import EmptyState from '@/components/members/EmptyState'
import CorkBoard from '@/components/members/CorkBoard'
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
        <style dangerouslySetInnerHTML={{ __html: `
          .nb-tabs { display: flex; gap: clamp(18px, 3vw, 34px); overflow-x: auto; scrollbar-width: none;
                     border-bottom: 1px solid rgba(229,212,194,.14); margin: 8px 0 34px; }
          .nb-tabs::-webkit-scrollbar { display: none; }
          .nb-tab { position: relative; flex-shrink: 0; background: none; border: none; cursor: pointer; padding: 0 0 12px;
                    color: #E5D4C2; font-family: 'Rampant Sans', serif; font-size: clamp(18px, 2.6vw, 24px); line-height: 1;
                    opacity: .42; transition: opacity .3s ease; }
          .nb-tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: #D4B85A;
                           transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.16,.84,.44,1); }
          .nb-tab:hover { opacity: .8; }
          .nb-tab.is-on { opacity: 1; }
          .nb-tab.is-on::after { transform: scaleX(1); }
          .nb-count { font-family: 'Google Sans Code', monospace; font-size: 10px; opacity: .7; margin-left: 6px; }
          @media (prefers-reduced-motion: reduce) { .nb-tab, .nb-tab::after { transition: none; } }
        ` }} />

        {/* The categories as tabs, the way /studio sets its artists. */}
        <div className="nb-tabs" role="tablist" aria-label={t('Categories', 'Danh mục')}>
          {CATEGORIES.map(c => {
            const n = c === 'all' ? notices.length : notices.filter(x => x.category === c).length
            return (
              <button key={c} type="button" role="tab" aria-selected={filter === c}
                      className={`nb-tab ${filter === c ? 'is-on' : ''}`} onClick={() => setFilter(c)}>
                {catLabel(c, t)}{!loading && n > 0 && <span className="nb-count">{n}</span>}
              </button>
            )
          })}
        </div>

        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 13, color: '#E5D4C2', opacity: .7 }}>{t('Loading...', 'Đang tải...')}</p>
        ) : (
          /* The board itself: cork in a wooden frame, each notice pinned or
             taped at its own angle; click a sheet to read the whole thing. */
          <CorkBoard
            notices={filtered}
            empty={
              <EmptyState
                glyph="◆"
                title={filter === 'all' ? t('The board is quiet', 'Bảng tin đang yên ắng') : t(`Nothing under ${filter}`, `Chưa có gì trong mục ${catLabel(filter, t)}`)}
                body={filter === 'all'
                  ? t('No notices posted just now. When the Committee has word — a fixture, a pour, a change to the house — it appears here first.', 'Hiện chưa có thông báo nào. Khi Hội đồng có tin — một trận đấu, một chai mới, một thay đổi trong câu lạc bộ — tin sẽ xuất hiện ở đây đầu tiên.')
                  : t('Nothing in this category yet. Try another, or check back soon.', 'Mục này chưa có gì. Hãy thử mục khác, hoặc quay lại sau.')}
              />
            }
          />
        )}
      </MemberPage>
    </>
  )
}
