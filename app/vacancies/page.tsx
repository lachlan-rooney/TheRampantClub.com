'use client'

import { useEffect, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'

const VACANCIES = [
  { title: 'Coordinateur de Laboratoire', blurb: 'Must be profficient with test tubes, rotary evaporation, culinary science, and the occasional explosion.' },
  { title: 'Urban Beekeeper', blurb: 'Comfortable with heights, Vietnamese summers, and unsolicited stings.' },
  { title: 'Assistant Whisky Librarian', blurb: 'Dewey Decimal not required. Knowing your Imperious from your Imperial a necessity.' },
  { title: 'Vinyl Curator (no digital submissions)', blurb: 'If you have to ask what a B-side is, this isn\'t for you.' },
]

export default function VacanciesPage() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 150) }, [])

  return (
    <>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #E5D4C2 !important; margin: 0; padding: 0; }
      ` }} />

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 40px',
      }}>
        <div style={{
          maxWidth: 560,
          width: '100%',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/Vacancies.svg"
            alt="Vacancies"
            style={{
              display: 'block',
              width: 100,
              height: 'auto',
              margin: '0 auto 32px',
            }}
          />
          <div style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 400,
            color: '#052E20',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}>
            Vacancies
          </div>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 13,
            color: '#7A7462',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 32,
          }}>
            Vị trí tuyển dụng
          </p>

          {/* Diamond */}
          <div style={{
            width: 8, height: 8,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.25,
            margin: '0 auto 32px',
          }} />

          <div style={{ textAlign: 'center' }}>
            {VACANCIES.map((v, i) => (
              <div
                key={i}
                style={{
                  padding: '18px 0',
                  borderBottom: i < VACANCIES.length - 1
                    ? '1px solid rgba(178,170,152,0.25)'
                    : 'none',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 0.5s ease ${0.2 + i * 0.06}s, transform 0.5s ease ${0.2 + i * 0.06}s`,
                }}
              >
                <div style={{
                  fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                  fontSize: 16,
                  fontWeight: 400,
                  color: '#052E20',
                }}>
                  {v.title}
                </div>
                <div style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                  fontSize: 11,
                  fontStyle: 'italic',
                  color: '#7A7462',
                  marginTop: 5,
                  letterSpacing: '0.02em',
                }}>
                  {v.blurb}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            width: 6, height: 6,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.2,
            margin: '48px auto 32px',
          }} />

          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 11,
            color: '#7A7462',
            textAlign: 'center',
            lineHeight: 1.8,
            maxWidth: 560,
            margin: '0 auto',
            letterSpacing: '0.02em',
          }}>
            A sound opinion on Islay vs Speyside is considered an advantage but not a requirement. Interviews are conducted informally and may involve a dram.
          </p>

          <a href="mailto:Oddjobs@TheRampantClub.com" style={{
            display: 'block',
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 11,
            color: '#5E6650',
            letterSpacing: '0.04em',
            textAlign: 'center',
            marginTop: 40,
            opacity: 0.6,
            textDecoration: 'none',
          }}>
            Oddjobs@TheRampantClub.com
          </a>
        </div>
      </div>
    </>
  )
}
