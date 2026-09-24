'use client'

import { useState } from 'react'
import TetPlate from '@/components/tet/TetPlate'
import { MONO, GOLD } from '@/components/public/kit'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE FLIGHT — five sample bottles, each one a fact about a wood in the list.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "little tooltips on the sample bottles. Fun facts about
// the casks we put in the options."
//
// ABOUT THE WOOD, NOT THE DISTILLERY. Every cask in tet_casks is still a
// placeholder ("Glen Placeholder", "Placeholder Isle") so there is no real
// distillery to tell a story about, and making one up would be printed on a
// page people spend money from. What IS real is the list's woods — Oloroso,
// Pedro Ximénez, first-fill bourbon, refill, and the octave itself — and
// those have facts that are true of every cask of that kind. Each tip also
// COUNTS how many casks in the selection carry that wood, from the same rows
// the list below is drawn from, so when the real casks arrive the numbers
// move and the facts still hold. A wood the selection no longer has loses its
// count line rather than claiming one.
//
// The bottles are matched to the facts by what they look like: the darkest
// sample is the PX, the pale ones the refill and the octave. The rings sit on
// the caps, not the numbered labels, so the numbers stay visible.
//
// Hover, focus or tap. On a phone the photograph is too small to hold a card
// over a bottle, so the fact opens under the picture instead.
// ═══════════════════════════════════════════════════════════════════════════

interface Fact {
  /** The bottle's black cap, as a percentage of the photograph — the ring
   *  sits there so the sample's own number stays readable. */
  x: number; y: number
  title: [string, string]
  body: [string, string]
  /** Which casks count as this wood. */
  match: (c: CaskBoardRow) => boolean
}

const FACTS: Fact[] = [
  {
    x: 18.4, y: 43.4,
    title: ['Oloroso', 'Oloroso'],
    body: [
      'Oloroso is sherry aged in contact with the air — dry, nutty and dark. The cask that held it gives whisky dried fruit, walnut and spice.',
      'Oloroso là rượu sherry được ủ tiếp xúc với không khí — khô, bùi và sẫm màu. Thùng từng chứa nó mang lại cho whisky hương trái cây sấy, óc chó và gia vị.',
    ],
    match: c => /oloroso/i.test(c.wood ?? ''),
  },
  {
    x: 31.2, y: 40.1,
    title: ['Refill', 'Thùng tái sử dụng'],
    body: [
      'A refill cask has already matured one whisky. It gives less of the wood and lets more of the distillery come through.',
      'Thùng tái sử dụng đã từng ủ một mẻ whisky. Gỗ tác động ít hơn, để đặc tính của nhà chưng cất thể hiện rõ hơn.',
    ],
    match: c => /refill/i.test(c.wood ?? ''),
  },
  {
    x: 48, y: 38.9,
    title: ['First-fill bourbon', 'Thùng bourbon lần đầu'],
    body: [
      'Bourbon must be aged in new charred oak, so each barrel holds bourbon only once — then it crosses the Atlantic. Its first Scotch picks up the vanilla and coconut of American oak.',
      'Bourbon bắt buộc phải ủ trong thùng sồi mới được đốt cháy, nên mỗi thùng chỉ chứa bourbon một lần — rồi vượt Đại Tây Dương. Mẻ Scotch đầu tiên nhận hương vani và dừa của gỗ sồi Mỹ.',
    ],
    match: c => /bourbon/i.test(c.wood ?? ''),
  },
  {
    x: 65.1, y: 39.3,
    title: ['The octave', 'Thùng octave'],
    body: [
      'An octave is a small cask — 40 to 50 litres, an eighth of a sherry butt, hence the name. More wood touches every litre, so it works faster than a big one.',
      'Octave là thùng nhỏ — 40 đến 50 lít, bằng một phần tám thùng butt sherry, nên có tên như vậy. Mỗi lít tiếp xúc với nhiều gỗ hơn, nên rượu chín nhanh hơn thùng lớn.',
    ],
    match: c => /octave/i.test(`${c.cask_type} ${c.wood ?? ''}`),
  },
  {
    x: 84.5, y: 41.7,
    title: ['Pedro Ximénez', 'Pedro Ximénez'],
    body: [
      'PX grapes are dried in the sun until they are nearly raisins before they are pressed. The sherry is almost black — and so is what it leaves in the wood.',
      'Nho PX được phơi nắng đến gần thành nho khô rồi mới ép. Rượu sherry gần như đen — và những gì nó để lại trong gỗ cũng vậy.',
    ],
    match: c => /\bPX\b|pedro/i.test(c.wood ?? ''),
  },
]

