'use client'

import { useMemo, useState } from 'react'
import { useLang, pick } from '@/lib/lang'
import {
  ALLERGEN_LABEL, DIETARY_LABEL, dong, mediaUrl,
  type Allergen, type Dietary, type MenuPlate, type MenuSet, type MenuVenueGroup,
} from '@/lib/menus/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE MENU, ON BOTH SURFACES
// ───────────────────────────────────────────────────────────────────────────
// One component for the members' portal and the room tablets, because a menu
// that differs between the phone in a member's hand and the tablet on the
// table beside them is a menu that will be wrong in one of the two places.
// What changes between them is size and touch, not content — `variant` sets
// the scale and nothing else.
//
// Two services, and the switch between them is the first thing on the screen:
//
//   PLATES  — small dishes to share, brought to wherever you are sitting.
//   DINING  — set menus, cooked downstairs, sat down.
//
// A dish opens in place. Nothing navigates away, nothing opens a modal: on a
// tablet standing on a table during service, a modal is something a member has
// to dismiss before the next person can read the menu, and it will be left
// open. Tapping a second dish closes the first.
//
// This is a MENU, not a shop. There is no basket and no "order" button — the
// team takes the order. Anything that looks like a checkout would be a promise
// the club has not built yet.
// ═══════════════════════════════════════════════════════════════════════════

type Service = 'plates' | 'dining'

