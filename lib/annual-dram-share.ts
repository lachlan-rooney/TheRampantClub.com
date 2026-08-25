// Renders the Annual Dram card to a shareable PNG on a <canvas> (no DOM-raster
// dependency — we redraw the card directly) and shares it via the Web Share API
// with a file, falling back to a download. Replaces the "screenshot and share"
// hint, which captured the browser chrome + nav.

export interface AnnualShareData {
  sparse: boolean
  framing: 'year_end' | 'so_far'
  year: number
  member_name: string
  member_no: string
  visits: number
  distinct_drams: number
  top_dram: string | null
  palette: string | null
  standout_note: { note: string; whisky: string | null } | null
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const CREAM = '#E5D4C2'
const GOLD = '#C9A84C'
const MUTED = '#B2AA98'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function renderAnnualDramImage(d: AnnualShareData): Promise<Blob> {
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready } catch { /* fonts optional */ }

  const W = 1080, H = 1350, scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale; canvas.height = H * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // Background gradient
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#0A3A28'); g.addColorStop(0.55, '#052E20'); g.addColorStop(1, '#04251A')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

  // Gold inset border
  ctx.strokeStyle = 'rgba(201,168,76,0.45)'; ctx.lineWidth = 2
  ctx.strokeRect(40, 40, W - 80, H - 80)

  const cx = W / 2
  const setLS = (v: number) => { try { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${v}px` } catch { /* older canvas */ } }
  ctx.textAlign = 'center'

  let y = 150
  const title = d.framing === 'year_end' ? `Your ${d.year}` : 'Your Year So Far'

  // Kicker
  setLS(4); ctx.fillStyle = GOLD; ctx.font = `500 22px ${MONO}`
  ctx.fillText(`THE RAMPANT CLUB · ${title.toUpperCase()}`, cx, y)
  setLS(0)
  y += 90

  if (d.sparse) {
    ctx.fillStyle = CREAM; ctx.font = `600 58px ${SERIF}`
    ctx.fillText('Your story is', cx, y); y += 66
    ctx.fillText('just beginning.', cx, y); y += 70
    ctx.fillStyle = MUTED; ctx.font = `26px ${MONO}`
    for (const ln of wrap(ctx, `Every visit, every dram, every note from here becomes your year. We're glad you're with us, ${d.member_name}.`, W - 260)) {
      ctx.fillText(ln, cx, y); y += 40
    }
  } else {
    ctx.fillStyle = CREAM; ctx.font = `600 64px ${SERIF}`
    ctx.fillText(d.member_name, cx, y); y += 56
    if (d.palette) { ctx.fillStyle = GOLD; ctx.font = `26px ${MONO}`; ctx.fillText(`a ${d.palette} palate`, cx, y); y += 40 }
    y += 40

    // Stats
    const stats: [string, string][] = []
    if (d.visits > 0) stats.push([String(d.visits), d.visits === 1 ? 'VISIT' : 'VISITS'])
    if (d.distinct_drams > 0) stats.push([String(d.distinct_drams), 'DISTINCT DRAMS'])
    if (stats.length) {
      const span = 300, startX = cx - ((stats.length - 1) * span) / 2
      stats.forEach(([val, lab], i) => {
        const x = startX + i * span
        ctx.fillStyle = GOLD; ctx.font = `600 84px ${SERIF}`; ctx.fillText(val, x, y + 60)
        setLS(3); ctx.fillStyle = MUTED; ctx.font = `22px ${MONO}`; ctx.fillText(lab, x, y + 100); setLS(0)
      })
      y += 170
    }

    if (d.top_dram) {
      ctx.strokeStyle = 'rgba(201,168,76,0.28)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(W - 140, y); ctx.stroke()
      setLS(4); ctx.fillStyle = MUTED; ctx.font = `20px ${MONO}`; ctx.fillText('YOUR DRAM OF THE YEAR', cx, y + 40); setLS(0)
      ctx.fillStyle = CREAM; ctx.font = `42px ${SERIF}`; ctx.fillText(d.top_dram, cx, y + 92)
      y += 120
      ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(W - 140, y); ctx.stroke()
      y += 50
    }

    if (d.standout_note) {
      ctx.fillStyle = CREAM; ctx.font = `italic 28px ${MONO}`
      for (const ln of wrap(ctx, `"${d.standout_note.note}"`, W - 280)) { ctx.fillText(ln, cx, y); y += 42 }
      if (d.standout_note.whisky) { ctx.fillStyle = GOLD; ctx.font = `20px ${MONO}`; ctx.fillText(`— on ${d.standout_note.whisky}`, cx, y + 12); y += 40 }
    }
  }

  // Footer
  setLS(3); ctx.fillStyle = '#7E8A7E'; ctx.font = `22px ${MONO}`
  ctx.textAlign = 'left'; ctx.fillText(`No. ${d.member_no}`, 80, H - 90)
  ctx.textAlign = 'right'; setLS(6); ctx.fillText('RAMPANT', W - 80, H - 90)
  setLS(0)

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('encode failed')), 'image/png')
  )
}

// Share the rendered card. Returns how it was handled so the UI can message it.
export async function shareAnnualDram(d: AnnualShareData): Promise<'shared' | 'downloaded'> {
  const blob = await renderAnnualDramImage(d)
  const file = new File([blob], `rampant-annual-dram-${d.year}.png`, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare && nav.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'The Rampant Club', text: 'My year at The Rampant Club.' })
    return 'shared'
  }
  // Fallback: download the PNG.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = file.name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}
