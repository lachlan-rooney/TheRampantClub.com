'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import RadarChart from '@/components/whisky/RadarChart'
import { fetchCategories, RADAR_GOLD, type Cat, type ShapeValues } from '@/components/whisky/flavour-data'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { buildTasteNarrative, vectorToShape, type TasteVector, type TasteSources } from '@/lib/whisky/taste-narrative'
import { useLang } from '@/lib/lang'

// A linked member's OWN palate, in TRC voice — narrative + radar + the bottles
// that shape it. NO raw scores/parameters. member_taste_profiles is read via the
// member-own RLS (proven 0a), so the query returns only their row.

const FAMILY = "'Google Sans Code', 'DM Mono', monospace"

// ── THE VIETNAMESE NARRATIVE ────────────────────────────────────────────────
// buildTasteNarrative (lib/whisky/taste-narrative) speaks English only. This is
// its Vietnamese twin: the SAME selection (top 3 families with v > 0, the same
// case-insensitive distillery dedup, the same empty rule) with Vietnamese phrases.
// If the English builder's selection ever changes, change this with it.
const FAMILY_PHRASE_VN: Record<string, string> = {
  cereal_biscuit:       'những ly đậm mạch nha, thiên về ngũ cốc',
  green_grassy:         'hương cỏ xanh tươi mát',
  orchard_fruit:        'vị trái cây vườn ngọt dịu',
  tropical_citrus:      'trái cây nhiệt đới và cam chanh tươi sáng',
  floral_honeyed:       'nét hoa và mật ong thanh nhã',
  buttery_creamy:       'kết cấu béo mịn như bơ và kem',
  meaty_sulphury:       'chiều sâu mặn mà, đậm vị',
  vanilla_coconut:      'vani và dừa ngọt ngào',
  baking_spice:         'gia vị ấm nồng',
  pepper_tannin:        'vị tiêu và tannin khô',
  dried_fruit_walnut:   'chiều sâu trái cây khô đậm chất sherry',
  treacle_roast:        'mật mía, cà phê và hương rang',
  leather_polished_oak: 'gỗ sồi lâu năm và da thuộc trầm mặc',
  woodsmoke:            'khói gỗ và than hồng',
  tar_iodine:           'than bùn mạnh mẽ, nồng mùi i-ốt',
  brine_shoreline:      'vị muối biển béo dầu',
}
const joinVn = (items: string[]): string =>
  items.length <= 1 ? (items[0] || '') : `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`
function buildTasteNarrativeVn(vector: TasteVector, sources: TasteSources): string {
  const top = Object.entries(vector || {})
    .filter(([slug, v]) => v > 0 && FAMILY_PHRASE_VN[slug])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => FAMILY_PHRASE_VN[slug])
  const seen = new Set<string>()
  const distilleries = (sources?.loved_distilleries || []).filter(d => {
    if (!d) return false
    const k = d.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k); return true
  })
  if (top.length === 0 && distilleries.length === 0) return ''
  let s = top.length ? `Bạn thiên về ${joinVn(top)}` : 'Khẩu vị của bạn vẫn đang dần định hình'
  if (distilleries.length) s += ` — đặc biệt yêu thích ${joinVn(distilleries.slice(0, 3))}`
  return s + '.'
}

