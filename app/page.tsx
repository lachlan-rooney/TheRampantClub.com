'use client'

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'
import LiveTicker from '@/components/LiveTicker'
import TonightPanel from '@/components/TonightPanel'
import Spotlight from '@/components/Spotlight'
import useEasterEggs from '@/hooks/useEasterEggs'
import Link from 'next/link'

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
  marginLeft: number
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
  { title: 'Our Scottish Castle', desc: 'Members enjoy exclusive discounts on accommodation, fishing, shooting, golf, and dining at our sister castle in the Scottish Highlands, slated to open in 2027, will be home to an exclusive Rampant Club satellite outpost.' },
  { title: 'The Rampant Club Apartment', desc: 'Complimentary stays in Huntly, Scotland, furnished with cask samples for members to enjoy. Perfect for those visiting Speyside.' },
  { title: 'Reciprocal Club Access', desc: 'Bespoke access to a vetted global network of premier private clubs in London, New York, Tokyo, and Singapore.' },
  { title: 'Luxury Transport', desc: 'Complimentary GF VIP chauffeur service, plus airport fast-track and private car transfer for out-of-town members.' },
  { title: 'Events & Networking', desc: 'Highland Games, golf tournaments, round table events, business brunches, and private dinners.' },
]

const FLOORS = [
  { num: 5, name: 'Source & Origin Lab', vn: 'Phòng Thí Nghiệm', desc: 'Our in-house culinary innovation lab, bringing cutting-edge beverage experiences exclusively to members.' },
  { num: 4, name: 'The Rampant Room', vn: 'Phòng Rampant', desc: 'A world-class bottle-share room of global whiskies, enjoyed at your leisure with guests and fellow members. Private lockers available.' },
  { num: 3, name: 'The Dining Room', vn: 'Phòng Ăn Riêng', desc: 'The ultimate discreet city-centre room for meetings, birthday soir\u00e9es, private dinners, and intimate gatherings.' },
  { num: 2, name: 'The Studio', vn: 'Phòng Nghệ Thuật', desc: 'A quarterly rotating, curated sensory art space \u2014 interact with, touch, hear, taste, and smell immersive installations.' },
  { num: 1, name: 'The Library Bar', vn: 'Quầy Bar Thư Viện', desc: 'Your private cocktail bar. Seasonal cocktails, vintage spirits, curated books and games, with resident musicians and DJs.' },
]

// `short` is the name set large; `meta` is the one fact that tells the three
// apart at a glance, taken from the description rather than added to it.
const TIERS = [
  {
    name: 'The Legacy Membership',
    short: 'Legacy',
    meta: 'The Legacy Membership \u00b7 Established',
    desc: 'For established individuals shaping their communities. Full use of the Club and its shared resources, balanced through mutual consideration rather than formal limits.',
  },
  {
    name: 'The Pioneer Membership',
    short: 'Pioneer',
    meta: 'The Pioneer Membership \u00b7 Under 33',
    desc: 'For emerging leaders and rising creatives under 33. Full access to all areas, events, and member privileges at a preferential rate designed to nurture the next generation.',
  },
  {
    name: 'The Corporate Membership',
    short: 'Corporate',
    meta: 'The Corporate Membership \u00b7 Three seats',
    desc: 'Three nominated representative seats per company. Access to all spaces, events, and networking opportunities \u2014 ideal for hosting, relationship-building, and representation.',
  },
]

