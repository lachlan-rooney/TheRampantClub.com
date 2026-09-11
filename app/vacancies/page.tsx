'use client'

import NavOverlay from '@/components/NavOverlay'
import { PublicPage, Rise, InkFloat, Cta, MONO, SERIF } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// VACANCIES — set to the /studio benchmark.
// ───────────────────────────────────────────────────────────────────────────
// The club's own crest over a title set large, the butler's tray drifting in
// the empty half, and the four positions as a list set large — the way the
// Sports Club sets its other fixtures. The copy is exactly as it was.

const VACANCIES = [
  { title: 'Coordinateur de Laboratoire', blurb: 'Must be profficient with test tubes, rotary evaporation, culinary science, and the occasional explosion.' },
  { title: 'Urban Beekeeper', blurb: 'Comfortable with heights, Vietnamese summers, and unsolicited stings.' },
  { title: 'Assistant Whisky Librarian', blurb: 'Dewey Decimal not required. Knowing your Imperious from your Imperial a necessity.' },
  { title: 'Vinyl Curator (no digital submissions)', blurb: 'If you have to ask what a B-side is, this isn\'t for you.' },
]

export default function VacanciesPage() {
  return (
    <PublicPage>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        .vc-crest { display: block; width: 92px; height: auto; margin: 0 0 0 -10px; }
        .vc-tray { width: 100%; max-width: 440px; margin-left: auto; }

        .vc-list { list-style: none; margin: 0; padding: 0; }
        .vc-item { display: grid; grid-template-columns: 56px 1fr 1fr; gap: 12px 40px; align-items: baseline;
                   padding: 30px 0 32px; border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
        .vc-item:last-child { border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
        .vc-n { font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; opacity: .62; }
        .vc-title { font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.6vw, 48px); line-height: 1.02; margin: 0; }
        .vc-blurb { font-family: ${MONO}; font-size: 13px; line-height: 2; margin: 0; max-width: 460px; }

        .vc-close { display: grid; grid-template-columns: 1fr auto; gap: 48px; align-items: end; }

        @media (max-width: 860px) {
          .vc-crest { width: 76px; }
          .vc-tray { max-width: 300px; }
          .vc-item { grid-template-columns: 30px 1fr; column-gap: 12px; padding: 24px 0 26px; }
          .vc-blurb { grid-column: 2; }
          .vc-close { grid-template-columns: 1fr; gap: 20px; }
          .vc-gent { margin-left: auto; }
        }
      ` }} />

      {/* ══ THE MASTHEAD ═══════════════════════════════════════════════ */}
      <header className="pk-wrap pk-mast">
        <div>
          <Rise>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Vacancies.svg" alt="Vacancies" className="vc-crest" />
          </Rise>
          <Rise delay={.06}><h1 className="pk-h1">Vacancies</h1></Rise>
          <Rise delay={.12}><div className="pk-sub">Vị trí tuyển dụng</div></Rise>
        </div>
        <Rise delay={.15}>
          <InkFloat name="butler-tray" width="100%" rot={6} dur={8} className="vc-tray" />
        </Rise>
      </header>

      {/* ══ THE POSITIONS ══════════════════════════════════════════════ */}
      <section className="pk-wrap">
        <ol className="vc-list">
          {VACANCIES.map((v, i) => (
            <Rise key={i} as="li" delay={i * .06} className="vc-item">
              <span className="vc-n">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="vc-title">{v.title}</h2>
              <p className="vc-blurb">{v.blurb}</p>
            </Rise>
          ))}
        </ol>
      </section>

      {/* ══ HOW TO APPLY ═══════════════════════════════════════════════ */}
      <section className="pk-wrap pk-section" style={{ paddingBottom: 130 }}>
        <div className="vc-close">
          <Rise>
            <p className="pk-lede" style={{ marginTop: 0 }}>
              A sound opinion on Islay vs Speyside is considered an advantage but not a requirement. Interviews are conducted informally and may involve a dram.
            </p>
            <Cta href="mailto:Oddjobs@TheRampantClub.com" style={{ textTransform: 'none', letterSpacing: '.04em', fontSize: 13 }}>
              Oddjobs@TheRampantClub.com
            </Cta>
          </Rise>
          <Rise delay={.12}>
            <InkFloat name="gent-toast" width="clamp(170px, 20vw, 270px)" rot={-3} dur={7.5} className="vc-gent" />
          </Rise>
        </div>
      </section>
    </PublicPage>
  )
}