export default function TetFlight({ casks, t }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const active = hover ?? pinned
  const L = (pair: [string, string]) => t(pair[0], pair[1])

  const count = (f: Fact) => casks.filter(f.match).length
  const countLine = (f: Fact) => {
    const n = count(f)
    if (!n) return null
    return n === casks.length
      ? t(`Every cask in this selection`, `Mọi thùng trong bộ sưu tập này`)
      : t(`${n} of ${casks.length} casks in this selection`, `${n} trên ${casks.length} thùng trong bộ sưu tập này`)
  }

  const card = (i: number) => {
    const f = FACTS[i]; const line = countLine(f)
    return (
      <>
        <div className="fl-kicker">{t('Sample', 'Mẫu')} {i + 1} · {t('the wood', 'loại gỗ')}</div>
        <div className="fl-title">{L(f.title)}</div>
        <p className="fl-body">{L(f.body)}</p>
        {line && <div className="fl-count">{line}</div>}
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <TetPlate
        src="/images/tet/flight.webp" sm="/images/tet/flight-sm.webp"
        width={1106} height={738} smWidth={820}
        alt={t('Five samples poured into Glencairn glasses', 'Năm mẫu rượu rót trong ly Glencairn')}
        caption={t('Tasted before it is chosen · touch a sample', 'Nếm thử trước khi chọn · chạm vào một mẫu')}
        layer={
          <div onPointerLeave={() => setHover(null)} style={{ position: 'absolute', inset: 0 }}>
            {FACTS.map((f, i) => (
              <button
                key={i}
                type="button"
                className={`fl-spot${active === i ? ' is-on' : ''}`}
                style={{ left: `${f.x}%`, top: `${f.y}%`, ['--i' as string]: i }}
                aria-label={`${t('Sample', 'Mẫu')} ${i + 1}: ${L(f.title)}`}
                aria-expanded={active === i}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(i) }}
                onFocus={() => setPinned(i)}
                onBlur={() => setPinned(p => (p === i ? null : p))}
                onClick={() => setPinned(p => (p === i ? null : i))}
              >
                <span className="fl-ring" />
                {/* The card sits over the photograph on a wide screen, above
                    the bottle, flipped inward at the edges so it never leaves
                    the frame. */}
                <span
                  className="fl-tip"
                  role="tooltip"
                  style={{ ['--tx' as string]: f.x > 70 ? '-86%' : f.x < 30 ? '-14%' : '-50%' }}
                >
                  {card(i)}
                </span>
              </button>
            ))}
          </div>
        }
        after={
          <div className="fl-under" aria-live="polite">
            {active !== null ? card(active) : (
              <div className="fl-kicker">{t('Touch a sample for its wood', 'Chạm vào một mẫu để xem loại gỗ')}</div>
            )}
          </div>
        }
      />
    </>
  )
}

const CSS = `
.fl-spot { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; padding: 0;
           border: none; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.fl-ring { position: absolute; inset: 11px; border-radius: 50%; border: 1.5px solid rgba(255,244,214,.95);
           background: rgba(212,184,90,.28); box-shadow: 0 0 0 0 rgba(212,184,90,.55);
           transition: transform .35s cubic-bezier(.34,1.6,.5,1), background .3s ease;
           animation: fl-ping 3.2s ease-out infinite; animation-delay: calc(var(--i) * .45s); }
@keyframes fl-ping { 0% { box-shadow: 0 0 0 0 rgba(212,184,90,.55) } 70%, 100% { box-shadow: 0 0 0 14px rgba(212,184,90,0) } }
.fl-spot:hover .fl-ring, .fl-spot.is-on .fl-ring { transform: scale(1.35); background: ${GOLD}; animation: none; }
.fl-spot:focus-visible { outline: none; }
.fl-spot:focus-visible .fl-ring { box-shadow: 0 0 0 3px rgba(255,244,214,.8); }

.fl-tip { position: absolute; bottom: calc(100% + 6px); left: 50%; width: 290px; text-align: left;
          transform: translate(var(--tx), 8px); opacity: 0; pointer-events: none;
          transition: opacity .25s ease, transform .35s cubic-bezier(.16,.84,.44,1);
          padding: 16px 18px 15px; border-radius: 3px; border-top: 2px solid ${GOLD};
          background: rgba(5,30,22,.94); box-shadow: 0 18px 40px rgba(0,0,0,.45); color: #E5D4C2; }
.fl-spot.is-on .fl-tip { opacity: 1; transform: translate(var(--tx), 0); }
.fl-kicker { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .18em; text-transform: uppercase; color: rgba(229,212,194,.5); }
.fl-title { font-family: 'Rampant Sans', Georgia, serif; font-size: 21px; line-height: 1.1; margin-top: 6px; color: ${GOLD}; }
.fl-body { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; margin: 9px 0 0; color: rgba(229,212,194,.85); }
.fl-count { font-family: ${MONO}; font-size: 10px; letter-spacing: .06em; margin-top: 10px; padding-top: 9px;
            border-top: 1px solid rgba(229,212,194,.14); color: rgba(229,212,194,.6); }

/* The phone's version: under the photograph, not on it. */
.fl-under { display: none; }
@media (max-width: 780px) {
  .fl-tip { display: none; }
  .fl-under { display: block; margin-top: 16px; min-height: 40px; }
  .fl-under .fl-body { max-width: 520px; }
}
@media (prefers-reduced-motion: reduce) {
  .fl-ring { animation: none; transition: none; }
  .fl-tip { transition: none; }
}
`
