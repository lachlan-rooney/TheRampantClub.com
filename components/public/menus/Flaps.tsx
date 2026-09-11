'use client'

import { useEffect, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// SPLIT FLAPS — one line of departures-board letters (after TonightPanel).
// ───────────────────────────────────────────────────────────────────────────
// When `run` turns true each cell shuffles through random glyphs and settles
// on its letter, left to right. The shuffle writes straight to the cells, so
// nothing re-renders per frame. The cells are aria-hidden and the words sit in
// a visually-hidden span, so a screen reader (or reduced motion) just gets them.

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export default function Flaps({ text, run, size, font, delay = 0 }: {
  text: string; run: boolean; size: string; font?: string; delay?: number
}) {
  const chars = [...text]
  const cells = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const settleAt = chars.map((c, i) => (c === ' ' ? 0 : 6 + i * 2))
    let id: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      id = setInterval(() => {
        frame++
        let busy = false
        chars.forEach((c, i) => {
          const el = cells.current[i]
          if (!el) return
          if (frame >= settleAt[i]) {
            if (el.textContent !== c) {
              el.textContent = c
              const cell = el.parentElement
              cell?.classList.remove('is-flip'); void cell?.offsetWidth; cell?.classList.add('is-flip')
            }
            return
          }
          busy = true
          el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        })
        if (!busy && id) clearInterval(id)
      }, 55)
    }, delay * 1000)
    return () => { clearTimeout(start); if (id) clearInterval(id) }
    // chars derives from text; re-run only when the text or the trigger changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, text, delay])

  return (
    <span className="fl-flaps" style={{ fontSize: size, fontFamily: font }}>
      <style dangerouslySetInnerHTML={{ __html: FLAPS_CSS }} />
      <span className="fl-sr">{text}</span>
      {chars.map((c, i) => (
        <span key={i} className={`fl-cell ${c === ' ' ? 'fl-blank' : ''}`} aria-hidden="true">
          <span ref={el => { cells.current[i] = el }}>{c}</span>
        </span>
      ))}
    </span>
  )
}

const FLAPS_CSS = `
  .fl-flaps { position: relative; display: inline-flex; line-height: 1; white-space: nowrap; }
  .fl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  .fl-cell {
    position: relative; display: inline-flex; align-items: center; justify-content: center;
    width: .78em; height: 1.34em; margin-right: .07em; border-radius: .09em;
    background: linear-gradient(180deg, #232925 0%, #1b201d 49.5%, #141816 50.5%, #181c1a 100%);
    box-shadow: inset 0 -1px 0 rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.04);
    color: #EDE3CF; overflow: hidden;
  }
  .fl-cell:last-child { margin-right: 0; }
  .fl-cell::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,.75); }
  .fl-cell > span { transform: translateY(.03em); }
  .fl-blank { background: linear-gradient(180deg, #1a1f1c 0%, #161a18 49.5%, #111412 50.5%, #141715 100%); }
  .fl-cell.is-flip > span { animation: fl-flip .16s ease-out; }
  @keyframes fl-flip { from { transform: translateY(.03em) scaleY(.35); filter: brightness(1.6); } to { transform: translateY(.03em) scaleY(1); } }
  @media (prefers-reduced-motion: reduce) { .fl-cell.is-flip > span { animation: none; } }
`
