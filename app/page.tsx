'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'
import LiveTicker from '@/components/LiveTicker'
import useEasterEggs from '@/hooks/useEasterEggs'

// ═══════════════════════════════════════════════════════════════════
// THE RAMPANT CLUB — Homepage
// Hero · Benefits · Moodboard · Five Floors · Reciprocal · Blurb · Tiers
// ═══════════════════════════════════════════════════════════════════

interface MoodboardImage {
  id: string
  src: string
  thumb?: string
  filename: string
  noRotate?: boolean
  hoverSrc?: string
  filter?: string
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

interface ItemDragState {
  initialAngle: number
  marginTop: number
  x: number
  y: number
  lastX: number
  lastY: number
  z: number
}

// ─── Scroll-reveal hook ──────────────────────────────────────────
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

// ─── Data ────────────────────────────────────────────────────────
const BENEFITS = [
  { title: 'The Rampant Room', desc: 'Hundreds of open bottles in a world-class bottle-share room. Pour for yourself, stay as long as you like.' },
  { title: 'Club Picks', desc: 'Taste, discuss, and select bespoke casks to be bottled exclusively under The Rampant Club label.' },
  { title: 'Blending Workshops', desc: 'Private blending sessions where members learn to blend whisky and make their own small bottlings.' },
  { title: 'Our Scottish Castle', desc: 'Members enjoy exclusive discounts on accommodation, activities, and dining at our sister castle in the Scottish Highlands, slated to open in 2027, will be home to an exclusive Rampant Club whisky collection.' },
  { title: 'The Rampant Club Apartment', desc: 'Complimentary stays in Huntly, Scotland, furnished with cask samples for members to enjoy. Perfect for those visiting Speyside.' },
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

// ─── Draggable Image Component ───────────────────────────────────
function DraggableImage({
  img,
  index,
  itemSize,
  multiplier,
  maxZRef,
}: {
  img: MoodboardImage
  index: number
  itemSize: number
  multiplier: number
  maxZRef: React.MutableRefObject<number>
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<ItemDragState>({
    initialAngle: img.noRotate ? 0 : (seededRandom(index * 17 + 11) - 0.5) * 50,
    marginTop: (seededRandom(index * 23 + 5) - 0.5) * 280,
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    z: Math.floor(seededRandom(index * 31) * 20) + 1,
  })
  const [hovered, setHovered] = useState(false)
  const clickedRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })

  const applyTransform = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const s = stateRef.current
    const dragAngle = img.noRotate ? 0 : (s.x + s.y) / multiplier
    el.style.left = `${s.x}px`
    el.style.top = `${s.y}px`
    el.style.transform = `rotate(${s.initialAngle + dragAngle}deg)`
    el.style.zIndex = String(s.z)
  }, [multiplier, img.noRotate])

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    el.style.marginTop = `${stateRef.current.marginTop}px`
    applyTransform()
  }, [applyTransform])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = elRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    clickedRef.current = true
    startRef.current = { x: e.clientX, y: e.clientY }
    const newZ = maxZRef.current + 1
    maxZRef.current = newZ
    stateRef.current.z = newZ
    el.style.zIndex = String(newZ)
    el.style.cursor = 'grabbing'
    el.style.filter = 'drop-shadow(0 28px 40px rgba(5,46,32,0.2)) drop-shadow(0 8px 12px rgba(5,46,32,0.1))'
    el.style.transition = 'filter 0.15s ease'
  }, [maxZRef])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!clickedRef.current) return
    const s = stateRef.current
    s.x = s.lastX + (e.clientX - startRef.current.x)
    s.y = s.lastY + (e.clientY - startRef.current.y)
    const el = elRef.current
    if (!el) return
    const dragAngle = img.noRotate ? 0 : (s.x + s.y) / multiplier
    el.style.left = `${s.x}px`
    el.style.top = `${s.y}px`
    el.style.transform = `rotate(${s.initialAngle + dragAngle}deg)`
    el.style.transition = 'filter 0.15s ease'
  }, [multiplier, img.noRotate])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!clickedRef.current) return
    const el = elRef.current
    if (el) el.releasePointerCapture(e.pointerId)
    clickedRef.current = false
    const s = stateRef.current
    s.lastX = s.x
    s.lastY = s.y
    if (el) {
      el.style.cursor = 'grab'
      el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease'
      el.style.filter = 'drop-shadow(0 6px 20px rgba(5,46,32,0.12)) drop-shadow(0 2px 6px rgba(5,46,32,0.06))'
    }
  }, [])

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => img.hoverSrc && setHovered(true)}
      onMouseLeave={() => img.hoverSrc && setHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        borderRadius: 8,
        overflow: 'hidden',
        filter: 'drop-shadow(0 6px 20px rgba(5,46,32,0.12)) drop-shadow(0 2px 6px rgba(5,46,32,0.06))',
        transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.thumb || img.src}
        alt={img.filename}
        loading="lazy"
        draggable={false}
        style={{
          width: itemSize,
          height: 'auto',
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'block',
          ...(img.filter ? { filter: img.filter } : {}),
        }}
      />
      {img.hoverSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.hoverSrc}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            top: -8,
            right: 4,
            transform: `scale(${hovered ? 1 : 0.85})`,
            transformOrigin: 'top right',
            width: itemSize * 0.45,
            height: 'auto',
            pointerEvents: 'none',
            opacity: hovered ? 1 : 0,
            filter: 'url(#cream-recolour)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}
        />
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function HomePage() {
  useEasterEggs()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [images, setImages] = useState<MoodboardImage[]>([])
  const [showGrid, setShowGrid] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [blurbVisible, setBlurbVisible] = useState(false)
  const [ethosOpen, setEthosOpen] = useState(false)
  const [ethosLang, setEthosLang] = useState<'en' | 'vn'>('en')
  const blurbRef = useRef<HTMLDivElement>(null)
  const maxZRef = useRef(50)

  const multiplier = isMobile ? 2 : 6

  // Scroll-reveal hooks for new sections
  const hero = useScrollReveal(0.1)
  const benefitsSec = useScrollReveal(0.1)
  const floorsSec = useScrollReveal(0.1)
  const reciprocalSec = useScrollReveal(0.15)
  const tiersSec = useScrollReveal(0.1)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)

    const localImages: MoodboardImage[] = [
      {
        id: 'lion-painting',
        src: '/images/Lion-opt.png',
        filename: 'Lion-opt.png',
        noRotate: true,
      },
      {
        id: 'library-bar',
        src: '/images/library%20bar.svg',
        filename: 'library bar.svg',
        noRotate: true,
        hoverSrc: '/images/PNG/%5BRAMPANT%5D_Logo_Rampants/8.svg',
      },
    ]

    fetch('/api/moodboard')
      .then(r => r.json())
      .then(data => {
        const imgs = [...(data.images || []), ...localImages]
        for (let i = imgs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [imgs[i], imgs[j]] = [imgs[j], imgs[i]]
        }
        setImages(imgs)
        setLoaded(true)
      })
      .catch(() => {
        setImages(localImages)
        setLoaded(true)
      })

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Intersection observer for scroll-reveal blurb
  useEffect(() => {
    const el = blurbRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setBlurbVisible(true) },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Grid overlay toggle (press G)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'G') setShowGrid(prev => !prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (showGrid) setMousePos({ x: e.pageX, y: e.pageY })
  }, [showGrid])

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');

        @font-face {
          font-family: 'Rampant Sans';
          src: url('/fonts/MNRampantSans-Regular.woff2') format('woff2'),
               url('/fonts/MNRampantSans-Regular.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: 'Google Sans Code';
          src: url('/fonts/GoogleSansCode-VariableFont_wght.ttf') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: 'Google Sans Code';
          src: url('/fonts/GoogleSansCode-Italic-VariableFont_wght.ttf') format('truetype');
          font-weight: 100 900;
          font-style: italic;
          font-display: swap;
        }

        :root {
          --trc-green-deep: #052E20;
          --trc-green-mid: #28483C;
          --trc-green-accent: #5E6650;
          --trc-cream: #E5D4C2;
          --trc-cream-dim: #B2AA98;
          --trc-dark-text: #221E20;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .trc-page {
          width: 100%;
          min-height: 100vh;
          background: var(--trc-cream);
          font-family: 'Google Sans Code', monospace;
          overflow-x: hidden;
          position: relative;
        }

        .trc-flow {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: flex-start;
          padding: 4em 2em 6em;
          gap: 0.6em;
          opacity: 0;
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .trc-flow.loaded { opacity: 1; }

        /* ── Paper texture overlay ── */
        .trc-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998;
          opacity: 0.045;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 300px;
        }

        /* ── Subtle vignette (warm, not dark) ── */
        .trc-vignette {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(178, 170, 152, 0.25) 100%);
        }

        .trc-empty {
          width: 100%; text-align: center; padding-top: 30vh;
        }
        .trc-empty p { color: var(--trc-green-accent); opacity: 0.4; }
        .trc-empty p:first-child {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 20px; font-weight: 500; letter-spacing: 0.04em;
          margin-bottom: 8px; opacity: 0.5;
        }
        .trc-empty p:last-child { font-size: 12px; letter-spacing: 0.06em; }

        /* ── Section helpers ── */
        .trc-section {
          padding: 100px 40px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .trc-section-diamond {
          width: 8px; height: 8px;
          background: var(--trc-green-accent);
          transform: rotate(45deg);
          opacity: 0.25;
          margin: 0 auto 24px;
        }
        .trc-section-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 28px; font-weight: 500;
          color: var(--trc-green-deep);
          text-align: center; letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        .trc-section-subtitle {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: var(--trc-cream-dim);
          text-align: center; letter-spacing: 0.06em;
          margin-bottom: 60px;
        }

        /* ── Scroll-reveal blurb section ── */
        .trc-blurb {
          text-align: center;
          padding: 40px 24px 0;
          max-width: 560px;
          margin: 0 auto;
          background: var(--trc-cream);
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .trc-blurb.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .trc-blurb-diamond {
          width: 8px; height: 8px; background: var(--trc-green-accent);
          transform: rotate(45deg); opacity: 0.3; margin: 0 auto 32px;
        }

        .trc-blurb-wordmark-img {
          display: block;
          width: 220px;
          height: auto;
          margin: 0 auto 28px;
        }

        .trc-blurb-en {
          font-size: 13px; line-height: 1.8;
          color: var(--trc-green-deep);
          letter-spacing: 0.02em;
          margin-bottom: 20px;
        }
        .trc-blurb-vn {
          font-size: 11px; line-height: 1.75;
          color: var(--trc-green-accent);
          letter-spacing: 0.02em;
        }

        .trc-blurb-address {
          margin-top: 32px;
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 14px; font-weight: 500;
          color: var(--trc-green-deep);
          letter-spacing: 0.06em; line-height: 1.6;
        }

        .trc-tier-card {
          background: rgba(5, 46, 32, 0.03);
          padding: 40px 32px;
          border: 1px solid rgba(5, 46, 32, 0.08);
          cursor: pointer;
        }
        .trc-tier-card:hover {
          background: rgba(5, 46, 32, 0.25);
          border-color: rgba(5, 46, 32, 0.4);
        }
        .trc-tier-card .trc-tier-name {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 20px; font-weight: 500;
          color: var(--trc-green-deep);
          margin-bottom: 12px;
        }
        .trc-tier-card .trc-tier-desc {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          color: var(--trc-green-accent);
          opacity: 0.7; line-height: 1.7;
          margin-bottom: 28px;
        }
        .trc-tier-card .trc-tier-btn {
          display: inline-block;
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 10px; letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--trc-cream);
          background: var(--trc-green-deep);
          padding: 12px 28px;
          text-decoration: none;
          transition: opacity 0.4s ease;
        }
        .trc-tier-card:hover .trc-tier-btn {
          opacity: 0.85;
        }

        @media (max-width: 768px) {
          .trc-flow { padding: 4em 1em 5em; gap: 0.4em; }
          .trc-blurb { padding: 40px 20px 0; }
          .trc-section { padding: 40px 16px; }
          .trc-section-title { font-size: 22px; }
          .trc-section-subtitle { font-size: 9px; }
          .trc-benefits-grid {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
          .trc-benefits-glass {
            order: -1;
            margin-bottom: 24px;
          }
          .trc-benefits-left, .trc-benefits-right {
            text-align: left !important;
          }
          .trc-tier-card {
            min-width: unset !important;
          }
          .trc-hero-title {
            font-size: 32px !important;
          }
          .trc-hero-illustration {
            margin-left: -100px !important;
            width: 120px !important;
          }
        }
      ` }} />

      {/* Inline SVG filter for exact cream recolour */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="cream-recolour" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0.898  0 0 0 0 0.831  0 0 0 0 0.761  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>

      <NavOverlay variant="public" />
      <LiveTicker />

      <div className="trc-page" onMouseMove={onMouseMove}>
        <div className="trc-vignette" />
        <div className="trc-grain" />

        {/* Dev grid overlay — toggle with G key */}
        {showGrid && (
          <>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, minHeight: '100%', zIndex: 99999, pointerEvents: 'none',
              backgroundImage: `
                linear-gradient(rgba(255,0,0,0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,0,0,0.08) 1px, transparent 1px),
                linear-gradient(rgba(255,0,0,0.2) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,0,0,0.2) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px, 50px 50px, 200px 200px, 200px 200px',
            }}>
              {Array.from({ length: 40 }, (_, i) => (
                <div key={`y${i}`} style={{
                  position: 'absolute', top: i * 200, left: 4,
                  fontSize: 9, color: 'rgba(255,0,0,0.5)', fontFamily: 'monospace',
                }}>{i * 200}</div>
              ))}
              {Array.from({ length: 20 }, (_, i) => (
                <div key={`x${i}`} style={{
                  position: 'absolute', top: 4, left: i * 200 + 4,
                  fontSize: 9, color: 'rgba(255,0,0,0.5)', fontFamily: 'monospace',
                }}>{i * 200}</div>
              ))}
            </div>
            <div style={{
              position: 'fixed', bottom: 12, right: 12, zIndex: 100000,
              background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '4px 10px',
              borderRadius: 4, fontSize: 12, fontFamily: 'monospace',
            }}>
              x: {mousePos.x} &nbsp; y: {mousePos.y}
            </div>
          </>
        )}

        {/* ══════ 1. HERO ══════ */}
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
            display: 'flex',
            justifyContent: 'center',
            marginBottom: -20,
            position: 'relative',
            zIndex: 1,
          }}>
            <img
              src="/images/251008_[RAMPANT]_Merch_WhiskyGlass.ai.svg"
              alt="The Rampant Club girl illustration"
              className="trc-hero-illustration"
              style={{
                width: 180,
                height: 'auto',
                objectFit: 'contain',
                filter: 'brightness(1.1)',
                marginLeft: -345,
              }}
            />
          </div>
          <h1 className="trc-hero-title" style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 48,
            fontWeight: 400,
            color: 'var(--trc-green-deep)',
            letterSpacing: '0.02em',
            lineHeight: 1.15,
            marginBottom: 24,
          }}>
            A Members&rsquo; Club
          </h1>
          <p style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
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
          <button
            onClick={() => setEthosOpen(true)}
            style={{
              display: 'inline-block',
              fontFamily: "'Rampant Sans', 'Playfair Display', serif",
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--trc-cream)',
              background: 'var(--trc-green-deep)',
              padding: '14px 36px',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
            }}
          >
            Club Ethos
          </button>
        </div>

        {/* ══════ 2. BENEFITS ══════ */}
        <div ref={benefitsSec.ref} className="trc-section">
          <div className="trc-section-diamond" />
          <div className="trc-section-title">Member Benefits</div>
          <div className="trc-section-subtitle">Quyền Lợi Thành Viên</div>

          <div className="trc-benefits-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0 48px', alignItems: 'center' }}>
            {/* Left column — first 4 benefits */}
            <div className="trc-benefits-left">
              {BENEFITS.slice(0, 4).map((b, i) => (
                <div
                  key={b.title}
                  style={{
                    padding: '20px 0',
                    borderTop: '1px solid rgba(5, 46, 32, 0.08)',
                    opacity: benefitsSec.visible ? 1 : 0,
                    transform: benefitsSec.visible ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    transitionDelay: `${i * 0.06}s`,
                    textAlign: 'right',
                  }}
                >
                  <div style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                    fontSize: 16, fontWeight: 500, color: 'var(--trc-green-deep)', marginBottom: 6,
                  }}>{b.title}</div>
                  <div style={{
                    fontFamily: "'Google Sans Code', monospace",
                    fontSize: 11, color: 'var(--trc-green-accent)', opacity: 0.7, lineHeight: 1.6,
                  }}>{b.desc}</div>
                </div>
              ))}
            </div>

            {/* Centre image */}
            <div className="trc-benefits-glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/whisky%20glass%20swim.svg" alt="" style={{ width: 160, height: 'auto' }} />
            </div>

            {/* Right column — last 4 benefits */}
            <div className="trc-benefits-right">
              {BENEFITS.slice(4).map((b, i) => (
                <div
                  key={b.title}
                  style={{
                    padding: '20px 0',
                    borderTop: '1px solid rgba(5, 46, 32, 0.08)',
                    opacity: benefitsSec.visible ? 1 : 0,
                    transform: benefitsSec.visible ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    transitionDelay: `${(i + 4) * 0.06}s`,
                  }}
                >
                  <div style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                    fontSize: 16, fontWeight: 500, color: 'var(--trc-green-deep)', marginBottom: 6,
                  }}>{b.title}</div>
                  <div style={{
                    fontFamily: "'Google Sans Code', monospace",
                    fontSize: 11, color: 'var(--trc-green-accent)', opacity: 0.7, lineHeight: 1.6,
                  }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════ 3. MOODBOARD ══════ */}
        <div className={`trc-flow ${loaded ? 'loaded' : ''}`}>
          {images.length === 0 && loaded && (
            <div className="trc-empty">
              <p>Nothing here yet</p>
              <p>The walls are bare. Someone fetch the curator.</p>
            </div>
          )}

          {images.map((img, i) => {
            const baseSize = isMobile ? 110 : 170
            const size = img.id === 'lion-painting' ? baseSize * 3
              : img.id === 'library-bar' ? baseSize * 2.5
              : baseSize
            return (
              <DraggableImage
                key={img.id}
                img={img}
                index={i}
                itemSize={size}
                multiplier={multiplier}
                maxZRef={maxZRef}
              />
            )
          })}
        </div>

        {/* ══════ 4. THE FIVE FLOORS ══════ */}
        <div ref={floorsSec.ref} className="trc-section">
          <div className="trc-section-diamond" />
          <div className="trc-section-title">The Five Floors</div>
          <div className="trc-section-subtitle">Năm Tầng</div>

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
                    opacity: floorsSec.visible ? 1 : 0,
                    transform: floorsSec.visible ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    transitionDelay: `${i * 0.08}s`,
                  }}
                >
                  <span style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
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
                    opacity: floorsSec.visible ? 1 : 0,
                    transform: floorsSec.visible ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    transitionDelay: `${i * 0.08 + 0.1}s`,
                  }}
                >
                  <div style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--trc-green-deep)',
                    opacity: 0.3,
                    marginBottom: 4,
                  }}>
                    Floor {floor.num}
                  </div>
                  <div style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
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

        {/* ══════ 5. RECIPROCAL ACCESS ══════ */}
        <div
          ref={reciprocalSec.ref}
          style={{
            padding: '80px 40px',
            background: 'var(--trc-green-deep)',
            opacity: reciprocalSec.visible ? 1 : 0,
            transform: reciprocalSec.visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/PNG/Key1.svg"
              alt=""
              style={{ display: 'block', width: 80, height: 'auto', margin: '0 auto 24px', opacity: 0.7 }}
            />
            <div style={{
              fontFamily: "'Rampant Sans', 'Playfair Display', serif",
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
              fontFamily: "'Rampant Sans', 'Playfair Display', serif",
              fontSize: 14,
              fontStyle: 'italic',
              color: 'var(--trc-cream)',
              opacity: 0.5,
              letterSpacing: '0.04em',
            }}>
              London &middot; New York &middot; Tokyo &middot; Singapore
            </div>
          </div>
        </div>

        {/* ══════ 6. LION PAINTING ══════ */}
        <div
          ref={blurbRef}
          className={`trc-blurb ${blurbVisible ? 'visible' : ''}`}
          style={{ textAlign: 'center' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/image%201472.svg"
            alt="The Rampant Club"
            style={{
              display: 'block', maxWidth: 500, width: '100%', height: 'auto',
              margin: '0 auto', opacity: 0.9, borderRadius: 12,
            }}
          />
        </div>

        {/* ══════ 7. MEMBERSHIP TIERS ══════ */}
        <div ref={tiersSec.ref} className="trc-section" id="tiers">
          <div className="trc-section-diamond" />
          <div className="trc-section-title">Membership</div>
          <div className="trc-section-subtitle">Thành Viên</div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 32,
          }}>
            {TIERS.map((tier, i) => (
              <div
                key={tier.name}
                className="trc-tier-card"
                style={{
                  opacity: tiersSec.visible ? 1 : 0,
                  transform: tiersSec.visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: tiersSec.visible ? 'none' : `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s`,
                }}
              >
                <div className="trc-tier-name">{tier.name}</div>
                <p className="trc-tier-desc">{tier.desc}</p>
                <a href="#" className="trc-tier-btn">Enquire</a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ CLUB ETHOS MODAL ══════ */}
      {ethosOpen && (
        <div
          onClick={() => setEthosOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(229,212,194,0.92)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, overflow: 'auto',
          }}
        >
          <button
            onClick={() => setEthosOpen(false)}
            style={{
              position: 'fixed', top: 28, right: 32,
              background: 'none', border: 'none', color: '#052E20',
              fontSize: 14, cursor: 'pointer', opacity: 0.5,
              fontFamily: "'Rampant Sans', serif",
              letterSpacing: '0.14em', textTransform: 'uppercase',
              zIndex: 100000,
            }}
          >
            Close
          </button>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 760, width: '100%', padding: '40px 56px 36px',
              background: '#052E20',
              borderRadius: 8,
              position: 'relative',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >

            <div style={{
              display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 28,
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); setEthosLang('en') }}
                style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                  letterSpacing: '0.06em', padding: '6px 16px', cursor: 'pointer',
                  background: ethosLang === 'en' ? 'rgba(229,212,194,0.12)' : 'transparent',
                  color: ethosLang === 'en' ? '#E5D4C2' : '#B2AA98',
                  border: '1px solid rgba(229,212,194,0.1)',
                  borderRadius: '4px 0 0 4px',
                  opacity: ethosLang === 'en' ? 1 : 0.5,
                }}
              >
                EN
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEthosLang('vn') }}
                style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                  letterSpacing: '0.06em', padding: '6px 16px', cursor: 'pointer',
                  background: ethosLang === 'vn' ? 'rgba(229,212,194,0.12)' : 'transparent',
                  color: ethosLang === 'vn' ? '#E5D4C2' : '#B2AA98',
                  border: '1px solid rgba(229,212,194,0.1)',
                  borderRadius: '0 4px 4px 0',
                  borderLeft: 'none',
                  opacity: ethosLang === 'vn' ? 1 : 0.5,
                }}
              >
                VN
              </button>
            </div>

            <div style={{
              width: 8, height: 8, background: '#E5D4C2',
              transform: 'rotate(45deg)', opacity: 0.2, margin: '0 auto 28px',
            }} />

            <h2 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500,
              color: '#E5D4C2', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 28,
            }}>
              {ethosLang === 'en' ? 'Club Ethos' : 'Tinh thần câu lạc bộ'}
            </h2>

            {(ethosLang === 'en' ? [
              'The Rampant Club exists to give serious whisky lovers freedoms rarely granted elsewhere. Hundreds of open bottles sit within a private space where members pour for themselves and stay as long as they like. There are no menus, no measures, and no permission required.',
              'That same philosophy extends beyond the glass. The Club is an exciting base for shared pursuits\u2026 sporting traditions, off-site excursions, private dinners, and events that reach well beyond the clubhouse.',
              'A discreet cocktail bar and experimental culinary lab sit alongside an immersive art studio and whisky library, giving members the freedom to test ideas, explore technique, and develop personalised flavours without constraint.',
              'This level of freedom only works because the Club is built on trust. Bottles are shared, not monitored. Spaces are respected, privacy is absolute. Membership is by invitation, renewal is not guaranteed, and belonging is demonstrated through conduct rather than status.',
              'This is not hospitality for everyone. Rather, it is a club for those who understand why this kind of access is rare.',
            ] : [
              'Câu lạc bộ The Rampant ra đời để mang đến cho người yêu thích whisky thực thụ những quyền tự do hiếm khi có được ở những nơi khác. Hàng trăm chai whisky đã mở nắp được đặt trong một không gian riêng tư, nơi các thành viên được quyền tự rót và ở lại thưởng thức bao lâu tùy thích. Không có thực đơn, không cần đong đếm và không cần xin phép.',
              'Triết lý đó không chỉ giới hạn trong phạm vi câu lạc bộ. The Rampant Club là một địa điểm tuyệt vời cho các hoạt động chung... các truyền thống thể thao, các chuyến du ngoạn ngoại khóa, các bữa tối riêng tư và các sự kiện vượt xa khuôn khổ của một câu lạc bộ.',
              'Một quầy bar cocktail riêng tư và phòng nghiên cứu ẩm thực nằm cạnh một không gian nghệ thuật độc đáo cùng thư viện rượu whisky, mang đến cho các thành viên sự tự do để thử nghiệm ý tưởng, khám phá kỹ thuật và phát triển hương vị cá nhân mà không bị ràng buộc.',
              'Sự tự do này ở câu lạc bộ được xây dựng dựa trên niềm tin. Rượu được chia sẻ, không bị kiểm soát. Không gian được tôn trọng, quyền riêng tư tuyệt đối. Việc gia nhập chỉ dành cho những người được mời, chính sách gia hạn và tư cách thành viên được thể hiện qua hành vi, không phải địa vị.',
              'Điều này không dành cho tất cả mọi người. Thay vào đó, đây là một câu lạc bộ chỉ dành cho những ai hiểu tại sao sự tiếp cận kiểu này lại hiếm có.',
            ]).map((p, i) => (
              <p key={`${ethosLang}-${i}`} style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                color: '#B2AA98', lineHeight: 1.85, marginBottom: 14, letterSpacing: '0.01em',
                textAlign: 'justify',
              }}>
                {p}
              </p>
            ))}

            <div style={{ textAlign: 'right', marginTop: 32 }}>
              <div style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 13, fontWeight: 500,
                color: '#E5D4C2', letterSpacing: '0.14em', textTransform: 'uppercase',
                marginBottom: 12, marginRight: 24,
              }}>
                {ethosLang === 'en' ? 'Chairman' : 'Chủ tịch'}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/signature (1) (1).png"
                alt="Chairman signature"
                style={{ height: 80, width: 'auto', opacity: 0.7, filter: 'brightness(0) invert(1)', marginRight: -20 }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
