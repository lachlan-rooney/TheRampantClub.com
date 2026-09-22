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
// x 4820–6015, y 998–1846. The logo starts centred THERE, not on the face's
// middle — the top swirl reaches into the right of the face, and a wide logo
// centred on the face would sit on the gold.
//
// ACTUAL SIZE is one artwork pixel to one CSS pixel, scrolled to the face. Its
// 695 KB file only loads when asked for; the page shows a 148 or 297 KB one.
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
  const [centre, setCentre] = useState({ cx: CLEAR.x + CLEAR.w / 2, cy: CLEAR.y + CLEAR.h / 2 })
  const [mode, setMode] = useState<'fit' | 'actual'>('fit')
  const [dragging, setDragging] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
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
      setScale(0.8); setCentre({ cx: CLEAR.x + CLEAR.w / 2, cy: CLEAR.y + CLEAR.h / 2 })
    }
    img.onerror = () => { URL.revokeObjectURL(url); setErr(t('That image could not be read.', 'Không đọc được ảnh này.')) }
    img.src = url
  }
  useEffect(() => () => { if (logo?.url) URL.revokeObjectURL(logo.url) }, [logo?.url])

  // Actual size opens on the face, not on the end flap six thousand pixels away.
  useEffect(() => {
    const v = viewRef.current
    if (mode !== 'actual' || !v) return
    const aim = box ?? CLEAR
    v.scrollLeft = aim.x + aim.w / 2 - v.clientWidth / 2
    v.scrollTop = aim.y + aim.h / 2 - v.clientHeight / 2
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const use = () => onUse({ sleeve: 'dt-tet-2027', logo_box: box, logo_preview: logo?.url, logo_file: logo?.file })

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div ref={viewRef} className={`ss-view is-${mode}`}>
        <div ref={stageRef} className="ss-stage" style={mode === 'actual' ? { width: SLEEVE.w } : undefined}>
          {/* TWO ELEMENTS, NOT ONE REPOINTED. Swapping src on the same <img>
              from a srcset to a single file left Chrome applying the old
              srcset's density (1600w in a 1180px slot = 1.356), so the 6431 px
              file reported itself as 4742 — measured in a browser. A separate
              element per view starts clean. */}
          {mode === 'actual' ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key="actual" className="ss-art" draggable={false} width={SLEEVE.w} height={SLEEVE.h}
                 src="/images/tet/sleeve-full.webp"
                 alt={t('The Duncan Taylor Tết sleeve, flat, at actual size', 'Hộp Tết Duncan Taylor, trải phẳng, kích thước thật')} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key="fit" className="ss-art" draggable={false} width={SLEEVE.w} height={SLEEVE.h}
                 src="/images/tet/sleeve-1600.webp"
                 srcSet="/images/tet/sleeve-1600.webp 1600w, /images/tet/sleeve-3200.webp 3200w"
                 sizes="(max-width: 900px) 100vw, 1180px"
                 alt={t('The Duncan Taylor Tết sleeve, flat, before folding', 'Hộp Tết Duncan Taylor, trải phẳng trước khi gấp')} />
          )}
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
              <button className="ss-link" onClick={() => setCentre({ cx: CLEAR.x + CLEAR.w / 2, cy: CLEAR.y + CLEAR.h / 2 })}>{t('Centre it', 'Căn giữa')}</button>
              <span className="pk-meta" style={{ opacity: .5, marginLeft: 12, fontSize: 11.5 }}>{t('or drag it on the sleeve', 'hoặc kéo trên hộp')}</span>
            </div>
          </div>
        )}

        <div>
          <div className="pk-eyebrow">{t('View', 'Xem')}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <button className={`ss-toggle ${mode === 'fit' ? 'is-on' : ''}`} onClick={() => setMode('fit')}>{t('Whole sleeve', 'Toàn bộ hộp')}</button>
            <button className={`ss-toggle ${mode === 'actual' ? 'is-on' : ''}`} onClick={() => setMode('actual')}>
              {t('Actual size', 'Kích thước thật')} <span style={{ opacity: .55 }}>· 6,431 × 2,387 px</span>
            </button>
          </div>
        </div>
      </div>

      <button onClick={use} className="pk-cta">
        {t('Send this design with an enquiry', 'Gửi thiết kế này kèm yêu cầu')} <span className="pk-go">→</span>
      </button>
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
.ss-view.is-actual { overflow: auto; max-height: 78vh; background: rgba(229,212,194,.04);
                     border: 1px solid rgba(229,212,194,.14); overscroll-behavior: contain; }
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
.ss-view.is-actual .ss-slot { font-size: 40px; }
.ss-controls { display: flex; flex-wrap: wrap; gap: 26px 44px; align-items: flex-start; margin-top: 30px; }
.ss-drop { border: 1px dashed rgba(229,212,194,.28); border-radius: 8px; padding: 14px 18px; text-align: center; cursor: pointer;
           background: none; font-family: 'Google Sans Code', monospace; font-size: 12px; color: rgba(229,212,194,.7); }
.ss-drop:hover { border-color: #D4B85A; color: #E5D4C2; }
.ss-range { width: 200px; margin-top: 12px; accent-color: #D4B85A; }
.ss-link { background: none; border: none; padding: 0; cursor: pointer; font-family: 'Google Sans Code', monospace;
           font-size: 12px; color: #D4B85A; border-bottom: 1px solid rgba(212,184,90,.5); }
.ss-toggle { background: none; border: none; padding: 2px 0; cursor: pointer; font-family: 'Google Sans Code', monospace;
             font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: rgba(229,212,194,.55);
             border-bottom: 1px solid transparent; }
.ss-toggle.is-on { color: #D4B85A; border-bottom-color: #D4B85A; }
@media (prefers-reduced-motion: reduce) { .ss-logo { transition: none; } }
`
