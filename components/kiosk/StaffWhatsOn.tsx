'use client'

import { useLang } from '@/lib/lang'
import type { Tonight } from './StaffTonight'

// WHAT IS ON TONIGHT — on the hub, not behind a card.
//
// The member's board has carried this since September; the staff screen never
// did, so the person asked "is the tasting tonight?" by a member knew less than
// the tablet sitting next to them.
//
// ── IT IS NOT A CARD ──────────────────────────────────────────────────────
// Every other tool on this screen is a card you tap because it is a job. This
// is one line you need to have READ, not opened — so it sits on the hub above
// the cards and says nothing at all when there is nothing on, rather than
// occupying a card with the word "none" in it.
//
// The sign-up count comes with it, because "the dinner is tonight" and "the
// dinner is tonight and nineteen people are coming" are different briefings.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function StaffWhatsOn({ tonight }: { tonight: Tonight | null }) {
  const { t } = useLang()
  const rows = tonight?.whats_on || []
  if (!rows.length) return null

  return (
    <div className="sw-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sw-head">{t('On tonight', 'Tối nay có')}</div>
      <ul className="sw-list">
        {rows.map((r, i) => (
          <li key={i} className="sw-row">
            <span className="sw-title">{t(r.title, r.title_vn || r.title)}</span>
            <span className="sw-meta">
              {r.time && <span>{r.time}</span>}
              {r.space && <span>{r.space}</span>}
              {r.taken != null && (
                <span className="sw-count">
                  {r.seats != null ? `${r.taken}/${r.seats}` : `${r.taken}`} {t('signed up', 'đã đăng ký')}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const CSS = `
.sw-wrap { margin: 20px 0 4px; padding: 14px 16px; border: 1px solid rgba(212,184,90,.22);
           border-radius: 10px; background: rgba(212,184,90,.05); }
.sw-head { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
           color: #D4B85A; opacity: .85; }
.sw-list { list-style: none; margin: 9px 0 0; padding: 0; }
.sw-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; padding: 5px 0; }
.sw-title { font-family: ${SERIF}; font-size: 17px; color: #E5D4C2; }
.sw-meta { display: flex; gap: 14px; flex-wrap: wrap; font-family: ${MONO}; font-size: 10px;
           letter-spacing: .1em; text-transform: uppercase; color: rgba(229,212,194,.5); }
.sw-count { color: #D4B85A; opacity: .8; }
`