export default function MenuBoard({
  venues, variant = 'member',
}: {
  venues: MenuVenueGroup[]
  variant?: 'member' | 'kiosk'
}) {
  const { t, lang } = useLang()
  const [service, setService] = useState<Service>('plates')
  const [open, setOpen] = useState<string | null>(null)

  const withPlates = useMemo(() => venues.filter(v => v.plates.length), [venues])
  const withSets   = useMemo(() => venues.filter(v => v.sets.length), [venues])
  const shown = service === 'plates' ? withPlates : withSets
  const big = variant === 'kiosk'

  return (
    <div className={`mb ${big ? 'is-kiosk' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── The choice of service, and what it means ──────────────────── */}
      <div className="mb-switch" role="tablist">
        <button role="tab" aria-selected={service === 'plates'}
                className={`mb-tab ${service === 'plates' ? 'is-on' : ''}`}
                onClick={() => { setService('plates'); setOpen(null) }}>
          {t('Plates', 'Món nhỏ')}
          <span className="mb-tab-sub">{t('anywhere in the club', 'phục vụ khắp câu lạc bộ')}</span>
        </button>
        <button role="tab" aria-selected={service === 'dining'}
                className={`mb-tab ${service === 'dining' ? 'is-on' : ''}`}
                onClick={() => { setService('dining'); setOpen(null) }}>
          {t('The Dining Room', 'Phòng ăn')}
          <span className="mb-tab-sub">{t('set menus, sat down', 'thực đơn cố định, dùng tại bàn')}</span>
        </button>
      </div>

      <p className="mb-note">
        {service === 'plates'
          ? t('Small dishes to share, plated in our kitchen and brought to you wherever you are sitting. Ask any of the team.',
              'Các món nhỏ dùng chung, được bày biện tại bếp của chúng tôi và phục vụ ngay tại chỗ quý vị ngồi. Vui lòng gọi nhân viên.')
          : t('Cooked in our dining room and served at the table downstairs. These are not available elsewhere in the club, and need to be arranged in advance.',
              'Được nấu tại phòng ăn và phục vụ tại bàn ở tầng dưới. Không phục vụ ở khu vực khác, và cần đặt trước.')}
      </p>

      {!shown.length && (
        <p className="mb-empty">
          {t('Nothing is published on this menu yet.', 'Chưa có món nào trên thực đơn này.')}
        </p>
      )}

      {shown.map(v => (
        <section key={v.slug} className="mb-venue">
          <VenueHead v={v} lang={lang} />
          {service === 'plates'
            ? <ul className="mb-list">
                {v.plates.map(p => (
                  <PlateRow key={p.id} p={p} open={open === p.id}
                            onToggle={() => setOpen(o => (o === p.id ? null : p.id))} />
                ))}
              </ul>
            : v.sets.map(s => <SetMenu key={s.id} s={s} />)}
        </section>
      ))}

      {/* The line that has to be on every menu we serve from someone else's
          kitchen, and the reason `allergens_confirmed` exists. */}
      <p className="mb-legal">
        {t('Dishes are prepared by our partner kitchens and plated here. Please tell any of the team about allergies or dietary needs before ordering — we will check with the kitchen.',
           'Các món được chế biến bởi nhà bếp đối tác và bày biện tại đây. Vui lòng báo nhân viên về dị ứng hoặc chế độ ăn trước khi gọi món — chúng tôi sẽ kiểm tra với nhà bếp.')}
      </p>
    </div>
  )
}

// ── A restaurant's heading ──────────────────────────────────────────────────
// The logo if we have one, the name if we do not. A partner who has not sent
// artwork yet still gets a proper heading rather than a broken image.

function VenueHead({ v, lang }: { v: MenuVenueGroup; lang: string }) {
  const logo = mediaUrl(v.logo_path)
  const tagline = pick(lang as 'en' | 'vn', v.tagline_en, v.tagline_vn)
  return (
    <header className="mb-vhead" style={v.accent_hex ? { borderTopColor: v.accent_hex } : undefined}>
      {logo
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <img src={logo} alt={v.name} className="mb-logo" />
        : <h2 className="mb-vname">{v.name}</h2>}
      {tagline && <div className="mb-vtag">{tagline}</div>}
      {logo && <span className="mb-vname-sr">{v.name}</span>}
    </header>
  )
}

// ── One small dish ──────────────────────────────────────────────────────────

function PlateRow({ p, open, onToggle }: { p: MenuPlate; open: boolean; onToggle: () => void }) {
  const { t, lang } = useLang()
  const l = lang as 'en' | 'vn'
  const name = pick(l, p.name_en, p.name_vn)
  const desc = pick(l, p.description_en, p.description_vn)
  const avail = pick(l, p.availability_en, p.availability_vn)
  const price = dong(p.price_vnd)
  const hasMore = !!(desc || avail || p.photo_path || p.allergens.length || p.dietary.length)

  return (
    <li className={`mb-item ${open ? 'is-open' : ''}`}>
      <button className="mb-row" onClick={onToggle} aria-expanded={open} disabled={!hasMore}>
        <span className="mb-name">{name}</span>
        <span className="mb-rule" aria-hidden="true" />
        <span className="mb-price">
          {price ?? <em className="mb-tbc">{t('on request', 'liên hệ')}</em>}
        </span>
      </button>

      {open && (
        <div className="mb-body">
          {p.photo_path && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={mediaUrl(p.photo_path)!} alt="" className="mb-photo" loading="lazy" />
          )}
          {desc && <p className="mb-desc">{desc}</p>}
          <Tags allergens={p.allergens} dietary={p.dietary} confirmed={p.allergens_confirmed} />
          <div className="mb-meta">
            {p.lead_time_minutes ? (
              <span>{t('About', 'Khoảng')} {p.lead_time_minutes} {t('minutes', 'phút')}</span>
            ) : null}
            {avail && <span>{avail}</span>}
          </div>
        </div>
      )}
    </li>
  )
}

// ── One set menu ────────────────────────────────────────────────────────────

function SetMenu({ s }: { s: MenuSet }) {
  const { t, lang } = useLang()
  const l = lang as 'en' | 'vn'
  const price = dong(s.price_per_head_vnd)
  const stand = pick(l, s.standfirst_en, s.standfirst_vn)

  return (
    <article className="mb-set">
      <div className="mb-set-head">
        <h3 className="mb-set-name">{pick(l, s.name_en, s.name_vn)}</h3>
        <div className="mb-set-price">
          {price ? <>{price} <span className="mb-perhead">{t('per person', 'mỗi người')}</span></>
                 : <em className="mb-tbc">{t('price on request', 'giá liên hệ')}</em>}
        </div>
      </div>
      {stand && <p className="mb-desc">{stand}</p>}

      <ol className="mb-courses">
        {s.courses.map(c => (
          <li key={c.id} className="mb-course">
            {pick(l, c.course_en, c.course_vn) &&
              <div className="mb-course-label">{pick(l, c.course_en, c.course_vn)}</div>}
            <div className="mb-course-dish">{pick(l, c.dish_en, c.dish_vn)}</div>
            {pick(l, c.note_en, c.note_vn) &&
              <div className="mb-course-note">{pick(l, c.note_en, c.note_vn)}</div>}
            <Tags allergens={c.allergens} dietary={c.dietary} confirmed={c.allergens_confirmed} small />
          </li>
        ))}
      </ol>

      {/* The two facts that stop a booking going wrong. */}
      {(s.min_covers || s.notice_hours) && (
        <div className="mb-meta">
          {s.min_covers ? <span>{t('Minimum', 'Tối thiểu')} {s.min_covers} {t('covers', 'khách')}</span> : null}
          {s.notice_hours ? (
            <span>
              {s.notice_hours >= 24
                ? `${t('Order', 'Đặt trước')} ${Math.round(s.notice_hours / 24)} ${t('days ahead', 'ngày')}`
                : `${t('Order', 'Đặt trước')} ${s.notice_hours} ${t('hours ahead', 'giờ')}`}
            </span>
          ) : null}
        </div>
      )}
    </article>
  )
}

// ── Allergens and dietary marks ─────────────────────────────────────────────
// An unconfirmed dish says so out loud. Showing nothing would read as "no
// allergens", which is the specific way this goes badly wrong.

function Tags({ allergens, dietary, confirmed, small }: {
  allergens: Allergen[]; dietary: Dietary[]; confirmed: boolean; small?: boolean
}) {
  const { t, lang } = useLang()
  const i = lang === 'vn' ? 1 : 0
  if (!confirmed) {
    return (
      <div className={`mb-tags ${small ? 'is-small' : ''}`}>
        <span className="mb-tag is-ask">
          {t('Allergens — please ask your server', 'Dị ứng — vui lòng hỏi nhân viên')}
        </span>
      </div>
    )
  }
  if (!allergens.length && !dietary.length) return null
  return (
    <div className={`mb-tags ${small ? 'is-small' : ''}`}>
      {dietary.map(d => <span key={d} className="mb-tag is-diet">{DIETARY_LABEL[d][i]}</span>)}
      {allergens.map(a => <span key={a} className="mb-tag">{ALLERGEN_LABEL[a][i]}</span>)}
    </div>
  )
}

const CSS = `
/* A menu is a narrow document. Dotted leaders running the full width of a
   desktop window read as a spreadsheet, and a dish name a metre from its own
   price is a dish nobody connects to its price. Capped here rather than by the
   page, so the kiosk and the portal agree. */
.mb { --cream: #E5D4C2; --gold: #D4B85A; --hair: rgba(229,212,194,.16);
      --mono: 'Google Sans Code','DM Mono',monospace;
      --serif: 'Rampant Sans', Georgia, serif; color: var(--cream);
      max-width: 780px; }
.mb.is-kiosk { max-width: 920px; }

.mb-switch { display: flex; gap: 0; border-bottom: 1px solid var(--hair); margin-bottom: 22px; }
.mb-tab { flex: 1; background: none; border: none; cursor: pointer; text-align: left;
          padding: 14px 4px 16px; color: rgba(229,212,194,.5);
          font-family: var(--serif); font-size: 19px; line-height: 1.1;
          border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .2s; }
.mb-tab.is-on { color: var(--cream); border-bottom-color: var(--gold); }
.mb-tab:hover { color: var(--cream); }
.mb-tab-sub { display: block; font-family: var(--mono); font-size: 10px; letter-spacing: .12em;
              text-transform: uppercase; opacity: .55; margin-top: 7px; font-weight: 400; }

.mb-note { font-family: var(--mono); font-size: 12px; line-height: 1.9;
           color: rgba(229,212,194,.62); margin: 0 0 40px; max-width: 62ch; }
.mb-empty { font-family: var(--mono); font-size: 13px; opacity: .55; padding: 40px 0; }

.mb-venue { margin-bottom: 52px; }
.mb-vhead { border-top: 1px solid var(--gold); padding-top: 16px; margin-bottom: 10px; }
.mb-logo { height: 34px; width: auto; max-width: 200px; object-fit: contain; display: block; }
.mb-vname { font-family: var(--serif); font-size: 22px; margin: 0; font-weight: 500; }
.mb-vtag { font-family: var(--mono); font-size: 10px; letter-spacing: .16em;
           text-transform: uppercase; opacity: .5; margin-top: 8px; }
.mb-vname-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.mb-list { list-style: none; margin: 0; padding: 0; }
.mb-item { border-bottom: 1px solid var(--hair); }
.mb-row { display: flex; align-items: baseline; gap: 12px; width: 100%;
          background: none; border: none; cursor: pointer; text-align: left;
          padding: 17px 0; color: inherit; }
.mb-row[disabled] { cursor: default; }
.mb-name { font-family: var(--serif); font-size: 17px; line-height: 1.25; flex-shrink: 0; max-width: 72%; }
.mb-rule { flex: 1; border-bottom: 1px dotted rgba(229,212,194,.25); transform: translateY(-4px); }
.mb-price { font-family: var(--mono); font-size: 13px; white-space: nowrap; padding-left: 4px; }
.mb-tbc { font-style: normal; opacity: .5; font-size: 11px;
          letter-spacing: .1em; text-transform: uppercase; }
.mb-item.is-open .mb-name { color: var(--gold); }

.mb-body { padding: 0 0 22px; max-width: 64ch; }
.mb-photo { width: 100%; max-width: 380px; aspect-ratio: 4 / 3; object-fit: cover;
            border-radius: 2px; display: block; margin-bottom: 16px; }
.mb-desc { font-family: var(--mono); font-size: 12.5px; line-height: 1.95;
           color: rgba(229,212,194,.78); margin: 0 0 14px; }

.mb-tags { display: flex; flex-wrap: wrap; gap: 7px; margin: 12px 0; }
.mb-tag { font-family: var(--mono); font-size: 9.5px; letter-spacing: .12em;
          text-transform: uppercase; padding: 4px 9px; border: 1px solid var(--hair);
          border-radius: 2px; opacity: .8; }
.mb-tag.is-diet { border-color: rgba(176,193,142,.4); color: #B0C18E; }
.mb-tag.is-ask { border-color: rgba(212,184,90,.45); color: var(--gold); opacity: 1; }
.mb-tags.is-small .mb-tag { font-size: 9px; padding: 3px 7px; }

.mb-meta { display: flex; flex-wrap: wrap; gap: 20px; font-family: var(--mono);
           font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
           opacity: .5; margin-top: 12px; }

.mb-set { border-bottom: 1px solid var(--hair); padding: 22px 0 26px; }
.mb-set-head { display: flex; justify-content: space-between; align-items: baseline;
               gap: 18px; flex-wrap: wrap; margin-bottom: 12px; }
.mb-set-name { font-family: var(--serif); font-size: 20px; margin: 0; font-weight: 500; }
.mb-set-price { font-family: var(--mono); font-size: 14px; white-space: nowrap; }
.mb-perhead { font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; opacity: .55; }
.mb-courses { list-style: none; margin: 16px 0 0; padding: 0;
              border-left: 1px solid var(--hair); }
.mb-course { padding: 0 0 18px 20px; }
.mb-course-label { font-family: var(--mono); font-size: 9.5px; letter-spacing: .18em;
                   text-transform: uppercase; color: var(--gold); margin-bottom: 6px; }
.mb-course-dish { font-family: var(--serif); font-size: 16px; line-height: 1.3; }
.mb-course-note { font-family: var(--mono); font-size: 11.5px; line-height: 1.85;
                  opacity: .6; margin-top: 5px; }

.mb-legal { font-family: var(--mono); font-size: 10.5px; line-height: 1.95;
            color: rgba(229,212,194,.42); margin-top: 40px; max-width: 70ch;
            border-top: 1px solid var(--hair); padding-top: 20px; }

/* The tablet stands on a table and is read at arm's length, often by two
   people at once, so everything grows and the hover states go away. */
.mb.is-kiosk .mb-tab { font-size: 26px; padding: 18px 6px 20px; }
.mb.is-kiosk .mb-tab-sub { font-size: 12px; }
.mb.is-kiosk .mb-note { font-size: 14px; }
.mb.is-kiosk .mb-name { font-size: 22px; }
.mb.is-kiosk .mb-row { padding: 22px 0; min-height: 64px; }
.mb.is-kiosk .mb-price { font-size: 16px; }
.mb.is-kiosk .mb-desc { font-size: 15px; }
.mb.is-kiosk .mb-vname { font-size: 27px; }
.mb.is-kiosk .mb-logo { height: 44px; max-width: 260px; }
.mb.is-kiosk .mb-set-name { font-size: 25px; }
.mb.is-kiosk .mb-course-dish { font-size: 20px; }
.mb.is-kiosk .mb-tag { font-size: 11px; padding: 5px 11px; }
.mb.is-kiosk .mb-meta { font-size: 12px; }
.mb.is-kiosk .mb-row:hover .mb-name { color: inherit; }
.mb.is-kiosk .mb-item.is-open .mb-name { color: var(--gold); }

@media (max-width: 600px) {
  .mb-tab { font-size: 16px; }
  .mb-name { font-size: 15.5px; max-width: 64%; }
  .mb-switch { gap: 0; }
}
`
