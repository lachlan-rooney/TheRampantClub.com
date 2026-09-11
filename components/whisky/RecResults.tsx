'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import RadarChart from './RadarChart'
import { type Cat, type ShapeValues, fetchCategories, RADAR_GOLD, RADAR_SAGE } from './flavour-data'
import { useLang } from '@/lib/lang'
import { strengthColor, bare, RADAR } from './WhiskyStyle'

// Shared rec-results renderer (staff Suggest-a-pour + member For-You both use it).
// Each rec card overlays the TARGET taste (gold) vs the whisky's shape (sage) so
// the fit is visible — delight-first, honest strength, stock note only when known.

const FAMILY = "'Google Sans Code', monospace"
const STRENGTH: Record<string, string> = { strong: 'Strong match', good: 'Good match', loose: 'Loose match', distant: 'Distant' }
const STRENGTH_VN: Record<string, string> = { strong: 'Rất phù hợp', good: 'Phù hợp', loose: 'Tương đối', distant: 'Khá xa' }
const toShape = (m: Record<string, number>): ShapeValues =>
  Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, { intensity: v, confidence: 1 }]))

export interface RecItem {
  id: string; name: string; spokes: Record<string, number>
  pct: number; strength: string; fill_pct: number | null; stock_known: boolean
}

export default function RecResults({ recs, target, bestIsClose, theme = 'dark' }: {
  recs: RecItem[]; target: Record<string, number>; bestIsClose: boolean; theme?: 'dark' | 'member'
}) {
  const { t } = useLang()
  const [cats, setCats] = useState<Cat[]>([])
  useEffect(() => { fetchCategories(createBrowserSupabaseClient()).then(setCats) }, [])
  if (!recs.length) return null
  const targetShape = toShape(target)

  // ── The member's recommendations: a run of pours on hairlines ──────────
  // The same data and links as the staff card below, in the whisky pages'
  // vocabulary (WhiskyStyle, loaded by the page). Staff keep their cards.
  if (theme === 'member') return (
    <div>
      {!bestIsClose && (
        <p className="wl-banner">{t("Nothing's a close match to this profile yet — here's the nearest we pour.", 'Chưa có chai nào thật sự khớp với hồ sơ này — đây là những ly gần nhất chúng tôi có.')}</p>
      )}
      <div className="wl-pours">
        {recs.map(r => (
          <article key={r.id} className="wl-pour">
            <div className="wl-pour-head">
              <h3 className="wl-pour-name">{r.name}</h3>
              <div className="wl-strength" style={{ color: strengthColor(r.strength) }}>{t(STRENGTH[r.strength] || r.strength, STRENGTH_VN[r.strength] || '')} · {r.pct}%</div>
            </div>
            <div className="wl-pour-note">
              {r.stock_known ? t(`In stock · ~${r.fill_pct}% of the bottle`, `Còn hàng · ~${r.fill_pct}% chai`) : t('Stock not tracked', 'Chưa theo dõi tồn kho')}
            </div>
            {cats.length > 0 && (
              <div className="wl-radar">
                <RadarChart cats={cats} shapes={[
                  { values: targetShape, color: RADAR_GOLD, label: t('Their taste', 'Khẩu vị của họ') },
                  { values: toShape(r.spokes), color: RADAR_SAGE, label: r.name },
                ]} size={RADAR} />
              </div>
            )}
            <div className="wl-legend">
              <span className="wl-sw" style={{ background: RADAR_GOLD }} /><span>{t('Their taste', 'Khẩu vị của họ')}</span>
              <span className="wl-sw" style={{ background: RADAR_SAGE }} /><span>{t('This whisky', 'Chai whisky này')}</span>
            </div>
            <Link href={`/members/whisky?focus=${r.id}`} className="wl-link is-gold">
              {bare(t('See it in the library →', 'Xem trong thư viện →'))} <span className="pk-go" aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      {!bestIsClose && (
        <div style={banner}>{t("Nothing's a close match to this profile yet — here's the nearest we pour.", 'Chưa có chai nào thật sự khớp với hồ sơ này — đây là những ly gần nhất chúng tôi có.')}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {recs.map(r => (
          <div key={r.id} style={card}>
            <div style={head}>
              <div style={name}>{r.name}</div>
              <div style={{ ...pill, ...tone(r.strength) }}>{t(STRENGTH[r.strength] || r.strength, STRENGTH_VN[r.strength] || '')} · {r.pct}%</div>
            </div>
            <div style={stockLine}>
              {r.stock_known ? t(`In stock · ~${r.fill_pct}% of the bottle`, `Còn hàng · ~${r.fill_pct}% chai`) : t('Stock not tracked', 'Chưa theo dõi tồn kho')}
            </div>
            {cats.length > 0 && (
              <RadarChart cats={cats} shapes={[
                { values: targetShape, color: RADAR_GOLD, label: t('Their taste', 'Khẩu vị của họ') },
                { values: toShape(r.spokes), color: RADAR_SAGE, label: r.name },
              ]} />
            )}
            <div style={legend}>
              <span style={{ ...sw, background: RADAR_GOLD }} /><span style={leg}>{t('Their taste', 'Khẩu vị của họ')}</span>
              <span style={{ ...sw, background: RADAR_SAGE, marginLeft: 14 }} /><span style={leg}>{t('This whisky', 'Chai whisky này')}</span>
            </div>
            <Link href={`/members/whisky?focus=${r.id}`} style={link}>{t('See it in the library →', 'Xem trong thư viện →')}</Link>
          </div>
        ))}
      </div>
    </div>
  )
}

function tone(s: string): React.CSSProperties {
  if (s === 'strong') return { color: '#7AB07A', borderColor: 'rgba(122,176,122,0.45)' }
  if (s === 'good') return { color: '#D4B85A', borderColor: 'rgba(212,184,90,0.45)' }
  if (s === 'loose') return { color: '#C49555', borderColor: 'rgba(196,149,85,0.45)' }
  return { color: '#B2AA98', borderColor: 'rgba(178,170,152,0.4)' }
}
const banner: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#C49555', background: 'rgba(196,149,85,0.08)', border: '1px solid rgba(196,149,85,0.25)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, marginBottom: 14 }
const card: React.CSSProperties = { padding: 16, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 12 }
const head: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 2 }
const name: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', lineHeight: 1.25 }
const pill: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, padding: '3px 10px', borderRadius: 12, border: '1px solid', whiteSpace: 'nowrap' }
const stockLine: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#B2AA98', opacity: 0.7, marginBottom: 6 }
const legend: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }
const sw: React.CSSProperties = { width: 11, height: 11, borderRadius: 3, display: 'inline-block' }
const leg: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const link: React.CSSProperties = { display: 'block', textAlign: 'center', marginTop: 12, fontFamily: FAMILY, fontSize: 11, color: '#7AB07A', textDecoration: 'none' }
