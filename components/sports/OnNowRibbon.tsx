'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

interface ActiveFixture {
  sport: string
  title: string
  location: string | null
}

// Sliver of red ribbon at the top of the page that appears only when a
// fixture is happening today (within ±6 hours).
export default function OnNowRibbon() {
  const [fixture, setFixture] = useState<ActiveFixture | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - 6 * 3600 * 1000).toISOString()
    const sixHoursAhead = new Date(now.getTime() + 6 * 3600 * 1000).toISOString()
    supabase.from('fixtures')
      .select('sport, title, location, date')
      .gte('date', sixHoursAgo)
      .lte('date', sixHoursAhead)
      .order('date', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length) setFixture(data[0] as ActiveFixture)
      })
  }, [])

  if (!fixture) return null

  return (
    <>
      <style>{`
        @keyframes onnow-pulse {
          0%, 100% { background: #B45656; }
          50%      { background: #D46868; }
        }
        .on-now {
          color: #FFEFE6;
          padding: 8px 18px;
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-align: center;
          animation: onnow-pulse 2.4s ease-in-out infinite;
          font-weight: 600;
        }
        .on-now-dot {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #FFEFE6;
          margin-right: 8px;
          vertical-align: middle;
          box-shadow: 0 0 10px #FFEFE6;
        }
      `}</style>
      <div className="on-now" role="status">
        <span className="on-now-dot" />
        ON NOW &nbsp;·&nbsp; {fixture.title}
        {fixture.location && <span> &nbsp;·&nbsp; {fixture.location}</span>}
      </div>
    </>
  )
}
