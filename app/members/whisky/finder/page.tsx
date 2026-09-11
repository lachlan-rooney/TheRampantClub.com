'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import FinderRadar from '@/components/whisky/FinderRadar'
import RadarChart from '@/components/whisky/RadarChart'
import { type Cat, type ShapeValues, fetchCategories, RADAR_GOLD, RADAR_SAGE } from '@/components/whisky/flavour-data'
import { STRENGTH_LABEL, type Match } from '@/lib/whisky/flavour-match'
import { useLang } from '@/lib/lang'

const FAMILY = "'Google Sans Code', 'DM Mono', monospace"

// Vietnamese for the shared STRENGTH_LABEL (lib/whisky/flavour-match), keyed the same.
const STRENGTH_VN: Record<Match['strength'], string> = {
  strong: 'Rất phù hợp', good: 'Phù hợp', loose: 'Tương đối', distant: 'Khá xa — gần nhất hiện có',
}

const toShape = (m: Record<string, number>): ShapeValues =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { intensity: v, confidence: 1 }]))

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
    } finally { setLoading(false) }
  }
  const reset = () => { setValue({}); setMatches(null) }

  return (
    <>
      <MemberPage title="Find Your Dram" subtitle="Tìm Ly Của Bạn" icon="/images/whisky-glass-icon-opt.png" description={t("Set the flavours you're in the mood for, and we'll find your match", 'Chọn những hương vị bạn đang muốn thưởng thức, chúng tôi sẽ tìm ly hợp với bạn')}>
        <p style={prompt}>
          {t("Tap a flavour to add it, tap again to turn it up (1–4). Set only the notes you care about — the rest we'll leave open. Then find your match.",
            'Chạm vào một hương vị để thêm, chạm lần nữa để tăng mức độ (1–4). Chỉ chọn những hương bạn quan tâm — phần còn lại chúng tôi để ngỏ. Rồi tìm ly hợp với bạn.')}
        </p>

        {cats.length === 0 ? <div style={muted}>{t('Loading…', 'Đang tải…')}</div> : (
          <>
            <FinderRadar cats={cats} value={value} onChange={setValue} />
            <div style={actions}>
              <button onClick={find} disabled={!anySet || loading} style={{ ...primaryBtn, opacity: anySet && !loading ? 1 : 0.45 }}>
                {loading ? t('Finding…', 'Đang tìm…') : t('Find my match', 'Tìm ly hợp với tôi')}
              </button>
              {anySet && <button onClick={reset} style={ghostBtn}>{t('Reset', 'Đặt lại')}</button>}
            </div>
            {!anySet && <div style={{ ...muted, textAlign: 'center' }}>{t('Tap the compass above to begin.', 'Chạm vào la bàn phía trên để bắt đầu.')}</div>}
          </>
        )}

        {matches && (
          <div style={{ marginTop: 36 }}>
            {matches.length === 0 ? (
              <div style={muted}>{t('Set a flavour or two first.', 'Hãy chọn một hoặc hai hương vị trước.')}</div>
            ) : (
              <>
                {!bestIsClose && (
                  <div style={honestBanner}>
                    {t("Nothing's a close match for that exact profile yet — but here's the nearest we pour.", 'Chưa có chai nào thật sự khớp với đúng hồ sơ đó — nhưng đây là những ly gần nhất chúng tôi có.')}
                  </div>
                )}
                <div style={resultsHead}>{bestIsClose ? t('Your matches', 'Những ly hợp với bạn') : t('Nearest pours', 'Những ly gần nhất')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {matches.map(m => (
                    <div key={m.id} style={card}>
                      <div style={cardHead}>
                        <div style={cardName}>{m.name}</div>
                        <div style={{ ...strengthPill, ...strengthTone(m.strength) }}>{t(STRENGTH_LABEL[m.strength], STRENGTH_VN[m.strength])} · {m.pct}%</div>
                      </div>
                      {m.in_stock === false && <div style={oos}>{t('Not currently in stock', 'Hiện đang hết hàng')}</div>}
                      <RadarChart cats={cats} shapes={[
                        { values: memberShape, color: RADAR_GOLD, label: t('You', 'Bạn') },
                        { values: toShape(m.spokes), color: RADAR_SAGE, label: m.name },
                      ]} />
                      <div style={legend}>
                        <span style={{ ...sw, background: RADAR_GOLD }} /><span style={legTxt}>{t('What you set', 'Lựa chọn của bạn')}</span>
                        <span style={{ ...sw, background: RADAR_SAGE, marginLeft: 14 }} /><span style={legTxt}>{t('This whisky', 'Chai whisky này')}</span>
                      </div>
                      <Link href={`/members/whisky?focus=${m.id}`} style={libLink}>{t('See it in the library →', 'Xem trong thư viện →')}</Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </MemberPage>
    </>
  )
}

function strengthTone(s: Match['strength']): React.CSSProperties {
  if (s === 'strong') return { color: '#7AB07A', borderColor: 'rgba(122,176,122,0.45)' }
  if (s === 'good') return { color: '#D4B85A', borderColor: 'rgba(212,184,90,0.45)' }
  if (s === 'loose') return { color: '#C49555', borderColor: 'rgba(196,149,85,0.45)' }
  return { color: '#B2AA98', borderColor: 'rgba(178,170,152,0.4)' }
}

const prompt: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, textAlign: 'center', maxWidth: 460, margin: '0 auto 24px' }
const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.7, marginTop: 12 }
const actions: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }
const primaryBtn: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 24, padding: '12px 28px', fontFamily: FAMILY, fontSize: 13, letterSpacing: '0.06em', cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.2)', borderRadius: 24, padding: '12px 22px', fontFamily: FAMILY, fontSize: 12, cursor: 'pointer' }
const honestBanner: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#C49555', background: 'rgba(196,149,85,0.08)', border: '1px solid rgba(196,149,85,0.25)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, marginBottom: 16 }
const resultsHead: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', marginBottom: 16, textAlign: 'center' }
const card: React.CSSProperties = { padding: 18, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 12 }
const cardHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }
const cardName: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 17, color: '#E5D4C2', lineHeight: 1.25 }
const strengthPill: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, padding: '3px 10px', borderRadius: 12, border: '1px solid', whiteSpace: 'nowrap' }
const oos: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#B2AA98', opacity: 0.7, marginBottom: 8 }
const legend: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }
const sw: React.CSSProperties = { width: 11, height: 11, borderRadius: 3, display: 'inline-block' }
const legTxt: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const libLink: React.CSSProperties = { display: 'block', textAlign: 'center', marginTop: 12, fontFamily: FAMILY, fontSize: 11, color: '#7AB07A', textDecoration: 'none' }
