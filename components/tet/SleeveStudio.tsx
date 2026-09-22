'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent, type CSSProperties } from 'react'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// THE SLEEVE — Duncan Taylor's own artwork, with your logo on its blank face.
// ───────────────────────────────────────────────────────────────────────────
// This replaced an invented rectangle (colour swatches, a hex field, "gold
// foil", a company line and a message) on 22 September 2026, when the real
// sleeve arrived: "DT Sleeve.png", the flat dieline, 6431 × 2387 px at 300 dpi
// — 54.4 × 20.2 cm printed, on a transparent ground. It is fixed artwork, so
// colour and foil no longer mean anything; what a buyer chooses is their logo
// and where it sits.
//
// THE FACE WAS MEASURED, NOT GUESSED. Five panels, left to right: an end flap,
// the back (warnings and barcode), the front (Chợ Bến Thành), the side, and a
// BLANK FACE — plain red with gold swirls — from the fold at x 4770 to the
// right-hand edge. There is no glue flap after it. Inside its thin gold frame
// (x 4792–6372, y 673–2306) the swirls cover the top right and the bottom;
// the clear red between them, found by scanning every row for gold, is
// x 4820–6015, y 998–1846. That region SIZES the logo; it does not place it.
// It was also the starting point until the owner said "Centre it is slightly
// off left of centre" — the clear red is 165 px left of the face's middle,
// because the swirl takes the top right. Centred means centred in the gold
// frame, and that is where a logo lands and where "Centre it" puts it back.
//
// There was an ACTUAL SIZE view (one artwork pixel to one CSS pixel). The owner
// removed it, 2026-09-22: "Just whole sleeve is good."
//
// DOWNLOAD AS PNG draws the finished sleeve in the browser — the 3200 px
// artwork with the logo composited at its box — so a buyer can send it to
// whoever signs it off. Nothing is uploaded to make it.
//
// The logo never leaves the browser until an enquiry is actually sent, and then
// only into a private bucket. Its position travels with it, in the artwork's
// own pixels, so whoever prepares the print file knows exactly where it goes.
// ═══════════════════════════════════════════════════════════════════════════

export const SLEEVE = { w: 6431, h: 2387 }
/** The blank face: the fold to the right-hand edge. */
export const FACE = { x: 4770, y: 612, w: 1644, h: 1731 }
/** Inside the face's gold frame — the logo can be moved anywhere in here. */
const FRAME = { x: 4792, y: 673, w: 1580, h: 1633 }
/** The middle of the frame — where "centred" is. */
const MIDDLE = { cx: FRAME.x + FRAME.w / 2, cy: FRAME.y + FRAME.h / 2 }
/** The clear red between the swirls — where the logo starts. */
export const CLEAR = { x: 4820, y: 998, w: 1195, h: 848 }

type Box = { x: number; y: number; w: number; h: number }

