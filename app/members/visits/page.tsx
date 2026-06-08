'use client'

import { useEffect, useState } from 'react'
import MemberPage from '@/components/MemberPage'

// A member's own visit history — member-own via /api/members/visits (session →
// member_no). A tasteful record (date · space), not raw rows.

interface Visit { visit_id: string; visit_date: string; space: string | null; duration_min: number | null }
const FAMILY = "'Google Sans Code', 'DM Mono', monospace"

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
}
function fmtDuration(min: number | null) {
  if (!min || min <= 0) return null
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

export default function MyVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/members/visits', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setVisits(d.visits || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <MemberPage title="Your Visits" subtitle="Những Lần Ghé Thăm">
      {loading ? (
        <p style={muted}>Loading…</p>
      ) : visits.length === 0 ? (
        <p style={muted}>No visits recorded yet. We look forward to welcoming you.</p>
      ) : (
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          {visits.map(v => {
            const dur = fmtDuration(v.duration_min)
            return (
              <div key={v.visit_id} style={row}>
                <div style={dateText}>{fmtDate(v.visit_date)}</div>
                <div style={metaText}>{[v.space, dur].filter(Boolean).join(' · ') || 'A visit to the club'}</div>
              </div>
            )
          })}
        </div>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, textAlign: 'center' }
const row: React.CSSProperties = { padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)' }
const dateText: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 3 }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em' }
