'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'
import LiveTicker from '@/components/LiveTicker'
import TonightPanel from '@/components/TonightPanel'
import ReciprocalClocks from '@/components/ReciprocalClocks'
import HomeHero from '@/components/home/HomeHero'
import { tenseOf, dateRange } from '@/components/StudioIndex'
import MemberBenefits from '@/components/home/MemberBenefits'
import Clubhouse from '@/components/home/Clubhouse'
import StudioInvite from '@/components/home/StudioInvite'
import EthosLetter from '@/components/home/EthosLetter'
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


// `short` is the name set large; the description carries the rest.
const TIERS = [
  {
    name: 'The Legacy Membership',
    short: 'Legacy',
    desc: 'For established individuals shaping their communities. Full use of the Club and its shared resources, balanced through mutual consideration rather than formal limits.',
  },
  {
    name: 'The Pioneer Membership',
    short: 'Pioneer',
    desc: 'For emerging leaders and rising creatives under 33. Full access to all areas, events, and member privileges at a preferential rate designed to nurture the next generation.',
  },
  {
    name: 'The Corporate Membership',
    short: 'Corporate',
    desc: 'Three nominated representative seats per company. Access to all spaces, events, and networking opportunities \u2014 ideal for hosting, relationship-building, and representation.',
  },
]

