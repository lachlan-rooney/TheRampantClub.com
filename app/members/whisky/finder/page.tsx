'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import FinderRadar from '@/components/whisky/FinderRadar'
import RadarChart from '@/components/whisky/RadarChart'
import { type Cat, type ShapeValues, fetchCategories, RADAR_GOLD, RADAR_SAGE } from '@/components/whisky/flavour-data'
import { WhiskyStyle, bare, strengthColor, RADAR } from '@/components/whisky/WhiskyStyle'
import { Rise, GOLD, MONO } from '@/components/public/kit'
import { CreamInk } from '@/components/public/CreamInk'
import { STRENGTH_LABEL, type Match } from '@/lib/whisky/flavour-match'
import { useLang } from '@/lib/lang'

// Vietnamese for the shared STRENGTH_LABEL (lib/whisky/flavour-match), keyed the same.
const STRENGTH_VN: Record<Match['strength'], string> = {
  strong: 'Rất phù hợp', good: 'Phù hợp', loose: 'Tương đối', distant: 'Khá xa — gần nhất hiện có',
}

const toShape = (m: Record<string, number>): ShapeValues =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { intensity: v, confidence: 1 }]))

// The members' Flavour Finder, set like the public one at /cup/finder: the ask
// on the left with the butler and his tray, the compass on the right where a
// hand reaches for it, and the matches beneath as a run of pours on hairlines.
// The engine is untouched — the same /api/whisky/flavour-match, the same wheel.

const CSS = `
  .wf-top { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 56px; align-items: center; }
  .wf-words { position: relative; }
  .wf-prompt { font-family: ${MONO}; font-size: 14px; line-height: 2; max-width: 440px; margin: 0; opacity: .9; }
  .wf-ink { width: clamp(170px, 18vw, 250px); margin: 40px 0 0 clamp(20px, 5vw, 80px); }
  .wf-tool { display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .wf-compass { max-width: 600px; }
  .wf-actions { display: flex; gap: 34px; align-items: baseline; justify-content: center; flex-wrap: wrap; margin-top: 18px; }
  .wf-actions .wl-link { padding-top: 12px; }
  .wf-hint { font-family: ${MONO}; font-size: 12.5px; margin-top: 16px; opacity: .78; text-align: center; }

  .wf-results { margin-top: 110px; scroll-margin-top: 24px; }
  .wf-rhead { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; margin-bottom: 34px; }
  .wf-glass { width: clamp(84px, 9vw, 124px); margin-right: 4%; }
  .wf-oos { color: ${GOLD}; opacity: .9; }

  @media (max-width: 1000px) {
    .wf-top { grid-template-columns: minmax(0, 1fr); gap: 28px; }
    .wf-ink { display: none; }
    .wf-prompt { max-width: 560px; }
  }
  @media (max-width: 600px) {
    .wf-prompt { font-size: 13.5px; line-height: 1.95; }
    .wf-results { margin-top: 80px; }
  }
`

