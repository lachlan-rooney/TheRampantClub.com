// ONE SUBJECT, ONE PAGE — this was /members/journey.
//
// Owner, 2026-10-02: "should 'your palate' and your notes not be one page?"
// and, of the third: "and your journey. WTF. 3 tabs of the same shit really."
//
// They were right. Your Palate drew a radar of the member's flavour vector;
// Your Journey drew THE SAME radar component from the same vector, plus the
// drams and notes behind it; Your Notes listed those notes — which the journey
// page was already listing. Three nav entries, one subject, and the notes
// appeared twice.
//
// This file is that page's body, unchanged, as a section of /members/taste. Its
// logic, its fetches and its markup are as they were: only the MemberPage
// wrapper came off, because the merged page provides it once.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'
import { WhiskyStyle } from '@/components/whisky/WhiskyStyle'
import { Rise, CREAM, GOLD, MONO, SERIF } from '@/components/public/kit'
import { CreamInk } from '@/components/public/CreamInk'

// Your Whisky Journey — the timeline of becoming. Current palate up top, then the
// real milestones, an honest drift line (only when earned), and the chronological
// story of drams + notes. Sparse → an invitation, never a barren page.
//
// Set to the house standard: the drift line large and the milestones as big
// numbers on the left, the palate's radar on the right; the story beneath as
// a run of dated entries on hairlines, a lion at his ease beside its heading.

interface Entry { kind: 'dram' | 'note'; date: string; whisky_id?: string; whisky_name: string; distillery?: string | null; note?: string; flavour_tags?: string[] }
interface Milestone { label: string; value: string }

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// ── VIETNAMESE FOR WHAT /api/members/journey SENDS IN ENGLISH ───────────────
// The route composes milestone labels/values and the drift line server-side in
// English. Its label set is fixed, so it is paired here by the English literal;
// anything unrecognised falls through as sent. The drift line is rebuilt from
// the `family` slug the route also returns.
const MILESTONE_VN: Record<string, string> = {
  'A member for': 'Thời gian là hội viên',
  'With us': 'Đồng hành cùng chúng tôi',
  'Distinct drams met': 'Whisky đã thưởng thức',
  'Most returned to': 'Quay lại nhiều nhất',
  'Evenings at the club': 'Buổi tối tại câu lạc bộ',
}
const milestoneValueVn = (v: string): string => {
  const m = v.match(/^(\d+) (year|month)s?$/)
  return m ? `${m[1]} ${m[2] === 'year' ? 'năm' : 'tháng'}` : v
}
const DRIFT_WORD_VN: Record<string, string> = {
  dried_fruit_walnut: 'sherry', tar_iodine: 'than bùn', woodsmoke: 'khói', brine_shoreline: 'hương biển',
  baking_spice: 'gia vị', pepper_tannin: 'vị tiêu', orchard_fruit: 'trái cây vườn', tropical_citrus: 'trái cây nhiệt đới',
  floral_honeyed: 'mật ong', vanilla_coconut: 'gỗ sồi và vani', buttery_creamy: 'béo mịn', treacle_roast: 'hương rang',
  leather_polished_oak: 'gỗ sồi lâu năm', cereal_biscuit: 'mạch nha', green_grassy: 'cỏ xanh', meaty_sulphury: 'mặn mà, đậm vị',
}

