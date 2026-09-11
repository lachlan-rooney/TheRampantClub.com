'use client'

import { useEffect, useState, useRef, ReactNode } from 'react'
import NavOverlay from '@/components/NavOverlay'
import CaptainsMarquee from '@/components/sports/CaptainsMarquee'
import SportSelector from '@/components/sports/SportSelector'
import CaptainsColumn from '@/components/sports/CaptainsColumn'
import TrophyCabinet from '@/components/sports/TrophyCabinet'
import OnNowRibbon from '@/components/sports/OnNowRibbon'
import ExpressInterest from '@/components/sports/ExpressInterest'
import SportOdds from '@/components/sports/SportOdds'
import SportIcon from '@/components/sports/SportIcons'
import { tenseOf, dateRange } from '@/components/StudioIndex'

// ═══════════════════════════════════════════════════════════════════════════
// THE SPORTS CLUB — set to the /studio benchmark.
// ───────────────────────────────────────────────────────────────────────────
// Left-aligned, one flat ground, display type large and mono for the reading,
// hairlines instead of boxes. The copy is untouched; only its setting changed.
//
// The paper grain is gone, as it went from the homepage: plain block colour.
const CREAM = '#E5D4C2'
const INK   = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO  = "'Google Sans Code', 'DM Mono', monospace"
// Side padding only — a `padding` shorthand here would zero the section's
// top padding, which lives in the .sp-section class.
const WRAP: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', paddingLeft: 24, paddingRight: 24 }

// ── Rise on arrival — the same motion as /studio ─────────────────
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={visible ? 'sp-rise' : 'sp-wait'} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  )
}

// ── Eyebrow: small mono, tracked out ─────────────────────────────
function Eyebrow({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase',
                  opacity: .62, ...style }}>
      {children}
    </div>
  )
}

