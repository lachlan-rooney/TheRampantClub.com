'use client'

import { useState } from 'react'
import Link from 'next/link'

// TODO: Replace with Supabase query — fetch from `events` table
// const { data: events } = await supabase.from('events').select('*').gte('date', new Date().toISOString()).order('date')
const EVENTS = [
  {
    id: '1',
    titleEn: 'Honey & Whisky',
    titleVn: 'Mật Ong & Whisky',
    date: 'Wednesday, 15 April',
    time: '19:00',
    location: 'Library Bar',
    language: 'VN',
    descriptionEn: 'An evening exploring the natural affinity between Vietnamese highland honey and peated single malts. Three curated pairings, guided tasting notes, and a seasonal cocktail to close.',
    descriptionVn: 'Một buổi tối khám phá sự hòa hợp tự nhiên giữa mật ong vùng cao Việt Nam và các loại single malt hun khói than bùn.',
    pairing: 'Paired with seasonal cocktails',
    capacity: '16 seats',
  },
  {
    id: '2',
    titleEn: 'Shetland Spotlight',
    titleVn: 'Tiêu Điểm Shetland',
    date: 'Tuesday, 22 April',
    time: '19:30',
    location: 'Rampant Room',
    language: 'EN',
    descriptionEn: 'A deep dive into the emerging Shetland distilling scene. We\'ll taste three rare expressions alongside canapés prepared by our kitchen team, with discussion led by a visiting distiller.',
    descriptionVn: 'Một cuộc khám phá sâu vào làng chưng cất mới nổi của Shetland. Chúng ta sẽ thử ba loại whisky hiếm cùng với canapé.',
    pairing: 'Paired with canapés',
    capacity: '12 seats',
  },
]

export default function EventsPage() {
  const [rsvpId, setRsvpId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const handleRsvp = async (eventId: string) => {
    setConfirming(eventId)
    // TODO: Insert into Supabase `rsvps` table
    // const supabase = createBrowserSupabaseClient()
    // const { data: { user } } = await supabase.auth.getUser()
    // await supabase.from('rsvps').insert({ event_id: eventId, user_id: user?.id })
    await new Promise(r => setTimeout(r, 800))
    setRsvpId(eventId)
    setConfirming(null)
  }

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');

        .events-page {
          min-height: 100vh;
          background: #052E20;
          font-family: 'DM Mono', monospace;
          position: relative;
        }

        .events-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px;
        }

        .events-container {
          position: relative; z-index: 2;
          max-width: 680px; margin: 0 auto;
          padding: 100px 24px 80px;
        }

        .events-back {
          font-size: 11px;
          color: #B2AA98;
          opacity: 0.4;
          text-decoration: none;
          letter-spacing: 0.06em;
          transition: opacity 0.2s;
          display: inline-block;
          margin-bottom: 32px;
        }
        .events-back:hover { opacity: 0.7; }

        .events-title {
          font-family: 'Rampant Sans', serif;
          font-size: 28px; font-weight: 600;
          color: #E5D4C2; letter-spacing: 0.02em;
          margin-bottom: 4px;
        }
        .events-subtitle {
          font-size: 11px; color: #B2AA98;
          opacity: 0.4; letter-spacing: 0.06em;
          margin-bottom: 48px;
        }

        .event-card {
          padding: 32px 0;
          border-bottom: 1px solid rgba(229, 212, 194, 0.08);
        }
        .event-card:first-of-type {
          border-top: 1px solid rgba(229, 212, 194, 0.08);
        }

        .event-meta {
          display: flex; flex-wrap: wrap;
          gap: 6px; align-items: center;
          margin-bottom: 14px;
        }
        .event-meta span {
          font-size: 11px; color: #B2AA98;
          opacity: 0.5; letter-spacing: 0.04em;
        }
        .event-meta-dot {
          width: 3px; height: 3px;
          background: #B2AA98; border-radius: 50%;
          opacity: 0.3;
        }

        .event-title-en {
          font-family: 'Rampant Sans', serif;
          font-size: 22px; font-weight: 600;
          color: #E5D4C2; letter-spacing: 0.02em;
          margin-bottom: 4px;
        }
        .event-title-vn {
          font-size: 10px; color: #B2AA98;
          opacity: 0.35; letter-spacing: 0.04em;
          margin-bottom: 16px;
        }

        .event-desc {
          font-size: 12px; line-height: 1.7;
          color: #B2AA98; opacity: 0.65;
          letter-spacing: 0.02em;
          margin-bottom: 8px;
        }
        .event-desc-vn {
          font-size: 11px; line-height: 1.6;
          color: #B2AA98; opacity: 0.5;
          letter-spacing: 0.02em;
          margin-bottom: 20px;
        }

        .event-footer {
          display: flex; align-items: center;
          justify-content: space-between;
          flex-wrap: wrap; gap: 12px;
        }

        .event-pairing {
          font-size: 11px; color: #B2AA98;
          opacity: 0.4; font-style: italic;
          letter-spacing: 0.03em;
        }

        .event-capacity {
          font-size: 10px; color: #B2AA98;
          letter-spacing: 0.06em;
        }

        .event-rsvp {
          padding: 10px 22px;
          background: rgba(229, 212, 194, 0.1);
          color: #E5D4C2;
          border: none; border-radius: 100px;
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .event-rsvp:hover { background: #28483C; }
        .event-rsvp:disabled { opacity: 0.4; cursor: not-allowed; }
        .event-rsvp.confirmed {
          background: #5E6650;
          cursor: default;
        }

        .events-diamond {
          width: 6px; height: 6px;
          background: #E5D4C2;
          transform: rotate(45deg);
          opacity: 0.2;
          margin: 48px auto 0;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #052E20; }
        ::-webkit-scrollbar-thumb { background: rgba(94, 102, 80, 0.2); border-radius: 3px; }

        @media (max-width: 768px) {
          .events-container { padding: 80px 20px 60px; }
          .events-title { font-size: 24px; }
          .event-footer { flex-direction: column; align-items: flex-start; }
        }
      ` }} />

      <div className="events-page">
        <div className="events-grain" />
        <div className="events-container">
          <Link href="/members" className="events-back">&larr; Back</Link>

          <h1 className="events-title">Events</h1>
          <p className="events-subtitle">Sự kiện</p>

          {EVENTS.map((event) => (
            <div key={event.id} className="event-card">
              <div className="event-meta">
                <span>{event.date}</span>
                <div className="event-meta-dot" />
                <span>{event.time}</span>
                <div className="event-meta-dot" />
                <span>{event.location}</span>
                <div className="event-meta-dot" />
                <span>{event.language}</span>
              </div>

              <h2 className="event-title-en">{event.titleEn}</h2>
              <p className="event-title-vn">{event.titleVn}</p>

              <p className="event-desc">{event.descriptionEn}</p>
              <p className="event-desc-vn">{event.descriptionVn}</p>

              <div className="event-footer">
                <div>
                  <span className="event-pairing">{event.pairing}</span>
                  <span className="event-capacity" style={{ marginLeft: 16 }}>{event.capacity}</span>
                </div>
                <button
                  className={`event-rsvp ${rsvpId === event.id ? 'confirmed' : ''}`}
                  onClick={() => handleRsvp(event.id)}
                  disabled={confirming === event.id || rsvpId === event.id}
                >
                  {confirming === event.id ? 'Confirming...' : rsvpId === event.id ? 'Confirmed' : 'RSVP'}
                </button>
              </div>
            </div>
          ))}

          <div className="events-diamond" />
        </div>
      </div>
    </>
  )
}
