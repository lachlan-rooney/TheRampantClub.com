'use client'

import type { CSSProperties, ReactNode } from 'react'
import NavOverlay from '@/components/NavOverlay'
import { PublicPage, Masthead, SectionHead, Rise, Cta, InkFloat, BleedImage } from '@/components/public/kit'

// /origin — long-form story page. The copy below is intentionally editable;
// treat it as scaffolding to be tuned by the founders.
//
// Set to the /studio benchmark: words left and large, the lion painting in the
// masthead's empty half, each chapter answered by the house's own ink — the
// rampant lion beside the lion, five rampant floor-marks climbing a stair
// beside the five-floor house, two drawings raising a glass beside the table.
// The clubhouse photograph runs full-bleed into the ground before the building.

const CHAPTERS = [
  {
    image: 'lion-crest',
    title: 'A symbol, twice over',
    body: [
      `In Scottish heraldry, a lion rampant stands on its hind legs, forelegs raised, jaws and claws bared.
       It is a creature in motion — neither at rest nor at war, but ready, watchful, alive.`,
      `In Vietnamese tradition, lions guard the gate. They are stationed at temples and households to mark the
       threshold between the everyday and the sacred. They keep faith with what is inside.`,
      `Our lion is both. Scottish in posture, Vietnamese in purpose. Our crest watches from above the door,
       and the rooms behind it answer to its standard.`,
    ],
  },
  {
    image: 'whisky-lounge',
    title: 'A house with five floors and a long memory',
    body: [
      `Number 74A/2 Hai Bà Trưng has stood for the better part of a century. It has been many things —
       a residence, a workshop, a place of quiet commerce — but always a private one, set back from the
       street and behind a courtyard.`,
      `When we found it, the bones were intact and the rooms had stories: tile floors warm with use,
       balconies that faced the right kind of weather, a stairwell that climbed exactly five flights.
       It asked to be a clubhouse.`,
      `The restoration was patient. Nothing erased; much restored. Where we built new, we built quietly.`,
    ],
  },
  {
    image: 'trc/gala-cheer',
    title: 'Sustained by its members, not for profit',
    body: [
      `The Rampant Club is a members' club in the strict sense. It exists for the people who belong to it,
       and is paid for by them. Profit is not a goal of the institution; the community is.`,
      `Members may pour any bottle. They may bring guests within reason. They may use the spaces as they
       would their own — quietly, attentively, without fuss. There are house rules, but few; the club
       largely keeps itself.`,
    ],
  },
]

// 'trc/…' are the club's own photographs (public/images/trc).
const photo = (name: string) => name.startsWith('trc/') ? `/images/${name}-1600.webp` : `/images/social/${name}.webp`

// The five floors as the house draws them — the rampant lion holding each
// floor's object — climbing from the Library Bar (1) to the Lab (5).
const STAIR = ['floor-library-bar', 'floor-studio', 'floor-dining', 'floor-rampant-room', 'floor-lab'] as const

// A photograph as the kit frames it, with an ink drawing or two pinned over
// its corners.
function Pinned({ src, children, style }: { src: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="org-pinned" style={style}>
      <div className="pk-thumb org-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" />
      </div>
      {children}
    </div>
  )
}

// The chapter's art, by chapter.
function ChapterArt({ index, image }: { index: number; image: string }) {
  if (index === 0) return (
    <Pinned src={photo(image)}>
      <InkFloat name="lion-suit" width="44%" rot={-6} dur={8.5} className="org-pin org-pin-bl" />
    </Pinned>
  )
  if (index === 1) return (
    <div className="org-stair" aria-hidden="true">
      {STAIR.map((f, i) => (
        <InkFloat key={f} name={f} width="19%" rot={i % 2 ? 4 : -4} dur={7 + i * .6} className="org-step"
                  style={{ left: `${i * 20}%`, bottom: `${i * 17.5}%` }} />
      ))}
    </div>
  )
  return (
    <Pinned src={photo(image)}>
      <InkFloat name="gent-toast" width="42%" rot={-5} dur={8} className="org-pin org-pin-bl" />
      <InkFloat name="girl-toast" width="38%" rot={6} dur={9} className="org-pin org-pin-tr" />
    </Pinned>
  )
}