// ─── Draggable Image Component ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// THE GOLF DAY FILM — plays when it reaches you, muted.
// ───────────────────────────────────────────────────────────────────────────
// MUTED IS NOT A COMPROMISE, IT IS THE ONLY THING THAT WORKS: every browser
// blocks autoplay with sound, and an unmuted autoplay does not play quietly —
// it does not play at all, which reads as broken rather than silent.
//
// And not on page LOAD. This sits well below the fold, after the hero, the
// benefits and the Tonight panel. Starting it on load means streaming video at
// someone who never scrolls this far, and anyone who does arrive has missed the
// opening. So it starts when it comes INTO VIEW, and pauses when it leaves
// rather than playing on behind the footer.
function GolfFilm() {
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [armed, setArmed] = useState(false)   // only load YouTube once it is near

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setArmed(true)
      } else if (frame.current?.contentWindow) {
        // Leaving the screen: stop, rather than stream behind the rest of the page.
        frame.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*')
      }
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrap} style={{ maxWidth: 900, margin: '28px auto 0', padding: '0 20px' }}>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0,
                    borderRadius: 12, overflow: 'hidden',
                    border: '1px solid rgba(229,212,194,0.12)',
                    boxShadow: '0 24px 56px rgba(0,0,0,0.4)',
                    background: 'rgba(5,46,32,0.6)' }}>
        {armed && (
          <iframe
            ref={frame}
            // playsinline keeps iOS from taking over the whole screen;
            // enablejsapi is what lets us pause it on the way out.
            src="https://www.youtube.com/embed/qaKKajPODfk?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1"
            title="The Rampant Cup — golf day"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        )}
      </div>
    </div>
  )
}

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
    initialAngle: img.noRotate ? 0 : (seededRandom(index * 17 + 11) - 0.5) * 64,
    marginTop: (seededRandom(index * 23 + 5) - 0.5) * 260,
    marginLeft: (seededRandom(index * 41 + 7) - 0.5) * 300,
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
    el.style.marginLeft = `${stateRef.current.marginLeft}px`
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
    el.style.transition = 'none'
    el.style.willChange = 'transform'
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
        decoding="async"
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

// ─── Reciprocal Section ──────────────────────────────────────────
// Four reciprocal-club hubs, each showing the live local time and a
// signature partner club. Decorative dashed flight paths animate in.
const RECIP_CITIES = [
  { name: 'London',    tz: 'Europe/London',    code: 'GMT',  partner: 'Mark’s Club',          country: 'United Kingdom' },
  { name: 'New York',  tz: 'America/New_York', code: 'EST',  partner: 'Soho House',           country: 'United States' },
  { name: 'Tokyo',     tz: 'Asia/Tokyo',       code: 'JST',  partner: 'The Aman Club',        country: 'Japan' },
  { name: 'Singapore', tz: 'Asia/Singapore',   code: 'SGT',  partner: '1880',                 country: 'Singapore' },
]

