import type { SupabaseClient } from '@supabase/supabase-js'
import { lineChart, hbars, donut, funnel, stackedBars } from './charts'
import type { AutoData } from './gather'
import type { Financials } from './financials'

// Rasterise the report's charts (same specs render.ts inlines as SVG) to PNG and
// upload them to the public `report-charts` bucket, so the email can <img src>
// them (Gmail strips inline SVG). Returns { key: publicUrl } for chart_urls.
// Kept in lock-step with render.ts's chart keys: visits, events, members,
// funnel, financials.

const BUCKET = 'report-charts'

export function reportChartSvgs(auto: AutoData, financials: Financials | null, includeFinancials: boolean): Record<string, string> {
  const d = auto
  const out: Record<string, string> = {}
  out.visits = lineChart(d.usage.visits_by_day.map(x => ({ label: x.label, count: x.count })), 'dark')
  if ((d.events.fixtures || []).length) out.events = hbars(d.events.fixtures.map(f => ({ label: f.title, value: f.signups, max: f.max })), 'dark')
  if (Object.keys(d.members.by_tier || {}).length) out.members = donut(Object.entries(d.members.by_tier).map(([label, value]) => ({ label, value: value as number })), 'dark')
  out.funnel = funnel(d.pipeline.funnel, 'dark')
  if (includeFinancials && financials && 'total_revenue' in financials) {
    const mom = financials.mom.map(m => ({ label: m.label, parts: { Membership: m.membership, 'Card top-ups': m.card_topups, Gifting: m.gifting } }))
    out.financials = stackedBars(mom, ['Membership', 'Card top-ups', 'Gifting'], 'dark')
  }
  return out
}

export async function generateReportChartPngs(
  sb: SupabaseClient, reportId: string, auto: AutoData, financials: Financials | null, includeFinancials: boolean,
): Promise<Record<string, string>> {
  // Dynamic, guarded import: if sharp's native binary is unavailable (e.g. a
  // platform mismatch on the host), the whole route must NOT crash — we return
  // no PNGs and the email falls back to numbers + the hosted link (SVG charts).
  let sharp: typeof import('sharp')
  try {
    const m = await import('sharp')
    sharp = ((m as unknown as { default?: typeof import('sharp') }).default ?? (m as unknown as typeof import('sharp')))
  } catch (e) { console.error('sharp unavailable — charts will fall back:', e); return {} }

  const svgs = reportChartSvgs(auto, financials, includeFinancials)
  const urls: Record<string, string> = {}
  for (const [key, svg] of Object.entries(svgs)) {
    try {
      // A dark ground behind the chart so transparent PNGs read on any email bg.
      const png = await sharp(Buffer.from(svg)).flatten({ background: '#052E20' }).png().toBuffer()
      const path = `${reportId}/${key}.png`
      await sb.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true })
      const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
      urls[key] = data.publicUrl
    } catch (e) {
      console.error(`chart png ${key} failed:`, e)   // fallback: email shows numbers + hosted link
    }
  }
  return urls
}
