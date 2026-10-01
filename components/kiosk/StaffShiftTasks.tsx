'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'

// YOUR SHIFT LIST, WHERE THE SHIFT IS.
//
// Weekly Shift Tasks shipped as an admin page, and five of the six people it
// is for have a PIN rather than a login. The list of things they are meant to
// do during the shift lived on a screen they could not open.
//
// ── DONE ASKS FOR THE EVIDENCE, HERE TOO ──────────────────────────────────
// "No evidence, not done" is a database constraint, not a form rule, so it
// could not be softened for a tablet even if somebody wanted to. What the
// tablet can do is ask for it BEFORE sending — one tap opens a line, and the
// tick is only offered once something is in it. A refusal from the server
// mid-service is the failure this avoids, not the rule.
//
// ── THE ROSTER IS THE EXPECTATION, NOT THE PERMISSION ─────────────────────
// Anyone on shift may tick anything, and the row records who actually did it.
// That was a deliberate change (db/day_shifts.sql §4): refusing anyone but the
// assignee meant a person COVERING a colleague's day could not tick a single
// line, in a club of five with a moving roster. "Sy's Wednesday, done by Tiên"
// is more useful than the task sitting undone.
//
// So this screen does not re-add that rule. Somebody else's shift is marked
// with their name, and still tappable. A floor screen stricter than the desk
// sends people back to the laptop, which is the problem this is solving.
//
// NOT REQUIRED is a third state, not a shade of done — a task nobody needed.
// Turning back a done or a not-required costs a note AND the PIN again, the
// same as the desk: the cookie says who is signed in, the PIN proves who is
// doing this one thing, which matters more on a tablet that lives on the bar.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GOLD = '#D4B85A'

type Row = {
  id: string; date: string
  title_en: string; title_vn: string | null
  shift_en: string | null; shift_vn: string | null
  one_off: boolean
  status: 'not_started' | 'in_progress' | 'done' | 'blocked' | 'not_required'
  evidence: string | null; blocked_reason: string | null
  carried: number; mine: boolean; owner: string | null; done_by: string | null
}
type Payload = {
  today: string; week: string
  me: { id: string; name: string; supervisor: boolean }
  rows: Row[]; waiting: number
  charter: { title_en: string; title_vn: string | null; charter_en: string | null; charter_vn: string | null; measure_en: string | null; measure_vn: string | null } | null
}

