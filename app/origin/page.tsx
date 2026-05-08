'use client'

import { useEffect, useRef, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'
import Footer from '@/components/Footer'

// /origin — long-form story page. The copy below is intentionally editable;
// treat it as scaffolding to be tuned by the founders.

const CHAPTERS = [
  {
    eyebrow: 'I.  The Lion',
    title: 'A symbol, twice over',
    body: [
      `In Scottish heraldry, a lion rampant stands on its hind legs, forelegs raised, jaws and claws bared.
       It is a creature in motion — neither at rest nor at war, but ready, watchful, alive.`,
      `In Vietnamese tradition, lions guard the gate. They are stationed at temples and households to mark the
       threshold between the everyday and the sacred. They keep faith with what is inside.`,
      `Our lion is both. Scottish in posture, Vietnamese in purpose. The crest watches from above the door,
       and the room behind it answers to its standard.`,
    ],
    pullquote: 'Scottish in posture. Vietnamese in purpose.',
  },
  {
    eyebrow: 'II.  The Building',
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
    pullquote: 'Nothing erased; much restored.',
  },
  {
    eyebrow: 'III.  The Founders',
    title: 'Two cities, one cabinet',
    body: [
      `The Rampant Club was founded by people who grew up between Scotland and Việt Nam, who came of age
       sharing whisky with friends in living rooms rather than ordering it in bars, and who understood
       that the best evenings had no menu.`,
      `What we missed wasn't a place to drink — Sài Gòn has those. It was a place where serious whisky
       lovers were granted the freedoms they had at home: to pour for themselves, to stay as long as they
       liked, to share generously, to not be sold to.`,
      `So we built one.`,
    ],
    pullquote: 'The best evenings had no menu.',
  },
  {
    eyebrow: 'IV.  The Idea',
    title: 'Sustained by its members, not for profit',
    body: [
      `The Rampant Club is a members' club in the strict sense. It exists for the people who belong to it,
       and is paid for by them. Profit is not a goal of the institution; the cabinet is.`,
      `Members may pour any bottle. They may bring guests within reason. They may use the spaces as they
       would their own — quietly, attentively, without fuss. There are house rules, but few; the room
       largely keeps itself.`,
      `We are private by design and discreet by habit. What happens in the Library Bar stays in the Library Bar.`,
    ],
    pullquote: 'The cabinet is the goal.',
  },
]

export default function OriginPage() {
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = Number(e.target.getAttribute('data-idx'))
          setRevealed(prev => {
            if (prev.has(idx)) return prev
            const next = new Set(prev); next.add(idx); return next
          })
        }
      }
    }, { threshold: 0.15 })
    sectionRefs.current.forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'Rampant Sans';
          src: url('/fonts/MNRampantSans-Regular.woff2') format('woff2'),
               url('/fonts/MNRampantSans-Regular.ttf') format('truetype');
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: 'Google Sans Code';
          src: url('/fonts/GoogleSansCode-VariableFont_wght.ttf') format('truetype');
          font-weight: 100 900; font-style: normal; font-display: swap;
        }

        :root {
          --org-cream: #E5D4C2;
          --org-cream-dim: #B2AA98;
          --org-green-deep: #052E20;
          --org-green-mid: #28483C;
          --org-green-accent: #5E6650;
          --org-gold: #D4B85A;
        }

        body { background: var(--org-cream); }

        .org-hero {
          min-height: 92vh;
          display: flex; align-items: center; justify-content: center;
          padding: 120px 24px 80px;
          background: linear-gradient(180deg,
            #F2E5D2 0%,
            var(--org-cream) 60%,
            #DBC9B4 100%);
          position: relative;
          overflow: hidden;
        }
        .org-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 40%,
            rgba(212,184,90,0.18), transparent 60%);
          pointer-events: none;
        }
        .org-hero-inner {
          position: relative; z-index: 2;
          text-align: center; max-width: 760px;
        }
        .org-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: var(--org-green-accent);
          letter-spacing: 0.32em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .org-hero-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(48px, 8vw, 96px);
          font-weight: 400;
          color: var(--org-green-deep);
          line-height: 1;
          letter-spacing: -0.01em;
          margin: 0 0 36px;
        }
        .org-hero-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 13px; line-height: 1.8;
          color: var(--org-green-accent);
          opacity: 0.75;
          max-width: 480px; margin: 0 auto;
        }
        .org-hero-divider {
          width: 1px; height: 60px;
          background: var(--org-green-accent);
          opacity: 0.3;
          margin: 48px auto 0;
        }

        .org-chapter {
          padding: 100px 32px;
          max-width: 880px;
          margin: 0 auto;
          position: relative;
        }
        .org-chapter[data-revealed="true"] .org-chapter-inner {
          opacity: 1; transform: translateY(0);
        }
        .org-chapter-inner {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 1.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .org-chapter-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: var(--org-gold);
          letter-spacing: 0.24em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .org-chapter-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 400;
          color: var(--org-green-deep);
          line-height: 1.15;
          margin: 0 0 32px;
          letter-spacing: -0.005em;
        }
        .org-chapter-body p {
          font-family: 'Google Sans Code', monospace;
          font-size: 14px;
          line-height: 2;
          color: var(--org-green-accent);
          opacity: 0.85;
          margin: 0 0 22px;
        }
        .org-pullquote {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(20px, 2.4vw, 28px);
          font-style: italic;
          color: var(--org-green-mid);
          line-height: 1.45;
          margin: 32px 0 0;
          padding-left: 24px;
          border-left: 2px solid var(--org-gold);
        }

        .org-closing {
          padding: 120px 32px;
          background: var(--org-green-deep);
          color: var(--org-cream);
          text-align: center;
        }
        .org-closing-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 400;
          margin: 0 0 24px;
          letter-spacing: -0.005em;
        }
        .org-closing-text {
          font-family: 'Google Sans Code', monospace;
          font-size: 13px; line-height: 1.9;
          color: var(--org-cream-dim);
          max-width: 540px; margin: 0 auto;
        }
        .org-closing-link {
          display: inline-block;
          margin-top: 36px;
          padding: 12px 28px;
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--org-cream);
          border: 1px solid rgba(229,212,194,0.4);
          text-decoration: none;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .org-closing-link:hover {
          background: rgba(229,212,194,0.06);
          border-color: var(--org-gold);
        }

        .org-lion-mark {
          display: block;
          width: 88px; height: auto;
          margin: 0 auto 32px;
          opacity: 0.85;
        }

        @media (max-width: 720px) {
          .org-hero { padding: 100px 20px 60px; }
          .org-chapter { padding: 60px 20px; }
          .org-closing { padding: 80px 20px; }
        }
      ` }} />

      <NavOverlay variant="public" />

      <main>
        <section className="org-hero">
          <div className="org-hero-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/lion-signature-opt.png" alt="" className="org-lion-mark" />
            <div className="org-eyebrow">Nguồn Gốc · The Origin</div>
            <h1 className="org-hero-title">A house, a lion, an idea.</h1>
            <p className="org-hero-sub">
              How a Scottish-Vietnamese clubhouse came to occupy a five-storey townhouse in District 1,
              and what it intends to do there.
            </p>
            <div className="org-hero-divider" />
          </div>
        </section>

        {CHAPTERS.map((c, i) => (
          <section
            key={c.title}
            className="org-chapter"
            ref={el => { sectionRefs.current[i] = el }}
            data-idx={i}
            data-revealed={revealed.has(i) || undefined}
          >
            <div className="org-chapter-inner">
              <div className="org-chapter-eyebrow">{c.eyebrow}</div>
              <h2 className="org-chapter-title">{c.title}</h2>
              <div className="org-chapter-body">
                {c.body.map((p, j) => <p key={j}>{p}</p>)}
              </div>
              <div className="org-pullquote">{c.pullquote}</div>
            </div>
          </section>
        ))}

        <section className="org-closing">
          <div className="org-closing-title">Membership is by invitation or referral only.</div>
          <p className="org-closing-text">
            We do not advertise. We do not accept applications. If The Rampant Club is for you, we will
            most likely meet through a Rampant you already know.
          </p>
          <a href="/" className="org-closing-link">Return to the front door</a>
        </section>
      </main>

      <Footer />
    </>
  )
}
