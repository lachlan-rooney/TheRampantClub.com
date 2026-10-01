'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'

// WHAT THE CLUB HAS BEEN READING ABOUT.
//
// Owner, 2026-10-01: the Flavour Compass is "the thing nobody else has" and
// should be more prominent — "show top searched drams etc".
//
// ── WHY THIS IS THE ONE FEED THAT CAN WORK HERE ───────────────────────────
// The Snug was a members' feed and it was removed the same evening with zero
// posts, ever. A feed that waits for sixteen people to write something
// unprompted waits forever. This one writes itself: every member who opens a
// bottle's page adds to it without doing anything, so it has content on the
// first day and more on the second.
//
// ── IT KNOWS NOTHING ABOUT ANYBODY ────────────────────────────────────────
// The counts behind it have no member column and no timestamp — a tally per
// bottle per day, incremented in place. "Four members looked at this" is not
// something it can say, because it does not know. That was the owner's choice
// when asked, and it is the reason this panel can sit on a members' page
// without a line in the privacy notice.
//
// ── IT SAYS NOTHING RATHER THAN SOMETHING THIN ────────────────────────────
// Below a floor of looks the route returns an empty list and this draws
// nothing at all. A "most looked-at" built from four looks is a lie told with
// a chart, and an empty panel on a dashboard is exactly the feature-rich
// emptiness the owner was complaining about.

type Bottle = { id: string; looks: number; name: string; distillery: string | null; region: string | null; age: string | null }

export default function OnTheShelf() {
  const { t } = useLang()
  const [bottles, setBottles] = useState<Bottle[] | null>(null)

  useEffect(() => {
    fetch('/api/whisky/looked-at', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setBottles(j?.bottles ?? []))
      .catch(() => setBottles([]))
  }, [])

  // Nothing yet, or not enough to mean anything. Draw nothing.
  if (!bottles || bottles.length === 0) return null

  const most = bottles[0].looks

  return (
    <section className="ots">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ots-head">
        <h2 className="ots-title">{t('What the club’s been reading', 'Câu lạc bộ đang đọc gì')}</h2>
        <p className="ots-sub">
          {t('The bottles opened most on the shelf this month. We count the bottle, never the member.',
             'Những chai được xem nhiều nhất trên kệ tháng này. Chúng tôi đếm chai, không đếm người.')}
        </p>
      </div>

      <ol className="ots-list">
        {bottles.map((b, i) => (
          <li key={b.id}>
            <Link href={`/members/whisky/${b.id}`} className="ots-row">
              <span className="ots-rank">{i + 1}</span>
              <span className="ots-name">
                {b.name}
                <span className="ots-meta">
                  {[b.distillery && b.distillery.toLowerCase() !== b.name.toLowerCase().slice(0, b.distillery.length) ? b.distillery : null,
                    b.region, b.age].filter(Boolean).join(' · ')}
                </span>
              </span>
              {/* A bar, not a number: the exact count is the club's business
                  and the shape is the thing a member reads anyway. */}
              <span className="ots-bar" aria-hidden><span style={{ width: `${Math.round((b.looks / most) * 100)}%` }} /></span>
            </Link>
          </li>
        ))}
      </ol>

      <Link href="/members/whisky/finder" className="ots-cta">
        {t('Find one for your own palate', 'Tìm chai hợp khẩu vị của bạn')} <span aria-hidden>→</span>
      </Link>
    </section>
  )
}

const CSS = `
.ots { --cream:#E5D4C2; --gold:#D4B85A; --hair:rgba(229,212,194,.14);
       --mono:'Google Sans Code','DM Mono',monospace;
       --serif:'Rampant Sans',Georgia,serif;
       margin-top: 44px; color: var(--cream); }
.ots-head { margin-bottom: 18px; }
.ots-title { font-family: var(--serif); font-size: clamp(21px, 3vw, 27px); margin: 0; letter-spacing: .02em; }
.ots-sub { font-family: var(--mono); font-size: 11.5px; line-height: 1.8; color: rgba(229,212,194,.6);
           margin: 8px 0 0; max-width: 56ch; }

.ots-list { list-style: none; margin: 0; padding: 0; counter-reset: ots; }
.ots-list li { border-top: 1px solid var(--hair); }
.ots-list li:last-child { border-bottom: 1px solid var(--hair); }
.ots-row { display: grid; grid-template-columns: 26px 1fr 72px; gap: 14px; align-items: center;
           padding: 13px 2px; text-decoration: none; color: inherit;
           -webkit-tap-highlight-color: transparent; }
.ots-rank { font-family: var(--mono); font-size: 11px; color: rgba(229,212,194,.4); font-variant-numeric: tabular-nums; }
.ots-name { font-family: var(--serif); font-size: 16px; line-height: 1.3; min-width: 0; }
.ots-meta { display: block; font-family: var(--mono); font-size: 10px; letter-spacing: .08em;
            text-transform: uppercase; color: rgba(229,212,194,.45); margin-top: 5px; }
.ots-bar { display: block; height: 3px; background: rgba(229,212,194,.1); border-radius: 2px; overflow: hidden; }
.ots-bar > span { display: block; height: 100%; background: var(--gold); opacity: .75; }

.ots-cta { display: inline-block; margin-top: 18px; font-family: var(--mono); font-size: 11.5px;
           letter-spacing: .12em; text-transform: uppercase; color: var(--cream);
           text-decoration: none; border-bottom: 1px solid currentColor; padding-bottom: 5px; }

/* A thumb, not a cursor — the whole row is the target and it clears 44px. */
@media (pointer: coarse) { .ots-row { padding: 15px 2px; } .ots-cta { position: relative; }
  .ots-cta::before { content: ''; position: absolute; inset: -12px -8px; } }
@media (max-width: 520px) { .ots-row { grid-template-columns: 22px 1fr 48px; gap: 10px; } }
`
