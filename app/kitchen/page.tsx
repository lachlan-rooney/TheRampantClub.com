'use client'

import { PublicPage, Masthead, Rise, InkFloat, useInView, MONO, SERIF } from '@/components/public/kit'
import InkStill from '@/components/public/menus/InkStill'
import Flaps from '@/components/public/menus/Flaps'

// ═══════════════════════════════════════════════════════════════════════════
// THE KITCHEN — the menu nobody admits to.
// ───────────────────────────────────────────────────────────────────────────
// A joke, played straight. The title sits large like every other page, the
// lion asleep beside it (it is after 11pm), and the menu is the staff specials
// board: a dark board bolted to the wall a little crooked, whose prices clatter
// into place on a split-flap when it comes into view. The Committee — the lion
// in the suit, reading his paper — denies all knowledge underneath.
//
// Deliberately unlisted: no nav, no link from the menus. Found, not offered.

const ITEMS = [
  { name: "Phở 'Staff Meal'", note: 'Not on the menu. You know someone.', price: '₫0' },
  { name: "The Chairman's Toast", note: 'White bread. Kerrygold. No questions.', price: '₫35,000' },
  { name: 'Emergency Bánh Mì', note: "For members who've missed dinner. Again.", price: '₫50,000' },
  { name: 'Midnight Indomie', note: 'The real reason the kitchen stays open.', price: '₫20,000' },
  { name: 'One Glass of Milk', note: "Full fat. Don't make it weird.", price: '₫25,000' },
]

const CSS = `
  .kt-mast .pk-h1 { font-size: clamp(60px, 10vw, 140px); }
  .kt-still { width: 92%; margin-left: auto; }

  .kt-boardwrap { padding-top: 10px; }
  .kt-board {
    position: relative; max-width: 920px; box-sizing: border-box;
    background: linear-gradient(180deg, #151b17, #0B0F0D);
    border-radius: 12px; padding: 40px 48px 26px; color: #EDE3CF;
    transform: rotate(-.7deg);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), inset 0 2px 0 rgba(255,255,255,.05),
                0 28px 60px rgba(5,46,32,.28), 0 6px 14px rgba(5,46,32,.18);
  }
  /* four screws, one of them not quite tightened */
  .kt-screw { position: absolute; width: 7px; height: 7px; border-radius: 50%;
              background: radial-gradient(circle at 35% 35%, #6a7068, #1b1f1c); }
  .kt-screw.a { top: 12px; left: 12px; } .kt-screw.b { top: 12px; right: 12px; }
  .kt-screw.c { bottom: 12px; left: 12px; } .kt-screw.d { bottom: 16px; right: 15px; }

  .kt-row { padding: 22px 0 20px; border-bottom: 1px solid rgba(237,227,207,.09); }
  .kt-row:last-child { border-bottom: none; }
  .kt-line { display: grid; grid-template-columns: minmax(0, max-content) minmax(18px, 1fr) auto; gap: 14px; align-items: end; }
  .kt-name { font-family: ${SERIF}; font-weight: 400; font-size: clamp(22px, 3vw, 36px); line-height: 1.02; margin: 0; }
  .kt-dots { border-bottom: 2px dotted rgba(237,227,207,.34); margin-bottom: .42em; }
  .kt-note { font-family: ${MONO}; font-size: 13px; font-style: italic; line-height: 1.7; color: rgba(237,227,207,.78);
             margin: 8px 0 0; }

  .kt-foot { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end;
             max-width: 920px; padding-top: 70px; padding-bottom: 140px; }
  .kt-small { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 0; }

  @media (max-width: 860px) {
    .kt-still { width: 100%; max-width: 420px; margin: 0 auto; }
    .kt-board { padding: 30px 20px 16px; transform: rotate(-.9deg); }
    .kt-row { padding: 18px 0 16px; }
    .kt-line { gap: 10px; }
    .kt-note { font-size: 12px; }
    .kt-foot { grid-template-columns: 1fr; gap: 24px; padding-top: 54px; padding-bottom: 110px; }
    .kt-small { font-size: 13px; }
    .kt-committee { width: 150px !important; margin-left: auto; }
  }
  @media (prefers-reduced-motion: reduce) { .kt-board { transform: none; } }
`

export default function KitchenPage() {
  const board = useInView<HTMLDivElement>(.25)

  return (
    <PublicPage>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="kt-mast">
        <Masthead
          title="The Kitchen"
          sub={<>You weren&rsquo;t supposed to find this</>}
          art={
            <InkStill className="kt-still" aspect="1 / 0.78" objects={[
              { name: 'lion-reclining', w: '74%', top: '38%', left: '12%', rot: -3, dur: 9, z: 2 },
              { name: 'butler-tray',    w: '32%', top: '0%',  left: '62%', rot: 9,  dur: 7.5 },
              { name: 'glass',          w: '17%', top: '2%',  left: '6%',  rot: -10, dur: 6.5 },
            ]} />
          }
        />
      </div>

      <div className="pk-wrap kt-boardwrap">
        <Rise>
          <div ref={board.ref} className="kt-board">
            <span className="kt-screw a" /><span className="kt-screw b" />
            <span className="kt-screw c" /><span className="kt-screw d" />
            {ITEMS.map((item, i) => (
              <div key={i} className="kt-row">
                <div className="kt-line">
                  <h2 className="kt-name">{item.name}</h2>
                  <span className="kt-dots" aria-hidden="true" />
                  <Flaps text={item.price} run={board.seen} size="clamp(14px, 1.7vw, 19px)" font={MONO} delay={.15 + i * .18} />
                </div>
                <p className="kt-note">{item.note}</p>
              </div>
            ))}
          </div>
        </Rise>
      </div>

      <div className="pk-wrap">
        <div className="kt-foot">
          <Rise>
            <p className="kt-small">
              Available after 11pm. Ring the bell three times.<br />
              The Committee denies all knowledge of this page.
            </p>
          </Rise>
          <Rise delay={.12}>
            <InkFloat name="lion-suit" width={190} rot={4} dur={7} className="kt-committee" />
          </Rise>
        </div>
      </div>
    </PublicPage>
  )
}