export default function StaffShiftTasks({ onWaiting }: { onWaiting?: (n: number) => void }) {
  const { t } = useLang()
  const [d, setD] = useState<Payload | null>(null)
  const [week, setWeek] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'done' | 'blocked' | 'revert'>('done')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/kiosk/staff/tasks', { cache: 'no-store' })
    if (!r.ok) { setErr(t('Sign in with your PIN first.', 'Hãy đăng nhập bằng mã PIN trước.')); return }
    const j: Payload = await r.json()
    setD(j); onWaiting?.(j.waiting)
  }, [t, onWaiting])

  useEffect(() => { load() }, [load])

  const send = async (id: string, status: Row['status'], value?: string, revert?: boolean) => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kiosk/staff/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: id, status,
          evidence: !revert && status === 'done' ? value : undefined,
          blocked_reason: !revert && status === 'blocked' ? value : undefined,
          // A revert carries the note AND the PIN. Both are checked server-side;
          // sending them together means one refusal, not two round trips.
          revert_note: revert ? value : undefined,
          pin: revert ? pin : undefined,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || t('Could not save.', 'Không lưu được.')); return }
      setOpen(null); setText(''); setPin('')
      await load()
    } finally { setBusy(false) }
  }

  if (err && !d) return <p className="sk-quiet">{err}</p>
  if (!d) return <p className="sk-quiet">…</p>

  const shown = d.rows.filter(r => (week ? true : r.date === d.today))
  const mine = shown.filter(r => r.mine)
  const others = shown.filter(r => !r.mine)

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* WHAT THE SHIFT IS FOR. The one piece of the admin page worth carrying
          over whole: a list of jobs without the charter is a chore list. */}
      {d.charter && (
        <div className="sk-charter">
          <div className="sk-charter-h">{t(d.charter.title_en, d.charter.title_vn || d.charter.title_en)}</div>
          {d.charter.charter_en && <p className="sk-charter-p">{t(d.charter.charter_en, d.charter.charter_vn || d.charter.charter_en)}</p>}
          {d.charter.measure_en && (
            <p className="sk-charter-m">
              <b>{t('Judged by', 'Đánh giá theo')}:</b> {t(d.charter.measure_en, d.charter.measure_vn || d.charter.measure_en)}
            </p>
          )}
        </div>
      )}

      <div className="sk-tabs">
        <button onClick={() => setWeek(false)} className={week ? 'sk-tab' : 'sk-tab sk-on'}>{t('Today', 'Hôm nay')}</button>
        <button onClick={() => setWeek(true)} className={week ? 'sk-tab sk-on' : 'sk-tab'}>{t('This week', 'Tuần này')}</button>
      </div>

      {err && <div className="sk-err">{err}</div>}

      {shown.length === 0 && (
        <p className="sk-quiet">{t('Nothing on the list for today.', 'Hôm nay không có việc nào trong danh sách.')}</p>
      )}

      {/* CALLED, NOT MOUNTED. Written as <List rows={mine} /> this is a NEW
          component type on every render, so React unmounts and remounts the
          subtree each keystroke — the evidence box loses focus and the caret
          jumps to the start, which on a tablet reads as a broken keyboard.
          Calling it keeps the elements and their identity. */}
      {List({ rows: mine })}
      {others.length > 0 && (
        <>
          <div className="sk-head">{t('Other people’s shifts', 'Ca của người khác')}</div>
          {List({ rows: others })}
        </>
      )}
    </div>
  )

  function List({ rows }: { rows: Row[] }) {
    if (!rows.length) return null
    return (
      <ul className="sk-list">
        {rows.map(r => {
          // Everyone on shift may act — see the note at the top of the file.
          const settled = r.status === 'done' || r.status === 'not_required'
          const isOpen = open === r.id
          return (
            <li key={r.id} className={`sk-row sk-${r.status}`}>
              <div className="sk-top">
                <span className={`sk-dot sk-dot-${r.status}`} />
                <div className="sk-body">
                  <div className="sk-title">{t(r.title_en, r.title_vn || r.title_en)}</div>
                  <div className="sk-meta">
                    {week && <span>{r.date.slice(5)}</span>}
                    {r.shift_en && <span>{t(r.shift_en, r.shift_vn || r.shift_en)}</span>}
                    {r.one_off && <span className="sk-tag">{t('one-off', 'việc phát sinh')}</span>}
                    {!r.mine && r.owner && <span className="sk-owner">{t(`${r.owner}’s shift`, `ca của ${r.owner}`)}</span>}
                    {r.done_by && !r.mine && <span className="sk-by">{t(`done by ${r.done_by}`, `${r.done_by} đã làm`)}</span>}
                    {r.carried > 0 && (
                      <span className="sk-carried">
                        {t(`carried ${r.carried}×`, `chuyển tiếp ${r.carried} lần`)}
                      </span>
                    )}
                    <span className={`sk-state sk-state-${r.status}`}>{STATE(t)[r.status]}</span>
                  </div>
                  {r.status === 'done' && r.evidence && <div className="sk-ev">{r.evidence}</div>}
                  {r.status === 'blocked' && r.blocked_reason && <div className="sk-ev">{r.blocked_reason}</div>}
                </div>
              </div>

              {!settled && !isOpen && (
                <div className="sk-acts">
                  {r.status === 'not_started' && (
                    <button disabled={busy} onClick={() => send(r.id, 'in_progress')} className="sk-btn">
                      {t('Started', 'Đã bắt đầu')}
                    </button>
                  )}
                  <button disabled={busy} onClick={() => { setOpen(r.id); setMode('done'); setText('') }} className="sk-btn sk-btn-go">
                    {t('Done', 'Hoàn thành')}
                  </button>
                  <button disabled={busy} onClick={() => { setOpen(r.id); setMode('blocked'); setText('') }} className="sk-btn">
                    {t('Blocked', 'Bị chặn')}
                  </button>
                  {/* A task nobody needed. No evidence to give and nothing
                      blocking it — so it is one tap, and reversible. */}
                  <button disabled={busy} onClick={() => send(r.id, 'not_required')} className="sk-btn">
                    {t('Not needed', 'Không cần')}
                  </button>
                </div>
              )}

              {settled && !isOpen && (
                <div className="sk-acts">
                  <button disabled={busy} onClick={() => { setOpen(r.id); setMode('revert'); setText(''); setPin('') }} className="sk-btn">
                    {t('Turn it back', 'Hoàn tác')}
                  </button>
                </div>
              )}

              {isOpen && (
                <div className="sk-form">
                  <div className="sk-ask">
                    {mode === 'done'
                      ? t('Where is it, or a link. No evidence, not done.', 'Nó ở đâu, hoặc một đường dẫn. Không có bằng chứng thì chưa xong.')
                      : mode === 'blocked'
                        ? t('What is blocking it?', 'Điều gì đang chặn việc này?')
                        : t('Why are you turning it back? Then your PIN.', 'Vì sao bạn hoàn tác? Sau đó nhập mã PIN.')}
                  </div>
                  <textarea value={text} onChange={e => setText(e.target.value)} rows={2} className="sk-ta" autoFocus />
                  {mode === 'revert' && (
                    <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                           inputMode="numeric" type="password" placeholder={t('Your PIN', 'Mã PIN của bạn')} className="sk-pin" />
                  )}
                  <div className="sk-acts">
                    <button disabled={busy || text.trim().length < 2 || (mode === 'revert' && pin.length < 4)}
                            onClick={() => send(r.id, mode === 'revert' ? 'not_started' : mode, text.trim(), mode === 'revert')}
                            className="sk-btn sk-btn-go"
                            style={{ opacity: text.trim().length < 2 || (mode === 'revert' && pin.length < 4) ? .4 : 1 }}>
                      {mode === 'done' ? t('Mark done', 'Đánh dấu xong')
                        : mode === 'blocked' ? t('Mark blocked', 'Đánh dấu bị chặn')
                        : t('Turn it back', 'Hoàn tác')}
                    </button>
                    <button disabled={busy} onClick={() => { setOpen(null); setText(''); setPin('') }} className="sk-btn">
                      {t('Cancel', 'Hủy')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )
  }
}

const STATE = (t: (en: string, vn: string) => string): Record<Row['status'], string> => ({
  not_started: t('to do', 'cần làm'),
  in_progress: t('started', 'đang làm'),
  done: t('done', 'đã xong'),
  blocked: t('blocked', 'bị chặn'),
  not_required: t('not needed', 'không cần'),
})

const CSS = `
.sk-quiet { font-family: ${MONO}; font-size: 12px; line-height: 1.85; color: #B2AA98; opacity: .72; margin: 14px 0 0; max-width: 58ch; }
.sk-err { font-family: ${MONO}; font-size: 12px; line-height: 1.7; color: #C27070; margin: 12px 0; max-width: 58ch; }

.sk-charter { border-left: 2px solid rgba(212,184,90,.4); padding: 2px 0 2px 14px; margin: 2px 0 20px; }
.sk-charter-h { font-family: ${MONO}; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: ${GOLD}; opacity: .85; }
.sk-charter-p { font-family: ${SERIF}; font-size: 17px; line-height: 1.5; color: ${INK}; margin: 8px 0 0; max-width: 60ch; }
.sk-charter-m { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; color: rgba(229,212,194,.6); margin: 8px 0 0; max-width: 64ch; }
.sk-charter-m b { color: rgba(229,212,194,.8); font-weight: 400; }

.sk-tabs { display: flex; gap: 10px; margin: 0 0 6px; }
.sk-tab { background: transparent; border: 1px solid rgba(178,170,152,.3); border-radius: 20px;
          padding: 9px 18px; font-family: ${MONO}; font-size: 11px; letter-spacing: .08em;
          text-transform: uppercase; color: #B2AA98; cursor: pointer; }
.sk-on { border-color: rgba(212,184,90,.55); color: ${GOLD}; }

.sk-head { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
           color: rgba(229,212,194,.4); margin: 28px 0 2px; }

.sk-list { list-style: none; margin: 10px 0 0; padding: 0; }
.sk-row { border-top: 1px solid rgba(229,212,194,.12); padding: 14px 2px; }
.sk-row:last-child { border-bottom: 1px solid rgba(229,212,194,.12); }
.sk-top { display: flex; gap: 12px; align-items: flex-start; }
.sk-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex: 0 0 8px; background: rgba(229,212,194,.25); }
.sk-dot-in_progress { background: ${GOLD}; }
.sk-dot-done { background: #8FC48F; }
.sk-dot-blocked { background: #C27070; }
.sk-dot-not_required { background: #B2AA98; }
.sk-body { flex: 1 1 auto; min-width: 0; }
.sk-title { font-family: ${SERIF}; font-size: 18px; line-height: 1.35; color: ${INK}; }
.sk-done .sk-title { color: rgba(229,212,194,.55); }
.sk-meta { display: flex; gap: 13px; flex-wrap: wrap; font-family: ${MONO}; font-size: 9.5px;
           letter-spacing: .1em; text-transform: uppercase; color: rgba(229,212,194,.45); margin-top: 7px; }
.sk-owner { color: rgba(229,212,194,.6); }
.sk-tag { color: #9E8FC4; }
.sk-carried { color: #C79A6B; }
.sk-state-done { color: #8FC48F; }
.sk-state-blocked { color: #C27070; }
.sk-state-in_progress { color: ${GOLD}; }
.sk-state-not_required { color: rgba(229,212,194,.45); }
.sk-not_required .sk-title { color: rgba(229,212,194,.5); text-decoration: line-through;
                             text-decoration-color: rgba(229,212,194,.25); }
.sk-by { color: #8FC48F; opacity: .85; }
.sk-ev { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; color: rgba(229,212,194,.6);
         margin-top: 8px; max-width: 62ch; }

.sk-acts { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 0 20px; }
.sk-btn { background: transparent; border: 1px solid rgba(178,170,152,.35); border-radius: 22px;
          padding: 11px 20px; font-family: ${MONO}; font-size: 11px; letter-spacing: .08em;
          text-transform: uppercase; color: #B2AA98; cursor: pointer; }
.sk-btn-go { border-color: rgba(212,184,90,.5); color: ${GOLD}; }
.sk-form { margin: 12px 0 0 20px; }
.sk-ask { font-family: ${MONO}; font-size: 11px; line-height: 1.7; color: rgba(229,212,194,.6); max-width: 58ch; }
.sk-pin { display: block; width: 180px; box-sizing: border-box; margin-top: 10px;
          background: rgba(229,212,194,.06); border: 1px solid rgba(229,212,194,.2);
          border-radius: 8px; color: ${INK}; font-family: ${MONO}; font-size: 18px;
          letter-spacing: .3em; padding: 11px 13px; outline: none; }
.sk-ta { width: 100%; max-width: 560px; box-sizing: border-box; margin-top: 9px;
         background: rgba(229,212,194,.06); border: 1px solid rgba(229,212,194,.2);
         border-radius: 8px; color: ${INK}; font-family: ${SERIF}; font-size: 17px;
         padding: 11px 13px; outline: none; resize: vertical; }

@media (pointer: coarse) { .sk-btn, .sk-tab { padding-top: 13px; padding-bottom: 13px; } }
@media (max-width: 560px) { .sk-acts, .sk-form { margin-left: 0; } }
`
