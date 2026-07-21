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

// ── Scroll-reveal wrapper ────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

// ── Diamond ──────────────────────────────────────────────────────
function Diamond({ size = 8, margin = '48px auto' }: { size?: number; margin?: string }) {
  return (
    <div style={{
      width: size, height: size,
      background: '#5E6650',
      transform: 'rotate(45deg)',
      opacity: 0.25,
      margin,
    }} />
  )
}

// ── Detail row ───────────────────────────────────────────────────
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '8px 0',
      borderBottom: '1px solid rgba(178,170,152,0.2)',
    }}>
      <span style={{
        fontFamily: "'Google Sans Code', 'DM Mono', monospace",
        fontSize: 11,
        color: '#B2AA98',
        letterSpacing: '0.04em',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'Google Sans Code', 'DM Mono', monospace",
        fontSize: 12,
        color: '#052E20',
        textAlign: 'right',
        maxWidth: '60%',
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Sport section ────────────────────────────────────────────────
function SportSection({
  id,
  sportId,
  title,
  vn,
  copy,
  details,
  delay = 0,
  image,
}: {
  id?: string
  sportId?: string
  title: string
  vn: string
  copy: string[]
  details?: { label: string; value: string }[]
  delay?: number
  image?: { src: string; alt: string; cropX?: string; cropY?: string; scale?: number }
}) {
  return (
    <Reveal delay={delay}>
      <div id={id} style={{ marginBottom: 20, scrollMarginTop: 100 }}>
        {image && (
          <div style={{
            width: 140,
            height: 100,
            overflow: 'hidden',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              style={{
                width: 140 * (image.scale || 2),
                height: 'auto',
                filter: 'brightness(0) opacity(0.65)',
              }}
            />
          </div>
        )}
        <h2 style={{
          fontFamily: "'Rampant Sans', 'Playfair Display', serif",
          fontSize: 16,
          fontWeight: 600,
          fontStyle: 'italic',
          color: '#052E20',
          marginBottom: 4,
        }}>
          {title}
        </h2>
        <p style={{
          fontFamily: "'Google Sans Code', 'DM Mono', monospace",
          fontSize: 10,
          color: '#B2AA98',
          letterSpacing: '0.04em',
          marginBottom: 20,
        }}>
          {vn}
        </p>

        {copy.map((para, i) => (
          <p key={i} style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 12,
            lineHeight: 1.85,
            color: '#5E6650',
            marginBottom: 14,
            letterSpacing: '0.01em',
          }}>
            {para}
          </p>
        ))}

        {details && (
          <div style={{
            marginTop: 24,
            padding: '16px 20px',
            background: 'rgba(5,46,32,0.03)',
            borderRadius: 6,
          }}>
            {details.map((d, i) => (
              <Detail key={i} label={d.label} value={d.value} />
            ))}
          </div>
        )}
        {sportId && <SportOdds sport={sportId} />}
      </div>
    </Reveal>
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

export default function SportsPage() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 150) }, [])

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
        html, body { background: #E5D4C2 !important; margin: 0; padding: 0; }
      ` }} />

      <OnNowRibbon />
      <CaptainsMarquee />

      {/* Grain overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat',
        backgroundSize: '300px',
      }} />

      <div style={{
        minHeight: '100vh',
        background: '#E5D4C2',
        padding: '80px 40px 100px',
      }}>
        <div style={{
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {/* Header */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/Sports%20Club%20Logo.svg"
            alt="The Rampant Sports Club"
            style={{
              display: 'block',
              width: 100,
              height: 'auto',
              margin: '0 auto 32px',
              opacity: 1,
            }}
          />

          <h1 style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 500,
            color: '#052E20',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}>
            The Sports Club
          </h1>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 11,
            color: '#B2AA98',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 32,
          }}>
            Câu Lạc Bộ Thể Thao
          </p>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 12,
            fontStyle: 'italic',
            color: '#5E6650',
            textAlign: 'center',
            lineHeight: 1.7,
            marginBottom: 56,
            opacity: 0.65,
            maxWidth: 440,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            The Rampant Club believes in the cultivation of both mind and body. Mostly mind. But occasionally body.
          </p>

          <SportSelector counts={fixtureCounts} />

          {/* ── The Rampant Cup — hero film ── */}
          <Reveal delay={0.05}>
            <div style={{ margin: '4px 0 44px', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 60px rgba(5,46,32,0.22)' }}>
              <video
                autoPlay muted loop playsInline preload="metadata"
                poster="/images/cup/poster.webp"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              >
                <source src="/images/cup/cup.mp4" type="video/mp4" />
              </video>
            </div>
          </Reveal>

          {/* ── Golf — The Rampant Cup ── */}
          <SportSection
            id="golf"
            sportId="golf"
            title="The Inaugural Rampant Cup"
            vn="Giải Golf Rampant · 14 & 15 August 2026"
            delay={0.1}
            copy={[
              "A weekend of golf, dining, and charity hosted by The Rampant Club at The Grand Hồ Tràm and The Bluffs, on 14 and 15 August 2026, in aid of Operation Smile Vietnam.",
              "Friday evening opens with a black tie charity gala at The Grand Hồ Tràm. A welcome reception, a four-course dinner with paired wines, the captains' live draft of the Cup teams, a live charity auction, and a raffle. All proceeds directed to Operation Smile Vietnam's surgical missions for Vietnamese children.",
              "Saturday brings the Cup itself, played at The Bluffs. A Ryder Cup style match play tournament across two teams of fourteen, seven simultaneous fourball matches from a single shotgun start, on one of Southeast Asia's finest coastal links. Trophy and cheque presentation follow at a late lunch back at The Grand.",
              "For invitations and enquiries, contact Miss Châu Lê at membership@therampantclub.com.",
            ]}
            details={[
              { label: 'When', value: '14 & 15 August 2026' },
              { label: 'Friday', value: 'Charity gala · The Grand Hồ Tràm · black tie' },
              { label: 'Saturday', value: 'The Cup · The Bluffs · shotgun start 8:00am' },
              { label: 'Format', value: 'Two teams of fourteen · seven fourball matches · Ryder Cup style' },
              { label: 'In aid of', value: 'Operation Smile Vietnam' },
              { label: 'Enquiries', value: 'membership@therampantclub.com' },
            ]}
          />

          {/* ── The Cup, in full colour ── */}
          <Reveal delay={0.1}>
            <div style={{ margin: '36px 0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 60px rgba(5,46,32,0.2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/cup/cup-deco.webp" alt="The Rampant Cup — The Bluffs, Hồ Tràm" style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
          </Reveal>

          {/* ── The world of the Cup ── */}
          <Reveal delay={0.1}>
            <div style={{ margin: '40px 0 8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[
                  { s: 'cup-course', alt: 'The Rampant Cup at The Bluffs' },
                  { s: 'poster-2', alt: '2026 Invitational and Charity Gala Dinner' },
                  { s: 'lady', alt: 'The Rampant Cup' },
                  { s: 'ferrari-sponsor', alt: 'Your seat and tee time, compliments of Ferrari' },
                  { s: 'cao-minh', alt: 'Black tie by Cao Minh, Saigon' },
                  { s: 'cup-flag', alt: 'The ninth at The Bluffs' },
                  { s: 'tie', alt: 'The house colours' },
                  { s: 'cup-argyle', alt: 'The Rampant Cup 2026' },
                ].map(im => (
                  <div key={im.s} style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 30px rgba(5,46,32,0.14)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/images/cup/${im.s}.webp`} alt={im.alt} style={{ display: 'block', width: '100%', height: 'auto' }} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <CaptainsColumn />

          {/* ── Tennis ── */}
          <SportSection
            id="tennis"
            sportId="tennis"
            title="The Sài Gòn Open"
            vn="Giải Quần Vợt Sài Gòn"
            delay={0.1}
            copy={[
              "An annual doubles tournament open to all members and their guests, held at a local court that the Committee secures through means it prefers not to discuss. The Sài Gòn Open has been running since 2024 and has already produced three disputed line calls, one broken racquet, and a lifelong friendship.",
              "Mixed doubles is encouraged. Singles is tolerated. The Committee does not recognise \u201Csocial tennis\u201D as a category.",
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

          <div style={{ margin: '48px auto', display: 'flex', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/tennis-opt.png"
              alt="Tennis"
              style={{ width: 120, height: 'auto', filter: 'brightness(0) opacity(0.15)' }}
            />
          </div>

          {/* ── Padel ── */}
          <SportSection
            id="padel"
            sportId="padel"
            title="The Rampant Padel Club"
            vn="Câu Lạc Bộ Padel Rampant"
            delay={0.1}
            copy={[
              "The newest addition to the Club's sporting calendar. Monthly sessions for members who have discovered padel and now won't stop talking about it.",
              "The Committee acknowledges that padel is, in fact, a real sport and not simply \u201Ctennis with walls\u201D. Court bookings are managed by the Sports Secretary, who is learning the rules as we go. Coaching is available from a member who spent three weeks in Barcelona and returned with strong opinions.",
              "Beginners are welcome. Overconfidence is not.",
            ]}
            details={[
              { label: 'Sessions', value: 'First Thursday, 6pm (subject to rain, heat, and enthusiasm)' },
              { label: 'Location', value: 'TBC (the Committee is in negotiations)' },
              { label: 'Equipment', value: 'Racquets available to borrow. Returns expected.' },
              { label: 'Level', value: 'All levels. Ego-free zone (in theory).' },
            ]}
          />

          <Diamond />

          {/* ── Hash ── */}
          <SportSection
            id="hash"
            sportId="hash"
            title="The Rampant Hash"
            vn="Nhóm Chạy Rampant"
            delay={0.1}
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

          <Diamond />

          {/* ── Miscellaneous Fixtures ── */}
          <Reveal delay={0.1}>
            <h2 id="misc" style={{ scrollMarginTop: 100,
              fontFamily: "'Rampant Sans', 'Playfair Display', serif",
              fontSize: 16,
              fontWeight: 600,
              fontStyle: 'italic',
              color: '#052E20',
              marginBottom: 4,
            }}>
              Other Fixtures
            </h2>
            <p style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 10,
              color: '#B2AA98',
              letterSpacing: '0.04em',
              marginBottom: 24,
            }}>
              Các Hoạt Động Khác
            </p>

            <div style={{ textAlign: 'center' }}>
              {MISC_FIXTURES.map((fixture, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#052E20',
                    padding: '12px 0',
                    borderBottom: i < MISC_FIXTURES.length - 1
                      ? '1px solid rgba(178,170,152,0.25)'
                      : 'none',
                  }}
                >
                  {fixture}
                </div>
              ))}
            </div>
            <SportOdds sport="misc" />
          </Reveal>

          {/* ── Closing ── */}
          <Diamond />

          <Reveal delay={0.1}>
            <p style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 11,
              color: '#B2AA98',
              textAlign: 'center',
              lineHeight: 1.85,
              maxWidth: 460,
              margin: '0 auto',
              letterSpacing: '0.02em',
            }}>
              The Sports Club is open to all members of The Rampant Club. Fixtures are announced via the members&rsquo; area and by word of mouth at the bar. The Committee welcomes suggestions for new activities, provided they can be conducted with dignity, or at least plausible dignity.
            </p>
          </Reveal>

          {/* Address */}
          <div style={{
            width: 6, height: 6,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.2,
            margin: '64px auto 28px',
          }} />
          <p style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 12,
            fontWeight: 500,
            color: '#052E20',
            letterSpacing: '0.06em',
            lineHeight: 1.8,
            opacity: 0.3,
            textAlign: 'center',
          }}>
            74A/2 Hai Bà Trưng<br />
            TP. HCM, Việt Nam
          </p>
        </div>
      </div>

      {/* ── Trophy Cabinet on deep green ── */}
      <div style={{ background: '#052E20', borderTop: '1px solid rgba(229,212,194,0.08)' }}>
        <TrophyCabinet />
      </div>

      {/* ── Express Interest (has its own deep green bg) ── */}
      <ExpressInterest />
    </>
  )
}
