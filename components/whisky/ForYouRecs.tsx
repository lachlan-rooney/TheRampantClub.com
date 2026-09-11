'use client'

import { useEffect, useState } from 'react'
import RecResults, { type RecItem } from './RecResults'
import { useLang } from '@/lib/lang'

// Member-facing "For You" — reads the logged-in member's OWN taste profile
// (server-resolved) → recs. Honest empty-state when there's no profile (no
// linked member yet, or no mapped loves) → points to the Flavour Finder rather
// than inventing a taste. Dormant until profiles link to members.
//
// In three parts so the library can place them: the empty line sits beside
// the Finder's link, a real list of pours takes the page's full width.

interface RecResp { recs: RecItem[]; target: Record<string, number>; bestIsClose: boolean; profileEmpty: boolean }

export function useForYou() {
  const [data, setData] = useState<RecResp | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/whisky/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }, [])
  const empty = !loading && (!data || data.profileEmpty || !data.recs?.length)
  return { loading, data, empty }
}

export function ForYouEmpty() {
  const { t } = useLang()
  return (
    <p className="wl-text" style={{ margin: 0 }}>
      {t('Tell us what you love — try the', 'Hãy cho chúng tôi biết bạn yêu thích gì — thử')} <a href="/members/whisky/finder" className="wl-inline">{t('Flavour Finder', 'Tìm Ly Của Bạn')}</a>{' '}{t("and we'll match you a dram.", 'và chúng tôi sẽ tìm cho bạn một ly phù hợp.')}
    </p>
  )
}

export function ForYouList({ data }: { data: RecResp }) {
  const { t } = useLang()
  return (
    <section>
      <h2 className="wl-h is-2" style={{ marginBottom: 30 }}>{t('Recommended for you', 'Gợi ý dành cho bạn')}</h2>
      <RecResults recs={data.recs} target={data.target} bestIsClose={data.bestIsClose} theme="member" />
    </section>
  )
}

export default function ForYouRecs() {
  const { loading, data, empty } = useForYou()
  if (loading) return null
  if (empty || !data) return <ForYouEmpty />
  return <ForYouList data={data} />
}
