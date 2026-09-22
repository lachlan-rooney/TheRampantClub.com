'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent, type CSSProperties } from 'react'
import { useLang } from '@/lib/lang'
import SleeveBox from '@/components/tet/SleeveBox'

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
// FOLDED (2026-09-22, "a second clickable version"): the same design shown as
// the box it becomes, turned by dragging — see SleeveBox. The logo is placed
// in the flat view; the folded one only shows it.
//
// SHARE hands the same PNG to the phone's own share sheet (Zalo, WhatsApp,
// Messages — whatever is installed), because that is how a design actually
// reaches the person who signs it off here. Where a browser cannot share a
// file (most desktops) the button is not shown; Download does that job.
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

type Box = { x: number; y: number; w: number; h: number }

// ── TWO SLEEVES ────────────────────────────────────────────────────────────
// "DT Sleeve 2.png" arrived the same afternoon (owner: "add a second clickable
// version of the customisable … saved under DT Sleeve 2"): a gold dragon over
// the Sài Gòn skyline, on the same 6431 × 2387 canvas but NOT the same
// dieline — its outline is a symmetric house shape, tall from x 1730 to 4740,
// with panel lines at x ≈ 2223 and 4200. Its blank space is a gold-ruled
// rectangle on the right-hand panel, found by scanning for the rule: x 5100–
// 5104 and 6158–6163, y 752–759 and 1691–1694. Inside that rule the red is
// plain, so the whole interior is where a logo can go.
//
// Because its folds are not Sleeve 1's, the FOLDED view is offered for Sleeve 1
// only — folding the dragon along Sleeve 1's lines would show a box that does
// not exist. When its dieline is confirmed it gets its own fold table.
export type SleeveId = 'dt-tet-2027' | 'dt-tet-2027-dragon'
interface SleeveSpec {
  name: [string, string]
  small: string; large: string
  /** The blank face — what the enquiry thumbnail shows. */
  face: Box
  /** Inside its gold rule — the logo can be moved anywhere in here. */
  frame: Box
  /** The clear ground the logo is SIZED against. */
  clear: Box
  folds: boolean
}
export const SLEEVES: Record<SleeveId, SleeveSpec> = {
  'dt-tet-2027': {
    name: ['Sleeve 1 · Chợ Bến Thành', 'Hộp 1 · Chợ Bến Thành'],
    small: '/images/tet/sleeve-1600.webp', large: '/images/tet/sleeve-3200.webp',
    face: { x: 4770, y: 612, w: 1644, h: 1731 },
    frame: { x: 4792, y: 673, w: 1580, h: 1633 },
    // The clear red between the swirls.
    clear: { x: 4820, y: 998, w: 1195, h: 848 },
    folds: true,
  },
  'dt-tet-2027-dragon': {
    name: ['Sleeve 2 · The dragon', 'Hộp 2 · Rồng vàng'],
    small: '/images/tet/sleeve2-1600.webp', large: '/images/tet/sleeve2-3200.webp',
    face: { x: 5100, y: 752, w: 1064, h: 943 },
    frame: { x: 5105, y: 760, w: 1052, h: 930 },
    clear: { x: 5135, y: 790, w: 992, h: 870 },
    folds: false,
  },
}
const middle = (f: Box) => ({ cx: f.x + f.w / 2, cy: f.y + f.h / 2 })
/** Sleeve 1's, kept for anything that imported them before there were two. */
export const FACE = SLEEVES['dt-tet-2027'].face
export const CLEAR = SLEEVES['dt-tet-2027'].clear

