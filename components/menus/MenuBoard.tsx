'use client'

import { useMemo, useState } from 'react'
import { useLang, pick } from '@/lib/lang'
import {
  ALLERGEN_LABEL, DIETARY_LABEL, price, mediaUrl, arriving,
  type Allergen, type Dietary, type MenuPlate, type MenuSet, type MenuVenueGroup,
} from '@/lib/menus/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE MENU, ON BOTH SURFACES
// ───────────────────────────────────────────────────────────────────────────
// One component for the members' portal and the room tablets, because a menu
// that differs between the phone in a member's hand and the tablet on the table
// beside them is a menu that will be wrong in one of the two places. `variant`
// changes size and touch, never content.
//
// ── BUILT TO MATCH THE PRINTED CARD ───────────────────────────────────────
// The owner's brief was "look roughly like the Library Bar menu", so this is
// drawn from that PDF rather than from taste:
//
//   · item names in the MONO face, section headings in the serif — the
//     opposite way round from most of this site, and the printed menu's most
//     distinctive move
//   · no dotted leaders and no rule between items. The card has neither; it
//     separates by whitespace alone, and dotted leaders were making the web
//     version read like a spreadsheet
//   · the price right-aligned in its own column, written the club's way
//     ("350K VND"), not in dong with a symbol
//   · the crest lion enormous and barely-there behind the list, bleeding off
//     the right edge
//
// The card also puts an ink drawing in the bottom corner. That was built and
// then taken out on the owner's instruction — at the foot of a scrolling page
// it read as a dark blob rather than as a flourish, which is the difference
// between a printed page that ends and a web page that just stops.
//
// Two services, and the switch between them is the first thing on the screen:
// PLATES go anywhere in the club; DINING is set menus, downstairs, sat down.
//
// A dish opens in place — nothing navigates, nothing opens a modal. On a tablet
// standing on a table during service, a modal is something a member has to
// dismiss before the next person can read the menu, and it will be left open.
//
// This is a MENU, not a shop: no basket, no "order" button. The team takes the
// order, and anything resembling a checkout would promise something the club
// has not built.
// ═══════════════════════════════════════════════════════════════════════════

type Service = 'plates' | 'dining'

