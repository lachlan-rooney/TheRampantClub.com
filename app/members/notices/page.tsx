'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Notice } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'

const CATEGORIES = ['all', 'committee', 'fixture', 'general', 'whisky'] as const

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setNotices(data); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? notices : notices.filter(n => n.category === filter)

  return (
    <>
      <NavOverlay variant="members" dark />
      <MemberPage title="The Notice Board" subtitle="Bảng Thông Báo">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32, justifyContent: 'center' }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
                border: filter === c ? 'none' : '1px solid rgba(229,212,194,0.2)',
                background: filter === c ? 'rgba(229,212,194,0.12)' : 'transparent',
                color: filter === c ? '#E5D4C2' : '#B2AA98',
                transition: 'all 0.2s',
              }}
            >
              {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center', fontStyle: 'italic' }}>No notices</p>
        ) : (
          filtered.map(n => (
            <div key={n.id} style={{ padding: '24px 0', borderBottom: '1px solid rgba(229,212,194,0.1)' }}>
              {n.pinned && (
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, color: '#B2AA98', marginBottom: 6 }}>
                  ◆ Pinned
                </div>
              )}
              <h3 style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 17, fontWeight: 600,
                color: '#E5D4C2', marginBottom: 8, margin: 0,
              }}>
                {n.title}
              </h3>
              <p style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                color: '#B2AA98', lineHeight: 1.85, marginBottom: 12, margin: '0 0 12px',
              }}>
                {n.body}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: 'rgba(178,170,152,0.5)' }}>
                  {n.author && `${n.author} · `}{timeAgo(n.created_at)}
                </span>
                <span style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9,
                  background: 'rgba(229,212,194,0.1)', color: '#B2AA98', borderRadius: 20, padding: '2px 10px',
                }}>
                  {n.category}
                </span>
              </div>
            </div>
          ))
        )}
      </MemberPage>
    </>
  )
}
