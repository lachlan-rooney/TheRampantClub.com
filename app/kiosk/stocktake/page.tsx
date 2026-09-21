'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// STOCKTAKE, ON THE TABLET, IN THE ROOM WHERE THE BOTTLES ARE.
//
// The admin stocktake needs an admin login. The people who count bottles have
// a kiosk PIN and no login, so the count has never once been finished: 333
// bottles, 0 sessions, and a weekly shift task that has sat "not started" every
// week it has appeared.
//
// ── SEARCH IS THE WHOLE THING ─────────────────────────────────────────────
// 333 bottles is unusable as a list. The search box is focused, matches name,
// distillery and region, and is the first thing on the screen — someone
// standing at the back bar types three letters, taps the fill, and moves on.
//
// ── COUNTED BOTTLES LEAVE ─────────────────────────────────────────────────
// Anything already counted this session drops out of the list rather than
// sinking to the bottom. On a phone-sized screen "sunk to the bottom" is the
// same as "still in the way", and the question the counter is answering is
// always "what have I not done yet".
//
// No idle timeout. A stocktake takes an hour and involves long pauses with the
// tablet face-down on a shelf; bouncing to the board mid-count would lose the
// session and is exactly how this ends up never being finished again.

interface W {
  id: string; name: string; distillery: string | null; region: string | null
  current_fill_pct: number | null
  last_fill_updated_at: string | null
  last_fill_updated_email: string | null
}
interface Done { after: number; changed: boolean; missing: boolean }
interface Bi { en: string; vn: string }
interface GuideSection { head: Bi; numbered: boolean; lines: Bi[] }
interface Guide { title: Bi; standfirst: Bi; sections: GuideSection[]; rule: Bi }

// Shortcuts beside the slider, not instead of it. A slider alone makes 25%
// a small act of aim; chips alone cannot say 62%. The admin page has used a
// step-5 slider since it was built, and this matches it so two people counting
// the same bottle on different screens record the same number.
const STEPS = [0, 25, 50, 75, 100]