export default function PalateJourney() {
  const { t, lang } = useLang()
  const [loading, setLoading] = useState(true)
  const [timeline, setTimeline] = useState<Entry[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [drift, setDrift] = useState<{ line: string; family?: string } | null>(null)

  useEffect(() => {
    // The flavour categories went with the radar: they existed to label its
    // spokes, and section 01 fetches its own. One request now, not two — on a
    // merged page the duplicate fetch would have run beside the one above it.
    fetch('/api/members/journey')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j) { setTimeline(j.timeline || []); setMilestones(j.milestones || []); setDrift(j.drift || null) }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const story = [...timeline].reverse()   // newest first for reading

  return (
    <>
      <WhiskyStyle />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {loading ? (
        <p className="wl-text">{t('Tracing your path…', 'Đang lần theo hành trình của bạn…')}</p>
      ) : (
        <>
          {/* ── THE RADAR IS DRAWN ONCE, IN THE SECTION ABOVE ──────────────
              This section used to draw it too, from the same flavour vector and
              with the same component. Across three separate pages that was
              merely redundant; on one page it is the complaint itself — "3 tabs
              of the same shit" — rendered twice inside a single scroll.
              What belongs here is how the palate MOVED: the drift, the
              milestones and the story. The shape it moved into is section 01.
              ALWAYS SINGLE-COLUMN now: the two-column layout existed to put the
              radar beside the drift, and half of it has gone. */}
          {drift || milestones.length > 0 ? (
            <section className="wj-top is-single">
              <div style={{ minWidth: 0 }}>
                {drift && <Rise><p className="wj-drift">{lang === 'vn' && drift.family && DRIFT_WORD_VN[drift.family] ? `Bạn ngày càng nghiêng về gu ${DRIFT_WORD_VN[drift.family]}.` : drift.line}</p></Rise>}

                {milestones.length > 0 && (
                  <div className="wj-stones">
                    {milestones.map((m, i) => (
                      <Rise key={i} delay={.06 + i * .05} className="wj-stone">
                        <div className="wj-stone-val">{lang === 'vn' ? milestoneValueVn(m.value) : m.value}</div>
                        <div className="wj-stone-label">{t(m.label, MILESTONE_VN[m.label] || '')}</div>
                      </Rise>
                    ))}
                  </div>
                )}
              </div>


            </section>
          ) : null}

          {story.length === 0 ? (
            <section>
              <Rise>
                <h2 className="wl-h is-2">{t('Your journey begins.', 'Hành trình của bạn bắt đầu.')}</h2>
                <p className="wj-sparse-text">{t('Every dram poured for you and every note you log becomes part of the story here. Start in the', 'Mỗi ly được rót cho bạn và mỗi ghi chú bạn lưu lại đều trở thành một phần câu chuyện nơi đây. Hãy bắt đầu từ')} <Link href="/members/whisky" className="wl-inline">{t('Whisky Library', 'Thư Viện Whisky')}</Link> — <Link href="#notes" className="wl-inline">{t('note what you taste', 'ghi lại cảm nhận của bạn')}</Link>{t(', and watch this fill.', ', và xem trang này dần đầy lên.')}</p>
              </Rise>
            </section>
          ) : (
            <section className="wj-story">
              <div className="wj-story-head">
                <Rise><h2 className="wl-h is-2">{t('The story so far', 'Câu chuyện đến nay')}</h2></Rise>
                <Rise delay={.1} className="wj-story-ink"><CreamInk name="lion-reclining" width="100%" rot={-3} dur={9} /></Rise>
              </div>
              <ol className="wj-list">
                {story.map((e, i) => (
                  <li key={i} className="wj-entry">
                    <div className="wl-date">{fmt(e.date)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="wj-name">
                        {e.whisky_id ? <Link href={`/members/whisky/${e.whisky_id}`} className="wj-link">{e.whisky_name}</Link> : e.whisky_name === 'a dram' ? t('a dram', 'một ly') : e.whisky_name === 'a whisky' ? t('a whisky', 'một chai whisky') : e.whisky_name}
                      </div>
                      <div className="wj-kind">
                        <span className="wj-dot" style={{ background: e.kind === 'note' ? GOLD : '#9CC79C' }} aria-hidden="true" />
                        {e.kind === 'note' ? t('you noted it', 'bạn đã ghi chú') : t('poured for you', 'đã rót cho bạn')}{e.distillery ? ` · ${e.distillery}` : ''}
                      </div>
                      {e.note && <div className="wj-note">“{e.note}”</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  )
}

const CSS = `
  .wj-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 72px; align-items: center; margin-bottom: 110px; }
  .wj-top.is-single { grid-template-columns: minmax(0, 1fr); }
  .wj-drift { font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.3vw, 46px); line-height: 1.12; color: ${GOLD}; margin: 0 0 44px; max-width: 620px; }
  .wj-stones { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 30px 36px; }
  .wj-stone { border-top: 1px solid rgba(229,212,194,.16); padding-top: 16px; }
  .wj-stone-val { font-family: ${SERIF}; font-size: clamp(32px, 3.4vw, 48px); line-height: .98; color: ${CREAM}; overflow-wrap: break-word; }
  .wj-stone-label { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: ${CREAM}; opacity: .78; margin-top: 12px; line-height: 1.6; }
  .wj-radar { max-width: 540px; justify-self: end; }

  .wj-story-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; margin-bottom: 34px; }
  .wj-story-ink { width: clamp(170px, 20vw, 280px); margin-right: 2%; }
  .wj-list { list-style: none; margin: 0; padding: 0; border-bottom: 1px solid rgba(229,212,194,.16); }
  .wj-entry { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px 40px; align-items: baseline;
              padding: 22px 0 24px; border-top: 1px solid rgba(229,212,194,.16); }
  .wj-name { font-family: ${SERIF}; font-size: clamp(21px, 2.1vw, 27px); line-height: 1.08; color: ${CREAM}; overflow-wrap: anywhere; }
  .wj-link { color: inherit; text-decoration: none; background-image: linear-gradient(currentColor, currentColor); background-size: 0 1px;
             background-repeat: no-repeat; background-position: 0 100%; transition: background-size .45s cubic-bezier(.16,.84,.44,1); }
  .wj-link:hover { background-size: 100% 1px; }
  .wj-kind { font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: ${CREAM}; opacity: .8; margin-top: 8px;
             display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .wj-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .wj-note { font-family: ${MONO}; font-size: 13px; line-height: 1.9; color: ${CREAM}; opacity: .88; margin-top: 10px; max-width: 660px; }

  .wj-sparse-text { font-family: ${MONO}; font-size: 14px; line-height: 2; color: ${CREAM}; opacity: .9; max-width: 580px; margin: 24px 0 0; }

  @media (max-width: 860px) {
    .wj-top { grid-template-columns: minmax(0, 1fr); gap: 44px; margin-bottom: 88px; }
    .wj-radar { justify-self: stretch; max-width: 480px; }
  }
  @media (max-width: 600px) {
    .wj-entry { grid-template-columns: minmax(0, 1fr); gap: 6px; }
    .wj-story-ink { width: 120px; margin-right: -6px; }
    .wj-stones { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 20px; }
    .wj-stone-val { font-size: clamp(26px, 8vw, 34px); }
    .wj-sparse-text { font-size: 13.5px; line-height: 1.95; }
  }
`
