// Pure SVG-string chart kit for the weekly report — the single source of chart
// truth. The hosted page inlines these SVGs; email/PDF rasterise them (sharp →
// PNG) because Gmail strips inline SVG. Geometry mirrors app/admin/_charts.
// Themeable so one spec serves the dark surfaces (email/hosted) and a light PDF.

export const PALETTE = ['#D4B85A', '#7AB07A', '#5E6650', '#C27070', '#E58F4A', '#9E8FC4', '#5B8FA8']

type Theme = 'dark' | 'light'
interface Ctx { text: string; muted: string; grid: string; accent: string }
function ctx(theme: Theme): Ctx {
  return theme === 'light'
    ? { text: '#052E20', muted: '#5E6650', grid: 'rgba(5,46,32,0.12)', accent: '#C9A84C' }
    : { text: '#E5D4C2', muted: '#B2AA98', grid: 'rgba(229,212,194,0.14)', accent: '#D4B85A' }
}
const FONT = "Georgia, 'Times New Roman', serif"
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">${body}</svg>`
}

export function sparkline(values: number[], theme: Theme = 'dark', w = 200, h = 44): string {
  const c = ctx(theme)
  if (!values.length) return svg(w, h, '')
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 4 - (v / max) * (h - 8)).toFixed(1)}`).join(' ')
  const last = values[values.length - 1]
  const lx = (values.length - 1) * step, ly = h - 4 - (last / max) * (h - 8)
  return svg(w, h, `<polyline points="${pts}" fill="none" stroke="${c.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="${c.accent}"/>`)
}

export function lineChart(points: { label: string; count: number }[], theme: Theme = 'dark', w = 520, h = 190): string {
  const c = ctx(theme)
  const padL = 28, padB = 24, padT = 12, padR = 12
  const max = Math.max(...points.map(p => p.count), 1)
  const iw = w - padL - padR, ih = h - padT - padB
  const step = points.length > 1 ? iw / (points.length - 1) : iw
  const x = (i: number) => padL + i * step
  const y = (v: number) => padT + ih - (v / max) * ih
  const grid = [0, 0.5, 1].map(f => { const gy = padT + ih - f * ih; return `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="${c.grid}" stroke-width="1"/><text x="${padL - 6}" y="${gy + 3}" text-anchor="end" font-size="9" fill="${c.muted}">${Math.round(f * max)}</text>` }).join('')
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ')
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.count).toFixed(1)}" r="2.5" fill="${c.accent}"/>`).join('')
  const labels = points.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="9" fill="${c.muted}">${esc(p.label)}</text>`).join('')
  return svg(w, h, `${grid}<polyline points="${line}" fill="none" stroke="${c.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}`)
}

export function donut(segments: { label: string; value: number }[], theme: Theme = 'dark', w = 300, h = 190): string {
  const c = ctx(theme)
  const total = segments.reduce((s, x) => s + x.value, 0)
  const cx = 95, cy = h / 2, r = 62, sw = 26
  if (total === 0) return svg(w, h, `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" fill="${c.muted}">No data</text>`)
  let a0 = -Math.PI / 2
  const arcs = segments.map((s, i) => {
    const frac = s.value / total, a1 = a0 + frac * Math.PI * 2
    const large = frac > 0.5 ? 1 : 0
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    a0 = a1
    return `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="${sw}"/>`
  }).join('')
  const legend = segments.map((s, i) => `<g transform="translate(190, ${28 + i * 22})"><rect width="11" height="11" rx="2" fill="${PALETTE[i % PALETTE.length]}"/><text x="18" y="10" font-size="11" fill="${c.text}">${esc(s.label)} · ${s.value}</text></g>`).join('')
  return svg(w, h, `${arcs}<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="22" font-weight="bold" fill="${c.text}">${total}</text><text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="9" fill="${c.muted}">total</text>${legend}`)
}