// ── The fixture's particulars, as a hairline list rather than a box ──
function Details({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl style={{ margin: 0 }}>
      {rows.map(d => (
        <div key={d.label} className="sp-detail">
          <dt>{d.label}</dt>
          <dd>{d.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Numbered head: "02 ── icon", the rule draws on hover ─────────
function IndexRule({ n, sport }: { n: number; sport?: string }) {
  return (
    <div className="sp-index">
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', opacity: .6 }}>
        {String(n).padStart(2, '0')}
      </span>
      <span className="sp-index-line" />
      {sport && <span style={{ lineHeight: 0, opacity: .7 }} aria-hidden><SportIcon id={sport} size={22} /></span>}
    </div>
  )
}

// ── One sport ────────────────────────────────────────────────────
function SportSection({
  id, sportId, n, title, vn, copy, details, image,
}: {
  id: string
  sportId: string
  n: number
  title: string
  vn: string
  copy: string[]
  details?: { label: string; value: string }[]
  image?: { src: string; alt: string }
}) {
  return (
    <section id={id} className="sp-section" style={{ ...WRAP, scrollMarginTop: 90 }}>
      <Reveal>
        <IndexRule n={n} sport={sportId} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h2 className="sp-h2">{title}</h2>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 3vw, 27px)', opacity: .5, marginTop: 10 }}>{vn}</div>
          </div>
          {image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={image.src} alt={image.alt} className="sp-section-art" />
          )}
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="sp-split">
          <div>
            {copy.map((para, i) => <p key={i} className="sp-copy">{para}</p>)}
          </div>
          <div>
            {details && <Details rows={details} />}
            <SportOdds sport={sportId} />
          </div>
        </div>
      </Reveal>
    </section>
  )
}

// ── Main page ────────────────────────────────────────────────────

const MISC_FIXTURES = [
  'The Rooftop Putting Championship (Annual)',
  "The Chairman's Backgammon Invitational",
  'Chess Night (every second month)',
  'Darts',
  'The Hai Bà Trưng 5-a-side (pending enough members who own boots)',
  'Table Tennis (the Studio, lunch hours)',
]
// "Name (aside)" → the name set large, the aside in mono beside it.
const splitAside = (s: string) => {
  const m = s.match(/^(.*?)\s*\((.*)\)$/)
  return m ? { name: m[1], aside: m[2] } : { name: s, aside: null }
}

// The Cup's dates live here as DATES, so the page says "Played" by itself once
// they pass — prose that says "this August" goes stale silently.
const CUP = { opens: '2026-08-14', closes: '2026-08-15' }
const cupTense = (() => {
  const t = tenseOf(CUP.opens, CUP.closes)
  return t === 'Past' ? 'Played' : t
})()

const CUP_WORLD = [
  { s: 'cup-course', alt: 'The Rampant Cup at The Bluffs' },
  { s: 'poster-2', alt: '2026 Invitational and Charity Gala Dinner' },
  { s: 'lady', alt: 'The Rampant Cup' },
  { s: 'ferrari-sponsor', alt: 'Your seat and tee time, compliments of Ferrari' },
  { s: 'cao-minh', alt: 'Black tie by Cao Minh, Saigon' },
  { s: 'cup-flag', alt: 'The ninth at The Bluffs' },
  { s: 'tie', alt: 'The house colours' },
  { s: 'cup-argyle', alt: 'The Rampant Cup 2026' },
]

export default function SportsPage() {
  const [entered, setEntered] = useState(false)
  useEffect(() => { const t = setTimeout(() => setEntered(true), 60); return () => clearTimeout(t) }, [])

  // Live "N upcoming" counts (counts only, no PII) — RLS hides fixtures from
  // anon, so we read them via the server route rather than client-side.
  const [fixtureCounts, setFixtureCounts] = useState<Record<string, number> | undefined>(undefined)
  useEffect(() => {
    fetch('/api/sports/fixture-counts')
      .then(r => r.json())
      .then(d => { if (d?.counts) setFixtureCounts(d.counts) })
      .catch(() => {})
  }, [])

  return (
    <>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: ${CREAM} !important; margin: 0; padding: 0; }

        @keyframes sp-rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        .sp-rise { animation: sp-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        .sp-wait { opacity: 0; }

        .sp-h1 {
          font-family: ${SERIF}; font-weight: 400;
          font-size: clamp(52px, 9vw, 124px); line-height: .92;
          margin: 22px 0 0; color: ${INK};
        }
        .sp-h2 {
          font-family: ${SERIF}; font-weight: 400;
          font-size: clamp(34px, 7vw, 80px); line-height: .98;
          margin: 16px 0 0; color: ${INK};
        }
        .sp-copy {
          font-family: ${MONO}; font-size: 13px; line-height: 2;
          margin: 0 0 18px; color: ${INK}; opacity: .86;
        }

        /* ── masthead: words left, the film standing in the empty half ── */
        .sp-mast { display: grid; grid-template-columns: 1.1fr .9fr; gap: 56px; align-items: end; }
        .sp-film {
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 24px 60px rgba(5,46,32,.22);
          transform: rotate(1.5deg);
        }
        .sp-film video { display: block; width: 100%; height: auto; }

        .sp-section { padding-top: 120px; }
        .sp-index { display: flex; align-items: center; gap: 14px; }
        .sp-index-line { position: relative; flex: 1; height: 1px; background: rgba(5,46,32,.15); overflow: hidden; }
        .sp-index-line::after {
          content: ''; position: absolute; inset: 0; background: ${INK};
          transform: scaleX(0); transform-origin: left;
          transition: transform .8s cubic-bezier(.16,.84,.44,1);
        }
        .sp-section:hover .sp-index-line::after { transform: scaleX(1); }
        .sp-section-art { width: clamp(72px, 9vw, 120px); height: auto; opacity: .9; flex-shrink: 0; }

        .sp-split { display: grid; grid-template-columns: 1.15fr .85fr; gap: 64px; margin-top: 40px; align-items: start; }

        .sp-detail {
          display: grid; grid-template-columns: 120px 1fr; gap: 16px;
          padding: 13px 0; border-top: 1px solid rgba(5,46,32,.14);
        }
        .sp-detail:last-child { border-bottom: 1px solid rgba(5,46,32,.14); }
        .sp-detail dt {
          font-family: ${MONO}; font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
          opacity: .55; padding-top: 2px;
        }
        .sp-detail dd { margin: 0; font-family: ${MONO}; font-size: 12px; line-height: 1.7; color: ${INK}; }

        /* ── thumbnails, as on /studio ── */
        .sp-thumb { overflow: hidden; border-radius: 12px; box-shadow: 0 12px 30px rgba(5,46,32,.16); aspect-ratio: 4 / 5; }
        .sp-thumb img { width: 100%; height: 100%; object-fit: cover; display: block;
                        transition: transform .7s cubic-bezier(.16,.84,.44,1); }
        .sp-thumb:hover img { transform: scale(1.05); }


        /* ── other fixtures: a list set large ── */
        .sp-fixture {
          display: grid; grid-template-columns: 44px 1fr; gap: 12px; align-items: baseline;
          padding: 18px 0; border-top: 1px solid rgba(5,46,32,.14);
        }
        .sp-fixture:last-child { border-bottom: 1px solid rgba(5,46,32,.14); }
        .sp-fixture-name { font-family: ${SERIF}; font-size: clamp(21px, 2.8vw, 32px); line-height: 1.1; }
        .sp-fixture-aside { font-family: ${MONO}; font-size: 11px; opacity: .6; margin-left: 12px; white-space: normal; }

        @media (max-width: 900px) {
          .sp-mast { grid-template-columns: 1fr; gap: 40px; }
          .sp-film { transform: none; }
          .sp-split { grid-template-columns: 1fr; gap: 36px; }
          .sp-section { padding-top: 84px; }
          .sp-cup-feature { grid-template-columns: 1fr !important; }
          .sp-world { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 520px) {
          .sp-detail { grid-template-columns: 96px 1fr; }
          .sp-fixture { grid-template-columns: 32px 1fr; }
          .sp-fixture-aside { display: block; margin: 6px 0 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-rise, .sp-wait { animation: none !important; opacity: 1 !important; }
          .sp-thumb img, .sp-index-line::after { transition: none !important; }
        }
      ` }} />

      <OnNowRibbon />
      <CaptainsMarquee />

      <main style={{ background: CREAM, color: INK, overflowX: 'hidden', paddingBottom: 130 }}>

        {/* ══ THE MASTHEAD ═══════════════════════════════════════════════ */}
        <div style={{ ...WRAP, paddingTop: 88 }}>
          <div className="sp-mast">
            <div className={entered ? 'sp-rise' : 'sp-wait'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/Sports%20Club%20Logo.svg" alt="" aria-hidden="true"
                   style={{ display: 'block', width: 76, height: 'auto', marginLeft: -8 }} />
              <h1 className="sp-h1">The Sports Club</h1>
              <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 3.4vw, 30px)', opacity: .5, marginTop: 12 }}>
                Câu Lạc Bộ Thể Thao
              </div>
              <p style={{ fontFamily: MONO, fontSize: 14, lineHeight: 2, maxWidth: 520, margin: '30px 0 0' }}>
                The Rampant Club believes in the cultivation of both mind and body. Mostly mind. But occasionally body.
              </p>
            </div>

            {/* The Rampant Cup — the film, standing where /studio keeps its lion */}
            <div className={entered ? 'sp-rise' : 'sp-wait'} style={{ animationDelay: '.15s' }}>
              <div className="sp-film">
                <video autoPlay muted loop playsInline preload="metadata" poster="/images/cup/poster.webp">
                  <source src="/images/cup/cup.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>

          <div className={entered ? 'sp-rise' : 'sp-wait'} style={{ animationDelay: '.25s', marginTop: 64 }}>
            <SportSelector counts={fixtureCounts} />
          </div>
        </div>

        {/* ══ GOLF — THE RAMPANT CUP ═════════════════════════════════════ */}
        <section id="golf" className="sp-section" style={{ ...WRAP, scrollMarginTop: 90 }}>
          <Reveal>
            <IndexRule n={1} sport="golf" />
            <Eyebrow style={{ marginTop: 26 }}>
              {['Golf', cupTense, dateRange(CUP.opens, CUP.closes)].filter(Boolean).join('  ·  ')}
            </Eyebrow>
            <h2 className="sp-h2">The Inaugural Rampant Cup</h2>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 3vw, 27px)', opacity: .5, marginTop: 10 }}>
              Giải Golf Rampant · The Grand Hồ Tràm &amp; The Bluffs
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="sp-cup-feature" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 64, marginTop: 40, alignItems: 'start' }}>
              <div>
                {[
                  "A weekend of golf, dining, and charity hosted by The Rampant Club at The Grand Hồ Tràm and The Bluffs, on 14 and 15 August 2026, in aid of Operation Smile Vietnam.",
                  "Friday evening opens with a black tie charity gala at The Grand Hồ Tràm. A welcome reception, a four-course dinner with paired wines, the captains' live draft of the Cup teams, a live charity auction, and a raffle. All proceeds directed to Operation Smile Vietnam's surgical missions for Vietnamese children.",
                  "Saturday brings the Cup itself, played at The Bluffs. A Ryder Cup style match play tournament across two teams of fourteen, seven simultaneous fourball matches from a single shotgun start, on one of Southeast Asia's finest coastal links. Trophy and cheque presentation follow at a late lunch back at The Grand.",
                  "For invitations and enquiries, contact Miss Châu Lê at membership@therampantclub.com.",
                ].map((p, i) => <p key={i} className="sp-copy">{p}</p>)}

                <div style={{ marginTop: 30 }}>
                  <Details rows={[
                    { label: 'When', value: '14 & 15 August 2026' },
                    { label: 'Friday', value: 'Charity gala · The Grand Hồ Tràm · black tie' },
                    { label: 'Saturday', value: 'The Cup · The Bluffs · shotgun start 8:00am' },
                    { label: 'Format', value: 'Two teams of fourteen · seven fourball matches · Ryder Cup style' },
                    { label: 'In aid of', value: 'Operation Smile Vietnam' },
                    { label: 'Enquiries', value: 'membership@therampantclub.com' },
                  ]} />
                  <SportOdds sport="golf" />
                </div>
                {/* The Flavour Finder link used to sit here. It is not a golf
                    thing: it gets a home of its own once the DramFinder widget
                    is ready. /cup/finder itself stays up — event QR codes
                    point at it. */}
              </div>

              {/* The Cup, in full colour */}
              <div className="sp-thumb" style={{ borderRadius: 14, boxShadow: '0 24px 60px rgba(5,46,32,.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/cup/cup-deco.webp" alt="The Rampant Cup — The Bluffs, Hồ Tràm" />
              </div>
            </div>
          </Reveal>

          {/* The world of the Cup */}
          <Reveal delay={0.05}>
            <Eyebrow style={{ margin: '88px 0 22px', opacity: .55 }}>The world of the Cup</Eyebrow>
            <div className="sp-world" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {CUP_WORLD.map(im => (
                <div key={im.s} className="sp-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/cup/${im.s}.webp`} alt={im.alt} loading="lazy" />
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ══ THE CAPTAIN'S COLUMN — a band across the page ══════════════ */}
        <div style={{ marginTop: 120 }}>
          <CaptainsColumn />
        </div>

        {/* ══ TENNIS · PADEL · HASH ══════════════════════════════════════ */}
        <SportSection
          id="tennis"
          sportId="tennis"
          n={2}
          title="The Sài Gòn Open"
          vn="Giải Quần Vợt Sài Gòn"
          image={{ src: '/images/tennis-opt.png', alt: 'Tennis' }}
          copy={[
            "An annual doubles tournament open to all members and their guests, held at a local court that the Committee secures through means it prefers not to discuss. The Sài Gòn Open has been running since 2024 and has already produced three disputed line calls, one broken racquet, and a lifelong friendship.",
            "Mixed doubles is encouraged. Singles is tolerated. The Committee does not recognise “social tennis” as a category.",
            "White clothing is traditional but not enforced. The Committee reserves the right to comment.",
          ]}
          details={[
            { label: 'Entry', value: 'Open to members and one guest per member' },
            { label: 'Format', value: 'Round-robin doubles, knockout singles' },
            { label: 'Surface', value: 'Hard court (we take what we can get)' },
            { label: 'Prize', value: 'The Sài Gòn Open Shield (to be commissioned)' },
            { label: 'Refreshments', value: 'Courtside. No glass on-court. Non-negotiable.' },
          ]}
        />

        <SportSection
          id="padel"
          sportId="padel"
          n={3}
          title="The Rampant Padel Club"
          vn="Câu Lạc Bộ Padel Rampant"
          copy={[
            "The newest addition to the Club's sporting calendar. Monthly sessions for members who have discovered padel and now won't stop talking about it.",
            "The Committee acknowledges that padel is, in fact, a real sport and not simply “tennis with walls”. Court bookings are managed by the Sports Secretary, who is learning the rules as we go. Coaching is available from a member who spent three weeks in Barcelona and returned with strong opinions.",
            "Beginners are welcome. Overconfidence is not.",
          ]}
          details={[
            { label: 'Sessions', value: 'First Thursday, 6pm (subject to rain, heat, and enthusiasm)' },
            { label: 'Location', value: 'TBC (the Committee is in negotiations)' },
            { label: 'Equipment', value: 'Racquets available to borrow. Returns expected.' },
            { label: 'Level', value: 'All levels. Ego-free zone (in theory).' },
          ]}
        />

        <SportSection
          id="hash"
          sportId="hash"
          n={4}
          title="The Rampant Hash"
          vn="Nhóm Chạy Rampant"
          copy={[
            "A monthly social run from Sala Running Hub through the streets, alleys, and hẻms of Sài Gòn, finishing at the Club for coffee. The route is designed to be scenic, unpredictable, and approximately 5 kilometres — though distance varies depending on who set it and whether they were feeling ambitious.",
            "Walking is permitted. Stopping for cà phê sữa đá mid-route is frowned upon but has precedent.",
          ]}
          details={[
            { label: 'When', value: 'First Saturday of each month, 7am (to beat the heat)' },
            { label: 'Distance', value: 'Approximately 5km (approximately)' },
            { label: 'Pace', value: 'Social. No one is timing you. (Someone is timing you.)' },
            { label: 'Start', value: 'Sala Running Hub' },
            { label: 'Finish', value: 'The Clubhouse (coffee on arrival)' },
          ]}
        />

        {/* ══ OTHER FIXTURES ═════════════════════════════════════════════ */}
        <section id="misc" className="sp-section" style={{ ...WRAP, scrollMarginTop: 90 }}>
          <Reveal>
            <IndexRule n={5} sport="misc" />
            <h2 className="sp-h2">Other Fixtures</h2>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 3vw, 27px)', opacity: .5, marginTop: 10 }}>Các Hoạt Động Khác</div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="sp-split">
              <div>
                {MISC_FIXTURES.map((f, i) => {
                  const { name, aside } = splitAside(f)
                  return (
                    <div key={f} className="sp-fixture">
                      <span style={{ fontFamily: MONO, fontSize: 11, opacity: .5 }}>{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <span className="sp-fixture-name">{name}</span>
                        {aside && <span className="sp-fixture-aside">{aside}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div>
                <p className="sp-copy" style={{ opacity: .7 }}>
                  The Sports Club is open to all members of The Rampant Club. Fixtures are announced via the members&rsquo; area and by word of mouth at the bar. The Committee welcomes suggestions for new activities, provided they can be conducted with dignity, or at least plausible dignity.
                </p>
                <SportOdds sport="misc" />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ══ THE TROPHY CABINET · A WORD WITH THE CAPTAIN — deep green ════ */}
      <div style={{ background: INK }}>
        <TrophyCabinet />
        <ExpressInterest />
      </div>
    </>
  )
}