export default function MyTastePage() {
  const { t, lang } = useLang()
  const [loading, setLoading] = useState(true)
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [shape, setShape] = useState<ShapeValues | null>(null)
  const [narrative, setNarrative] = useState('')
  const [narrativeVn, setNarrativeVn] = useState('')
  const [lovedBottles, setLovedBottles] = useState<string[]>([])
  const [notedCount, setNotedCount] = useState(0)
  // Responsive radar: MemberPage gives ~280px of content width at 360px, so a
  // fixed 300 would overflow. Cap to the viewport (clamped 240–300).
  const [radarSize, setRadarSize] = useState(300)

  useEffect(() => {
    const fit = () => setRadarSize(Math.max(240, Math.min(300, window.innerWidth - 96)))
    fit(); window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    Promise.all([
      fetchCategories(supabase),
      supabase.from('member_taste_profiles').select('vector, sources').maybeSingle(),
    ]).then(([c, { data }]) => {
      setCats(c)
      if (data) {
        const vector = (data.vector || {}) as TasteVector
        const sources = (data.sources || {}) as TasteSources
        setNarrative(buildTasteNarrative(vector, sources))
        setNarrativeVn(buildTasteNarrativeVn(vector, sources))
        setShape(vectorToShape(vector))
        setLovedBottles(sources.loved_bottles || [])
        setNotedCount(sources.noted_count || 0)
      }
      setLoading(false)
    })
  }, [])

  const hasProfile = !!narrative || lovedBottles.length > 0 || (shape && Object.keys(shape).length > 0)

  return (
    <MemberPage title="Your Palate" subtitle="Khẩu Vị Của Bạn">
      {loading ? (
        <p style={muted}>{t('Reading your palate…', 'Đang đọc khẩu vị của bạn…')}</p>
      ) : !hasProfile ? (
        <div style={emptyWrap}>
          <p style={muted}>{t("We're still learning your palate. Tell us the drams you love — explore the", 'Chúng tôi vẫn đang tìm hiểu khẩu vị của bạn. Hãy cho chúng tôi biết những ly bạn yêu thích — khám phá')} <Link href="/members/whisky" style={link}>{t('Whisky Library', 'Thư Viện Whisky')}</Link> {t('or try the', 'hoặc thử')} <Link href="/members/whisky/finder" style={link}>{t('Flavour Finder', 'Tìm Ly Của Bạn')}</Link>{t(', and your profile will take shape.', ', và hồ sơ khẩu vị của bạn sẽ dần hình thành.')}</p>
        </div>
      ) : (
        <>
          {narrative && <p style={narrativeText}>{lang === 'vn' ? (narrativeVn || narrative) : narrative}</p>}

          {notedCount > 0 && (
            <p style={shapedLine}>
              {t(`✒ Shaped by your ${notedCount} tasting note${notedCount === 1 ? '' : 's'} — keep logging and your palate sharpens.`, `✒ Được định hình từ ${notedCount} ghi chú nếm thử của bạn — tiếp tục ghi lại để khẩu vị thêm tinh tường.`)}
            </p>
          )}

          {cats && shape && Object.keys(shape).length > 0 && (
            <div style={radarWrap}>
              <RadarChart cats={cats} shapes={[{ values: shape, color: RADAR_GOLD, label: '' }]} size={radarSize} />
            </div>
          )}

          {lovedBottles.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={sectionLabel}>{t('The drams that shape your profile', 'Những ly định hình khẩu vị của bạn')}</div>
              <ul style={bottleList}>
                {lovedBottles.map((b, i) => <li key={i} style={bottleItem}>{b}</li>)}
              </ul>
              <Link href="/members/whisky" style={{ ...link, fontSize: 11 }}>{t('Explore the library →', 'Khám phá thư viện →')}</Link>
            </div>
          )}
        </>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, textAlign: 'center' }
const emptyWrap: React.CSSProperties = { maxWidth: 460, margin: '24px auto', textAlign: 'center' }
const narrativeText: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 21, lineHeight: 1.55, color: '#E5D4C2', textAlign: 'center', maxWidth: 520, margin: '4px auto 8px' }
const shapedLine: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#D4B85A', textAlign: 'center', letterSpacing: '0.04em', opacity: 0.85, margin: '0 auto 10px' }
const radarWrap: React.CSSProperties = { display: 'flex', justifyContent: 'center', margin: '12px 0 24px' }
const sectionLabel: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }
const bottleList: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '0 auto 14px', maxWidth: 460 }
const bottleItem: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#E5D4C2', padding: '9px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', textAlign: 'center' }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