export default function OriginPage() {
  return (
    <PublicPage>
      <style dangerouslySetInnerHTML={{ __html: `
        /* the painting, askew in the masthead's empty half */
        .org-paint { position: relative; width: calc(100% + 40px); max-width: 600px; margin-left: -40px; }
        .org-paint .pk-float img { filter: drop-shadow(0 18px 34px rgba(5,46,32,.22)); }

        .org-ch { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 72px; align-items: center; }
        .org-ch.is-flip { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
        .org-ch.is-flip .org-ch-art { order: -1; }
        .org-ch-body { margin-top: 34px; max-width: 60ch; }
        .org-ch-body .pk-body { font-size: 14px; opacity: 1; margin-bottom: 22px; }

        .org-pinned { position: relative; width: 100%; max-width: 400px; margin: 0 auto; }
        .org-photo { aspect-ratio: 4 / 5; transform: rotate(-1.5deg); }
        .org-ch.is-flip .org-photo { transform: rotate(1.5deg); }
        .org-pin { position: absolute; z-index: 2; pointer-events: none; }
        .org-pin-bl { left: -16%; bottom: -12%; }
        .org-pin-tr { right: -14%; top: -10%; }

        /* five floors, climbing */
        .org-stair { position: relative; width: 100%; max-width: 440px; aspect-ratio: 1 / 1; margin: 0 auto; }
        .org-step { position: absolute; }

        .org-close { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr); gap: 56px; align-items: center;
                     padding-bottom: 140px; }
        .org-close-art { position: relative; width: 100%; max-width: 420px; aspect-ratio: 1 / .8; margin-left: auto; }
        .org-close-art .pk-float { position: absolute; }

        @media (max-width: 860px) {
          .org-paint { width: 100%; max-width: 420px; margin: 0 auto; }
          .org-ch, .org-ch.is-flip { grid-template-columns: 1fr; gap: 56px; }
          .org-ch.is-flip .org-ch-art { order: 0; }
          .org-ch-body { margin-top: 26px; }
          .org-ch-body .pk-body { font-size: 13px; }
          .org-pinned { max-width: 300px; }
          .org-pin-bl { left: -12%; }
          .org-pin-tr { right: -10%; }
          .org-stair { max-width: 320px; }
          .org-close { grid-template-columns: 1fr; gap: 36px; padding-bottom: 100px; }
          .org-close-art { max-width: 320px; margin: 0 auto; }
        }
      ` }} />

      <NavOverlay variant="public" />

      <Masthead
        title="A townhouse, a lion, an idea."
        lede={<>How a Scottish-Vietnamese clubhouse came to occupy a five-storey townhouse in District 1,
          and what it intends to do there.</>}
        art={
          <div className="org-paint">
            <div className="pk-float" style={{ ['--rot' as string]: '-3deg', ['--dur' as string]: '10s' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/lion-painting.webp" alt="The Rampant Lion" />
            </div>
          </div>
        }
      />

      {CHAPTERS.map((c, i) => (
        <div key={c.title}>
          {/* The building is the clubhouse photograph, full width, fading
              into the ground the way /studio's heroes do. */}
          {i === 1 && <div style={{ marginTop: 110 }}><BleedImage src={photo(c.image)} position="50% 62%" /></div>}
          <section className={`pk-wrap ${i === 1 ? '' : 'pk-section'}`} style={i === 1 ? { paddingTop: 12 } : undefined}>
            <div className={`org-ch ${i === 2 ? 'is-flip' : ''}`}>
              <div>
                <SectionHead title={c.title} />
                <Rise delay={.14} className="org-ch-body">
                  {c.body.map((p, j) => <p key={j} className="pk-body">{p}</p>)}
                </Rise>
              </div>
              <Rise delay={.2} className="org-ch-art">
                <ChapterArt index={i} image={c.image} />
              </Rise>
            </div>
          </section>
        </div>
      ))}

      <section className="pk-wrap pk-section org-close">
        <div>
          <Rise><h2 className="pk-h2">Membership is by invitation or referral only.</h2></Rise>
          <Rise delay={.1}>
            <p className="pk-lede">
              We do not advertise. We do not accept applications. If The Rampant Club is for you, we will
              most likely meet through one of our Lions.
            </p>
          </Rise>
          <Rise delay={.18}><Cta href="/">Return to the front door</Cta></Rise>
        </div>
        <Rise delay={.16}>
          <div className="org-close-art">
            <InkFloat name="lion-lounging" width="86%" rot={-3} dur={9} style={{ left: 0, bottom: 0 }} />
            <InkFloat name="key" width="34%" rot={-22} dur={7} style={{ right: 0, top: 0 }} />
          </div>
        </Rise>
      </section>
    </PublicPage>
  )
}
