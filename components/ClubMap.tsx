'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const FLOORS = [
  {
    num: 4,
    name: 'The The Rampant Room',
    vn: 'Phòng Nghệ Thuật',
    desc: 'Rotating exhibitions and artist residencies',
    bg: '#28483C',
  },
  {
    num: 3,
    name: 'The Dining Room',
    vn: 'Phòng Nghe Nhạc',
    desc: 'Vinyl-only sound system, no phones permitted',
    bg: '#052E20',
  },
  {
    num: 2,
    name: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    desc: '600+ bottles, members\u2019 lockers, and a working fireplace',
    bg: '#28483C',
  },
  {
    num: 1,
    name: 'The Entrance Hall',
    vn: 'Sảnh Chính',
    desc: 'Reception, post boxes, and the Honour Board',
    bg: '#052E20',
  },
]

export default function ClubMap() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null)
  const floorBandRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const onLegendEnter = useCallback((floorNum: number) => {
    setHoveredFloor(floorNum)
    const idx = FLOORS.findIndex(f => f.num === floorNum)
    const el = floorBandRefs.current[idx]
    if (el) el.style.filter = 'brightness(1.3)'
  }, [])

  const onLegendLeave = useCallback((floorNum: number) => {
    setHoveredFloor(null)
    const idx = FLOORS.findIndex(f => f.num === floorNum)
    const el = floorBandRefs.current[idx]
    if (el) el.style.filter = 'brightness(1)'
  }, [])

  return (
    <div
      ref={sectionRef}
      style={{
        width: '100%',
        background: 'var(--trc-cream, #E5D4C2)',
        padding: '100px 40px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Diamond */}
        <div style={{
          width: 8, height: 8,
          background: 'var(--trc-green-accent, #5E6650)',
          transform: 'rotate(45deg)',
          opacity: 0.25,
          margin: '0 auto 24px',
        }} />

        {/* Title */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 500,
          color: 'var(--trc-green-deep, #052E20)',
          letterSpacing: '0.04em',
          marginBottom: 8,
        }}>
          The Five Floors
        </div>

        {/* Subtitle */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'Google Sans Code', monospace",
          fontSize: 11,
          color: 'var(--trc-cream-dim, #B2AA98)',
          letterSpacing: '0.06em',
          marginBottom: 60,
        }}>
          Năm Tầng
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'flex',
          gap: 64,
          alignItems: 'center',
        }}>
          {/* Left — Building visual */}
          <div style={{
            flex: '0 0 280px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Rooftop line */}
            <div style={{
              height: 1,
              background: 'var(--trc-green-accent, #5E6650)',
              opacity: 0.3,
              marginBottom: 2,
              width: '70%',
              alignSelf: 'center',
            }} />

            {FLOORS.map((floor, i) => (
              <div
                key={floor.num}
                ref={el => { floorBandRefs.current[i] = el }}
                style={{
                  background: floor.bg,
                  height: 80,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: i < FLOORS.length - 1 ? '1px solid var(--trc-cream, #E5D4C2)' : 'none',
                  transition: 'filter 0.25s ease',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(10px)',
                  transitionDelay: `${i * 0.08}s`,
                  transitionProperty: 'opacity, transform, filter',
                  transitionDuration: '0.6s, 0.6s, 0.25s',
                }}
              >
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 32,
                  fontWeight: 600,
                  color: 'var(--trc-cream, #E5D4C2)',
                  opacity: 0.2,
                  letterSpacing: '0.04em',
                  userSelect: 'none',
                }}>
                  {floor.num}
                </span>
              </div>
            ))}

            {/* Ground line */}
            <div style={{
              height: 2,
              background: 'var(--trc-green-deep, #052E20)',
              opacity: 0.15,
              marginTop: 4,
            }} />
          </div>

          {/* Right — Floor legend */}
          <div style={{ flex: 1 }}>
            {FLOORS.map((floor, i) => (
              <div
                key={floor.num}
                onMouseEnter={() => onLegendEnter(floor.num)}
                onMouseLeave={() => onLegendLeave(floor.num)}
                style={{
                  padding: '20px 0',
                  borderBottom: i < FLOORS.length - 1 ? '1px solid rgba(5, 46, 32, 0.08)' : 'none',
                  cursor: 'default',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'opacity 0.6s ease, transform 0.6s ease',
                  transitionDelay: `${i * 0.08 + 0.1}s`,
                }}
              >
                {/* Floor number */}
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 600,
                  color: 'var(--trc-green-deep, #052E20)',
                  opacity: hoveredFloor === floor.num ? 0.6 : 0.3,
                  transition: 'opacity 0.2s ease',
                  marginBottom: 4,
                }}>
                  Floor {floor.num}
                </div>

                {/* Floor name */}
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--trc-green-deep, #052E20)',
                  marginBottom: 3,
                }}>
                  {floor.name}
                </div>

                {/* Vietnamese name */}
                <div style={{
                  fontFamily: "'Google Sans Code', monospace",
                  fontSize: 10,
                  color: 'var(--trc-cream-dim, #B2AA98)',
                  letterSpacing: '0.04em',
                  marginBottom: 6,
                }}>
                  {floor.vn}
                </div>

                {/* Description */}
                <div style={{
                  fontFamily: "'Google Sans Code', monospace",
                  fontSize: 12,
                  color: 'var(--trc-green-accent, #5E6650)',
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

      {/* Mobile styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1023px) {
          .club-map-cols { flex-direction: column !important; }
        }
      `}} />
    </div>
  )
}