export interface SleeveDesign {
  sleeve: 'dt-tet-2027'
  /** The logo's rectangle on the flat artwork, in the artwork's own pixels. */
  logo_box: Box | null
  /** Object URL for the preview only — never sent anywhere. */
  logo_preview?: string
  /** The file itself, uploaded when the enquiry is sent. */
  logo_file?: File
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** A rectangle in artwork pixels as percentages of the artwork, so it scales with it. */
export const onArt = (r: Box): CSSProperties => ({
  left: `${(r.x / SLEEVE.w) * 100}%`, top: `${(r.y / SLEEVE.h) * 100}%`,
  width: `${(r.w / SLEEVE.w) * 100}%`, height: `${(r.h / SLEEVE.h) * 100}%`,
})

export default function SleeveStudio({ onUse }: { onUse: (d: SleeveDesign) => void }) {
  const { t } = useLang()
  const [logo, setLogo] = useState<{ url: string; file: File; ar: number } | null>(null)
  const [scale, setScale] = useState(0.8)
  const [centre, setCentre] = useState(MIDDLE)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  // The logo's box: as big as `scale` of the clear area allows at its own
  // proportions, then kept inside the gold frame wherever it is dragged.
  const box: Box | null = logo ? (() => {
    let w = CLEAR.w * scale, h = w / logo.ar
    if (h > CLEAR.h * scale) { h = CLEAR.h * scale; w = h * logo.ar }
    const x = clamp(centre.cx - w / 2, FRAME.x, FRAME.x + FRAME.w - w)
    const y = clamp(centre.cy - h / 2, FRAME.y, FRAME.y + FRAME.h - h)
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
  })() : null

  const pickLogo = (f: File) => {
    setErr('')
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      setErr(t('PNG, JPEG or WebP, please.', 'Vui lòng dùng PNG, JPEG hoặc WebP.')); return
    }
    if (f.size > 5 * 1024 * 1024) {
      setErr(t(`That file is ${(f.size / 1048576).toFixed(1)}MB. The limit is 5MB.`,
               `Tệp ${(f.size / 1048576).toFixed(1)}MB. Giới hạn là 5MB.`)); return
    }
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      if (logo?.url) URL.revokeObjectURL(logo.url)
      setLogo({ url, file: f, ar: img.naturalWidth / img.naturalHeight || 1 })
      setScale(0.8); setCentre(MIDDLE)
    }
    img.onerror = () => { URL.revokeObjectURL(url); setErr(t('That image could not be read.', 'Không đọc được ảnh này.')) }
    img.src = url
  }
  useEffect(() => () => { if (logo?.url) URL.revokeObjectURL(logo.url) }, [logo?.url])

  // Dragging works in the artwork's pixels whatever size it is drawn at.
  const artPerPx = () => SLEEVE.w / (stageRef.current?.getBoundingClientRect().width || SLEEVE.w)
  const keepInFrame = (cx: number, cy: number) => {
    if (!box) return { cx, cy }
    return { cx: clamp(cx, FRAME.x + box.w / 2, FRAME.x + FRAME.w - box.w / 2), cy: clamp(cy, FRAME.y + box.h / 2, FRAME.y + FRAME.h - box.h / 2) }
  }
  const down = (e: ReactPointerEvent<HTMLImageElement>) => {
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, cx: centre.cx, cy: centre.cy }; setDragging(true)
  }
  const move = (e: ReactPointerEvent<HTMLImageElement>) => {
    const d = drag.current; if (!d) return
    const k = artPerPx()
    setCentre(keepInFrame(d.cx + (e.clientX - d.x) * k, d.cy + (e.clientY - d.y) * k))
  }
  const up = () => { drag.current = null; setDragging(false) }
  const nudge = (e: KeyboardEvent<HTMLImageElement>) => {
    const step = e.shiftKey ? 100 : 20
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const v = m[e.key]; if (!v) return
    e.preventDefault(); setCentre(c => keepInFrame(c.cx + v[0], c.cy + v[1]))
  }

  // The finished sleeve as a PNG. 3200 px wide, not the 6431 master: a PNG of
  // the master is tens of megabytes, far past what anyone can email, and this
  // is for looking at — the printer works from the logo file itself.
  const download = async () => {
    setErr(''); setSaving(true)
    try {
      const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => {
        const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src
      })
      const art = await load('/images/tet/sleeve-3200.webp')
      const k = art.naturalWidth / SLEEVE.w
      const c = document.createElement('canvas')
      c.width = art.naturalWidth; c.height = art.naturalHeight
      const g = c.getContext('2d')!
      g.drawImage(art, 0, 0)
      if (logo && box) {
        const l = await load(logo.url)
        g.imageSmoothingQuality = 'high'
        g.drawImage(l, box.x * k, box.y * k, box.w * k, box.h * k)
      }
      const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, 'image/png'))
      if (!blob) throw new Error('no blob')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'TRC-Tet-2027-sleeve.png'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    } catch {
      setErr(t('The PNG could not be made. Try again, or send the design with an enquiry.',
               'Không tạo được tệp PNG. Vui lòng thử lại, hoặc gửi thiết kế kèm yêu cầu.'))
    } finally { setSaving(false) }
  }

  const use = () => onUse({ sleeve: 'dt-tet-2027', logo_box: box, logo_preview: logo?.url, logo_file: logo?.file })

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ss-view">
        <div ref={stageRef} className="ss-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ss-art" draggable={false} width={SLEEVE.w} height={SLEEVE.h}
               src="/images/tet/sleeve-1600.webp"
               srcSet="/images/tet/sleeve-1600.webp 1600w, /images/tet/sleeve-3200.webp 3200w"
               sizes="(max-width: 900px) 100vw, 1180px"
               alt={t('The Duncan Taylor Tết sleeve, flat, before folding', 'Hộp Tết Duncan Taylor, trải phẳng trước khi gấp')} />
          {!logo && (
            <button type="button" className="ss-slot" style={onArt(CLEAR)} onClick={() => fileRef.current?.click()}>
              {t('Your logo here', 'Logo của quý vị')}
            </button>
          )}
          {logo && box && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo.url} alt={t('Your logo', 'Logo của quý vị')} draggable={false} tabIndex={0}
                 className={`ss-logo ${dragging ? 'is-drag' : ''}`} style={onArt(box)}
                 onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={nudge}
                 aria-label={t('Your logo — drag, or use the arrow keys, to move it', 'Logo của quý vị — kéo hoặc dùng phím mũi tên để di chuyển')} />
          )}
        </div>
      </div>
      <p className="pk-meta" style={{ marginTop: 12, opacity: .55, lineHeight: 1.8 }}>
        {t('Duncan Taylor’s printed sleeve, flat, before folding — your logo goes on the blank face. The printer works from your original file; this shows where it goes.',
           'Hộp in của Duncan Taylor, trải phẳng trước khi gấp — logo của quý vị đặt ở mặt trống. Nhà in làm việc với tệp gốc của quý vị; bản này cho thấy vị trí đặt logo.')}
      </p>

      <div className="ss-controls">
        <div>
          <div className="pk-eyebrow">{t('Your logo', 'Logo của quý vị')}</div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
                 onChange={e => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = '' }} />
          <div style={{ marginTop: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {logo ? (
              <>
                <span className="pk-meta">{logo.file.name} · {(logo.file.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => fileRef.current?.click()} className="pk-cta" style={{ marginTop: 0 }}>{t('Replace', 'Thay')} <span className="pk-go">→</span></button>
                <button onClick={() => { URL.revokeObjectURL(logo.url); setLogo(null) }} className="pk-cta" style={{ marginTop: 0, opacity: .6 }}>{t('Remove', 'Xoá')}</button>
              </>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="ss-drop">
                {t('Add a PNG, JPEG or WebP — up to 5MB', 'Thêm tệp PNG, JPEG hoặc WebP — tối đa 5MB')}
              </button>
            )}
          </div>
          <p className="pk-meta" style={{ marginTop: 8, opacity: .5, fontSize: 11.5 }}>
            {t('A PNG with a transparent background sits on the red. A white background prints as a white box.',
               'PNG nền trong suốt sẽ nằm trên nền đỏ. Nền trắng sẽ in thành một ô trắng.')}
          </p>
          {err && <p className="pk-meta" style={{ color: '#C27070', marginTop: 8 }}>{err}</p>}
        </div>

        {logo && (
          <div>
            <div className="pk-eyebrow">{t('Size', 'Kích thước')} · {Math.round(scale * 100)}%</div>
            <input type="range" min={20} max={100} step={1} value={Math.round(scale * 100)} className="ss-range"
                   onChange={e => setScale(+e.target.value / 100)} aria-label={t('Logo size', 'Kích thước logo')} />
            <div style={{ marginTop: 8 }}>
              <button className="ss-link" onClick={() => setCentre(MIDDLE)}>{t('Centre it', 'Căn giữa')}</button>
              <span className="pk-meta" style={{ opacity: .5, marginLeft: 12, fontSize: 11.5 }}>{t('or drag it on the sleeve', 'hoặc kéo trên hộp')}</span>
            </div>
          </div>
        )}

      </div>

      <div className="ss-actions">
        <button onClick={use} className="pk-cta" style={{ marginTop: 0 }}>
          {t('Send this design with an enquiry', 'Gửi thiết kế này kèm yêu cầu')} <span className="pk-go">→</span>
        </button>
        <button onClick={download} className="pk-cta" style={{ marginTop: 0, opacity: saving ? .5 : .8 }} disabled={saving}>
          {saving ? t('Making the PNG…', 'Đang tạo PNG…') : t('Download as PNG', 'Tải về PNG')} <span className="pk-go">↓</span>
        </button>
      </div>
    </div>
  )
}

/** The blank face alone, with the logo on it, at `width` px — for the enquiry,
 *  so the buyer can see their design is going with them. Built from the same
 *  measurements as the studio, so the two can never disagree. */
export function SleeveFaceThumb({ design, width = 88 }: { design: SleeveDesign; width?: number }) {
  const k = width / FACE.w
  return (
    <div style={{ position: 'relative', width, height: Math.round(FACE.h * k), overflow: 'hidden', borderRadius: 2, flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(0,0,0,.35)' }}>
      <div style={{ position: 'absolute', left: -FACE.x * k, top: -FACE.y * k, width: SLEEVE.w * k, height: SLEEVE.h * k }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/tet/sleeve-1600.webp" alt="" style={{ display: 'block', width: '100%', height: '100%' }} />
        {design.logo_preview && design.logo_box && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={design.logo_preview} alt="" style={{ position: 'absolute', objectFit: 'contain', ...onArt(design.logo_box) }} />
        )}
      </div>
    </div>
  )
}

const CSS = `
.ss-view { position: relative; width: 100%; border-radius: 3px; }
.ss-stage { position: relative; width: 100%; }
.ss-art { display: block; width: 100%; height: auto; user-select: none; -webkit-user-drag: none; pointer-events: none;
          filter: drop-shadow(0 18px 34px rgba(0,0,0,.4)); }
.ss-logo { position: absolute; object-fit: contain; cursor: grab; touch-action: none; user-select: none;
           outline: 1px dashed transparent; outline-offset: 3px; transition: outline-color .2s ease; }
.ss-logo:hover, .ss-logo:focus-visible, .ss-logo.is-drag { outline-color: rgba(212,184,90,.9); }
.ss-logo.is-drag { cursor: grabbing; }
.ss-slot { position: absolute; display: flex; align-items: center; justify-content: center; cursor: pointer;
           background: rgba(0,0,0,.08); border: 1px dashed rgba(229,212,194,.5); border-radius: 2px;
           font-family: 'Google Sans Code', monospace; font-size: clamp(8px, 1vw, 13px); letter-spacing: .16em;
           text-transform: uppercase; color: rgba(229,212,194,.8); }
.ss-slot:hover { border-color: #D4B85A; color: #E5D4C2; }
.ss-controls { display: flex; flex-wrap: wrap; gap: 26px 44px; align-items: flex-start; margin-top: 30px; }
.ss-drop { border: 1px dashed rgba(229,212,194,.28); border-radius: 8px; padding: 14px 18px; text-align: center; cursor: pointer;
           background: none; font-family: 'Google Sans Code', monospace; font-size: 12px; color: rgba(229,212,194,.7); }
.ss-drop:hover { border-color: #D4B85A; color: #E5D4C2; }
.ss-range { width: 200px; margin-top: 12px; accent-color: #D4B85A; }
.ss-link { background: none; border: none; padding: 0; cursor: pointer; font-family: 'Google Sans Code', monospace;
           font-size: 12px; color: #D4B85A; border-bottom: 1px solid rgba(212,184,90,.5); }
.ss-actions { display: flex; flex-wrap: wrap; gap: 14px 36px; align-items: center; margin-top: 36px; }
@media (prefers-reduced-motion: reduce) { .ss-logo { transition: none; } }
`