// The Cup's dates as DATES, so the eyebrow says "Played" by itself once they
// pass — the same rule as the sports page.
const CUP = { opens: '2026-08-14', closes: '2026-08-15' }
const cupTense = (() => { const t = tenseOf(CUP.opens, CUP.closes); return t === 'Past' ? 'Played' : t })()

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
    <div ref={wrap} style={{ marginTop: 40 }}>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0,
                    borderRadius: 14, overflow: 'hidden',
                    boxShadow: '0 24px 60px rgba(5,46,32,0.24)',
                    background: '#0B1A14' }}>
        {/* The Cup's own poster sits underneath until the film arrives — so
            there is never an empty grey box, even where YouTube is blocked. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/cup/cup-course.webp" alt="" aria-hidden="true" loading="lazy"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 38%' }} />
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

// ─── Main Page ───────────────────────────────────────────────────
export default function HomePage() {
  const easterEggs = useEasterEggs()
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [images, setImages] = useState<MoodboardImage[]>([])
  const [showGrid, setShowGrid] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [blurbVisible, setBlurbVisible] = useState(false)
  const [ethosOpen, setEthosOpen] = useState(false)
  const closeEthos = useCallback(() => setEthosOpen(false), [])
  const blurbRef = useRef<HTMLDivElement>(null)
  const maxZRef = useRef(50)

  const multiplier = isMobile ? 2 : 6

  // Scroll-reveal hooks for new sections
  const tiersSec = useScrollReveal(0.1)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
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
          /* clip, not hidden: hidden makes this a scroll container, and
             position: sticky inside it (the Clubhouse drawing) stops sticking. */
          overflow-x: clip;
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

        /* ── The Rampant Cup ── */
        .trc-cup { max-width: 1180px; margin: 0 auto; padding: 120px 24px 40px; color: var(--trc-green-deep); }
        .trc-cup-head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
        .trc-cup-head .trc-tiers-eyebrow { margin-top: 0; }
        .trc-cup-ink { position: relative; width: clamp(120px, 16vw, 220px); height: clamp(110px, 13vw, 170px); }
        .trc-cup-ink img { position: absolute; height: auto; filter: drop-shadow(5px 8px 8px rgba(5,46,32,.12));
                           transition: transform .6s cubic-bezier(.16,.84,.44,1); }
        .trc-cup-flag { width: 46%; left: 6%; bottom: 0; transform: rotate(-6deg); }
        .trc-cup-club { width: 44%; right: 4%; bottom: 4%; transform: rotate(14deg); }
        .trc-cup-head:hover .trc-cup-flag { transform: rotate(-12deg) translateY(-4px); }
        .trc-cup-head:hover .trc-cup-club { transform: rotate(26deg) translateY(-6px); }
        /* the /studio call to action: mono, underlined, the arrow slides */
        .trc-cta { display: inline-block; margin-top: 26px; color: var(--trc-green-deep); text-decoration: none;
                   font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px; letter-spacing: .12em;
                   text-transform: uppercase; border-bottom: 1px solid var(--trc-green-deep); padding-bottom: 6px; }
        .trc-go { display: inline-block; transition: transform .35s ease; }
        .trc-cta:hover .trc-go { transform: translateX(7px); }
        @media (max-width: 600px) {
          .trc-cup { padding: 80px 20px 24px; }
          .trc-cup-head { grid-template-columns: 1fr; }
          .trc-cup-ink { position: absolute; right: 16px; margin-top: -8px; width: 110px; height: 96px; }
          .trc-cup-head { position: relative; }
        }

        /* ── Membership, set like /studio ── */
        @keyframes trc-rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        .trc-tiers {
          max-width: 1180px; margin: 0 auto;
          padding: 28px 24px 140px;   /* tucked under the faded image, as on /studio */
          color: var(--trc-green-deep);
        }
        .trc-tiers-rise { opacity: 0; }
        .trc-tiers.is-in .trc-tiers-rise { animation: trc-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        .trc-tiers-head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
        .trc-tiers-lion { width: clamp(96px, 11vw, 150px); height: auto; margin-right: 4%;
                          transform: rotate(4deg); filter: drop-shadow(6px 10px 10px rgba(5,46,32,.14));
                          transition: transform .6s cubic-bezier(.16,.84,.44,1); }
        .trc-tiers-head:hover .trc-tiers-lion { transform: rotate(-3deg) translateY(-6px); }
        @media (max-width: 600px) {
          .trc-tiers-head { grid-template-columns: 1fr; }
          .trc-tiers-lion { width: 96px; justify-self: end; margin: -10px 0 0; order: -1; }
          .trc-tiers .trc-cta { font-size: 11px; letter-spacing: .06em; }
        }
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
        .trc-tier-desc {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 12px; line-height: 1.9; opacity: .8;
          margin: 18px 0 0; max-width: 34ch;
        }
        @media (max-width: 900px) {
          .trc-tiers { padding: 20px 20px 96px; }
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

        {/* ══════ 1. HERO — components/home/HomeHero ══════ */}
        <HomeHero onEthos={() => setEthosOpen(true)} />

        {/* ══════ 2. MEMBER BENEFITS (+ the card across the seam) ══════ */}
        <MemberBenefits />

        {/* ══════ 2.5 TONIGHT — the departures board ══════
            Full content width, not a small card in the middle of the page. */}
        <div className="trc-section" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <TonightPanel />
        </div>

        {/* ══════ 3. THE GOLF DAY ══════════════════════════════════════════
            Replaces the draggable moodboard. That was fed by member uploads and
            had never been used — the empty state read "The walls are bare."
            YouTube, unlisted: frame-src already allows it, so no CSP change, and
            it does not depend on a Drive share that breaks silently when
            somebody tidies a folder. /members/upload and /api/moodboard are left
            in place; nothing else on the site renders them. */}
        <div className="trc-cup">
          <div className="trc-cup-head">
            <div>
              <div className="trc-tiers-eyebrow">
                {['Ngày Hội Golf', cupTense, dateRange(CUP.opens, CUP.closes)].filter(Boolean).join('  ·  ')}
              </div>
              <h2 className="trc-tiers-title">The Rampant Cup</h2>
              <Link href="/sports#golf" className="trc-cta">The Cup at The Sports Club <span className="trc-go">→</span></Link>
            </div>
            <div className="trc-cup-ink" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/ink/golf-flag.webp" alt="" className="trc-cup-flag" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/ink/golf-club.webp" alt="" className="trc-cup-club" />
            </div>
          </div>
          <GolfFilm />
        </div>

        {/* ══════ 4. THE CLUBHOUSE — components/home/Clubhouse (interim, until the
            owner's stacked, clickable SVG building arrives) ══════ */}
        <Clubhouse />

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
        <StudioInvite />

        {/* ══════ 5. RECIPROCAL ACCESS ══════ */}
        <ReciprocalClocks />

        {/* ══════ 6. THE CLUB'S COLOURS — full bleed ══════
            Unboxed and edge to edge, fading into the cream below exactly the
            way the artist heroes fade into the sage on /studio: the same
            height rule and the same gradient stop, only the ground differs. */}
        <div
          ref={blurbRef}
          style={{
            position: 'relative', width: '100%', height: 'min(70vh, 660px)', overflow: 'hidden',
            opacity: blurbVisible ? 1 : 0, transition: 'opacity 1s ease',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* DC500693, full resolution (7008px original → 2400/1400 webp), so the
              full-bleed band is sharp on a large screen. Positioned low so the
              collar's lettering sits above the fade rather than in it. */}
          <img
            src="/images/club-bottle-bag-2400.webp"
            srcSet="/images/club-bottle-bag-1400.webp 1400w, /images/club-bottle-bag-2400.webp 2400w"
            sizes="100vw"
            alt="The Rampant Club"
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                     objectPosition: '50% 68%', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, transparent 58%, var(--trc-cream) 100%)' }} />
        </div>

        {/* ══════ 7. MEMBERSHIP TIERS ══════
            Set the way /studio sets itself: left-aligned, one large statement,
            mono for the reading, hairlines instead of boxes. */}
        <div ref={tiersSec.ref} id="tiers" className={`trc-tiers ${tiersSec.visible ? 'is-in' : ''}`}>
          <div className="trc-tiers-head">
            <div>
              <div className="trc-tiers-eyebrow trc-tiers-rise">Membership · Thành Viên</div>
              <h2 className="trc-tiers-title trc-tiers-rise" style={{ animationDelay: '.06s' }}>By Invitation</h2>
              <p className="trc-tiers-lede trc-tiers-rise" style={{ animationDelay: '.14s' }}>
                Membership is by invitation or referral only. We do not accept applications.
              </p>
              {/* Somewhere to go from here: the club's own membership address,
                  the one the footer already carries. */}
              <a href="mailto:membership@therampantclub.com" className="trc-cta trc-tiers-rise" style={{ animationDelay: '.2s' }}>
                Enquiries · membership@therampantclub.com <span className="trc-go">→</span>
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ink/lion-suit.webp" alt="" aria-hidden="true" className="trc-tiers-lion trc-tiers-rise"
                 style={{ animationDelay: '.24s' }} />
          </div>

          <div className="trc-tiers-grid">
            {TIERS.map((tier, i) => (
              <div key={tier.name} className="trc-tier trc-tiers-rise" style={{ animationDelay: `${0.24 + i * 0.1}s` }}>
                <div className="trc-tier-head">
                  <span className="trc-tier-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="trc-tier-line" />
                </div>
                <div className="trc-tier-name">{tier.short}</div>
                <p className="trc-tier-desc">{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ CLUB ETHOS — the Chairman's letter (components/home/EthosLetter) ══════ */}
      <EthosLetter open={ethosOpen} onClose={closeEthos} />
    </>
  )
}
