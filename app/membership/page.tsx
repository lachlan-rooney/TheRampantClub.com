'use client'

import { useEffect, useRef, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'
import LiveTicker from '@/components/LiveTicker'

// ═══════════════════════════════════════════════════════════════════
// THE RAMPANT CLUB — Membership Page
// ═══════════════════════════════════════════════════════════════════

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

const BENEFITS = [
  { title: 'The Rampant Room', desc: 'Hundreds of open bottles in a world-class bottle-share room. Pour for yourself, stay as long as you like.' },
  { title: 'Club Picks', desc: 'Taste, discuss, and select bespoke casks to be bottled exclusively under The Rampant Club label.' },
  { title: 'Blending Workshops', desc: 'Private blending sessions where members learn to blend whisky and make their own small bottlings.' },
  { title: 'Cask Selection Journey', desc: 'Purchase an entire private cask, including a selection trip to Duncan Taylor\u2019s warehouses in Scotland.' },
  { title: 'Guest Privileges', desc: 'Host up to four guests at any one time to share the club experience.' },
  { title: 'Reciprocal Club Access', desc: 'Bespoke access to a vetted global network of premier private clubs in London, New York, Tokyo, and Singapore.' },
  { title: 'Luxury Transport', desc: 'Complimentary GF VIP chauffeur service, plus airport fast-track and private car transfer for out-of-town members.' },
  { title: 'Events & Networking', desc: 'Highland Games, golf tournaments, round table events, business brunches, and private dinners.' },
]

const FLOORS = [
  { num: 5, name: 'Source & Origin Lab', vn: 'Phòng Thí Nghiệm', desc: 'Our in-house culinary innovation lab, bringing cutting-edge beverage experiences exclusively to members.' },
  { num: 4, name: 'The Rampant Room', vn: 'Phòng Rampant', desc: 'A world-class bottle-share room of global whiskies, enjoyed at your leisure with guests and fellow members. Private lockers available.' },
  { num: 3, name: 'The Private Dining Room', vn: 'Phòng Ăn Riêng', desc: 'The ultimate discreet city-centre room for meetings, birthday soir\u00e9es, private dinners, and intimate gatherings.' },
  { num: 2, name: 'The Studio', vn: 'Phòng Nghệ Thuật', desc: 'A quarterly rotating, curated sensory art space \u2014 interact with, touch, hear, taste, and smell immersive installations.' },
  { num: 1, name: 'The Library Bar', vn: 'Quầy Bar Thư Viện', desc: 'Your private cocktail bar. Seasonal cocktails, vintage spirits, curated books and games, with resident musicians and DJs.' },
]

const TIERS = [
  {
    name: 'The Legacy Membership',
    desc: 'For established individuals shaping their communities. Full use of the Club and its shared resources, balanced through mutual consideration rather than formal limits.',
    highlight: true,
  },
  {
    name: 'The Pioneer Membership',
    desc: 'For emerging leaders and rising creatives under 33. Full access to all areas, events, and member privileges at a preferential rate designed to nurture the next generation.',
    highlight: false,
  },
  {
    name: 'The Corporate Membership',
    desc: 'Three nominated representative seats per company. Access to all spaces, events, and networking opportunities \u2014 ideal for hosting, relationship-building, and representation.',
    highlight: false,
  },
]

export default function MembershipPage() {
  const hero = useScrollReveal(0.1)
  const benefits = useScrollReveal(0.1)
  const spaces = useScrollReveal(0.1)
  const reciprocal = useScrollReveal(0.15)
  const tiers = useScrollReveal(0.1)

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        :root {
          --trc-green-deep: #052E20;
          --trc-green-mid: #28483C;
          --trc-green-accent: #5E6650;
          --trc-cream: #E5D4C2;
          --trc-cream-dim: #B2AA98;
          --trc-dark-text: #221E20;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .membership-page {
          width: 100%;
          background: var(--trc-cream);
          font-family: 'Google Sans Code', monospace;
          overflow-x: hidden;
        }

        .membership-section {
          padding: 100px 40px;
          max-width: 1100px;
          margin: 0 auto;
        }

        .membership-diamond {
          width: 8px; height: 8px;
          background: var(--trc-green-accent);
          transform: rotate(45deg);
          opacity: 0.25;
          margin: 0 auto 24px;
        }

        .membership-title {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 500;
          color: var(--trc-green-deep);
          text-align: center;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }

        .membership-subtitle {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: var(--trc-cream-dim);
          text-align: center;
          letter-spacing: 0.06em;
          margin-bottom: 60px;
        }

        /* ── Paper texture ── */
        .membership-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998;
          opacity: 0.045;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 300px;
        }

        .membership-vignette {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(178, 170, 152, 0.25) 100%);
        }

        .tier-card {
          background: rgba(5, 46, 32, 0.03);
          padding: 40px 32px;
          border: 1px solid rgba(5, 46, 32, 0.08);
          cursor: pointer;
        }
        .tier-card:hover {
          background: rgba(5, 46, 32, 0.25);
          border-color: rgba(5, 46, 32, 0.4);
        }
        .tier-card .tier-name {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 500;
          color: var(--trc-green-deep);
          margin-bottom: 12px;
        }
        .tier-card .tier-desc {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          color: var(--trc-green-accent);
          opacity: 0.7;
          line-height: 1.7;
          margin-bottom: 28px;
        }
        .tier-card .tier-btn {
          display: inline-block;
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--trc-cream);
          background: var(--trc-green-deep);
          padding: 12px 28px;
          text-decoration: none;
          transition: opacity 0.4s ease;
        }
        .tier-card:hover .tier-btn {
          opacity: 0.85;
        }

        @media (max-width: 768px) {
          .membership-section { padding: 60px 20px; }
          .membership-title { font-size: 24px; }
        }
      ` }} />

      <NavOverlay variant="public" />
      <LiveTicker />

      <div className="membership-page">
        <div className="membership-vignette" />
        <div className="membership-grain" />

        {/* ══════ HERO ══════ */}
        <div
          ref={hero.ref}
          style={{
            padding: '160px 40px 100px',
            textAlign: 'center',
            maxWidth: 700,
            margin: '0 auto',
            opacity: hero.visible ? 1 : 0,
            transform: hero.visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 1s ease, transform 1s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 13,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--trc-green-accent)',
            opacity: 0.5,
            marginBottom: 20,
          }}>
            The Rampant Club
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 48,
            fontWeight: 500,
            color: 'var(--trc-green-deep)',
            letterSpacing: '0.02em',
            lineHeight: 1.15,
            marginBottom: 24,
          }}>
            A Members&rsquo; Club
          </h1>
          <p style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20,
            fontWeight: 400,
            color: 'var(--trc-green-deep)',
            opacity: 0.7,
            lineHeight: 1.5,
            marginBottom: 12,
          }}>
            For kindred spirits
          </p>
          <p style={{
            fontFamily: "'Google Sans Code', monospace",
            fontSize: 12,
            color: 'var(--trc-cream-dim)',
            letterSpacing: '0.04em',
            lineHeight: 1.7,
            marginBottom: 40,
          }}>
            Scottish heritage meets Vietnamese soul in a five-storey townhouse in the heart of Sài Gòn.
            Whisky, art, conversation, and community &mdash; sustained by its members, not for profit.
          </p>
          <a
            href="#tiers"
            style={{
              display: 'inline-block',
              fontFamily: "'Rampant Sans', 'Playfair Display', serif",
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--trc-cream)',
              background: 'var(--trc-green-deep)',
              padding: '14px 36px',
              textDecoration: 'none',
              transition: 'opacity 0.2s ease',
            }}
          >
            Apply for Membership
          </a>
        </div>

        {/* ══════ BENEFITS ══════ */}
        <div ref={benefits.ref} className="membership-section">
          <div className="membership-diamond" />
          <div className="membership-title">What Membership Brings</div>
          <div className="membership-subtitle">Quyền Lợi Thành Viên</div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '32px 48px',
          }}>
            {BENEFITS.map((b, i) => (
              <div
                key={b.title}
                style={{
                  padding: '24px 0',
                  borderTop: '1px solid rgba(5, 46, 32, 0.08)',
                  opacity: benefits.visible ? 1 : 0,
                  transform: benefits.visible ? 'translateY(0)' : 'translateY(12px)',
                  transition: 'opacity 0.6s ease, transform 0.6s ease',
                  transitionDelay: `${i * 0.06}s`,
                }}
              >
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--trc-green-deep)',
                  marginBottom: 8,
                }}>
                  {b.title}
                </div>
                <div style={{
                  fontFamily: "'Google Sans Code', monospace",
                  fontSize: 12,
                  color: 'var(--trc-green-accent)',
                  opacity: 0.7,
                  lineHeight: 1.6,
                }}>
                  {b.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════ THE FIVE FLOORS ══════ */}
        <div ref={spaces.ref} className="membership-section">
          <div className="membership-diamond" />
          <div className="membership-title">The Five Floors</div>
          <div className="membership-subtitle">Năm Tầng</div>

          <div style={{
            display: 'flex',
            gap: 64,
            alignItems: 'stretch',
            flexWrap: 'wrap',
          }}>
            {/* Building visual */}
            <div style={{
              flex: '0 0 240px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                height: 1,
                background: 'var(--trc-green-accent)',
                opacity: 0.3,
                marginBottom: 2,
                width: '70%',
                alignSelf: 'center',
              }} />
              {FLOORS.map((floor, i) => (
                <div
                  key={floor.num}
                  style={{
                    background: i % 2 === 0 ? 'var(--trc-green-deep)' : 'var(--trc-green-mid)',
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: i < FLOORS.length - 1 ? '1px solid var(--trc-cream)' : 'none',
                    opacity: spaces.visible ? 1 : 0,
                    transform: spaces.visible ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    transitionDelay: `${i * 0.08}s`,
                  }}
                >
                  <span style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 32,
                    fontWeight: 600,
                    color: 'var(--trc-cream)',
                    opacity: 0.2,
                    userSelect: 'none',
                  }}>
                    {floor.num}
                  </span>
                </div>
              ))}
              <div style={{
                height: 2,
                background: 'var(--trc-green-deep)',
                opacity: 0.15,
                marginTop: 4,
              }} />
            </div>

            {/* Floor legend */}
            <div style={{ flex: 1, minWidth: 280 }}>
              {FLOORS.map((floor, i) => (
                <div
                  key={floor.num}
                  style={{
                    padding: '20px 0',
                    borderBottom: i < FLOORS.length - 1 ? '1px solid rgba(5, 46, 32, 0.08)' : 'none',
                    opacity: spaces.visible ? 1 : 0,
                    transform: spaces.visible ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    transitionDelay: `${i * 0.08 + 0.1}s`,
                  }}
                >
                  <div style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--trc-green-deep)',
                    opacity: 0.3,
                    marginBottom: 4,
                  }}>
                    Floor {floor.num}
                  </div>
                  <div style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 17,
                    fontWeight: 500,
                    color: 'var(--trc-green-deep)',
                    marginBottom: 3,
                  }}>
                    {floor.name}
                  </div>
                  <div style={{
                    fontFamily: "'Google Sans Code', monospace",
                    fontSize: 10,
                    color: 'var(--trc-cream-dim)',
                    letterSpacing: '0.04em',
                    marginBottom: 6,
                  }}>
                    {floor.vn}
                  </div>
                  <div style={{
                    fontFamily: "'Google Sans Code', monospace",
                    fontSize: 12,
                    color: 'var(--trc-green-accent)',
                    opacity: 0.7,
                    lineHeight: 1.5,
                  }}>
                    {floor.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════ RECIPROCAL ACCESS ══════ */}
        <div
          ref={reciprocal.ref}
          style={{
            padding: '80px 40px',
            background: 'var(--trc-green-deep)',
            opacity: reciprocal.visible ? 1 : 0,
            transform: reciprocal.visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              width: 8, height: 8,
              background: 'var(--trc-cream)',
              transform: 'rotate(45deg)',
              opacity: 0.15,
              margin: '0 auto 24px',
            }} />
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28,
              fontWeight: 500,
              color: 'var(--trc-cream)',
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}>
              A World Beyond Sài Gòn
            </div>
            <div style={{
              fontFamily: "'Google Sans Code', monospace",
              fontSize: 11,
              color: 'var(--trc-cream-dim)',
              letterSpacing: '0.06em',
              opacity: 0.5,
              marginBottom: 40,
            }}>
              Câu Lạc Bộ Đối Ứng
            </div>
            <p style={{
              fontFamily: "'Google Sans Code', monospace",
              fontSize: 13,
              color: 'var(--trc-cream)',
              opacity: 0.6,
              lineHeight: 1.8,
              marginBottom: 24,
            }}>
              Our membership includes bespoke reciprocal access to a carefully vetted global network of premier private clubs. From golf courses to spa hotels, enjoy the privileges of fellow establishments worldwide.
            </p>
            <p style={{
              fontFamily: "'Google Sans Code', monospace",
              fontSize: 13,
              color: 'var(--trc-cream)',
              opacity: 0.6,
              lineHeight: 1.8,
              marginBottom: 32,
            }}>
              Our Member Experience Manager will seamlessly facilitate all arrangements for your visits. Details of our reciprocal partners are shared with members upon joining.
            </p>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 14,
              fontStyle: 'italic',
              color: 'var(--trc-cream)',
              opacity: 0.3,
              letterSpacing: '0.04em',
            }}>
              London &middot; New York &middot; Tokyo &middot; Singapore
            </div>
          </div>
        </div>

        {/* ══════ MEMBERSHIP TIERS ══════ */}
        <div ref={tiers.ref} className="membership-section" id="tiers">
          <div className="membership-diamond" />
          <div className="membership-title">Membership</div>
          <div className="membership-subtitle">Thành Viên</div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 32,
          }}>
            {TIERS.map((tier, i) => (
              <div
                key={tier.name}
                className="tier-card"
                style={{
                  opacity: tiers.visible ? 1 : 0,
                  transform: tiers.visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: tiers.visible ? 'none' : `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s`,
                }}
              >
                <div className="tier-name">{tier.name}</div>
                <p className="tier-desc">{tier.desc}</p>
                <a href="#" className="tier-btn">Enquire</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