export interface SleeveDesign {
  sleeve: SleeveId
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
  const [sleeveId, setSleeveId] = useState<SleeveId>('dt-tet-2027')
  const S = SLEEVES[sleeveId]
  const FRAME = S.frame, CLEAR = S.clear
  const MIDDLE = middle(FRAME)
  const [centre, setCentre] = useState(MIDDLE)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'flat' | 'folded'>('flat')
  // A new sleeve puts the logo in the middle of ITS blank space, and drops
  // back to flat if that sleeve cannot be folded.
  const pickSleeve = (id: SleeveId) => {
    setSleeveId(id); setCentre(middle(SLEEVES[id].frame))
    if (!SLEEVES[id].folds) setView('flat')
  }
  const [canShare, setCanShare] = useState(false)
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
  const makePng = async (): Promise<Blob> => {
    const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src
    })
    const art = await load(S.large)
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
    return blob
  }
  const FILE = `TRC-Tet-2027-sleeve-${sleeveId === 'dt-tet-2027' ? '1' : '2'}.png`
  const failed = () => setErr(t('The PNG could not be made. Try again, or send the design with an enquiry.',
                                'Không tạo được tệp PNG. Vui lòng thử lại, hoặc gửi thiết kế kèm yêu cầu.'))

  const download = async () => {
    setErr(''); setSaving(true)
    try {
      const blob = await makePng()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = FILE
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    } catch { failed() } finally { setSaving(false) }
  }

  // Only offered where the browser can actually share a FILE — asked with a
  // real one, because canShare({files}) is the only honest test.
  useEffect(() => {
    try {
      const probe = new File([new Blob(['x'], { type: 'image/png' })], FILE, { type: 'image/png' })
      setCanShare(typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] }))
    } catch { setCanShare(false) }
  }, [])
  const share = async () => {
    setErr(''); setSaving(true)
    try {
      const file = new File([await makePng()], FILE, { type: 'image/png' })
      await navigator.share({
        files: [file],
        title: t('Our Tết sleeve', 'Hộp Tết của chúng tôi'),
        text: t('Our logo on the Duncan Taylor Tết sleeve — therampantclub.com/tet',
                'Logo của chúng tôi trên hộp Tết Duncan Taylor — therampantclub.com/tet'),
      })
    } catch (e) {
      // Closing the share sheet is not an error.
      if ((e as Error)?.name !== 'AbortError') failed()
    } finally { setSaving(false) }
  }

  const use = () => onUse({ sleeve: sleeveId, logo_box: box, logo_preview: logo?.url, logo_file: logo?.file })

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ss-sleeves" role="radiogroup" aria-label={t('Choose a sleeve', 'Chọn mẫu hộp')}>
        {(Object.keys(SLEEVES) as SleeveId[]).map(id => (
          <button key={id} role="radio" aria-checked={sleeveId === id}
                  className={`ss-pick ${sleeveId === id ? 'is-on' : ''}`} onClick={() => pickSleeve(id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SLEEVES[id].small} alt="" width={160} height={59} />
            <span>{t(SLEEVES[id].name[0], SLEEVES[id].name[1])}</span>
          </button>
        ))}
      </div>

      <div className="ss-views" role="tablist">
        <button role="tab" aria-selected={view === 'flat'} className={`ss-toggle ${view === 'flat' ? 'is-on' : ''}`} onClick={() => setView('flat')}>
          {t('Flat', 'Trải phẳng')}
        </button>
        <button role="tab" aria-selected={view === 'folded'} className={`ss-toggle ${view === 'folded' ? 'is-on' : ''}`}
                onClick={() => setView('folded')} disabled={!S.folds}
                title={S.folds ? undefined : t('Sleeve 2’s folds are not confirmed yet', 'Nếp gấp của hộp 2 chưa được xác nhận')}>
          {t('Folded · 3D', 'Đã gấp · 3D')}
        </button>
      </div>

      {view === 'folded' && <SleeveBox logo={logo?.url ?? null} box={box} t={t} />}

      <div className="ss-view" hidden={view !== 'flat'}>
        <div ref={stageRef} className="ss-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ss-art" draggable={false} width={SLEEVE.w} height={SLEEVE.h}
               key={sleeveId} src={S.small}
               srcSet={`${S.small} 1600w, ${S.large} 3200w`}
               sizes="(max-width: 900px) 100vw, 1180px"
               alt={t(`${S.name[0]}: the Duncan Taylor Tết sleeve, flat, before folding`, `${S.name[1]}: hộp Tết Duncan Taylor, trải phẳng trước khi gấp`)} />
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
        {view === 'folded'
          ? t('The same design, folded into the box. Place and size your logo in the flat view.',
              'Cùng thiết kế, gấp thành hộp. Đặt và chỉnh cỡ logo ở chế độ trải phẳng.')
          : t('Duncan Taylor’s printed sleeve, flat, before folding — your logo goes on the blank face. The printer works from your original file; this shows where it goes.',
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
        {canShare && (
          <button onClick={share} className="pk-cta" style={{ marginTop: 0, opacity: saving ? .5 : .8 }} disabled={saving}>
            {t('Share · Zalo, WhatsApp…', 'Chia sẻ · Zalo, WhatsApp…')} <span className="pk-go">↗</span>
          </button>
        )}
      </div>
    </div>
  )
}

/** The blank face alone, with the logo on it, at `width` px — for the enquiry,
 *  so the buyer can see their design is going with them. Built from the same
 *  measurements as the studio, so the two can never disagree. */
export function SleeveFaceThumb({ design, width = 88 }: { design: SleeveDesign; width?: number }) {
  const spec = SLEEVES[design.sleeve] ?? SLEEVES['dt-tet-2027']
  const FACE = spec.face
  const k = width / FACE.w
  return (
    <div style={{ position: 'relative', width, height: Math.round(FACE.h * k), overflow: 'hidden', borderRadius: 2, flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(0,0,0,.35)' }}>
      <div style={{ position: 'absolute', left: -FACE.x * k, top: -FACE.y * k, width: SLEEVE.w * k, height: SLEEVE.h * k }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spec.small} alt="" style={{ display: 'block', width: '100%', height: '100%' }} />
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
.ss-sleeves { display: flex; flex-wrap: wrap; gap: 14px 22px; margin-bottom: 26px; }
.ss-pick { display: grid; gap: 8px; justify-items: start; background: none; border: none; padding: 0; cursor: pointer;
           font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
           color: rgba(229,212,194,.55); }
.ss-pick img { width: 160px; height: auto; display: block; padding: 6px; border-radius: 3px;
               border: 1px solid rgba(229,212,194,.14); transition: border-color .2s ease, transform .3s ease; }
.ss-pick:hover img { border-color: rgba(229,212,194,.4); transform: translateY(-2px); }
.ss-pick.is-on { color: #D4B85A; }
.ss-pick.is-on img { border-color: #D4B85A; }
.ss-views { display: flex; gap: 22px; margin-bottom: 18px; }
.ss-toggle:disabled { opacity: .3; cursor: not-allowed; }
.ss-toggle { background: none; border: none; padding: 2px 0; cursor: pointer; font-family: 'Google Sans Code', monospace;
             font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: rgba(229,212,194,.55);
             border-bottom: 1px solid transparent; }
.ss-toggle.is-on { color: #D4B85A; border-bottom-color: #D4B85A; }
.ss-actions { display: flex; flex-wrap: wrap; gap: 14px 36px; align-items: center; margin-top: 36px; }
@media (prefers-reduced-motion: reduce) { .ss-logo { transition: none; } }
`