function ReciprocalSection({ refProp, visible }: {
  refProp: React.Ref<HTMLDivElement>
  visible: boolean
}) {
  const computeTimes = () => RECIP_CITIES.map(c => new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: c.tz,
  }).format(new Date()))
  // Server render uses placeholders to avoid SSR/CSR drift; first client paint hydrates real times.
  const [times, setTimes] = useState<string[]>(() => Array(RECIP_CITIES.length).fill('—'))

  useEffect(() => {
    setTimes(computeTimes())
    const id = setInterval(() => setTimes(computeTimes()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Sort cities left → right, earliest local time first.
  const order = useMemo(() => {
    const minutes = (t: string) => {
      const [h, m] = t.split(':').map(n => parseInt(n, 10))
      if (Number.isNaN(h) || Number.isNaN(m)) return -1
      return h * 60 + m
    }
    return RECIP_CITIES.map((_, i) => i).sort((a, b) => minutes(times[a]) - minutes(times[b]))
  }, [times])

  return (
    <div
      ref={refProp}
      style={{
        padding: '60px 32px 64px',
        background: 'var(--trc-green-deep)',
        position: 'relative',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto', position: 'relative' }}>
        <div
          className="trc-section-diamond"
          style={{ background: 'var(--trc-cream)', opacity: 0.4 }}
        />
        <h2
          className="trc-section-title"
          style={{ color: 'var(--trc-cream)', marginBottom: 8 }}
        >
          A World Beyond Sài Gòn
        </h2>
        <div
          className="trc-section-subtitle"
          style={{ color: 'var(--trc-cream-dim)', opacity: 0.7, marginBottom: 16 }}
        >
          Câu Lạc Bộ Đối Ứng
        </div>
        <p style={{
          fontFamily: "'Google Sans Code', monospace",
          fontSize: 12,
          color: 'var(--trc-cream)',
          opacity: 0.65,
          lineHeight: 1.7,
          textAlign: 'center',
          maxWidth: 560,
          margin: '0 auto 36px',
        }}>
          Bespoke reciprocal access to a vetted network of premier private clubs.
        </p>

        {/* Live city tiles */}
        <div className="recip-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          maxWidth: 880,
          margin: '0 auto',
        }}>
          {order.map((i, displayIdx) => {
            const c = RECIP_CITIES[i]
            return (
            <div
              key={c.name}
              style={{
                padding: '14px 14px 14px',
                background: 'rgba(229,212,194,0.04)',
                border: '1px solid rgba(229,212,194,0.10)',
                borderRadius: 10,
                textAlign: 'center',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity 0.6s ease ${0.2 + displayIdx * 0.1}s, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${0.2 + displayIdx * 0.1}s, background 0.3s, border-color 0.3s, box-shadow 0.4s`,
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background  = 'rgba(229,212,194,0.07)'
                e.currentTarget.style.borderColor = 'rgba(212,184,90,0.4)'
                e.currentTarget.style.boxShadow   = '0 18px 32px rgba(0,0,0,0.32)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background  = 'rgba(229,212,194,0.04)'
                e.currentTarget.style.borderColor = 'rgba(229,212,194,0.10)'
                e.currentTarget.style.boxShadow   = 'none'
              }}
            >
              <div style={{
                fontFamily: "'Rampant Sans', serif",
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--trc-cream)',
                letterSpacing: '0.04em',
                marginBottom: 2,
              }}>
                {c.name}
              </div>
              <div style={{
                fontFamily: "'Google Sans Code', monospace",
                fontSize: 10,
                color: '#D4B85A',
                opacity: 0.7,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                {c.code}
              </div>
              <div style={{
                fontFamily: "'Google Sans Code', monospace",
                fontSize: 16,
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500,
                color: 'var(--trc-cream)',
                letterSpacing: '0.04em',
              }}>
                {times[i]}
              </div>
            </div>
          )})}
        </div>

        <p className="recip-foot" style={{
          fontFamily: "'Google Sans Code', monospace",
          fontSize: 10,
          color: 'var(--trc-cream-dim)',
          opacity: 0.45,
          letterSpacing: '0.06em',
          textAlign: 'center',
          marginTop: 36,
          fontStyle: 'italic',
        }}>
          Featured partner cities shown.
          <span className="recip-foot-break"> </span>
          The full reciprocal list is shared with members upon joining.
        </p>
        <style dangerouslySetInnerHTML={{ __html: `
          @media (max-width: 768px) {
            .recip-foot-break { display: block; height: 0; }
            .recip-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
        ` }} />
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function HomePage() {
  const easterEggs = useEasterEggs()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [images, setImages] = useState<MoodboardImage[]>([])
  const [showGrid, setShowGrid] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [isPhone, setIsPhone] = useState(false)
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
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      setIsPhone(window.innerWidth < 768)
    }
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
        src: '/images/library-bar-opt.png',
        filename: 'library-bar-opt.png',
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
          font-display: block;
        }

        @font-face {
          font-family: 'Google Sans Code';
          src: url('/fonts/GoogleSansCode-VariableFont_wght.ttf') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: block;
        }

        @font-face {
          font-family: 'Google Sans Code';
          src: url('/fonts/GoogleSansCode-Italic-VariableFont_wght.ttf') format('truetype');
          font-weight: 100 900;
          font-style: italic;
          font-display: block;
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
          position: relative;
        }
        .trc-flow.loaded { opacity: 1; }

        /* ── Paper texture overlay — NOT MOUNTED, see the note in the JSX ──
           Halved from 0.045. Measured, this was the LARGEST of the three veils
           on the cream ground, not the tint: of 56 points of total deviation
           from #E5D4C2, the grain accounted for ~22, the night tint ~18 and the
           vignette the remainder. Greyscale noise over a warm cream desaturates
           it directly — warmth (R−B) fell 35 → 28, which is what read as
           "dull" rather than the darkening alone. */
        .trc-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998;
          /* soft-light, NOT normal. Greyscale noise blended normally mixes the
             ground toward grey, which is precisely what desaturated the cream.
             soft-light modulates the luminance underneath and leaves the hue
             alone, so the texture derives its colour from whatever it sits on —
             cream at the top of the page, sage in the Studio band, bottle green
             below — instead of carrying a fixed tint that would suit one ground
             and fight the others. Opacity can go back up because soft-light is
             far gentler than a normal-blend veil at the same number. */
          mix-blend-mode: soft-light;
          /* 0.30 calibrated against the original: the old normal-blend grain at
             0.045 measured 0.61 texture for 53.0 points of colour deviation;
             this measures 0.79 texture for 46.5. More paper, less cost. */
          opacity: 0.30;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 300px;
        }

        /* ── Subtle vignette — NOT MOUNTED, see the note in the JSX ──
           Halved from 0.25. On its own it read as intended, but stacked under
           the night tint's multiply the two compounded and the homepage lost its
           colour — the same sage renders exact on /studio and 31 points darker
           here. Both were halved together; neither was removed. */
        .trc-vignette {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(178, 170, 152, 0.125) 100%);
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

        /* ── The membership card, dropped across the seam ──
           Not a section of its own: it lies ON the page, over the line where
           the hero ends and Member Benefits begins, tilted up to the left.
           Its shadow falls behind it onto the paper, which is what lifts it —
           and it drifts the way the lion does on /studio. The shadow lives on
           the WRAPPER and the tilt on the image, so the light stays put while
           the card turns under it. */
        @keyframes trc-card-land {
          from { opacity: 0; transform: translate(-14px, -42px) scale(1.12) rotate(-5deg); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes trc-card-drift {
          from { transform: rotate(-15deg) translateY(0); }
          to   { transform: rotate(-12deg) translateY(-12px); }
        }
        .trc-card-drop {
          position: absolute; z-index: 3; pointer-events: none;
          left: 2%; top: -190px;
          width: clamp(150px, 15vw, 210px);
          opacity: 0;
          filter: drop-shadow(18px 24px 20px rgba(5, 46, 32, .28))
                  drop-shadow(4px 6px 5px rgba(5, 46, 32, .18));
        }
        .trc-card-drop.is-in { animation: trc-card-land 1s cubic-bezier(.16,.84,.44,1) .15s both; }
        .trc-card-drop img {
          display: block; width: 100%; height: auto;
          transform: rotate(-15deg);
          animation: trc-card-drift 7s ease-in-out infinite alternate;
        }
        @media (max-width: 768px) {
          /* Runs off the left edge a little, clear of the centred title. */
          .trc-card-drop { width: 100px; left: 2px; top: -150px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .trc-card-drop.is-in { animation: none; opacity: 1; }
          .trc-card-drop img { animation: none; }
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
          font-size: 12px; line-height: 1.8;
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

        /* ── Membership, set like /studio ── */
        @keyframes trc-rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        .trc-tiers {
          max-width: 1180px; margin: 0 auto;
          padding: 110px 24px 140px;
          color: var(--trc-green-deep);
        }
        .trc-tiers-rise { opacity: 0; }
        .trc-tiers.is-in .trc-tiers-rise { animation: trc-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        .trc-tiers-rule { height: 1px; background: var(--trc-green-deep); opacity: .15; }
        .trc-tiers-eyebrow {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase;
          opacity: .55; margin: 26px 0 0;
        }
        .trc-tiers-title {
          font-family: 'Rampant Sans', serif; font-weight: 400;
          font-size: clamp(44px, 8vw, 96px); line-height: .98;
          margin: 16px 0 0;
        }
        .trc-tiers-lede {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 14px; line-height: 2; max-width: 560px;
          margin: 26px 0 0;
        }
        .trc-tiers-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 48px; margin-top: 72px;
        }
        .trc-tier-head { display: flex; align-items: center; gap: 14px; }
        .trc-tier-no {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; letter-spacing: .12em; opacity: .6;
        }
        /* A hairline that draws itself across when the tier is hovered —
           the same gesture as the artist tabs on /studio. */
        .trc-tier-line { position: relative; flex: 1; height: 1px; background: rgba(5, 46, 32, .15); overflow: hidden; }
        .trc-tier-line::after {
          content: ''; position: absolute; inset: 0; background: var(--trc-green-deep);
          transform: scaleX(0); transform-origin: left;
          transition: transform .6s cubic-bezier(.16,.84,.44,1);
        }
        .trc-tier:hover .trc-tier-line::after { transform: scaleX(1); }
        .trc-tier-name {
          font-family: 'Rampant Sans', serif;
          font-size: clamp(34px, 3.6vw, 48px); line-height: 1;
          margin-top: 26px;
        }
        .trc-tier-meta {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; opacity: .62; margin-top: 10px;
        }
        .trc-tier-desc {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 12px; line-height: 1.9; opacity: .8;
          margin: 18px 0 0; max-width: 34ch;
        }
        @media (max-width: 900px) {
          .trc-tiers { padding: 72px 20px 96px; }
          .trc-tiers-grid { grid-template-columns: 1fr; gap: 44px; margin-top: 52px; }
          .trc-tier-desc { max-width: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .trc-tiers-rise, .trc-tiers.is-in .trc-tiers-rise { opacity: 1; animation: none; }
          .trc-tier-line::after { transition: none; }
        }

        @media (max-width: 768px) {
          .trc-flow { padding: 4em 1em 5em; gap: 0.4em; }
          .trc-blurb { padding: 40px 20px 0; }
          .trc-section { padding: 40px 16px; }
          .trc-section-title { font-size: 24px; }
          .trc-section-subtitle { font-size: 10px; }
          .trc-benefits-grid {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
          .trc-benefits-glass {
            order: -1;
            margin-bottom: 24px;
          }
          .trc-benefits-left > div:nth-child(odd),
          .trc-benefits-right > div:nth-child(odd) {
            text-align: left !important;
            padding-right: 20% !important;
          }
          .trc-benefits-left > div:nth-child(even),
          .trc-benefits-right > div:nth-child(even) {
            text-align: right !important;
            padding-left: 20% !important;
          }
          .trc-hero-title {
            font-size: 32px !important;
          }
          .trc-hero-illustration {
            margin-left: -235px !important;
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
      {easterEggs}

      {/* ── THE THREE VEILS ARE OFF. ───────────────────────────────────────
          <TimeOfDayTint />, <div className="trc-vignette" /> and
          <div className="trc-grain" /> used to mount here. Between them they
          took this page's ground from its authored #E5D4C2 to rgb(208,196,179)
          — and, more to the point, its warmth (R−B) from 35 to 28, which is why
          it read dull rather than merely dark. Nothing on screen explained why,
          and the tint changed the answer through the day, so the page never
          looked the same twice.

          The homepage now shows plain block colour, like /studio and the admin
          portal: authored colour, nothing on top.

          TO PUT THEM BACK: re-add the three lines above and re-import
          TimeOfDayTint from '@/components/TimeOfDayTint'. The CSS for
          .trc-vignette and .trc-grain is deliberately left in place below, with
          the tuning that was measured, so this is one edit and not a rebuild. */}

      <div className="trc-page" onMouseMove={onMouseMove}>

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
                  fontSize: 10, color: 'rgba(255,0,0,0.5)', fontFamily: 'monospace',
                }}>{i * 200}</div>
              ))}
              {Array.from({ length: 20 }, (_, i) => (
                <div key={`x${i}`} style={{
                  position: 'absolute', top: 4, left: i * 200 + 4,
                  fontSize: 10, color: 'rgba(255,0,0,0.5)', fontFamily: 'monospace',
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
              src="/images/whisky-girl-opt.png"
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
            color: 'var(--trc-green-accent)',
            opacity: 0.7,
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
        <div ref={benefitsSec.ref} className="trc-section" style={{ position: 'relative' }}>
          {/* The membership card in its sleeve, lying across the seam between
              the hero and this section. Decorative, so hidden from screen
              readers; it lands when the section comes into view. */}
          <div className={`trc-card-drop ${benefitsSec.visible ? 'is-in' : ''}`} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/member-card-opt.webp" alt="" />
          </div>
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
              <img src="/images/whisky-swim-opt.png" alt="" style={{ width: 160, height: 'auto' }} />
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

        {/* ══════ 2.5 TONIGHT PANEL ══════ */}
        <div className="trc-section" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <TonightPanel />
          </div>
        </div>

        {/* ══════ 3. THE GOLF DAY ══════════════════════════════════════════
            Replaces the draggable moodboard. That was fed by member uploads and
            had never been used — the empty state read "The walls are bare."
            YouTube, unlisted: frame-src already allows it, so no CSP change, and
            it does not depend on a Drive share that breaks silently when
            somebody tidies a folder. /members/upload and /api/moodboard are left
            in place; nothing else on the site renders them. */}
        <div className="trc-section">
          <div className="trc-section-diamond" />
          <div className="trc-section-title">The Rampant Cup</div>
          <div className="trc-section-subtitle">Ngày Hội Golf</div>
          <GolfFilm />
        </div>

        {/* ══════ 4. THE FIVE FLOORS ══════ */}
        <div ref={floorsSec.ref} className="trc-section">
          <div className="trc-section-diamond" />
          <div className="trc-section-title">The Clubhouse</div>
          <div className="trc-section-subtitle">Năm Tầng</div>

          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'stretch',
            flexWrap: 'wrap',
          }}>
            {/* Building visual */}
            <div style={{
              flex: '0 0 440px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <img
                src="/images/Club Map.svg"
                alt="The Clubhouse — five floors"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  opacity: floorsSec.visible ? 1 : 0,
                  transform: floorsSec.visible ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'opacity 0.8s ease, transform 0.8s ease',
                }}
              />
            </div>

            {/* Floor legend */}
            <div style={{ flex: 1, minWidth: 280, paddingTop: 151, display: isPhone ? 'none' : 'block' }}>
              {FLOORS.map((floor, i) => (
                <div
                  key={floor.num}
                  style={{
                    padding: '8px 0',
                    borderBottom: i < FLOORS.length - 1 ? '1px solid rgba(5, 46, 32, 0.08)' : 'none',
                    opacity: floorsSec.visible ? 1 : 0,
                    transform: floorsSec.visible ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    transitionDelay: `${i * 0.08 + 0.1}s`,
                  }}
                >
                  <div style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--trc-green-deep)',
                    opacity: 0.3,
                    marginBottom: 1,
                  }}>
                    Floor {floor.num}
                  </div>
                  <div style={{
                    fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--trc-green-deep)',
                    marginBottom: 1,
                  }}>
                    {floor.name}
                  </div>
                  <div style={{
                    fontFamily: "'Google Sans Code', monospace",
                    fontSize: 10,
                    color: 'var(--trc-cream-dim)',
                    letterSpacing: '0.04em',
                    marginBottom: 4,
                  }}>
                    {floor.vn}
                  </div>
                  <div style={{
                    fontFamily: "'Google Sans Code', monospace",
                    fontSize: 12,
                    color: 'var(--trc-green-accent)',
                    opacity: 0.7,
                    lineHeight: 1.4,
                  }}>
                    {floor.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════ 4.5 THE STUDIO — an invitation, not a section ══════════════
            Full-bleed SAGE against a page that is bottle green everywhere else.
            That inversion is the whole point: it should read as a door to
            somewhere separate rather than as another band of homepage.

            The bottle is FRAMED, not cut out. Its raster is a glass bottle with
            translucent liquid shot against a blurred painting — the background
            shows through the glass, the warm right edge has almost no
            separation from the warm background, and the base merges into the
            barrel. An automatic cutout haloes, and a haloed cutout is worse
            than no cutout. A frame has neither problem and looks deliberate. */}
        <Link href="/studio" style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{ background: '#B0C18E', color: '#052E20', padding: '72px 24px' }}>
            <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', gap: 34,
                          alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/studio/bottle.jpg" alt="" loading="lazy"
                   style={{ width: 168, height: 240, objectFit: 'cover', flexShrink: 0,
                            borderRadius: '84px 84px 6px 6px', display: 'block',
                            boxShadow: '0 18px 40px rgba(5,46,32,0.22)' }} />
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10.5,
                              letterSpacing: '.18em', textTransform: 'uppercase', opacity: .7 }}>
                  Floor 2 · Phòng Studio
                </div>
                {/* The Studio's own wordmark rather than the words set in the
                    club's face — it is a mark, and the room has one. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/studio/studio-wordmark.png" alt="The Studio"
                     style={{ width: 'min(340px, 62vw)', height: 'auto', display: 'block',
                              margin: '12px 0 14px' }} />
                <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12.5,
                            lineHeight: 1.85, margin: 0, opacity: .85, maxWidth: 430 }}>
                  A quarterly rotating art space. Each exhibition is made with the artist,
                  and each one leaves a whisky behind.
                </p>
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11.5,
                              marginTop: 18, letterSpacing: '.08em' }}>
                  Step inside →
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* ══════ 5. RECIPROCAL ACCESS ══════ */}
        <ReciprocalSection refProp={reciprocalSec.ref} visible={reciprocalSec.visible} />

        {/* ══════ 6. LION PAINTING ══════ */}
        <div
          ref={blurbRef}
          className={`trc-blurb ${blurbVisible ? 'visible' : ''}`}
          style={{ textAlign: 'center' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/castle-opt.png"
            alt="The Rampant Club"
            style={{
              display: 'block', maxWidth: 500, width: '100%', height: 'auto',
              margin: '0 auto', opacity: 0.9, borderRadius: 12,
            }}
          />
        </div>

        {/* ══════ 7. MEMBERSHIP TIERS ══════
            Set the way /studio sets itself: left-aligned, one large statement,
            mono for the reading, hairlines instead of boxes. */}
        <div ref={tiersSec.ref} id="tiers" className={`trc-tiers ${tiersSec.visible ? 'is-in' : ''}`}>
          <div className="trc-tiers-rule" />
          <div className="trc-tiers-eyebrow trc-tiers-rise">Membership · Thành Viên</div>
          <h2 className="trc-tiers-title trc-tiers-rise" style={{ animationDelay: '.06s' }}>By Invitation</h2>
          <p className="trc-tiers-lede trc-tiers-rise" style={{ animationDelay: '.14s' }}>
            Membership is by invitation or referral only. We do not accept applications.
          </p>

          <div className="trc-tiers-grid">
            {TIERS.map((tier, i) => (
              <div key={tier.name} className="trc-tier trc-tiers-rise" style={{ animationDelay: `${0.24 + i * 0.1}s` }}>
                <div className="trc-tier-head">
                  <span className="trc-tier-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="trc-tier-line" />
                </div>
                <div className="trc-tier-name">{tier.short}</div>
                <div className="trc-tier-meta">{tier.meta}</div>
                <p className="trc-tier-desc">{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ CLUB ETHOS MODAL ══════ */}
      {ethosOpen && <style dangerouslySetInnerHTML={{ __html: 'body { overflow: hidden !important; }' }} />}
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
              maxWidth: 760, width: 'calc(100% - 48px)', padding: '32px 28px 28px',
              background: '#052E20',
              borderRadius: 8,
              position: 'relative',
              maxHeight: '85vh', overflowY: 'auto',
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
                fontFamily: "'Rampant Sans', serif", fontSize: 12, fontWeight: 500,
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