export default function FlavourFinderPage() {
  const { t } = useLang()
  const [cats, setCats] = useState<Cat[]>([])
  const [value, setValue] = useState<Record<string, number>>({})
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [bestIsClose, setBestIsClose] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchCategories(createBrowserSupabaseClient()).then(setCats) }, [])

  const anySet = Object.keys(value).length > 0
  const memberShape = toShape(value)

  const find = async () => {
    if (!anySet) return
    setLoading(true); setMatches(null)
    try {
      const r = await fetch('/api/whisky/flavour-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set: value }),
      })
      const j = await r.json()
      setMatches(j.matches || [])
      setBestIsClose(!!j.bestIsClose)
      // The matches land beneath the compass — take the member to them.
      setTimeout(() => document.getElementById('wf-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } finally { setLoading(false) }
  }
  const reset = () => { setValue({}); setMatches(null) }

  return (
    <>
      <MemberPage title="Find Your Dram" subtitle="Tìm Ly Của Bạn" icon="/images/whisky-glass-icon-opt.png" description={t("Set the flavours you're in the mood for, and we'll find your match", 'Chọn những hương vị bạn đang muốn thưởng thức, chúng tôi sẽ tìm ly hợp với bạn')}>
        <WhiskyStyle />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />

        <section className="wf-top">
          <div className="wf-words">
            <Rise>
              <p className="wf-prompt">
                {t("Tap a flavour to add it, tap again to turn it up (1–4). Set only the notes you care about — the rest we'll leave open. Then find your match.",
                  'Chạm vào một hương vị để thêm, chạm lần nữa để tăng mức độ (1–4). Chỉ chọn những hương bạn quan tâm — phần còn lại chúng tôi để ngỏ. Rồi tìm ly hợp với bạn.')}
              </p>
            </Rise>
            <Rise delay={.16} className="wf-ink"><CreamInk name="butler-tray" width="100%" rot={-4} dur={9} /></Rise>
          </div>

          <Rise delay={.1} className="wf-tool">
            {cats.length === 0 ? <div className="wf-hint">{t('Loading…', 'Đang tải…')}</div> : (
              <>
                <div className="wl-radar wf-compass">
                  <FinderRadar cats={cats} value={value} onChange={setValue} size={RADAR} />
                </div>
                <div className="wf-actions">
                  <button type="button" onClick={find} disabled={!anySet || loading} className="wl-link is-gold is-big" style={{ opacity: anySet && !loading ? 1 : 0.42 }}>
                    {loading ? t('Finding…', 'Đang tìm…') : <>{t('Find my match', 'Tìm ly hợp với tôi')} <span className="pk-go" aria-hidden="true">→</span></>}
                  </button>
                  {anySet && <button type="button" onClick={reset} className="wl-link is-quiet">{t('Reset', 'Đặt lại')}</button>}
                </div>
                {!anySet && <div className="wf-hint">{t('Tap the compass above to begin.', 'Chạm vào la bàn phía trên để bắt đầu.')}</div>}
              </>
            )}
          </Rise>
        </section>

        {matches && (
          <section id="wf-results" className="wf-results">
            {matches.length === 0 ? (
              <p className="wl-text">{t('Set a flavour or two first.', 'Hãy chọn một hoặc hai hương vị trước.')}</p>
            ) : (
              <>
                {!bestIsClose && (
                  <p className="wl-banner">
                    {t("Nothing's a close match for that exact profile yet — but here's the nearest we pour.", 'Chưa có chai nào thật sự khớp với đúng hồ sơ đó — nhưng đây là những ly gần nhất chúng tôi có.')}
                  </p>
                )}
                <div className="wf-rhead">
                  <h2 className="wl-h is-2">{bestIsClose ? t('Your matches', 'Những ly hợp với bạn') : t('Nearest pours', 'Những ly gần nhất')}</h2>
                  <div className="wf-glass"><CreamInk name="glass" width="100%" rot={-6} dur={7} /></div>
                </div>
                <div className="wl-pours">
                  {matches.map(m => (
                    <article key={m.id} className="wl-pour">
                      <div className="wl-pour-head">
                        <h3 className="wl-pour-name">{m.name}</h3>
                        <div className="wl-strength" style={{ color: strengthColor(m.strength) }}>{t(STRENGTH_LABEL[m.strength], STRENGTH_VN[m.strength])} · {m.pct}%</div>
                      </div>
                      {m.in_stock === false && <div className="wl-pour-note wf-oos">{t('Not currently in stock', 'Hiện đang hết hàng')}</div>}
                      <div className="wl-radar">
                        <RadarChart cats={cats} shapes={[
                          { values: memberShape, color: RADAR_GOLD, label: t('You', 'Bạn') },
                          { values: toShape(m.spokes), color: RADAR_SAGE, label: m.name },
                        ]} size={RADAR} />
                      </div>
                      <div className="wl-legend">
                        <span className="wl-sw" style={{ background: RADAR_GOLD }} /><span>{t('What you set', 'Lựa chọn của bạn')}</span>
                        <span className="wl-sw" style={{ background: RADAR_SAGE }} /><span>{t('This whisky', 'Chai whisky này')}</span>
                      </div>
                      <Link href={`/members/whisky?focus=${m.id}`} className="wl-link is-gold">
                        {bare(t('See it in the library →', 'Xem trong thư viện →'))} <span className="pk-go" aria-hidden="true">→</span>
                      </Link>
                    </article>
                  ))}
                </div>
                <button type="button" onClick={reset} className="wl-link is-quiet" style={{ marginTop: 26 }}>{t('Reset', 'Đặt lại')}</button>
              </>
            )}
          </section>
        )}
      </MemberPage>
    </>
  )
}
