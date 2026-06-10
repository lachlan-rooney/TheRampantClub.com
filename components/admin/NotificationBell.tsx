'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { describeNotification, notificationLink, timeAgo, type OpsNotification } from '@/lib/ops/notifications'

const FAMILY = "'Google Sans Code', monospace"

// In-app notification bell — fixed top-right of /admin. Reads notifications
// scoped to the logged-in user (RLS: recipient = auth.uid()), badge = unread,
// panel lists them with click-through + mark-read. Polls on a light interval.
export default function NotificationBell() {
  const supabase = createBrowserSupabaseClient()
  const router = useRouter()
  const [items, setItems] = useState<OpsNotification[]>([])
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const seenIds = useRef<Set<string>>(new Set())   // ids seen so far — chime only on genuinely new ones
  const primed = useRef(false)                      // first load shouldn't chime for existing unread
  const mutedRef = useRef(false)                    // load() reads this (avoids stale-closure deps)

  // Sound preference (persisted; default on).
  useEffect(() => {
    const m = typeof window !== 'undefined' && localStorage.getItem('trc-notif-mute') === '1'
    setMuted(m); mutedRef.current = m
  }, [])
  const toggleMute = () => setMuted(m => {
    const next = !m; mutedRef.current = next
    try { localStorage.setItem('trc-notif-mute', next ? '1' : '0') } catch { /* ignore */ }
    return next
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
    if (data) {
      const rows = data as OpsNotification[]
      const fresh = rows.filter(n => !n.read && !seenIds.current.has(n.id))
      if (primed.current && fresh.length > 0 && !mutedRef.current) playChime()
      rows.forEach(n => seenIds.current.add(n.id))
      primed.current = true
      setItems(rows)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
    const t = setInterval(load, 45000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [load])

  // close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const unread = items.filter(n => !n.read).length

  const openItem = async (n: OpsNotification) => {
    if (!n.read) {
      await supabase.rpc('ops_mark_notification_read', { p_id: n.id })
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    setOpen(false)
    router.push(notificationLink(n))
  }
  const markAll = async () => {
    await supabase.rpc('ops_mark_all_notifications_read')
    setItems(prev => prev.map(x => ({ ...x, read: true })))
  }

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 200 }}>
      <button onClick={() => setOpen(o => !o)} style={bellBtn} title="Notifications" aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7AB07A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span style={badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div style={panel}>
          <div style={panelHeader}>
            <span style={{ color: '#E5D4C2' }}>Notifications</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={toggleMute} style={muteBtn} title={muted ? 'Sound off — click to enable' : 'Sound on — click to mute'} aria-label={muted ? 'Unmute notifications' : 'Mute notifications'}>{muted ? '🔇' : '🔔'}</button>
              {unread > 0 && <button onClick={markAll} style={markAllBtn}>Mark all read</button>}
            </span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={emptyRow}>Nothing yet.</div>
            ) : items.map(n => (
              <button key={n.id} onClick={() => openItem(n)} style={{ ...itemRow, opacity: n.read ? 0.55 : 1 }}>
                <span style={{ ...dot, background: n.read ? 'transparent' : '#D4B85A' }} />
                <span style={{ flex: 1 }}>
                  <span style={itemText}>{describeNotification(n)}</span>
                  <span style={itemWhen}>{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// A single soft tone (Web Audio, no asset). One ding per new notification batch.
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = 880
    o.connect(g); g.connect(ctx.destination)
    const now = ctx.currentTime
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.14, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
    o.start(now); o.stop(now + 0.32)
    setTimeout(() => { try { ctx.close() } catch { /* ignore */ } }, 500)
  } catch { /* audio blocked / unsupported — silently skip */ }
}

const muteBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0, opacity: 0.85 }
const bellBtn: React.CSSProperties = { position: 'relative', background: 'rgba(229,212,194,0.08)', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 8, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const badge: React.CSSProperties = { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#C27070', color: '#fff', fontFamily: FAMILY, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const panel: React.CSSProperties = { position: 'absolute', top: 46, right: 0, width: 'min(360px, 92vw)', background: '#0A3526', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 10, boxShadow: '0 18px 50px rgba(0,0,0,0.55)', overflow: 'hidden' }
const panelHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(229,212,194,0.10)', fontFamily: FAMILY, fontSize: 12, letterSpacing: '0.04em' }
const markAllBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#B2AA98', fontFamily: FAMILY, fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }
const itemRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(229,212,194,0.06)', padding: '10px 14px', cursor: 'pointer' }
const dot: React.CSSProperties = { flex: '0 0 6px', width: 6, height: 6, borderRadius: '50%', marginTop: 5 }
const itemText: React.CSSProperties = { display: 'block', fontFamily: FAMILY, fontSize: 12, color: '#E5D4C2', lineHeight: 1.45 }
const itemWhen: React.CSSProperties = { display: 'block', fontFamily: FAMILY, fontSize: 9, color: '#7E7864', marginTop: 2 }
const emptyRow: React.CSSProperties = { padding: '24px 14px', textAlign: 'center', fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
