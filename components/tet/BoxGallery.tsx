'use client'

import { useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import FoldedBox from '@/components/tet/FoldedBox'
import { BOXES, boxArt, type TetBox } from '@/lib/tet/boxes'

// ═══════════════════════════════════════════════════════════════════════════
// THE TWELVE COVERS — flat, and folded into the box they become.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: a folder of new cover designs from the design company,
// "background remove, then upload as foldable boxes into the tet page".
//
// A COVER IS A CHOICE, SO IT IS SHOWN AS ONE. Twelve thumbnails, one picked at
// a time, and the picked one can be turned. The flat view is the dieline as it
// will print; the folded view is what a person is handed. Neither is a render
// of a photograph — every face is a slice of the actual artwork, so what is on
// screen cannot drift from what goes to the printer.
//
// These are NOT the customisable sleeve. There is no blank face on them and no
// logo goes on: the sleeve studio above answers "where does my logo go", and
// this answers "which of these do we want". Keeping them apart is why neither
// has a control that does nothing.
//
// THE THREE-BOTTLE WRAP IS SHOWN FLAT and says why. Its outline has no gable
// and no shoulders, so its folds cannot be read from it the way the other
// eleven can, and folding it along theirs would draw a box that does not
// exist — the same rule that keeps Sleeve 2 flat.
// ═══════════════════════════════════════════════════════════════════════════

export default function BoxGallery({ t, vn, onAsk }: {
  t: (en: string, v: string) => string
  vn: boolean
  onAsk?: (box: TetBox) => void
}) {
  const [slug, setSlug] = useState(BOXES[0].slug)
  const [view, setView] = useState<'flat' | 'folded'>('flat')
  const box = BOXES.find(b => b.slug === slug) ?? BOXES[0]
  const pick = (b: TetBox) => {
    setSlug(b.slug)
    if (!b.folds) setView('flat')
  }

  return (
    <div className="bg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <ul className="bg-strip">
        {BOXES.map(b => (
          <li key={b.slug}>
            <button className={`bg-thumb${b.slug === slug ? ' is-on' : ''}`}
                    aria-pressed={b.slug === slug} data-slug={b.slug}
                    onClick={() => pick(b)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={boxArt(b.slug, 640)} alt={vn ? b.name[1] : b.name[0]} width={160} height={62} loading="lazy" />
              <span>{vn ? b.name[1] : b.name[0]}</span>
              {b.combo && <i className="bg-combo">{t('3 bottles', '3 chai')}</i>}
            </button>
          </li>
        ))}
      </ul>

      <div className="bg-head">
        <div>
          <p className="bg-name">{vn ? box.name[1] : box.name[0]}</p>
          <p className="bg-sub">
            {vn ? box.subject[1] : box.subject[0]}
            {box.signed && <span className="bg-note"> · {t('named on the artwork', 'tên có trên hình')}</span>}
          </p>
        </div>
        <div className="bg-views" role="tablist">
          <button role="tab" aria-selected={view === 'flat'} className={`bg-toggle${view === 'flat' ? ' is-on' : ''}`}
                  onClick={() => setView('flat')}>{t('Flat', 'Trải phẳng')}</button>
          <button role="tab" aria-selected={view === 'folded'} className={`bg-toggle${view === 'folded' ? ' is-on' : ''}`}
                  onClick={() => setView('folded')} disabled={!box.folds}
                  title={box.folds ? undefined : t('Its dieline has not been confirmed', 'Chưa xác nhận khuôn bế')}>
            {t('Folded · 3D', 'Đã gấp · 3D')}
          </button>
        </div>
      </div>

      {view === 'flat' || !box.folds ? (
        <div className="bg-flat">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={boxArt(box.slug, 1600)} alt={vn ? box.subject[1] : box.subject[0]} />
          {!box.folds && (
            <p className="bg-why">
              {t('This one wraps the three-bottle box. Its dieline has not been confirmed, so it is shown flat rather than folded along lines that are not its own.',
                 'Mẫu này bọc hộp ba chai. Khuôn bế chưa được xác nhận nên chỉ hiển thị dạng trải phẳng, thay vì gấp theo nếp không phải của nó.')}
            </p>
          )}
        </div>
      ) : (
        <FoldedBox
          url={boxArt(box.slug, 3200)}
          folds={box.folds}
          // NOT DEAD-ON. A box facing the viewer square is four pixels of side
          // and reads as a flat card — the whole point of this view is that it
          // is a solid, so it settles a third of a turn off.
          settleAt={-32}
          label={t(`${box.name[0]}, folded into its box — drag to turn it`, `${box.name[1]}, đã gấp thành hộp — kéo để xoay`)}
          hint={t('or drag to turn it', 'hoặc kéo để xoay')}
          turns={[
            { label: vn ? box.name[1] : box.name[0], to: 0, gold: true },
            { label: t('Duncan Taylor', 'Duncan Taylor'), to: -90 },
            { label: t('The crest', 'Mặt huy hiệu'), to: 180 },
            { label: t('The small print', 'Mặt thông tin'), to: 90 },
          ]}
        />
      )}

      {onAsk && (
        <button className="bg-ask" onClick={() => onAsk(box)}>
          {t(`Ask about ${box.name[0]}`, `Hỏi về mẫu ${box.name[1]}`)} <span className="pk-go">→</span>
        </button>
      )}
    </div>
  )
}

const CSS = `
.bg { margin-top: 30px; }
.bg-strip { list-style: none; margin: 0 0 22px; padding: 0 0 6px; display: flex; gap: 10px;
            overflow-x: auto; scrollbar-width: none; }
.bg-strip::-webkit-scrollbar { display: none; }
.bg-thumb { flex: 0 0 auto; width: 160px; background: none; border: none; padding: 0; cursor: pointer;
            display: flex; flex-direction: column; gap: 6px; text-align: left; position: relative; }
.bg-thumb img { width: 160px; height: auto; display: block; opacity: .55; transition: opacity .3s ease;
                border-bottom: 1px solid transparent; }
.bg-thumb span { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .04em; color: rgba(229,212,194,.55);
                 line-height: 1.4; }
.bg-thumb:hover img { opacity: .85; }
.bg-thumb.is-on img { opacity: 1; border-bottom-color: ${GOLD}; }
.bg-thumb.is-on span { color: #E5D4C2; }
.bg-combo { position: absolute; top: 4px; right: 4px; font-family: ${MONO}; font-style: normal; font-size: 9px;
            letter-spacing: .1em; text-transform: uppercase; color: #052E20; background: ${GOLD};
            padding: 2px 5px; border-radius: 3px; }

.bg-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; flex-wrap: wrap;
           border-bottom: 1px solid rgba(229,212,194,.14); padding-bottom: 10px; }
.bg-name { font-family: 'Rampant Sans', serif; font-size: 22px; color: #E5D4C2; margin: 0; }
.bg-sub { font-family: ${MONO}; font-size: 11.5px; color: rgba(229,212,194,.6); margin: 4px 0 0; }
.bg-note { color: rgba(229,212,194,.4); }
.bg-views { display: flex; gap: 14px; }
.bg-toggle { background: none; border: none; padding: 2px 0; cursor: pointer; font-family: ${MONO};
             font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: rgba(229,212,194,.5);
             border-bottom: 1px solid transparent; }
.bg-toggle.is-on { color: ${GOLD}; border-bottom-color: ${GOLD}; }
.bg-toggle:disabled { opacity: .3; cursor: not-allowed; }

.bg-flat { margin-top: 18px; }
.bg-flat img { width: 100%; height: auto; display: block; }
.bg-why { font-family: ${MONO}; font-size: 11px; line-height: 1.8; color: rgba(229,212,194,.55);
          max-width: 620px; margin: 12px 0 0; }

.bg-ask { margin-top: 20px; background: none; border: none; padding: 4px 0; cursor: pointer;
          font-family: ${MONO}; font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase;
          color: ${GOLD}; border-bottom: 1px solid rgba(212,184,90,.4); }
.bg-ask:hover { border-bottom-color: ${GOLD}; }
@media (max-width: 640px) {
  .bg-thumb, .bg-thumb img { width: 128px; }
  .bg-name { font-size: 19px; }
}
`
