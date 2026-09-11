'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import RadarChart from '@/components/whisky/RadarChart'
import { fetchCategories, RADAR_GOLD, type Cat, type ShapeValues } from '@/components/whisky/flavour-data'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { buildTasteNarrative, vectorToShape, type TasteVector, type TasteSources } from '@/lib/whisky/taste-narrative'
import { useLang } from '@/lib/lang'
import { WhiskyStyle, bare, RADAR } from '@/components/whisky/WhiskyStyle'
import { Rise, CREAM, GOLD, MONO, SERIF } from '@/components/public/kit'
import { CreamInk } from '@/components/public/CreamInk'

// A linked member's OWN palate, in TRC voice — narrative + radar + the bottles
// that shape it. NO raw scores/parameters. member_taste_profiles is read via the
// member-own RLS (proven 0a), so the query returns only their row.
//
// Set as the house sets a portrait: the narrative in the display face on the
// left, large, with the radar given the right half; the bottles that shape it
// beneath as a numbered list on hairlines, a lion with his dram beside them.

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
  // The radar scales to its column (.wl-radar); drawn at the pages' RADAR size.
  const radarSize = RADAR

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
      <WhiskyStyle />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {loading ? (
        <p className="wl-text">{t('Reading your palate…', 'Đang đọc khẩu vị của bạn…')}</p>
      ) : !hasProfile ? (
        <section>
          <Rise>
            <p className="wt-empty-text">{t("We're still learning your palate. Tell us the drams you love — explore the", 'Chúng tôi vẫn đang tìm hiểu khẩu vị của bạn. Hãy cho chúng tôi biết những ly bạn yêu thích — khám phá')} <Link href="/members/whisky" className="wl-inline">{t('Whisky Library', 'Thư Viện Whisky')}</Link> {t('or try the', 'hoặc thử')} <Link href="/members/whisky/finder" className="wl-inline">{t('Flavour Finder', 'Tìm Ly Của Bạn')}</Link>{t(', and your profile will take shape.', ', và hồ sơ khẩu vị của bạn sẽ dần hình thành.')}</p>
          </Rise>
        </section>
      ) : (
        <>
          <section className={`wt-grid ${cats && shape && Object.keys(shape).length > 0 ? '' : 'is-single'}`}>
            <div>
              {narrative && <Rise><p className="wt-narrative">{lang === 'vn' ? (narrativeVn || narrative) : narrative}</p></Rise>}

              {notedCount > 0 && (
                <Rise delay={.08}>
                  <p className="wt-shaped">
                    {t(`✒ Shaped by your ${notedCount} tasting note${notedCount === 1 ? '' : 's'} — keep logging and your palate sharpens.`, `✒ Được định hình từ ${notedCount} ghi chú nếm thử của bạn — tiếp tục ghi lại để khẩu vị thêm tinh tường.`)}
                  </p>
                </Rise>
              )}
            </div>

            {cats && shape && Object.keys(shape).length > 0 && (
              <Rise delay={.12} className="wl-radar wt-radar">
                <RadarChart cats={cats} shapes={[{ values: shape, color: RADAR_GOLD, label: '' }]} size={radarSize} />
              </Rise>
            )}
          </section>

          {lovedBottles.length > 0 && (
            <section className="wt-loved">
              <div className="wt-loved-head">
                <Rise><h2 className="wl-h is-2">{t('The drams that shape your profile', 'Những ly định hình khẩu vị của bạn')}</h2></Rise>
                <Rise delay={.1} className="wt-loved-ink"><CreamInk name="lion-suit" width="100%" rot={4} dur={9} /></Rise>
              </div>
              <ol className="wt-list">
                {lovedBottles.map((b, i) => (
                  <li key={i}><span className="wt-num">{String(i + 1).padStart(2, '0')}</span><span className="wt-name">{b}</span></li>
                ))}
              </ol>
              <Link href="/members/whisky" className="wl-link is-gold is-big" style={{ marginTop: 30 }}>
                {bare(t('Explore the library →', 'Khám phá thư viện →'))} <span className="pk-go" aria-hidden="true">→</span>
              </Link>
            </section>
          )}
        </>
      )}
    </MemberPage>
  )
}

const CSS = `
  .wt-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 72px; align-items: center; }
  .wt-grid.is-single { grid-template-columns: minmax(0, 1fr); }
  .wt-narrative { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 2.9vw, 40px); line-height: 1.14;
                  color: ${CREAM}; margin: 0; max-width: 620px; }
  .wt-shaped { font-family: ${MONO}; font-size: 12.5px; line-height: 1.9; color: ${GOLD}; margin: 26px 0 0; max-width: 520px; }
  .wt-radar { max-width: 540px; justify-self: end; }

  .wt-loved { margin-top: 120px; }
  .wt-loved-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; margin-bottom: 34px; }
  .wt-loved-ink { width: clamp(120px, 13vw, 190px); margin-right: 4%; }
  .wt-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 56px; }
  .wt-list li { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; align-items: baseline;
                padding: 16px 0 18px; border-top: 1px solid rgba(229,212,194,.16); }
  .wt-num { font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; color: ${GOLD}; }
  .wt-name { font-family: ${SERIF}; font-size: clamp(21px, 2.1vw, 27px); line-height: 1.08; color: ${CREAM}; overflow-wrap: anywhere; }

  .wt-empty-text { font-family: ${MONO}; font-size: 14px; line-height: 2; color: ${CREAM}; opacity: .9; max-width: 600px; margin: 0; }

  @media (max-width: 860px) {
    .wt-grid { grid-template-columns: minmax(0, 1fr); gap: 36px; }
    .wt-radar { justify-self: stretch; max-width: 480px; }
    .wt-list { grid-template-columns: minmax(0, 1fr); }
    .wt-loved { margin-top: 88px; }
  }
  @media (max-width: 600px) {
    .wt-loved-ink { width: 92px; margin-right: 0; }
    .wt-empty-text { font-size: 13.5px; line-height: 1.95; }
  }
`