export default function MenuBoard({
  venues, variant = 'member', masthead = false,
}: {
  venues: MenuVenueGroup[]
  variant?: 'member' | 'kiosk'
  /** The crest and wordmark above the list, as on the printed card. Off in the
   *  members' portal, where MemberPage has already given the page a masthead
   *  and a second one would just say the club's name twice. */
  masthead?: boolean
}) {
  const { t, lang } = useLang()
  const [service, setService] = useState<Service>('plates')
  const [open, setOpen] = useState<string | null>(null)

  const l = lang as 'en' | 'vn'
  // A restaurant that has been announced but has not opened appears on the
  // Plates tab with its date and no dishes — including where placeholder
  // dishes exist, which they do for El Gaucho and Le Corto. It is not repeated
  // under Dining, because nobody has said which service it arrives with.
  // SERVING FIRST, COMING SOON BELOW — regardless of the display order set in
  // admin, which interleaved them. A member scanning this menu wants to know
  // what they can eat tonight; a restaurant that opens on the 23rd is news, not
  // an option, and it should not sit between two kitchens that are cooking.
  //
  // The sort is stable (ES2019), so the admin's display order still decides the
  // running order WITHIN each half — and on the 23rd, when arriving() starts
  // returning null for those dates, they rejoin the top group in their proper
  // places with nothing to change here.
  const withPlates = useMemo(
    () => venues
      .filter(v => v.plates.length || arriving(v.arriving_on, l))
      .sort((a, b) => (arriving(a.arriving_on, l) ? 1 : 0) - (arriving(b.arriving_on, l) ? 1 : 0)),
    [venues, l])
  const withSets = useMemo(() => venues.filter(v => v.sets.length), [venues])
  const shown = service === 'plates' ? withPlates : withSets

  return (
    <div className={`mb ${variant === 'kiosk' ? 'is-kiosk' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* The lion behind everything, off the right edge. Decorative only —
          hidden from screen readers, and it must never catch a tap meant for
          the dish underneath it. */}
      <img src="/images/logo-mark-cream.svg" alt="" aria-hidden="true" className="mb-watermark" />

      <div className="mb-inner">
        {masthead && (
          <header className="mb-masthead">
            <img src="/images/logo-mark-cream.svg" alt="" aria-hidden="true" className="mb-crest" />
            <div className="mb-wordmark">The Rampant Club</div>
          </header>
        )}

        <div className="mb-switch" role="tablist">
          <button role="tab" aria-selected={service === 'plates'}
                  className={`mb-tab ${service === 'plates' ? 'is-on' : ''}`}
                  onClick={() => { setService('plates'); setOpen(null) }}>
            {t('Plates', 'Món nhỏ')}
            <span className="mb-tab-sub">{t('anywhere in the club', 'phục vụ khắp câu lạc bộ')}</span>
          </button>
          {/* The owner's own framing, and a better one than mine: "set menus,
              sat down" describes what it looks like; "private catering for
              large groups" says what it is FOR, which is what a member is
              deciding between. */}
          <button role="tab" aria-selected={service === 'dining'}
                  className={`mb-tab ${service === 'dining' ? 'is-on' : ''}`}
                  onClick={() => { setService('dining'); setOpen(null) }}>
            {t('The Dining Room', 'Phòng ăn')}
            <span className="mb-tab-sub">{t('private catering, by arrangement', 'tiệc riêng, đặt trước')}</span>
          </button>
        </div>

        <p className="mb-note">
          {service === 'plates'
            ? t('Quick-order small plates to share, sent up from the kitchens above us and plated here. Ask any of the team and it comes to wherever you are sitting.',
                'Món nhỏ gọi nhanh để dùng chung, được gửi từ các nhà bếp phía trên và bày biện tại đây. Chỉ cần gọi nhân viên, món sẽ được mang đến tận chỗ quý vị ngồi.')
            : t('Private catering for larger groups, cooked in our dining room and served at the table downstairs. Not available elsewhere in the club, and arranged in advance.',
                'Tiệc riêng cho nhóm đông, được nấu tại phòng ăn và phục vụ tại bàn ở tầng dưới. Không phục vụ ở khu vực khác, và cần đặt trước.')}
        </p>

        {!shown.length && (
          <p className="mb-empty">
            {t('Nothing is published on this menu yet.', 'Chưa có món nào trên thực đơn này.')}
          </p>
        )}

        {/* Wrapped so a landscape tablet can set them side by side. */}
        <div className="mb-venues">
          {shown.map(v => {
            const soon = arriving(v.arriving_on, l)
            return (
              <section key={v.slug} className={`mb-venue${soon ? ' is-soon' : ''}`}>
                <VenueHead v={v} lang={lang} />
                {/* The date, and then the food anyway. An announced restaurant
                    that has already sent its menu should show it: that is a
                    preview a member can look forward to, and hiding it wastes
                    the only interesting thing about a restaurant that is not
                    open yet. The date sits above the list, not beside it, so
                    nobody reads a price as available tonight.
                    Fiction is kept out a different way — the invented
                    placeholder dishes are switched off, not hidden here. */}
                {soon && <div className="mb-soon">{soon}</div>}
                {service === 'plates'
                  ? <PlateList plates={v.plates} lang={lang} open={open}
                               onToggle={id => setOpen(o => (o === id ? null : id))} />
                  : v.sets.map(s => <SetMenu key={s.id} s={s} />)}
              </section>
            )
          })}
        </div>

        <p className="mb-legal">
          {t('Dishes are prepared by our partner kitchens and plated here. Please tell any of the team about allergies or dietary needs before ordering — we will check with the kitchen.',
             'Các món được chế biến bởi nhà bếp đối tác và bày biện tại đây. Vui lòng báo nhân viên về dị ứng hoặc chế độ ăn trước khi gọi món — chúng tôi sẽ kiểm tra với nhà bếp.')}
        </p>
      </div>

    </div>
  )
}

// ── A restaurant's heading ──────────────────────────────────────────────────
// The printed card has one house name at the top; this has several, because the
// club is plating from several kitchens. The logo does the work where there is
// one, and a partner who has not sent artwork still gets a proper heading.

function VenueHead({ v, lang }: { v: MenuVenueGroup; lang: string }) {
  const logo = mediaUrl(v.logo_path)
  const tagline = pick(lang as 'en' | 'vn', v.tagline_en, v.tagline_vn)
  return (
    <header className="mb-vhead">
      {logo
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <><img src={logo} alt={v.name} className="mb-logo" /><span className="mb-sr">{v.name}</span></>
        : <h2 className="mb-vname">{v.name}</h2>}
      {tagline && <div className="mb-vtag">{tagline}</div>}
    </header>
  )
}

// ── A restaurant's dishes, grouped if it offers more than one list ──────────
// Livannah run a skewer menu and a nori taco menu; without headings the two
// would read as one long list under one logo and a member would never know the
// tacos were a thing. A restaurant with a single list gets NO heading — one
// heading over one group is furniture, not information.

function PlateList({ plates, lang, open, onToggle }: {
  plates: MenuPlate[]; lang: string
  open: string | null; onToggle: (id: string) => void
}) {
  const l = lang as 'en' | 'vn'
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: MenuPlate[] }[] = []
    for (const p of plates) {
      const label = pick(l, p.section_en, p.section_vn)
      const key = p.section_en ?? ''
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(p)
      else out.push({ key, label, items: [p] })
    }
    return out
  }, [plates, l])

  const headed = groups.length > 1

  return (
    <>
      {groups.map(g => (
        <div key={g.key} className={headed ? 'mb-group' : undefined}>
          {headed && g.label && <h3 className="mb-section">{g.label}</h3>}
          <ul className="mb-list">
            {g.items.map(p => (
              <PlateRow key={p.id} p={p} open={open === p.id} onToggle={() => onToggle(p.id)} />
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

// ── One small dish ──────────────────────────────────────────────────────────

function PlateRow({ p, open, onToggle }: { p: MenuPlate; open: boolean; onToggle: () => void }) {
  const { t, lang } = useLang()
  const l = lang as 'en' | 'vn'
  const name = pick(l, p.name_en, p.name_vn)
  const desc = pick(l, p.description_en, p.description_vn)
  const avail = pick(l, p.availability_en, p.availability_vn)
  const money = price(p.price_vnd)
  const hasMore = !!(desc || avail || p.photo_path || p.allergens.length || p.dietary.length)

  return (
    <li className={`mb-item ${open ? 'is-open' : ''}`}>
      <button className="mb-row" onClick={onToggle} aria-expanded={open} disabled={!hasMore}>
        <span className="mb-name">
          {name}
          {/* The whole promise of this menu is that it is quick, so the wait is
              on the row rather than hidden behind a tap. It is how a member
              actually chooses between two plates at eleven at night. */}
          {p.lead_time_minutes ? (
            <span className="mb-wait">{p.lead_time_minutes} {t('min', 'phút')}</span>
          ) : null}
        </span>
        <span className="mb-price">
          {money ?? <em className="mb-tbc">{t('on request', 'liên hệ')}</em>}
        </span>
      </button>

      {/* Always mounted, so it can animate CLOSED as well as open — a panel
          that glides out and then vanishes is worse than one that never moved.
          The grid 0fr→1fr trick animates to the content's real height without
          anyone having to measure it or guess a max-height that clips. */}
      {hasMore && (
        <div className="mb-panel" aria-hidden={!open}>
          <div className="mb-panel-in">
            <div className="mb-body">
              {p.photo_path && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaUrl(p.photo_path)!} alt="" className="mb-photo" loading="lazy" />
              )}
              {desc && <p className="mb-desc">{desc}</p>}
              <Tags allergens={p.allergens} dietary={p.dietary} confirmed={p.allergens_confirmed} />
              {/* The wait is already on the row above; only availability is left. */}
              {avail && <div className="mb-meta"><span>{avail}</span></div>}
            </div>
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
  const money = price(s.price_per_head_vnd)
  const stand = pick(l, s.standfirst_en, s.standfirst_vn)

  return (
    <article className="mb-set">
      <div className="mb-row is-static">
        <span className="mb-name is-set">{pick(l, s.name_en, s.name_vn)}</span>
        <span className="mb-price">
          {money ? <>{money}<span className="mb-perhead">{t('per person', 'mỗi người')}</span></>
                 : <em className="mb-tbc">{t('on request', 'liên hệ')}</em>}
        </span>
      </div>
      {stand && <p className="mb-desc mb-set-stand">{stand}</p>}

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
.mb { --cream: #E5D4C2; --gold: #D4B85A; --hair: rgba(229,212,194,.14);
      --mono: 'Google Sans Code','DM Mono',monospace;
      --serif: 'Rampant Sans', Georgia, serif;
      color: var(--cream); position: relative; overflow: hidden; }
.mb-inner { max-width: 760px; position: relative; z-index: 1; padding-bottom: 40px; }
.mb.is-kiosk .mb-inner { max-width: 900px; padding-bottom: 48px; }

/* The lion, enormous and barely there, bleeding off the right edge — the
   card's signature. Faint enough that the prices sitting over it stay the
   thing you read; pointer-events:none so it can never eat a tap meant for a
   dish.
   Sized in vh and NOT as a percentage of the container: it was 84% of .mb, so
   opening a dish grew the container and the lion grew with it, which made a
   background animate every time somebody tapped something. It is wallpaper.
   It should not know the menu exists. */
.mb-watermark {
  position: absolute; right: -22%; top: 90px;
  height: min(860px, 82vh); width: auto;
  opacity: .032; pointer-events: none; user-select: none; z-index: 0;
}

.mb-masthead { text-align: center; padding-bottom: 34px; }
.mb-crest { height: 76px; width: auto; display: inline-block; }
.mb-wordmark { font-family: var(--serif); font-size: 27px; letter-spacing: .07em;
               text-transform: uppercase; margin-top: 12px; }

.mb-switch { display: flex; border-bottom: 1px solid var(--hair); margin-bottom: 22px; }
.mb-tab { flex: 1; background: none; border: none; cursor: pointer; text-align: left;
          padding: 14px 4px 16px; color: rgba(229,212,194,.5);
          font-family: var(--serif); font-size: 19px; line-height: 1.1;
          border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .2s; }
.mb-tab.is-on { color: var(--cream); border-bottom-color: var(--gold); }
.mb-tab:hover { color: var(--cream); }
.mb-tab-sub { display: block; font-family: var(--mono); font-size: 10px; letter-spacing: .12em;
              text-transform: uppercase; opacity: .55; margin-top: 7px; }

.mb-note { font-family: var(--mono); font-size: 12px; line-height: 1.9;
           color: rgba(229,212,194,.6); margin: 0 0 46px; max-width: 60ch; }
.mb-empty { font-family: var(--mono); font-size: 13px; opacity: .55; padding: 40px 0; }

/* The card separates sections with space, not rules. */
.mb-venue { margin-bottom: 62px; }
.mb-vhead { margin-bottom: 18px; }
/* A FIXED BOX, not a fixed height. Partner marks arrive in every shape there
   is: Le Corto is a wide wordmark, Cure & Pickle a circle, Iberico a tall
   crest. A fixed height flattered the wide ones and shrank the tall ones to
   47px wide and unreadable. Every logo now fits inside the same box and is
   scaled to fit it, which is the only way they sit together as equals. */
.mb-logo { width: 210px; height: 84px; object-fit: contain;
           object-position: left center; display: block; }
.mb-vname { font-family: var(--serif); font-size: 23px; margin: 0; font-weight: 500;
            letter-spacing: .03em; }
.mb-vtag { font-family: var(--mono); font-size: 10px; letter-spacing: .16em;
           text-transform: uppercase; opacity: .5; margin-top: 9px; }
.mb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

/* A named list inside one restaurant. Quieter than the venue's own heading —
   it is a subdivision, not a second restaurant — but in the serif, so it reads
   as a heading rather than as another dish. */
/* An announced restaurant. Deliberately quiet — it is a promise, not a menu,
   and it must not compete with the food that can actually be ordered tonight.
   The whole block dims so the eye passes over it on the way to the real list. */
.mb-venue.is-soon { opacity: .62; }
.mb-soon { font-family: var(--mono); font-size: 11px; letter-spacing: .18em;
           text-transform: uppercase; color: var(--gold); padding: 2px 0 4px; }
.mb.is-kiosk .mb-soon { font-size: 13px; }

.mb-group + .mb-group { margin-top: 26px; }
.mb-section { font-family: var(--serif); font-size: 15px; font-weight: 500;
              letter-spacing: .16em; text-transform: uppercase;
              color: var(--gold); opacity: .85; margin: 0 0 8px; }
.mb.is-kiosk .mb-section { font-size: 17px; }

/* THE LIST. Mono names, price in its own right-aligned column, nothing between
   the rows — the printed card's layout, and the reason it reads like a menu. */
.mb-list { list-style: none; margin: 0; padding: 0; }
/* THE ROW, AND THE BLUE BAR THAT WAS ACROSS IT.
   Two separate browser defaults, both landing on a button that happens to be
   the full width of the page:
     · the TAP HIGHLIGHT — a translucent slab a touch device paints over the
       whole element on touch. On a tablet this is the "big blue line".
     · the FOCUS RING — Chrome's default outline, which after a tap stays on
       the row until something else is touched.
   Both are turned off and replaced, NOT simply deleted: a keyboard user still
   needs to see where they are, so :focus-visible (keyboard only, never a
   mouse or a finger) gets a gold bar down the left instead. */
.mb-row { display: flex; align-items: baseline; gap: 24px; width: 100%;
          background: none; border: none; text-align: left; cursor: pointer;
          padding: 7px 0; color: inherit;
          -webkit-tap-highlight-color: transparent;
          transition: opacity .2s ease; }
.mb-row:focus { outline: none; }
.mb-row:focus-visible { outline: none; box-shadow: inset 3px 0 0 var(--gold); }
.mb-row.is-static { cursor: default; }
.mb-row[disabled] { cursor: default; }
.mb-row:active { opacity: .62; }
.mb-name { font-family: var(--mono); font-size: 15px; line-height: 1.7; flex: 1; }
.mb-name.is-set { font-family: var(--serif); font-size: 20px; letter-spacing: .02em; }
.mb-price { font-family: var(--mono); font-size: 15px; white-space: nowrap;
            text-align: right; min-width: 108px; }
.mb-tbc { font-style: normal; opacity: .5; font-size: 11px;
          letter-spacing: .1em; text-transform: uppercase; }
/* Quiet enough that the dish name still leads the line. */
.mb-wait { font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
           opacity: .4; margin-left: 14px; white-space: nowrap; }
.mb.is-kiosk .mb-wait { font-size: 12px; margin-left: 18px; }
.mb-perhead { display: block; font-size: 9px; letter-spacing: .12em;
              text-transform: uppercase; opacity: .5; margin-top: 3px; }
.mb-item.is-open .mb-name { color: var(--gold); }
.mb-row:hover .mb-name { color: var(--gold); }
.mb-row[disabled]:hover .mb-name { color: inherit; }

/* The reveal. grid-template-rows 0fr → 1fr is the one way to transition to a
   height nobody has measured; the inner element must be overflow:hidden with
   min-height:0 or the row refuses to collapse below its content. */
.mb-panel { display: grid; grid-template-rows: 0fr; opacity: 0;
            transition: grid-template-rows .34s cubic-bezier(.22,.7,.3,1),
                        opacity .26s ease; }
.mb-item.is-open .mb-panel { grid-template-rows: 1fr; opacity: 1; }
.mb-panel-in { overflow: hidden; min-height: 0; }
.mb-body { padding: 4px 0 20px; max-width: 62ch; }

/* Somebody who has asked for less movement gets the panel, not the animation. */
@media (prefers-reduced-motion: reduce) {
  .mb-panel { transition: none; }
}
.mb-photo { width: 100%; max-width: 360px; aspect-ratio: 4 / 3; object-fit: cover;
            display: block; margin-bottom: 16px; }
.mb-desc { font-family: var(--mono); font-size: 12.5px; line-height: 1.95;
           color: rgba(229,212,194,.72); margin: 0 0 14px; }
.mb-set-stand { margin-top: 6px; }

.mb-tags { display: flex; flex-wrap: wrap; gap: 7px; margin: 12px 0; }
.mb-tag { font-family: var(--mono); font-size: 9.5px; letter-spacing: .12em;
          text-transform: uppercase; padding: 4px 9px; border: 1px solid var(--hair);
          opacity: .8; }
.mb-tag.is-diet { border-color: rgba(176,193,142,.4); color: #B0C18E; }
.mb-tag.is-ask { border-color: rgba(212,184,90,.45); color: var(--gold); opacity: 1; }
.mb-tags.is-small .mb-tag { font-size: 9px; padding: 3px 7px; }

.mb-meta { display: flex; flex-wrap: wrap; gap: 20px; font-family: var(--mono);
           font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
           opacity: .5; margin-top: 12px; }

.mb-set { padding: 4px 0 30px; }
.mb-courses { list-style: none; margin: 14px 0 0; padding: 0; }
.mb-course { padding: 0 0 16px; }
.mb-course-label { font-family: var(--mono); font-size: 9.5px; letter-spacing: .18em;
                   text-transform: uppercase; color: var(--gold); margin-bottom: 5px; }
.mb-course-dish { font-family: var(--mono); font-size: 15px; line-height: 1.6; }
.mb-course-note { font-family: var(--mono); font-size: 11.5px; line-height: 1.85;
                  opacity: .58; margin-top: 4px; }

.mb-legal { font-family: var(--mono); font-size: 10.5px; line-height: 1.95;
            color: rgba(229,212,194,.4); margin-top: 48px; max-width: 68ch;
            border-top: 1px solid var(--hair); padding-top: 20px; }

/* The tablet stands on a table and is read at arm's length, often by two people
   at once, so everything grows and hover goes away. */
.mb.is-kiosk .mb-tab { font-size: 26px; padding: 18px 6px 20px; }
.mb.is-kiosk .mb-tab-sub { font-size: 12px; }
.mb.is-kiosk .mb-note { font-size: 14px; }
.mb.is-kiosk .mb-name { font-size: 21px; }
.mb.is-kiosk .mb-name.is-set { font-size: 26px; }
.mb.is-kiosk .mb-price { font-size: 19px; min-width: 140px; }
.mb.is-kiosk .mb-row { padding: 12px 0; min-height: 56px; }
.mb.is-kiosk .mb-desc { font-size: 15px; }
.mb.is-kiosk .mb-vname { font-size: 28px; }
.mb.is-kiosk .mb-logo { width: 260px; height: 100px; }
.mb.is-kiosk .mb-course-dish { font-size: 19px; }
.mb.is-kiosk .mb-tag { font-size: 11px; padding: 5px 11px; }
.mb.is-kiosk .mb-meta { font-size: 12px; }
.mb.is-kiosk .mb.is-kiosk .mb-row:hover .mb-name { color: inherit; }
.mb.is-kiosk .mb-item.is-open .mb-name { color: var(--gold); }

/* ── A TABLET LYING DOWN ────────────────────────────────────────────────────
   A room tablet in landscape is about 800px tall, and the portrait layout put
   ONE of seven dishes above the bar: the crest, the wordmark, the tabs and the
   standfirst between them ate 60% of the screen, while the list ran down a
   narrow column leaving half the glass empty.
   Nobody scrolls a menu they have not been given a reason to scroll, so on a
   short wide screen the titling shrinks and the restaurants sit side by side.
   Keyed on height as well as width, so a phone held sideways is not caught. */
@media (min-width: 1000px) and (max-height: 900px) {
  .mb.is-kiosk .mb-inner { max-width: 1180px; padding-bottom: 40px; }
  .mb.is-kiosk .mb-masthead { padding-bottom: 14px; }
  .mb.is-kiosk .mb-crest { height: 42px; }
  .mb.is-kiosk .mb-wordmark { font-size: 19px; margin-top: 7px; }
  .mb.is-kiosk .mb-tab { font-size: 21px; padding: 10px 4px 12px; }
  .mb.is-kiosk .mb-note { font-size: 12.5px; margin-bottom: 26px; max-width: 74ch; }
  /* Multi-column, not a two-column grid: grid rows align to the tallest cell,
     so a restaurant with one dish left a hole the height of a restaurant with
     three. Columns let a short venue and the next one stack in the same
     column. break-inside keeps a restaurant whole. */
  .mb.is-kiosk .mb-venues { columns: 2; column-gap: 56px; }
  .mb.is-kiosk .mb-venue { margin-bottom: 34px; break-inside: avoid;
                           -webkit-column-break-inside: avoid; }
  .mb.is-kiosk .mb-vhead { margin-bottom: 12px; }
  .mb.is-kiosk .mb-logo { width: 200px; height: 74px; }
  .mb.is-kiosk .mb-name { font-size: 18px; }
  .mb.is-kiosk .mb-price { font-size: 16px; min-width: 118px; }
  .mb.is-kiosk .mb-row { padding: 8px 0; min-height: 0; }
  .mb.is-kiosk   .mb.is-kiosk .mb-legal { margin-top: 26px; }
}

@media (max-width: 600px) {
  .mb-tab { font-size: 16px; }
  .mb-name { font-size: 14px; }
  .mb-price { font-size: 13px; min-width: 88px; }
  .mb-row { gap: 14px; }
  .mb-watermark { right: -34%; opacity: .035; }
    .mb-crest { height: 58px; }
  .mb-wordmark { font-size: 21px; }
}
`
