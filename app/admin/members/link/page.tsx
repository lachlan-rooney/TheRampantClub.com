'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// LINKING ACCOUNTS TO MEMBERSHIPS — used six times this week, twice a year after.
// ───────────────────────────────────────────────────────────────────────────
// The whole design problem is that the WRONG pair is the worst outcome in this
// system: two members with the same surname, or a Vietnamese name order that
// differs between the account and the roster, and somebody opens another
// member's dossier — their visits, their palate, their spend.
//
// So the mistake has to be visible BEFORE it is made, not after: every account
// shows the email it signs in with and when it was last used; every member
// shows their tier, join date and the email on the roster. The confirmation
// puts the two side by side and asks about the thing most likely to be wrong.
// And it is reversible in one click.
const MONO = "'Google Sans Code', monospace"
const SERIF = "'Rampant Sans', serif"

interface Account { id: string; email: string | null; created_at: string
  last_sign_in_at: string | null; is_admin: boolean; member_no: string | null }
interface Member { member_no: string; full_name: string; nickname: string | null
  tier: string | null; status: string | null; join_date: string | null; email: string | null }

const d = (s: string | null) => s ? new Date(s).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function LinkPage() {
  const { t } = useLang()
  const [data, setData] = useState<{ unlinked: Account[]; linked: Account[]
    memberless: Member[]; members: Member[] } | null>(null)
  const [acc, setAcc] = useState<Account | null>(null)
  const [mem, setMem] = useState<Member | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    fetch('/api/admin/member-link', { cache: 'no-store' }).then(r => r.json())
      .then(setData).catch(() => {})
  }, [])
  useEffect(load, [load])

  const link = async () => {
    if (!acc || !mem) return
    setBusy(true); setMsg(null)
    const r = await fetch('/api/admin/member-link', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: acc.id, member_no: mem.member_no }) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? t('Linked.', 'Đã liên kết.') : (j.error || t('Could not link.', 'Không thể liên kết.')))
    if (r.ok) { setAcc(null); setMem(null); load() }
    setBusy(false)
  }
  const unlink = async (id: string) => {
    setBusy(true)
    await fetch(`/api/admin/member-link?account=${id}`, { method: 'DELETE' })
    load(); setBusy(false); setMsg(t('Unlinked.', 'Đã huỷ liên kết.'))
  }

  if (!data) return null
  const memberOf = (no: string | null) => data.members.find(m => m.member_no === no)
  const shown = data.memberless.filter(m =>
    !q.trim() || `${m.full_name} ${m.member_no} ${m.nickname || ''}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#E5D4C2' }}>
        {t('Accounts and memberships', 'Tài khoản và tư cách hội viên')}
      </h1>
      <p style={meta}>
        {t('An account signs in. A membership is the person. Until they are linked, that account has no visits, no palate and cannot post in The Snug.',
           'Tài khoản dùng để đăng nhập. Tư cách hội viên là con người. Chưa liên kết thì tài khoản đó không có lịch sử ghé, không có hồ sơ khẩu vị và không đăng được trong The Snug.')}
      </p>
      {msg && <div style={warn}>{msg}</div>}

      {data.unlinked.length === 0 && (
        <div style={{ ...card, marginTop: 14, borderColor: 'rgba(122,176,122,0.4)' }}>
          <div style={{ ...meta, color: '#7AB07A' }}>
            {t('Every account is linked to a membership.', 'Mọi tài khoản đều đã liên kết với một hội viên.')}
          </div>
        </div>
      )}

      {/* ── THE QUEUE ────────────────────────────────────────────────── */}
      {data.unlinked.length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={label}>
            {t('Accounts with no membership', 'Tài khoản chưa có hội viên')} · {data.unlinked.length}
          </div>
          {data.unlinked.map(a => (
            <button key={a.id} onClick={() => setAcc(a)}
              style={{ ...row, ...(acc?.id === a.id ? rowOn : null) }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#E5D4C2' }}>{a.email || a.id.slice(0, 8)}</div>
                <div style={meta}>
                  {t('created', 'tạo')} {d(a.created_at)} ·{' '}
                  {a.last_sign_in_at
                    ? `${t('last in', 'lần cuối')} ${d(a.last_sign_in_at)}`
                    : t('never signed in', 'chưa đăng nhập')}
                  {a.is_admin && <span style={{ color: '#D4B85A' }}> · {t('staff', 'nhân viên')}</span>}
                </div>
              </div>
              {acc?.id === a.id && <span style={{ ...meta, color: '#D4B85A' }}>{t('picked', 'đã chọn')}</span>}
            </button>
          ))}
          {data.unlinked.some(a => a.is_admin) && (
            <div style={{ ...meta, marginTop: 8, opacity: .85 }}>
              {t('A staff account does not need a membership — admin pages never check for one. Only link a staff account if that person is also a member.',
                 'Tài khoản nhân viên không cần hội viên — trang quản trị không kiểm tra. Chỉ liên kết nếu người đó cũng là hội viên.')}
            </div>
          )}
        </div>
      )}

      {/* ── THE OTHER HALF ───────────────────────────────────────────── */}
      {acc && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={label}>{t('Link to which member?', 'Liên kết với hội viên nào?')} · {shown.length}</div>
          <input style={input} value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('Search name or number', 'Tìm tên hoặc số hội viên')} />
          <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
            {shown.map(m => (
              <button key={m.member_no} onClick={() => setMem(m)}
                style={{ ...row, ...(mem?.member_no === m.member_no ? rowOn : null) }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#E5D4C2' }}>
                    {m.full_name}{m.nickname ? ` (${m.nickname})` : ''}
                  </div>
                  {/* Everything that makes a wrong pair visible before it is made. */}
                  <div style={meta}>
                    {m.member_no} · {m.tier || '—'} · {t('joined', 'gia nhập')} {d(m.join_date)}
                    {m.email ? ` · ${m.email}` : ` · ${t('no email on the roster', 'chưa có email trong danh sách')}`}
                  </div>
                </div>
              </button>
            ))}
            {shown.length === 0 && <div style={meta}>
              {t('Every membership already has an account.', 'Mọi hội viên đều đã có tài khoản.')}</div>}
          </div>
        </div>
      )}

      {/* ── CONFIRM, SIDE BY SIDE ────────────────────────────────────── */}
      {acc && mem && (
        <div style={{ ...card, marginTop: 12, borderColor: 'rgba(212,184,90,0.45)' }}>
          <div style={label}>{t('Check before linking', 'Kiểm tra trước khi liên kết')}</div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <div style={meta}>{t('This account', 'Tài khoản này')}</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: '#E5D4C2' }}>{acc.email}</div>
            </div>
            <div>
              <div style={meta}>{t('becomes this member', 'sẽ là hội viên này')}</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: '#E5D4C2' }}>
                {mem.full_name} · {mem.member_no}
              </div>
            </div>
          </div>
          {/* The single question most likely to catch the mistake. */}
          <div style={{ ...meta, marginTop: 12, color: '#D4B85A' }}>
            {mem.email && acc.email && mem.email.toLowerCase() !== acc.email.toLowerCase()
              ? t(`The roster has a different email for this member (${mem.email}). Make sure this is the same person.`,
                  `Danh sách ghi email khác cho hội viên này (${mem.email}). Hãy chắc chắn đây là cùng một người.`)
              : t('This account will see this member’s visits, palate, bookings and messages.',
                  'Tài khoản này sẽ thấy lịch sử ghé, khẩu vị, đặt chỗ và tin nhắn của hội viên đó.')}
          </div>
          <div style={{ marginTop: 14 }}>
            <button disabled={busy} onClick={link} style={{ ...btn, borderColor: '#7AB07A', color: '#7AB07A' }}>
              {busy ? '…' : t('Link them', 'Liên kết')}
            </button>
            <button onClick={() => { setAcc(null); setMem(null) }} style={{ ...btn, marginLeft: 8 }}>
              {t('Cancel', 'Huỷ')}
            </button>
          </div>
        </div>
      )}

      {/* ── EXISTING LINKS, reversible ───────────────────────────────── */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={label}>{t('Linked', 'Đã liên kết')} · {data.linked.length}</div>
        {data.linked.map(a => {
          const m = memberOf(a.member_no)
          return (
            <div key={a.id} style={{ ...row, cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#E5D4C2' }}>
                  {m?.full_name || a.member_no} <span style={{ opacity: .6 }}>· {a.member_no}</span>
                </div>
                <div style={meta}>{a.email} · {a.last_sign_in_at
                  ? `${t('last in', 'lần cuối')} ${d(a.last_sign_in_at)}`
                  : t('never signed in', 'chưa đăng nhập')}</div>
              </div>
              <button disabled={busy} onClick={() => unlink(a.id)} style={mini}>{t('Unlink', 'Huỷ')}</button>
            </div>
          )
        })}
        {data.linked.length === 0 && <div style={meta}>{t('Nothing linked yet.', 'Chưa có liên kết nào.')}</div>}
      </div>

      {data.memberless.length > 0 && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={label}>{t('Members with no account', 'Hội viên chưa có tài khoản')} · {data.memberless.length}</div>
          <div style={meta}>
            {t('These people cannot sign in at all. An account has to be created for them first.',
               'Những người này chưa thể đăng nhập. Cần tạo tài khoản cho họ trước.')}
          </div>
          {data.memberless.map(m => (
            <div key={m.member_no} style={{ ...row, cursor: 'default' }}>
              <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#B2AA98' }}>
                {m.full_name} · {m.member_no} · {m.tier || '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 18 }}><Link href="/admin" style={ghost}>← {t('Admin', 'Quản trị')}</Link></div>
    </>
  )
}

const meta: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', lineHeight: 1.7 }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 8 }
const card: React.CSSProperties = { padding: '14px 16px', borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)' }
const row: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: '11px 8px', background: 'none', border: 'none', borderBottom: '1px solid rgba(229,212,194,0.07)', cursor: 'pointer', minHeight: 44 }
const rowOn: React.CSSProperties = { background: 'rgba(229,212,194,0.07)', borderRadius: 6 }
const btn: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, padding: '10px 16px', borderRadius: 6, border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer' }
const mini: React.CSSProperties = { ...btn, fontSize: 10, padding: '6px 11px' }
const ghost: React.CSSProperties = { ...btn, textDecoration: 'none', display: 'inline-block' }
const input: React.CSSProperties = { width: '100%', fontFamily: MONO, fontSize: 12.5, padding: '10px 12px', borderRadius: 7, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const warn: React.CSSProperties = { ...meta, color: '#D4B85A', marginTop: 10, padding: '9px 12px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