export function hbars(rows: { label: string; value: number; max?: number | null }[], theme: Theme = 'dark', w = 520): string {
  const c = ctx(theme)
  const rh = 30, h = Math.max(rh * rows.length + 10, 40)
  const max = Math.max(...rows.map(r => r.max || r.value), 1)
  const barX = 150, barW = w - barX - 50
  const body = rows.map((r, i) => {
    const yy = 8 + i * rh, frac = (r.value) / max
    const cap = r.max ? ` / ${r.max}` : ''
    return `<text x="0" y="${yy + 13}" font-size="11" fill="${c.text}">${esc(r.label.slice(0, 22))}</text><rect x="${barX}" y="${yy + 4}" width="${barW}" height="14" rx="7" fill="${c.grid}"/><rect x="${barX}" y="${yy + 4}" width="${Math.max(0, frac * barW).toFixed(1)}" height="14" rx="7" fill="${PALETTE[i % PALETTE.length]}"/><text x="${barX + barW + 8}" y="${yy + 15}" font-size="10" fill="${c.muted}">${r.value}${cap}</text>`
  }).join('')
  return svg(w, h, body)
}

export function funnel(stages: { stage: string; count: number }[], theme: Theme = 'dark', w = 520): string {
  const c = ctx(theme)
  const rh = 30, h = rh * stages.length + 10
  const max = Math.max(...stages.map(s => s.count), 1)
  const body = stages.map((s, i) => {
    const yy = 6 + i * rh, frac = s.count / max, bw = Math.max(24, frac * (w - 180))
    const x0 = (w - 180) / 2 - bw / 2 + 12
    return `<rect x="${x0.toFixed(1)}" y="${yy}" width="${bw.toFixed(1)}" height="22" rx="4" fill="${PALETTE[i % PALETTE.length]}" opacity="0.9"/><text x="${(x0 + bw / 2).toFixed(1)}" y="${yy + 15}" text-anchor="middle" font-size="11" font-weight="bold" fill="#052E20">${s.count}</text><text x="${w - 150}" y="${yy + 15}" font-size="11" fill="${c.text}">${esc(s.stage)}</text>`
  }).join('')
  return svg(w, h, body)
}

export function stackedBars(groups: { label: string; parts: Record<string, number> }[], keys: string[], theme: Theme = 'dark', w = 520, h = 210): string {
  const c = ctx(theme)
  const padL = 40, padB = 26, padT = 14, padR = 12
  const iw = w - padL - padR, ih = h - padT - padB
  const totals = groups.map(g => keys.reduce((s, k) => s + (g.parts[k] || 0), 0))
  const max = Math.max(...totals, 1)
  const bw = (iw / groups.length) * 0.6, gap = (iw / groups.length)
  const fmtM = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
  const grid = [0, 0.5, 1].map(f => { const gy = padT + ih - f * ih; return `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="${c.grid}"/><text x="${padL - 5}" y="${gy + 3}" text-anchor="end" font-size="8" fill="${c.muted}">${fmtM(f * max)}</text>` }).join('')
  const bars = groups.map((g, i) => {
    const x0 = padL + i * gap + (gap - bw) / 2
    let yy = padT + ih
    const segs = keys.map((k, ki) => {
      const val = g.parts[k] || 0, hh = (val / max) * ih
      yy -= hh
      return hh > 0 ? `<rect x="${x0.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${PALETTE[ki % PALETTE.length]}"/>` : ''
    }).join('')
    return `${segs}<text x="${(x0 + bw / 2).toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="9" fill="${c.muted}">${esc(g.label)}</text>`
  }).join('')
  const legend = keys.map((k, ki) => `<g transform="translate(${padL + ki * 120}, 0)"><rect width="9" height="9" y="2" rx="2" fill="${PALETTE[ki % PALETTE.length]}"/><text x="14" y="10" font-size="9" fill="${c.text}">${esc(k)}</text></g>`).join('')
  return svg(w, h + 18, `<g transform="translate(0,18)">${grid}${bars}</g>${legend}`)
}
