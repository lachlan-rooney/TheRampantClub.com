'use client'

export default function OfflinePage() {
  return (
    <div style={{
      background: '#052E20',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ maxWidth: 420, textAlign: 'center', color: '#E5D4C2' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo-mark-cream.png"
          alt="The Rampant Club"
          style={{ width: 100, height: 'auto', display: 'block', margin: '0 auto 32px' }}
        />
        <div style={{
          fontFamily: "'Rampant Sans', 'Playfair Display', serif",
          fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: '#E5D4C2', opacity: 0.5, marginBottom: 24,
        }}>
          The Rampant Club
        </div>
        <h1 style={{
          fontFamily: "'Rampant Sans', 'Playfair Display', serif",
          fontSize: 26, fontWeight: 400, letterSpacing: '0.12em',
          textTransform: 'uppercase', margin: '0 0 8px', lineHeight: 1.2, color: '#E5D4C2',
        }}>
          Off the grid
        </h1>
        <p style={{
          fontFamily: "'Google Sans Code', monospace", fontSize: 11,
          color: '#B2AA98', opacity: 0.7, letterSpacing: '0.06em',
          margin: '0 0 32px',
        }}>
          Ngoài Vùng Phủ Sóng
        </p>
        <p style={{
          fontFamily: "'Google Sans Code', monospace", fontSize: 13,
          lineHeight: 1.8, color: '#E5D4C2', opacity: 0.85, margin: '0 0 32px',
        }}>
          No signal at the moment. The club is still here. Reconnect when you can —
          we&rsquo;ll have a glass waiting.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            display: 'inline-block',
            padding: '14px 32px',
            background: '#5E6650',
            color: '#E5D4C2',
            border: '1px solid rgba(229,212,194,0.15)',
            borderRadius: 8,
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 14,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