export default function KioskStocktake() {
  const { t } = useLang()
  const [staff, setStaff] = useState<{ name: string } | null>(null)
  const [all, setAll] = useState<W[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  // The slider's working value for whichever bottle is open. Seeded from what
  // is on record so a bottle that has not moved needs no dragging at all.
  const [draft, setDraft] = useState(100)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Map<string, Done>>(new Map())
  // The session's start comes from the SERVER, not from this tab. A reload
  // rejoins the count in progress instead of starting a second one.
  const [since, setSince] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [guide, setGuide] = useState<Guide | null>(null)
  // Shut by default. Somebody on their fourth stocktake should not have to
  // scroll past the instructions to reach the search box.
  const [guideOpen, setGuideOpen] = useState(false)
  const [finished, setFinished] = useState<{ reviewed: number; changed: number; missing: string[] } | null>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/kiosk/staff/whisky', { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'Could not load the catalogue.')
        return j
      })
      .then(j => {
        setAll(j.whiskies); setStaff(j.staff); setSince(j.since); setGuide(j.guide ?? null)
        // Whatever this person has already counted today — rebuilt from the
        // fill history, so the tablet sleeping at bottle 200 costs nothing.
        setDone(new Map((j.counted ?? []).map((c: { whisky_id: string; fill_pct: number; changed: boolean; missing: boolean }) =>
          [c.whisky_id, { after: c.fill_pct, changed: c.changed, missing: c.missing }])))
        setTimeout(() => search.current?.focus(), 80)
      })
      .catch(e => setErr(String(e.message || e)))
  }, [])

  const shown = useMemo(() => {
    if (!all) return []
    const needle = q.trim().toLowerCase()
    return all
      .filter(w => !done.has(w.id))
      .filter(w => !needle || `${w.name} ${w.distillery ?? ''} ${w.region ?? ''}`.toLowerCase().includes(needle))
      .slice(0, needle ? 40 : 60)
  }, [all, q, done])

  // EVERY kind of count goes through the server — a reading, "no change" and
  // "not on the shelf" alike. Nothing is recorded only in this tab, because a
  // count that lives in a browser is a count that a flat battery erases.
  const save = async (w: W, kind: 'count' | 'same' | 'missing', fill?: number) => {
    setBusy(w.id)
    try {
      const r = await fetch('/api/kiosk/staff/whisky', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: w.id, kind, fill_pct: fill }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'That did not save.'); return }
      setErr('')
      setAll(prev => prev?.map(x => x.id === w.id ? { ...x, current_fill_pct: j.fill_pct } : x) ?? prev)
      setDone(prev => new Map(prev).set(w.id, { after: j.fill_pct, changed: !!j.changed, missing: !!j.missing }))
      setOpenId(null); setQ(''); search.current?.focus()
    } catch { setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.')) }
    finally { setBusy(null) }
  }

  // A bottle on the shelf that is not in the catalogue. Name only: the person
  // counting knows what it says on the label and nothing else, and a guessed
  // distillery would be fiction in the catalogue.
  const addBottle = async () => {
    const name = q.trim()
    if (name.length < 2) return
    setAdding(true)
    try {
      const r = await fetch('/api/kiosk/staff/whisky', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not add that.'); return }
      setErr('')
      setAll(prev => (prev && !prev.some(x => x.id === j.whisky.id)) ? [...prev, j.whisky] : prev)
      setOpenId(j.whisky.id); setDraft(100)
    } catch { setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.')) }
    finally { setAdding(false) }
  }

  const finish = async () => {
    if (!done.size || !all) return
    setBusy('__finish__')
    try {
      // No summary is sent: the server builds it from the fill history, so the
      // count is whatever was actually recorded and not whatever this tab
      // happens to remember.
      const r = await fetch('/api/kiosk/staff/whisky', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', started_at: since }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'That did not save.'); return }
      setFinished({ reviewed: j.session.reviewed_count, changed: j.session.changed_count, missing: j.missing ?? [] })
      setDone(new Map())
    } catch { setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.')) }
    finally { setBusy(null) }
  }

  const changedCount = [...done.values()].filter(d => d.changed).length

  return (
    <main className="st">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="st-head">
        <div>
          <div className="st-kicker">{t('Stocktake', 'Kiểm kê')}</div>
          <div className="st-who">{staff ? staff.name : '…'}</div>
        </div>
        <div className="st-tally">
          <b>{done.size}</b> {t('counted', 'đã đếm')}
          {all && <span className="st-of"> / {all.length}</span>}
        </div>
      </div>

      {err && <div className="st-err">{err}</div>}

      {finished && (
        <div className="st-done">
          {t('Stocktake saved.', 'Đã lưu phiên kiểm kê.')}{' '}
          {finished.reviewed} {t('counted', 'đã đếm')}, {finished.changed} {t('changed', 'thay đổi')}.
          {finished.missing.length > 0 && (
            <div className="st-missing-list">
              {t('Not on the shelf', 'Không có trên kệ')}: {finished.missing.join(', ')}
            </div>
          )}
          <button className="st-again" onClick={() => setFinished(null)}>{t('Count more', 'Đếm tiếp')}</button>
        </div>
      )}

      {/* The instructions, on the tablet, one tap away — a printed sheet drifts
          from the buttons the moment a label changes, and the person holding a
          bottle is not holding a printout. Shut by default so it never stands
          between somebody and the search box. */}
      {guide && (
        <div className="st-guide">
          <button className="st-guide-btn" onClick={() => setGuideOpen(o => !o)} aria-expanded={guideOpen}>
            {guideOpen ? '−' : '?'} {t(guide.title.en, guide.title.vn)}
          </button>
          {guideOpen && (
            <div className="st-guide-body">
              <p className="st-guide-stand">{t(guide.standfirst.en, guide.standfirst.vn)}</p>
              {guide.sections.map((sec, si) => (
                <section key={si} className="st-guide-sec">
                  <h2 className="st-guide-head">{t(sec.head.en, sec.head.vn)}</h2>
                  <ol className="st-guide-steps">
                    {sec.lines.map((g, i) => (
                      <li key={i}>
                        <span>{sec.numbered ? i + 1 : '·'}</span>{t(g.en, g.vn)}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              <p className="st-guide-note">{t(guide.rule.en, guide.rule.vn)}</p>
              <button className="st-guide-close" onClick={() => setGuideOpen(false)}>
                {t('Close', 'Đóng')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* The search box, first and focused. Nothing else on this screen matters
          if a person cannot find the bottle in their hand. */}
      <input
        ref={search} className="st-search" value={q} onChange={e => setQ(e.target.value)}
        placeholder={t('Search a bottle — name, distillery, region', 'Tìm chai — tên, nhà máy, vùng')}
        autoComplete="off" spellCheck={false} enterKeyHint="search"
        aria-label={t('Search', 'Tìm kiếm')}
      />

      {!all && !err && <p className="st-msg">{t('Loading the catalogue…', 'Đang tải danh mục…')}</p>}

      <ul className="st-list">
        {shown.map(w => (
          <li key={w.id} className={`st-item ${openId === w.id ? 'is-open' : ''}`}>
            <button className="st-row" onClick={() => {
              setOpenId(o => (o === w.id ? null : w.id))
              setDraft(w.current_fill_pct ?? 100)
            }}>
              <span className="st-name">
                {w.name}
                <span className="st-sub">{[w.distillery, w.region].filter(Boolean).join(' · ') || '—'}</span>
              </span>
              <span className="st-now">
                {w.current_fill_pct == null
                  ? <em className="st-never">{t('never counted', 'chưa đếm')}</em>
                  : `${w.current_fill_pct}%`}
              </span>
            </button>

            {openId === w.id && (
              <div className="st-panel">
                {/* THE SLIDER, as on the admin page: 0-100 in fives. The big
                    number is the read-out, because a thumb covers the track at
                    exactly the moment somebody wants to check the value. */}
                <div className="st-slide">
                  <input
                    type="range" min={0} max={100} step={5} value={draft}
                    onChange={e => setDraft(Number(e.target.value))}
                    className="st-range" aria-label={t('Fill level', 'Mức rượu')}
                  />
                  <span className="st-val">{draft}%</span>
                </div>

                <div className="st-steps">
                  {STEPS.map(v => (
                    <button key={v} className={`st-step ${draft === v ? 'is-now' : ''}`}
                            onClick={() => setDraft(v)}>{v}%</button>
                  ))}
                </div>

                <div className="st-acts">
                  <button className="st-save" disabled={busy === w.id} onClick={() => save(w, 'count', draft)}>
                    {busy === w.id ? t('Saving…', 'Đang lưu…') : `${t('Save', 'Lưu')} ${draft}%`}
                  </button>
                  {/* Counting a bottle that has not moved is still counting it —
                      otherwise the session only ever records the losses. */}
                  <button className="st-same" disabled={busy === w.id} onClick={() => save(w, 'same')}>
                    {t('No change', 'Không đổi')}
                  </button>
                </div>
                {/* In the catalogue, not on the shelf. Recorded as zero with a
                    loud note: for stock purposes absent is nothing available,
                    and last week's reading dropping to 0 is exactly the signal
                    the count exists to produce. */}
                <button className="st-missing" disabled={busy === w.id} onClick={() => save(w, 'missing')}>
                  {t('Not on the shelf', 'Không có trên kệ')}
                </button>
              </div>
            )}
          </li>
        ))}
        {all && !shown.length && (
          <li className="st-msg">
            {q ? (
              <>
                {t('Nothing matches that.', 'Không tìm thấy.')}
                <button className="st-add" disabled={adding} onClick={addBottle}>
                  {adding ? t('Adding…', 'Đang thêm…')
                          : `${t('Add', 'Thêm')} “${q.trim()}” ${t('to the catalogue', 'vào danh mục')}`}
                </button>
              </>
            ) : t('Everything on screen has been counted.', 'Đã đếm hết các chai hiển thị.')}
          </li>
        )}
      </ul>

      {done.size > 0 && (
        <div className="st-tray">
          <div className="st-tray-txt">
            <b>{done.size}</b> {t('counted', 'đã đếm')} · {changedCount} {t('changed', 'thay đổi')}
          </div>
          <button className="st-finish" disabled={busy === '__finish__'} onClick={finish}>
            {busy === '__finish__' ? t('Saving…', 'Đang lưu…') : t('Finish stocktake', 'Kết thúc kiểm kê')}
          </button>
        </div>
      )}
    </main>
  )
}

const MONO = "'Google Sans Code','DM Mono',monospace"
const CSS = `
.st { min-height: 100dvh; background: #052E20; color: #E5D4C2;
      padding: 28px clamp(18px,4vw,48px) calc(120px + var(--kiosk-bar, 0px)); }
.st-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.st-kicker { font-family: ${MONO}; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #D4B85A; }
.st-who { font-family: 'Rampant Sans', Georgia, serif; font-size: 26px; margin-top: 6px; }
.st-tally { font-family: ${MONO}; font-size: 14px; text-align: right; }
.st-tally b { color: #D4B85A; font-size: 22px; font-weight: 400; }
.st-of { opacity: .45; }
.st-err { font-family: ${MONO}; font-size: 13px; color: #E0A0A0; border-left: 3px solid #C27070;
          padding: 10px 14px; margin: 16px 0; }
.st-done { font-family: ${MONO}; font-size: 14px; color: #B0C18E; border: 1px solid rgba(176,193,142,.45);
           padding: 14px 16px; margin: 18px 0; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.st-again { background: none; border: 1px solid rgba(229,212,194,.3); border-radius: 2px; color: #E5D4C2;
            font-family: ${MONO}; font-size: 12px; padding: 8px 14px; cursor: pointer; }

.st-guide { margin-top: 18px; }
.st-guide-btn { background: none; border: 1px solid rgba(229,212,194,.22); border-radius: 20px;
                color: rgba(229,212,194,.8); font-family: ${MONO}; font-size: 13px;
                letter-spacing: .1em; text-transform: uppercase; padding: 10px 18px;
                cursor: pointer; -webkit-tap-highlight-color: transparent; }
.st-guide-body { margin-top: 14px; padding: 18px 20px;
                 border: 1px solid rgba(229,212,194,.16); border-radius: 4px; }
.st-guide-steps { list-style: none; margin: 0; padding: 0; }
.st-guide-steps li { display: flex; gap: 14px; padding: 7px 0; font-family: ${MONO};
                     font-size: 14px; line-height: 1.65; }
.st-guide-steps li span { flex: 0 0 auto; width: 20px; color: #D4B85A; }
.st-guide-stand { font-family: ${MONO}; font-size: 13px; line-height: 1.7;
                  opacity: .6; margin: 0 0 20px; }
.st-guide-sec { margin-bottom: 22px; }
.st-guide-head { font-family: ${MONO}; font-size: 11px; letter-spacing: .2em;
                 text-transform: uppercase; color: #D4B85A; margin: 0 0 8px;
                 padding-bottom: 7px; border-bottom: 1px solid rgba(229,212,194,.14); font-weight: 400; }
.st-guide-note { font-family: ${MONO}; font-size: 14px; line-height: 1.7; color: #D4B85A;
                 margin: 18px 0 0; padding: 14px 16px;
                 border: 1px solid rgba(212,184,90,.4); border-radius: 4px; }
.st-guide-close { margin-top: 18px; width: 100%; min-height: 52px; background: none;
                  border: 1px solid rgba(229,212,194,.25); border-radius: 4px; color: #E5D4C2;
                  font-family: ${MONO}; font-size: 13px; letter-spacing: .1em;
                  text-transform: uppercase; cursor: pointer; }
.st-search { width: 100%; box-sizing: border-box; margin: 22px 0 6px; padding: 18px 18px;
             background: rgba(229,212,194,.06); border: 1px solid rgba(229,212,194,.22);
             border-radius: 3px; color: #E5D4C2; font-family: ${MONO}; font-size: 19px; outline: none; }
.st-search:focus { border-color: #D4B85A; }
.st-search::placeholder { color: rgba(229,212,194,.4); }

.st-msg { font-family: ${MONO}; font-size: 14px; opacity: .55; padding: 26px 2px; list-style: none; }
.st-list { list-style: none; margin: 8px 0 0; padding: 0; }
.st-item { border-bottom: 1px solid rgba(229,212,194,.13); }
.st-row { display: flex; align-items: center; gap: 16px; width: 100%; background: none; border: none;
          text-align: left; cursor: pointer; padding: 16px 2px; color: inherit;
          -webkit-tap-highlight-color: transparent; }
.st-name { flex: 1; font-family: ${MONO}; font-size: 17px; line-height: 1.35; }
.st-sub { display: block; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
          opacity: .42; margin-top: 4px; }
.st-now { font-family: ${MONO}; font-size: 18px; color: #D4B85A; white-space: nowrap; }
.st-never { font-style: normal; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; opacity: .5; color: #E5D4C2; }
.st-item.is-open { background: rgba(229,212,194,.04); }

.st-panel { padding: 8px 2px 22px; }

.st-slide { display: flex; align-items: center; gap: 18px; margin-bottom: 16px; }
.st-range { flex: 1; -webkit-appearance: none; appearance: none; height: 44px;
            background: transparent; cursor: pointer; }
.st-range::-webkit-slider-runnable-track { height: 10px; border-radius: 5px;
            background: rgba(229,212,194,.18); }
.st-range::-moz-range-track { height: 10px; border-radius: 5px; background: rgba(229,212,194,.18); }
/* 44px thumb: this is dragged with a thumb, standing up, beside a shelf. */
.st-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
            width: 44px; height: 44px; margin-top: -17px; border-radius: 50%;
            background: #D4B85A; border: none; }
.st-range::-moz-range-thumb { width: 44px; height: 44px; border-radius: 50%;
            background: #D4B85A; border: none; }
.st-val { font-family: ${MONO}; font-size: 30px; color: #D4B85A; min-width: 92px;
          text-align: right; }

.st-steps { display: flex; flex-wrap: wrap; gap: 8px; }
.st-step { flex: 1 1 60px; min-height: 48px; background: rgba(229,212,194,.05);
           border: 1px solid rgba(229,212,194,.2); border-radius: 4px; color: #E5D4C2;
           font-family: ${MONO}; font-size: 16px; cursor: pointer;
           -webkit-tap-highlight-color: transparent; }
.st-step.is-now { border-color: #D4B85A; color: #D4B85A; }
.st-step:active { background: rgba(212,184,90,.2); }

.st-acts { display: flex; gap: 10px; margin-top: 16px; }
.st-missing { margin-top: 10px; width: 100%; min-height: 48px; background: none;
              border: 1px solid rgba(194,112,112,.4); border-radius: 4px; color: #C27070;
              font-family: ${MONO}; font-size: 12px; letter-spacing: .1em;
              text-transform: uppercase; cursor: pointer; }
.st-add { display: block; margin-top: 14px; padding: 16px 20px; background: rgba(212,184,90,.12);
          border: 1px solid rgba(212,184,90,.5); border-radius: 4px; color: #D4B85A;
          font-family: ${MONO}; font-size: 15px; cursor: pointer; }
.st-missing-list { width: 100%; font-size: 12px; color: #C27070; margin-top: 8px; line-height: 1.7; }
.st-save { flex: 2; min-height: 60px; background: #D4B85A; color: #052E20; border: none;
           border-radius: 4px; font-family: ${MONO}; font-size: 17px; letter-spacing: .06em;
           cursor: pointer; -webkit-tap-highlight-color: transparent; }
.st-save:disabled { opacity: .5; cursor: default; }
.st-same { flex: 1; min-height: 60px; background: none;
           border: 1px dashed rgba(229,212,194,.3); border-radius: 4px; color: rgba(229,212,194,.8);
           font-family: ${MONO}; font-size: 13px; letter-spacing: .08em; text-transform: uppercase;
           cursor: pointer; }

.st-tray { position: fixed; left: 0; right: 0; bottom: var(--kiosk-bar, 0px); z-index: 40;
           display: flex; align-items: center; justify-content: space-between; gap: 16px;
           padding: 14px clamp(18px,4vw,48px);
           background: rgba(4,37,26,.97); backdrop-filter: blur(12px);
           border-top: 1px solid rgba(212,184,90,.4); }
.st-tray-txt { font-family: ${MONO}; font-size: 14px; }
.st-tray-txt b { color: #D4B85A; font-size: 20px; font-weight: 400; }
.st-finish { background: #D4B85A; color: #052E20; border: none; border-radius: 2px;
             font-family: ${MONO}; font-size: 14px; letter-spacing: .1em; text-transform: uppercase;
             padding: 16px 24px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.st-finish:disabled { opacity: .5; cursor: default; }
`
