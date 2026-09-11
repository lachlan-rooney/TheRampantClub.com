'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import ForYouRecs from '@/components/whisky/ForYouRecs'
import AlphabetShelf from '@/components/whisky/AlphabetShelf'
import WhiskyRow from '@/components/whisky/WhiskyRow'
import { useLang } from '@/lib/lang'

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function WhiskyPage() {
  const { t } = useLang()
  const [whiskies, setWhiskies] = useState<Whisky[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('whiskies').select('*').order('committees_pick', { ascending: false }).order('name')
      .then(({ data }) => {
        if (data) {
          setWhiskies(data)
          // Deep-link from the Finder / For-You (?focus=<id>): seed the search
          // with that bottle's name so it lands showing the whisky directly.
          const focus = new URLSearchParams(window.location.search).get('focus')
          if (focus) { const w = data.find(x => x.id === focus); if (w) setSearch(w.name) }
        }
        setLoading(false)
      })
  }, [])

  const results = useMemo(() => {
    const toks = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (toks.length === 0) return null
    return whiskies.filter(w => {
      const hay = `${w.name} ${w.distillery || ''} ${w.region || ''}`.toLowerCase()
      return toks.every(tok => hay.includes(tok))
    })
  }, [search, whiskies])

  return (
    <>
      <MemberPage
        title="The Whisky Library"
        subtitle="Thư Viện Whisky"
        icon="/images/whisky-glass-icon-opt.png"
        description={t(`${whiskies.length} bottle${whiskies.length === 1 ? '' : 's'} and counting`, `${whiskies.length} chai, và con số vẫn đang tăng`)}
      >
        <Link href="/members/whisky/finder" style={{
          display: 'block', textAlign: 'center', marginBottom: 24, textDecoration: 'none',
          fontFamily: MONO, fontSize: 12, letterSpacing: '0.04em',
          color: '#D4B85A', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 24, padding: '11px 20px',
        }}>
          {t('◆ Find your dram — match by flavour →', '◆ Tìm ly của bạn — theo hương vị →')}
        </Link>
        <ForYouRecs />

        {/* Search — the fast path: type a name/distillery, skip the alphabet. */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search by name or distillery…', 'Tìm theo tên hoặc nhà chưng cất…')}
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 24,
            background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
            border: '1px solid rgba(229,212,194,0.18)', borderRadius: 24,
            padding: '12px 18px', fontFamily: MONO, fontSize: 13, outline: 'none',
          }}
        />

        {loading ? (
          <p style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>{t('Loading…', 'Đang tải…')}</p>
        ) : results !== null ? (
          // Search active → matching whiskies (alphabet bypassed)
          results.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', textAlign: 'center', fontStyle: 'italic' }}>
              {t(`No whiskies match “${search}”.`, `Không có whisky nào khớp “${search}”.`)}
            </p>
          ) : (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 6 }}>
                {t(`${results.length} match${results.length === 1 ? '' : 'es'}`, `${results.length} kết quả`)}
              </div>
              {results.map(w => <WhiskyRow key={w.id} w={w} />)}
            </div>
          )
        ) : (
          // The shelf — browse by letter
          <AlphabetShelf whiskies={whiskies} />
        )}
      </MemberPage>
    </>
  )
}
