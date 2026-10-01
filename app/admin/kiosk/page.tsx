'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/admin-lang'

// Admin kiosk management: enrol/revoke tablets (the device boundary), set staff
// PINs (the picker attribution), and hold each staff member's EMAIL ADDRESS
// (2026-10-01) so the morning board digest has somewhere to go.
//
// The address sits here rather than on Logins & Admin Rights because that page
// is a list of SEATS — accounts that sign in — and most of this list has none
// on purpose: floor staff have PINs, not seats. A PIN and an address are the
// same kind of thing for the same people: how the club reaches somebody, and
// how it knows who did what, without giving them a login. Same screen, same
// list of people, one more column. The nav entry says so: "Kiosk & Staff PINs".

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Device { id: string; label: string; room: string | null; purpose?: 'room' | 'door'; status: string; enrolled_at: string | null; last_seen_at: string | null; pair_code: string | null }
interface Staff { id: string; display_name: string; role_title: string | null; active: boolean; has_pin: boolean; email: string | null; email_reminders: boolean; last_digest_on: string | null }
interface MemberPin { member_no: string; full_name: string; has_pin: boolean; set_at: string | null; fails_15m: number; fails_24h: number; locked: boolean; hard_locked: boolean }

export default function AdminKiosk() {
  const { t } = useLang()
  const [devices, setDevices] = useState<Device[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [label, setLabel] = useState('')
  const [rooms, setRooms] = useState<string[]>([])
  const [room, setRoom] = useState('')
  // THE DOOR (2026-09-14): a device is a room tablet or the guest sign-in iPad at
  // the entrance. doorReady is false until db/guest_signin.sql has run.
  const [purpose, setPurpose] = useState<'room' | 'door'>('room')
  const [doorReady, setDoorReady] = useState(false)
  const [mpins, setMpins] = useState<MemberPin[]>([])
  const [pinFor, setPinFor] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')
  // The address being edited, and what is typed into it. One at a time: a list
  // of fifteen open text boxes is fifteen ways to save the wrong row.
  const [mailFor, setMailFor] = useState<Staff | null>(null)
  const [mail, setMail] = useState('')
  const [emailsReady, setEmailsReady] = useState(true)
  const [sending, setSending] = useState(false)
  // Adding somebody to the team. There was no way to do this at all until
  // 2026-10-01 — every one of the fifteen people on the list had been put there
  // by hand in the database.
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newRota, setNewRota] = useState(true)
  const [showStoodDown, setShowStoodDown] = useState(false)

  const load = useCallback(async () => {
    const [d, s, m] = await Promise.all([
      fetch('/api/admin/kiosk-devices'), fetch('/api/admin/kiosk-devices/pin'),
      fetch('/api/admin/kiosk-devices/member-pins'),
    ])
    if (d.ok) { const j = await d.json(); setDevices(j.devices || []); setRooms(j.rooms || []); setDoorReady(j.door_ready === true) }
    if (s.ok) { const j = await s.json(); setStaff(j.staff || []); setEmailsReady(j.emails_ready !== false) }
    if (m.ok) setMpins((await m.json()).members || [])
  }, [])
  useEffect(() => { load() }, [load])

  const saveEmail = async (id: string, email: string | null, reminders?: boolean) => {
    const r = await fetch('/api/admin/kiosk-devices/pin', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_member_id: id, ...(email !== undefined ? { email } : {}), ...(reminders !== undefined ? { email_reminders: reminders } : {}) }),
    })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? t('Saved.', 'Đã lưu.') : (j.error || t('Could not save that.', 'Không lưu được.')))
    if (r.ok) { setMailFor(null); setMail(''); load() }
  }

  // SEND IT NOW, so the owner can see what arrives instead of waiting for
  // nine in the morning and wondering. It ignores "already sent today" and
  // the quiet hours, and sends to ONE person — a button that mails the whole
  // team is a button nobody dares press twice.
  const sendNow = async (s: Staff) => {
    if (!s.email) return
    if (!window.confirm(t(`Send ${s.display_name} their board list now, at ${s.email}?`, `Gửi danh sách công việc cho ${s.display_name} tại ${s.email} ngay bây giờ?`))) return
    setSending(true)
    const r = await fetch('/api/admin/staff-digest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_member_id: s.id }),
    })
    const j = await r.json().catch(() => ({}))
    setSending(false)
    if (!r.ok) { setMsg(j.error || t('Could not send.', 'Không gửi được.')); return }
    const me = (j.people || [])[0]
    setMsg(me?.outcome === 'sent'
      ? `${t('Sent to', 'Đã gửi tới')} ${s.email} — ${me.late} ${t('late', 'quá hạn')}, ${me.today} ${t('due today', 'hôm nay')}, ${me.soon} ${t('tomorrow', 'ngày mai')}.`
      : `${t('Nothing sent', 'Chưa gửi')} — ${me?.outcome || j.reason || '—'}.`)
  }

  const addPerson = async () => {
    const r = await fetch('/api/admin/team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: newName, role_title: newRole, on_rota: newRota }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(j.error || t('Could not add them.', 'Không thêm được.')); return }
    setMsg(`${j.display_name} ${t('is on the team. Give them a PIN if they work the floor, and an address if they get board reminders.', 'đã có trong danh sách. Đặt mã PIN nếu làm việc tại sàn, và địa chỉ email nếu nhận nhắc việc.')}`)
    setAddOpen(false); setNewName(''); setNewRole(''); setNewRota(true); load()
  }

  const setActive = async (s2: Staff, active: boolean) => {
    if (!active && !window.confirm(t(`Stand ${s2.display_name} down? They come off the staff picker, the rota and the reminders. Everything they have done is kept.`, `Cho ${s2.display_name} nghỉ? Sẽ không còn trên màn hình chọn nhân viên, lịch trực và nhắc việc. Mọi ghi nhận vẫn được giữ.`))) return
    const r = await fetch('/api/admin/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_member_id: s2.id, active }),
    })
    setMsg(r.ok ? t('Saved.', 'Đã lưu.') : t('Could not save that.', 'Không lưu được.'))
    if (r.ok) load()
  }

  const addDevice = async () => {
    if (!label.trim()) return
    const isDoor = purpose === 'door'
    const r = await fetch('/api/admin/kiosk-devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, room: isDoor ? null : room || null, purpose }) })
    if (r.ok) {
      const j = await r.json()
      setMsg(`${t('Pairing code for', 'Mã ghép nối cho')} “${label}”: ${j.pair_code} (${t('valid', 'có hiệu lực')} ${j.expires_in_min} ${t('min — enter it on the tablet at', 'phút — nhập mã trên máy tính bảng tại')} /kiosk/pair${isDoor ? t(' — it opens the guest sign-in', ' — máy sẽ mở màn hình đăng ký khách') : ''})`)
      setLabel(''); setPurpose('room'); load()
    } else setMsg((await r.json().catch(() => ({})))?.error || t('Could not create.', 'Không thể tạo.'))
  }
  const revoke = async (id: string) => {
    if (!window.confirm(t('Revoke this device? The tablet loses access immediately.', 'Thu hồi thiết bị này? Máy tính bảng sẽ mất quyền truy cập ngay lập tức.'))) return
    await fetch(`/api/admin/kiosk-devices/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke' }) })
    load()
  }
  const setRoomFor = async (id: string, value: string) => {
    const r = await fetch(`/api/admin/kiosk-devices/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_room', room: value || null }) })
    if (!r.ok) setMsg(t('That room is not a bookable space.', 'Phòng đó không phải không gian có thể đặt.'))
    load()
  }
  const memberPinAction = async (member_no: string, action: 'reset' | 'unlock') => {
    if (action === 'reset' && !window.confirm(t('Clear this member\u2019s PIN? They set a new one themselves in their portal — nobody here can set it for them.', 'Xóa mã PIN của hội viên này? Họ tự đặt lại trong cổng thành viên.'))) return
    await fetch('/api/admin/kiosk-devices/member-pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, member_no }) })
    load()
  }

  const savePin = async () => {
    if (!pinFor || !/^[0-9]{4,8}$/.test(pin)) return
    const r = await fetch('/api/admin/kiosk-devices/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: pinFor.id, pin }) })
    if (r.ok) { setMsg(`${t('PIN set for', 'Đã đặt mã PIN cho')} ${pinFor.display_name}.`); setPinFor(null); setPin(''); load() }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('Kiosk & Staff PINs', 'Kiosk & Mã PIN nhân viên')}</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 24 }}>{t('Enrol tablets (the device session is the security boundary) · set staff PINs (attribution) · hold the address a task reminder goes to', 'Đăng ký máy tính bảng (phiên thiết bị là ranh giới bảo mật) · đặt mã PIN cho nhân viên (ghi nhận) · lưu địa chỉ nhận nhắc việc')}</p>
      {msg && <div style={banner}>{msg}</div>}

      <div style={sectionLabel}>{t('Enrolled devices', 'Thiết bị đã đăng ký')}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('Device name (e.g. Floor 4 bar)', 'Tên thiết bị (vd. Quầy bar tầng 4)')} style={input} />
        <select value={purpose} onChange={e => setPurpose(e.target.value as 'room' | 'door')} style={{ ...input, flex: '0 0 190px' }}>
          <option value="room">{t('Room tablet', 'Máy tính bảng phòng')}</option>
          <option value="door" disabled={!doorReady}>{doorReady ? t('Door — guest sign-in', 'Cửa — khách đăng ký') : t('Door (run db/guest_signin.sql)', 'Cửa (cần chạy db/guest_signin.sql)')}</option>
        </select>
        {purpose === 'room' && (
          <select value={room} onChange={e => setRoom(e.target.value)} style={{ ...input, flex: '0 0 200px' }}>
            <option value="">{t('Room (for the board)', 'Phòng (cho bảng)')}</option>
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <button onClick={addDevice} disabled={!label.trim()} style={{ ...btn, opacity: label.trim() ? 1 : 0.4 }}>{t('Add device', 'Thêm thiết bị')}</button>
      </div>
      {devices.map(d => (
        <div key={d.id} style={row}>
          <div>
            <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{d.label}</span>
            <span style={{ ...pill, ...(d.status === 'enrolled' ? pillOk : d.status === 'revoked' ? pillBad : pillPend) }}>{d.status}</span>
            {d.pair_code && <span style={{ fontFamily: MONO, fontSize: 13, color: '#D4B85A', marginLeft: 10 }}>{t('code:', 'mã:')} {d.pair_code}</span>}
            {d.purpose === 'door' ? (
              // A door device stands in no room; the database refuses one.
              <span style={{ ...pill, ...pillPend }}>{t('door · guest sign-in', 'cửa · khách đăng ký')}</span>
            ) : (
              <select value={d.room || ''} onChange={e => setRoomFor(d.id, e.target.value)} style={{ ...input, flex: 'none', marginLeft: 10, padding: '4px 8px', fontSize: 11 }}>
                <option value="">{t('no room', 'chưa có phòng')}</option>
                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', marginTop: 3 }}>{d.last_seen_at ? `${t('last seen', 'lần cuối')} ${new Date(d.last_seen_at).toLocaleString('en-GB')}` : t('never connected', 'chưa từng kết nối')}</div>
          </div>
          {d.status !== 'revoked' && <button onClick={() => revoke(d.id)} style={revokeBtn}>{t('Revoke', 'Thu hồi')}</button>}
        </div>
      ))}
      {devices.length === 0 && <div style={muted}>{t('No devices enrolled.', 'Chưa có thiết bị nào được đăng ký.')}</div>}

      <div style={{ ...sectionLabel, marginTop: 32 }}>{t('Staff PINs & addresses', 'Mã PIN & địa chỉ nhân viên')}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: .7, marginBottom: 12, lineHeight: 1.7, maxWidth: '72ch' }}>
        {t('A PIN is how somebody signs what they did; an address is where their board list is sent at nine each morning. Neither is a login — nobody here gets a seat from this page. Somebody with nothing due is sent nothing.',
           'Mã PIN để ghi nhận ai đã làm gì; địa chỉ email là nơi nhận danh sách công việc lúc 9 giờ mỗi sáng. Cả hai đều không phải tài khoản đăng nhập. Ai không có việc đến hạn thì không nhận email.')}
      </div>
      {!emailsReady && (
        <div style={{ ...muted, fontStyle: 'normal', color: '#D4B85A', marginBottom: 12 }}>
          {t('Run db/staff_emails.sql to switch the addresses on — PINs work either way.',
             'Chạy db/staff_emails.sql để bật phần địa chỉ — mã PIN vẫn hoạt động bình thường.')}
        </div>
      )}
      {/* ADD SOMEBODY. Above the list, like "Add device" above the devices. */}
      {!addOpen ? (
        <button onClick={() => setAddOpen(true)} style={{ ...btn, marginBottom: 14 }}>
          {t('+ Add someone to the team', '+ Thêm người vào danh sách')}
        </button>
      ) : (
        <div style={{ ...row, flexWrap: 'wrap', borderColor: 'rgba(212,184,90,0.35)', background: 'rgba(212,184,90,0.04)' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                 onKeyDown={e => { if (e.key === 'Enter' && newName.trim().length > 1) addPerson() }}
                 placeholder={t('Name, as the team says it', 'Tên, theo cách mọi người gọi')}
                 style={{ ...input, flex: '1 1 200px' }} />
          <input value={newRole} onChange={e => setNewRole(e.target.value)}
                 placeholder={t('Role — optional (e.g. Cleaner, Duncan Taylor)', 'Vai trò — tuỳ chọn')}
                 style={{ ...input, flex: '1 1 200px' }} />
          {/* ON THE ROTA IS A SEPARATE QUESTION. A partner contact gets board
              tasks and reminders; they do not get shifts in a Sài Gòn club. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, color: '#B2AA98', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={newRota} onChange={e => setNewRota(e.target.checked)} />
            {t('on the rota', 'có trong lịch trực')}
          </label>
          <button onClick={addPerson} disabled={newName.trim().length < 2}
                  style={{ ...btn, opacity: newName.trim().length < 2 ? 0.4 : 1 }}>{t('Add', 'Thêm')}</button>
          <button onClick={() => { setAddOpen(false); setNewName(''); setNewRole('') }} style={smallBtn}>{t('Cancel', 'Hủy')}</button>
        </div>
      )}

      {staff.filter(s => s.active || showStoodDown).map(s => (
        <div key={s.id} style={{ ...row, flexWrap: 'wrap', opacity: s.active ? 1 : 0.55 }}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{s.display_name}</span>
            {s.role_title && <span style={{ fontFamily: MONO, fontSize: 10, color: '#7E7864', marginLeft: 8 }}>{s.role_title}</span>}
            <span style={{ ...pill, ...(s.has_pin ? pillOk : pillPend) }}>{s.has_pin ? t('PIN set', 'Đã đặt PIN') : t('no PIN', 'chưa có PIN')}</span>
            <div style={{ fontFamily: MONO, fontSize: 11, color: s.email ? '#B2AA98' : '#7E7864', marginTop: 6 }}>
              {s.email || t('no address', 'chưa có địa chỉ')}
              {s.email && !s.email_reminders && <span style={{ ...pill, ...pillPend, marginLeft: 8 }}>{t('reminders off', 'tắt nhắc việc')}</span>}
              {s.email && s.last_digest_on && <span style={{ color: '#7E7864', marginLeft: 8 }}>{t('last sent', 'gửi lần cuối')} {s.last_digest_on}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setPinFor(s); setPin('') }} style={smallBtn}>{s.has_pin ? t('Reset PIN', 'Đặt lại PIN') : t('Set PIN', 'Đặt PIN')}</button>
            {emailsReady && (
              <button onClick={() => { setMailFor(s); setMail(s.email || '') }} style={smallBtn}>
                {s.email ? t('Change address', 'Đổi địa chỉ') : t('Add address', 'Thêm địa chỉ')}
              </button>
            )}
            <button onClick={() => setActive(s, !s.active)} style={s.active ? smallBtn : { ...smallBtn, color: '#7AB07A', borderColor: 'rgba(122,176,122,0.4)' }}>
              {s.active ? t('Stand down', 'Cho nghỉ') : t('Bring back', 'Nhận lại')}
            </button>
            {emailsReady && s.email && (
              <>
                <button onClick={() => saveEmail(s.id, undefined as unknown as string, !s.email_reminders)} style={smallBtn}>
                  {s.email_reminders ? t('Stop reminders', 'Ngừng nhắc việc') : t('Start reminders', 'Bật nhắc việc')}
                </button>
                <button onClick={() => sendNow(s)} disabled={sending} style={{ ...smallBtn, opacity: sending ? .5 : 1 }}>
                  {t('Send now', 'Gửi ngay')}
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      {staff.some(s => !s.active) && (
        <button onClick={() => setShowStoodDown(v => !v)} style={{ ...smallBtn, marginTop: 4 }}>
          {showStoodDown
            ? t('Hide those who have left', 'Ẩn người đã nghỉ')
            : `${t('Show those who have left', 'Hiện người đã nghỉ')} · ${staff.filter(s => !s.active).length}`}
        </button>
      )}

      <div style={{ ...sectionLabel, marginTop: 32 }}>{t('Member kiosk PINs', 'Mã PIN kiosk của hội viên')}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: .7, marginBottom: 12, lineHeight: 1.7 }}>
        {t('Members set their own six digits in their portal. Nobody here can see or set a PIN — you can clear one, and clear a lockout.',
           'Hội viên tự đặt sáu chữ số trong cổng thành viên. Không ai ở đây xem hoặc đặt được mã PIN — bạn chỉ có thể xóa mã và gỡ khóa.')}
      </div>
      {mpins.filter(m => m.locked || m.has_pin).map(m => (
        <div key={m.member_no} style={row}>
          <div>
            <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{m.full_name}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#7E7864', marginLeft: 8 }}>{m.member_no}</span>
            {m.hard_locked
              ? <span style={{ ...pill, ...pillBad }}>{t('locked — needs clearing', 'đã khóa — cần gỡ')}</span>
              : m.locked ? <span style={{ ...pill, ...pillPend }}>{t('locked 15 min', 'khóa 15 phút')}</span>
              : <span style={{ ...pill, ...pillOk }}>{t('PIN set', 'đã đặt PIN')}</span>}
            {m.fails_24h > 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', marginLeft: 8 }}>{m.fails_15m}/15m · {m.fails_24h}/24h</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {m.locked && <button onClick={() => memberPinAction(m.member_no, 'unlock')} style={smallBtn}>{t('Clear lockout', 'Gỡ khóa')}</button>}
            {m.has_pin && <button onClick={() => memberPinAction(m.member_no, 'reset')} style={revokeBtn}>{t('Clear PIN', 'Xóa PIN')}</button>}
          </div>
        </div>
      ))}
      {mpins.filter(m => m.locked || m.has_pin).length === 0 && <div style={muted}>{t('No member has set a kiosk PIN yet.', 'Chưa hội viên nào đặt mã PIN kiosk.')}</div>}

      {pinFor && (
        <div style={modalBack} onClick={() => setPinFor(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', marginBottom: 12 }}>{t('PIN for', 'Mã PIN cho')} {pinFor.display_name}</div>
            <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder={t('4–8 digits', '4–8 chữ số')} style={{ ...input, width: '100%' }} autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button onClick={() => setPinFor(null)} style={smallBtn}>{t('Cancel', 'Hủy')}</button>
              <button onClick={savePin} disabled={!/^[0-9]{4,8}$/.test(pin)} style={{ ...btn, opacity: /^[0-9]{4,8}$/.test(pin) ? 1 : 0.4 }}>{t('Save', 'Lưu')}</button>
            </div>
          </div>
        </div>
      )}

      {/* THE ADDRESS. Empty clears it — "we do not have one" has to be sayable
          or a typo is permanent. */}
      {mailFor && (
        <div style={modalBack} onClick={() => setMailFor(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', marginBottom: 6 }}>{t('Address for', 'Địa chỉ của')} {mailFor.display_name}</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', opacity: .75, lineHeight: 1.7, marginBottom: 12 }}>
              {t('Where their board list is sent each morning. Not a login — it grants nothing. Leave it empty to remove it.',
                 'Nơi nhận danh sách công việc mỗi sáng. Không phải tài khoản đăng nhập. Để trống để xóa.')}
            </div>
            <input value={mail} onChange={e => setMail(e.target.value)} type="email" inputMode="email"
                   placeholder="name@example.com" style={{ ...input, width: '100%' }} autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button onClick={() => setMailFor(null)} style={smallBtn}>{t('Cancel', 'Hủy')}</button>
              <button onClick={() => saveEmail(mailFor.id, mail.trim())}
                      disabled={!!mail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim())}
                      style={{ ...btn, opacity: (!mail.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim())) ? 1 : 0.4 }}>
                {mail.trim() ? t('Save', 'Lưu') : t('Remove', 'Xóa')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4B85A', opacity: 0.8, marginBottom: 12 }
const banner: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.4)', borderRadius: 10, background: 'rgba(212,184,90,0.1)', padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: '#E5D4C2', marginBottom: 20, lineHeight: 1.6 }
const input: React.CSSProperties = { flex: 1, background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const btn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '10px 18px', fontFamily: MONO, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const smallBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontSize: 11, color: '#B2AA98', cursor: 'pointer' }
const revokeBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(194,112,112,0.4)', borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontSize: 11, color: '#C27070', cursor: 'pointer' }
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 9, padding: '2px 8px', borderRadius: 8, marginLeft: 10, letterSpacing: '0.04em' }
const pillOk: React.CSSProperties = { color: '#7AB07A', border: '1px solid rgba(122,176,122,0.4)' }
const pillPend: React.CSSProperties = { color: '#D4B85A', border: '1px solid rgba(212,184,90,0.4)' }
const pillBad: React.CSSProperties = { color: '#C27070', border: '1px solid rgba(194,112,112,0.4)' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
const modalBack: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(5,46,32,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modal: React.CSSProperties = { width: 'min(360px, 92vw)', background: '#0A3526', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 14, padding: 22 }
