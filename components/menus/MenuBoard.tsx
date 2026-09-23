'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useLang, pick } from '@/lib/lang'
import { NOTE_MAX, charges, SERVICE_PCT, VAT_PCT } from '@/lib/menus/orders'
import { venueState, waitLabel, type VenueState } from '@/lib/menus/hours'
import {
  ALLERGEN_LABEL, DIETARY_LABEL, price, mediaUrl, arrivingDate, isArriving,
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
// Three services, and the switch between them is the first thing on the screen:
// PLATES go anywhere in the club, THE BAR is the club's own drinks, and DINING
// is set menus, downstairs, sat down.
//
// A dish opens in place — nothing navigates, nothing opens a modal. On a tablet
// standing on a table during service, a modal is something a member has to
// dismiss before the next person can read the menu, and it will be left open.
//
// IT IS STILL NOT A SHOP. Nothing is charged here and no payment exists
// anywhere in the system. On the room tablet a member can build a list with
// +/- and confirm it, for one reason the owner gave plainly: "so the staff
// member doesn't mess up the order and has it confirmed with the member".
// The failure being prevented is a wrong order, not an unpaid one — so the
// tray says what it is for, the word "pay" appears nowhere, and the total is
// there to be read back, not settled.
// ═══════════════════════════════════════════════════════════════════════════

type Service = 'plates' | 'cocktails' | 'dining'

export default function MenuBoard({
  venues, variant = 'member', masthead = false,
  ordering = false, onConfirm, confirmBusy = false, orderOpen = false, now: serverNow,
}: {
  venues: MenuVenueGroup[]
  variant?: 'member' | 'kiosk'
  /** The +/- steppers and the confirm tray. Kiosk only: a member's phone is a
   *  menu, not a way to send the kitchen something from outside the building. */
  ordering?: boolean
  onConfirm?: (lines: { item_id: string; qty: number }[], note: string) => void | Promise<void>
  confirmBusy?: boolean
  /** True while the room already has an order waiting for staff. The steppers
   *  stay usable — a member who forgot the olives can add them and confirm
   *  again, which replaces the open order rather than opening a second. */
  orderOpen?: boolean
  /** The CLUB's time, from the server that sent the menu. Opening hours are
   *  judged against it, never against the tablet's own clock. Absent (the
   *  members' portal) = hours are shown but nothing is shut. */
  now?: string
  /** The crest and wordmark above the list, as on the printed card. Off in the
   *  members' portal, where MemberPage has already given the page a masthead
   *  and a second one would just say the club's name twice. */
  masthead?: boolean
}) {
  const { t, lang } = useLang()
  const [service, setService] = useState<Service>('plates')
  const [open, setOpen] = useState<string | null>(null)
  /** Which restaurant's menu is expanded. One at a time. */
  const [openVenue, setOpenVenue] = useState<string | null>(null)
  // Quantities by item id. Held here rather than in the page because the rows
  // are rendered here; the page only ever sees the finished list.
  const [qty, setQty] = useState<Record<string, number>>({})

  // ── THE CLOCK ───────────────────────────────────────────────────────────
  // Measured against the server's, so a tablet whose own clock is an hour out
  // still shuts the kitchen at the right minute. Ticks every half minute: a
  // kitchen that closed at 21:30 must go dark on its own, on a tablet nobody
  // has touched since 21:00.
  const skew = useMemo(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0), [serverNow])
  const [clock, setClock] = useState(() => Date.now() + (serverNow ? new Date(serverNow).getTime() - Date.now() : 0))
  useEffect(() => {
    const tick = () => setClock(Date.now() + skew)
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [skew])

  /** Where each restaurant stands right now, by slug. */
  const states = useMemo(() => {
    const m = new Map<string, VenueState>()
    for (const v of venues) m.set(v.slug, venueState(v.hours, clock))
    return m
  }, [venues, clock])
  const isShut = (slug: string) => ordering && states.get(slug)?.open === false
  // ONE NOTE FOR THE ORDER (owner, 2026-09-23), written before confirming. It
  // is closed until asked for: a textarea sitting open on a menu invites
  // nothing useful, and a tablet keyboard covers half the screen.
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const l = lang as 'en' | 'vn'
  // What a member can eat tonight, and what is still to come — kept apart
  // rather than interleaved by the admin's display order. A restaurant that
  // opens on the 23rd is news, not an option, and should not sit between two
  // kitchens that are actually cooking.
  const serving = useMemo(() => venues.filter(v => !isArriving(v.arriving_on, l)), [venues, l])
  // The same venues, narrowed to one service each: a restaurant appears under
  // Plates only if it has plates, and the bar under Cocktails only if it has
  // drinks. Filtering the DISHES rather than tagging the venue means one
  // kitchen could one day do both without anything here changing.
  const byService = (kind: 'plate' | 'cocktail') =>
    serving
      .map(v => ({ ...v, plates: v.plates.filter(p => p.service === kind) }))
      .filter(v => v.plates.length)
  // THE PLATES TAB KEEPS THE EMPTY KITCHENS (owner, 2026-09-23: "logo with
  // menu coming soon"). Until now a restaurant with no dishes was filtered out
  // of every tab and — once its arriving date passed — dropped out of the
  // "coming" block too, so four partners who had signed were invisible on the
  // tablets. A signed partner with no menu yet is news; a silent gap is not.
  // The bar and dining tabs still filter: a restaurant with no cocktails has
  // no business on the bar tab announcing itself.
  const withPlates = useMemo(() => {
    const cooking = byService('plate')
    const cookingSlugs = new Set(cooking.map(v => v.slug))
    const empty = serving
      .filter(v => !cookingSlugs.has(v.slug) && !v.plates.length && !v.sets.length)
      .map(v => ({ ...v, plates: [] as MenuPlate[] }))
    return [...cooking, ...empty].sort((a, b) => venues.findIndex(v => v.slug === a.slug) - venues.findIndex(v => v.slug === b.slug))
  }, [serving, venues])  // eslint-disable-line react-hooks/exhaustive-deps
  const withCocktails = useMemo(() => byService('cocktail'), [serving])
  const withSets = useMemo(() => serving.filter(v => v.sets.length), [serving])
  const shown = service === 'plates' ? withPlates
              : service === 'cocktails' ? withCocktails
              : withSets

  // One restaurant on a tab (the bar is only ever the club itself) should not
  // hide its list behind a tap — there is nothing to choose between.
  useEffect(() => {
    const only = shown.length === 1 && (shown[0].plates.length || shown[0].sets.length) ? shown[0].slug : null
    setOpenVenue(prev => (only ? only : shown.some(v => v.slug === prev) ? prev : null))
  }, [service, shown])

  // What has been chosen, across every tab — a member picks a plate, then a
  // drink, and the tray has to hold both. Looked up from the venues rather
  // than stored alongside the count, so a price edited mid-service is reflected
  // before anybody confirms rather than after.
  // WHAT CAN ACTUALLY BE SENT. A member may choose a dish at 21:25 and reach
  // the tray at 21:31, by which time that kitchen has stopped taking orders.
  // Those lines leave the tray and the tray SAYS SO — quietly dropping food
  // somebody has chosen is how an order arrives short.
  const picked = useMemo(() => {
    const byVenue = new Map<string, string>()
    for (const v of venues) for (const p of v.plates) byVenue.set(p.id, v.slug)
    return venues.flatMap(v => v.plates)
      .filter(p => (qty[p.id] ?? 0) > 0 && p.price_vnd != null)
      .map(p => ({ p, n: qty[p.id], venue: byVenue.get(p.id) ?? '' }))
  }, [venues, qty])
  const chosen = useMemo(
    () => picked.filter(c => !(ordering && states.get(c.venue)?.open === false)),
    [picked, ordering, states],
  )
  const shutOut = useMemo(
    () => picked.filter(c => ordering && states.get(c.venue)?.open === false),
    [picked, ordering, states],
  )
  const total = chosen.reduce((s2, c) => s2 + (c.p.price_vnd ?? 0) * c.n, 0)
  const count = chosen.reduce((s2, c) => s2 + c.n, 0)

  // THE LINE-UP. One heading and the logos side by side, rather than four
  // near-identical blocks each repeating the same date down the page.
  // Grouped BY DATE, so if a fifth restaurant is announced for October it gets
  // its own heading instead of being quietly folded into September's. On the
  // 23rd arrivingDate() returns null for these and the whole block disappears
  // by itself — the restaurants reappear above with their menus, and there is
  // nothing to run and nothing to remember.
  const comingSoon = useMemo(() => {
    const by = new Map<string, { when: string; venues: MenuVenueGroup[] }>()
    for (const v of venues) {
      const when = arrivingDate(v.arriving_on, l)
      if (!when || !v.arriving_on) continue
      const g = by.get(v.arriving_on) ?? { when, venues: [] }
      g.venues.push(v)
      by.set(v.arriving_on, g)
    }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g)
  }, [venues, l])

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
          <button role="tab" aria-selected={service === 'cocktails'}
                  className={`mb-tab ${service === 'cocktails' ? 'is-on' : ''}`}
                  onClick={() => { setService('cocktails'); setOpen(null) }}>
            {t('The Bar', 'Quầy bar')}
            <span className="mb-tab-sub">{t('cocktails and soft drinks', 'cocktail và nước giải khát')}</span>
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
            : service === 'cocktails'
            ? t('Mixed at the Library Bar and carried to you. The whisky list is a separate thing entirely — ask for it.',
                'Được pha tại Library Bar và mang đến tận nơi. Danh sách whisky là một phần riêng — vui lòng hỏi nhân viên.')
            : t('Private catering for larger groups, cooked in our dining room and served at the table downstairs. Not available elsewhere in the club, and arranged in advance.',
                'Tiệc riêng cho nhóm đông, được nấu tại phòng ăn và phục vụ tại bàn ở tầng dưới. Không phục vụ ở khu vực khác, và cần đặt trước.')}
        </p>

        {!shown.length && (
          <p className="mb-empty">
            {t('Nothing is published on this menu yet.', 'Chưa có món nào trên thực đơn này.')}
          </p>
        )}

        {/* ── WHO IS COOKING, THEN WHAT THEY HAVE ───────────────────────
            Owner, 2026-09-23: "lay out the menus screen as just the logos,
            then you can expand the logos by tapping them". With a dozen
            restaurants the old layout was one long wall of food; a grid of
            logos is a menu of KITCHENS, which is the choice a member actually
            makes first. The food is one tap away, and the tap expands IN
            PLACE — nobody loses their place, and switching kitchens is one
            tap, not back-then-in.
            One open at a time: two open menus on a tablet is the wall again. */}
        {/* ONE RESTAURANT IS NOT A CHOICE (owner, 2026-09-23: "no idea why you
            added one on the bar bit too"). The bar tab is the club itself and
            nothing else; putting its logo up as a tile to tap asks a question
            with one answer. Straight to the list. */}
        {shown.length === 1 ? (
          <section className="mb-solo">
            <VenueHead v={shown[0]} lang={lang} t={t} state={states.get(shown[0].slug)}
                       hideName={shown[0].kind === 'house'} />
            {service !== 'dining'
              ? <PlateList plates={shown[0].plates} lang={lang} open={open}
                           onToggle={id => setOpen(o => (o === id ? null : id))}
                           qty={ordering ? qty : undefined}
                           onQty={ordering && !isShut(shown[0].slug) ? (id, n) => setQty(q => ({ ...q, [id]: n })) : undefined} />
              : shown[0].sets.map(st2 => <SetMenu key={st2.id} s={st2} />)}
          </section>
        ) : (
        <div className="mb-grid">
          {shown.map(v => {
            const st = states.get(v.slug)
            const empty = !v.plates.length && !v.sets.length
            const isOpen = openVenue === v.slug && !empty
            const wait = waitLabel(v.wait_minutes)
            return (
              <Fragment key={v.slug}>
                <button
                  type="button"
                  className={`mb-tile ${isOpen ? 'is-open' : ''} ${empty ? 'is-soon' : ''} ${isShut(v.slug) ? 'is-shut' : ''}`}
                  aria-expanded={isOpen} disabled={empty}
                  onClick={() => setOpenVenue(o => (o === v.slug ? null : v.slug))}
                >
                  <TileFace v={v} lang={lang} />
                  <span className="mb-tile-meta">
                    {empty
                      ? <span className="mb-tile-soon">{t('Menu coming soon', 'Thực đơn sắp có')}</span>
                      : <>
                          {/* What is behind the logo, so a tile is an offer
                              rather than a mystery. */}
                          <span className="mb-tile-count">
                            {service === 'dining'
                              ? t(`${v.sets.length} ${v.sets.length === 1 ? 'set menu' : 'set menus'}`, `${v.sets.length} thực đơn set`)
                              : t(`${v.plates.length} ${v.plates.length === 1 ? 'dish' : 'dishes'}`, `${v.plates.length} món`)}
                          </span>
                          {wait && <span className="mb-tile-wait">{wait}</span>}
                          {st && !st.unknown && (
                            <span className={`mb-tile-when ${st.open ? '' : 'is-shut'}`}>
                              {st.open
                                ? (st.lastOrders ? t(`until ${st.lastOrders}`, `đến ${st.lastOrders}`) : '')
                                : (st.opensAt
                                    ? (st.opensToday
                                        ? t(`closed · opens ${st.opensAt}`, `đã đóng · mở ${st.opensAt}`)
                                        : t(`closed · opens ${st.opensAt} tomorrow`, `đã đóng · mở ${st.opensAt} mai`))
                                    : t('closed', 'đã đóng'))}
                            </span>
                          )}
                        </>}
                  </span>
                  {!empty && <span className="mb-tile-chev" aria-hidden>{isOpen ? '▾' : '▸'}</span>}
                </button>

                {isOpen && (
                  <section className="mb-drawer">
                    <VenueHead v={v} lang={lang} t={t} state={st} hideName />
                    {service !== 'dining'
                      ? <PlateList plates={v.plates} lang={lang} open={open}
                                   onToggle={id => setOpen(o => (o === id ? null : id))}
                                   qty={ordering ? qty : undefined}
                                   /* A shut kitchen keeps its menu — a member may
                                      well be reading it to plan tomorrow — but it
                                      cannot be ordered from. */
                                   onQty={ordering && !isShut(v.slug) ? (id, n) => setQty(q => ({ ...q, [id]: n })) : undefined} />
                      : v.sets.map(s => <SetMenu key={s.id} s={s} />)}
                  </section>
                )}
              </Fragment>
            )
          })}
        </div>
        )}

        {/* The line-up, under the food that can be ordered now. Plates tab
            only: nobody has said which service these arrive with, and
            announcing them twice would read as two different announcements. */}
        {service === 'plates' && comingSoon.map(g => (
          <section key={g.when} className="mb-coming">
            <h3 className="mb-coming-head">{t('Coming', 'Sắp có')} {g.when}</h3>
            <div className="mb-coming-row">
              {g.venues.map(v => {
                const logo = mediaUrl(v.logo_path)
                return logo
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img key={v.slug} src={logo} alt={v.name} className="mb-coming-logo" />
                  : <span key={v.slug} className="mb-coming-name">{v.name}</span>
              })}
            </div>
          </section>
        ))}

        {/* THE TRAY. Sticky above the kiosk bar so it is reachable from
            anywhere in a long menu — a member who chose a plate at the top and
            a drink at the bottom should not have to scroll back to confirm. */}
        {ordering && (count > 0 || orderOpen || shutOut.length > 0) && (
          <div className="mb-tray" role="status">
            <div className="mb-tray-in">
              <div className="mb-tray-lines">
                {chosen.map(c => (
                  <span key={c.p.id} className="mb-tray-line">
                    <b>{c.n}</b> {pick(l, c.p.name_en, c.p.name_vn)}
                  </span>
                ))}
                {!count && orderOpen && (
                  <span className="mb-tray-line is-quiet">
                    {t('Your order is written down below.', 'Yêu cầu của quý vị được ghi bên dưới.')}
                  </span>
                )}
                {shutOut.length > 0 && (
                  <span className="mb-tray-shut">
                    {t(`${shutOut.map(c => pick(l, c.p.name_en, c.p.name_vn)).join(', ')} — that kitchen has stopped taking orders, so it is not on this order.`,
                       `${shutOut.map(c => pick(l, c.p.name_en, c.p.name_vn)).join(', ')} — nhà bếp đã ngừng nhận món, nên không nằm trong yêu cầu này.`)}
                  </span>
                )}
              </div>
              <div className="mb-tray-right">
                {/* The gross figure, because a member deciding whether to add
                    another plate is deciding against what they will pay, not
                    against the food alone. The same helper the server uses. */}
                <span className="mb-tray-total">
                  {price(charges(total).total) ?? ''}
                  {total > 0 && (
                    <span className="mb-tray-inc">
                      {t(`incl. ${Math.round(SERVICE_PCT * 100)}% service + ${Math.round(VAT_PCT * 100)}% VAT`,
                         `gồm ${Math.round(SERVICE_PCT * 100)}% phí phục vụ + ${Math.round(VAT_PCT * 100)}% VAT`)}
                    </span>
                  )}
                </span>
                <button className="mb-tray-go" disabled={!count || confirmBusy}
                        onClick={() => onConfirm?.(chosen.map(c => ({ item_id: c.p.id, qty: c.n })), note.trim())}>
                  {confirmBusy ? t('Sending…', 'Đang gửi…')
                    : orderOpen ? t('Update the order', 'Cập nhật yêu cầu')
                    : t('Confirm this order', 'Xác nhận yêu cầu')}
                </button>
              </div>
            </div>
            {/* The note. Optional, short, and read by whoever brings it. */}
            {count > 0 && (
              noteOpen ? (
                <div className="mb-tray-notebox">
                  <label htmlFor="mb-note">{t('Anything we should know?', 'Quý vị cần lưu ý điều gì?')}</label>
                  <textarea id="mb-note" value={note} maxLength={NOTE_MAX} rows={2}
                            placeholder={t('No ice · one of us is coeliac · together, please',
                                           'Không đá · một người không ăn gluten · xin phục vụ cùng lúc')}
                            onChange={e => setNote(e.target.value)} />
                  <span className="mb-tray-left">{NOTE_MAX - note.length}</span>
                </div>
              ) : (
                <button className="mb-tray-addnote" onClick={() => setNoteOpen(true)}>
                  {note.trim()
                    ? t('Edit the note', 'Sửa ghi chú')
                    : t('+ Add a note for the team', '+ Thêm ghi chú cho nhân viên')}
                </button>
              )
            )}
            <div className="mb-tray-note">
              {t('Nothing is charged here. Confirm, then press the button on your table to call a server — they place the order for you.',
                 'Không có khoản thanh toán nào tại đây. Xác nhận, sau đó nhấn nút trên bàn để gọi nhân viên — nhân viên sẽ đặt món giúp quý vị.')}
            </div>
          </div>
        )}

        <p className="mb-legal">
          {t(`Prices are before ${Math.round(SERVICE_PCT * 100)}% service charge and ${Math.round(VAT_PCT * 100)}% VAT. Dishes are prepared by our partner kitchens and plated here. Please tell any of the team about allergies or dietary needs before ordering — we will check with the kitchen.`,
             `Giá chưa bao gồm ${Math.round(SERVICE_PCT * 100)}% phí phục vụ và ${Math.round(VAT_PCT * 100)}% thuế GTGT. Các món được chế biến bởi nhà bếp đối tác và bày biện tại đây. Vui lòng báo nhân viên về dị ứng hoặc chế độ ăn trước khi gọi món — chúng tôi sẽ kiểm tra với nhà bếp.`)}
        </p>
      </div>

    </div>
  )
}

// ── A restaurant's heading ──────────────────────────────────────────────────
// The printed card has one house name at the top; this has several, because the
// club is plating from several kitchens. The logo does the work where there is
// one, and a partner who has not sent artwork still gets a proper heading.

/** The logo, or the name where a restaurant has no logo yet. Sized by CSS so
 *  a tall logo and a wide one occupy the same tile. */
function TileFace({ v, lang }: { v: MenuVenueGroup; lang: string }) {
  const logo = mediaUrl(v.logo_path)
  const tagline = pick(lang as 'en' | 'vn', v.tagline_en, v.tagline_vn)
  return (
    <span className="mb-tile-face">
      {logo
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <><img src={logo} alt="" className="mb-tile-logo" /><span className="mb-sr">{v.name}</span></>
        : <span className="mb-tile-name">{v.name}</span>}
      {tagline && <span className="mb-tile-tag">{tagline}</span>}
    </span>
  )
}

function VenueHead({ v, lang, t, state, hideName = false }: {
  v: MenuVenueGroup; lang: string
  t: (en: string, vn: string) => string
  state?: VenueState
  hideName?: boolean
}) {
  const logo = mediaUrl(v.logo_path)
  const tagline = pick(lang as 'en' | 'vn', v.tagline_en, v.tagline_vn)

  // WHERE THIS KITCHEN STANDS, in one line: the wait it quotes, and whether it
  // is taking orders. A venue with no hours set says nothing about hours at
  // all — the club has never given them, and inventing "open" would be a
  // promise. See lib/menus/hours.ts.
  const wait = waitLabel(v.wait_minutes)
  const status = !state || state.unknown ? null
    : state.open
      ? { shut: false, text: state.lastOrders ? t(`Last orders ${state.lastOrders}`, `Nhận món đến ${state.lastOrders}`) : null }
      : {
          shut: true,
          text: state.opensAt
            ? (state.opensToday
                ? t(`Closed · opens ${state.opensAt}`, `Đã đóng · mở lúc ${state.opensAt}`)
                : t(`Closed · opens ${state.opensAt} tomorrow`, `Đã đóng · mở lúc ${state.opensAt} ngày mai`))
            : t('Closed', 'Đã đóng'),
        }

  const strip = (wait || status?.text) ? (
    <div className={`mb-vstatus ${status?.shut ? 'is-shut' : ''}`}>
      {wait && <span className="mb-vwait">{wait}</span>}
      {status?.text && <span className="mb-vwhen">{status.text}</span>}
    </div>
  ) : null

  if (hideName) {
    return tagline || strip
      ? <header className="mb-vhead">{tagline && <div className="mb-vtag is-lead">{tagline}</div>}{strip}</header>
      : null
  }
  return (
    <header className={`mb-vhead ${status?.shut ? 'is-shut' : ''}`}>
      {logo
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <><img src={logo} alt={v.name} className="mb-logo" /><span className="mb-sr">{v.name}</span></>
        : <h2 className="mb-vname">{v.name}</h2>}
      {tagline && <div className="mb-vtag">{tagline}</div>}
      {strip}
    </header>
  )
}

// ── A restaurant's dishes, grouped if it offers more than one list ──────────
// Livannah run a skewer menu and a nori taco menu; without headings the two
// would read as one long list under one logo and a member would never know the
// tacos were a thing. A restaurant with a single list gets NO heading — one
// heading over one group is furniture, not information.

function PlateList({ plates, lang, open, onToggle, qty, onQty }: {
  plates: MenuPlate[]; lang: string
  open: string | null; onToggle: (id: string) => void
  qty?: Record<string, number>
  onQty?: (id: string, n: number) => void
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
              <PlateRow key={p.id} p={p} open={open === p.id} onToggle={() => onToggle(p.id)}
                        qty={qty?.[p.id]}
                        onQty={onQty ? (n: number) => onQty(p.id, n) : undefined} />
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

// ── One small dish ──────────────────────────────────────────────────────────

function PlateRow({ p, open, onToggle, qty, onQty }: {
  p: MenuPlate; open: boolean; onToggle: () => void
  /** Undefined where ordering is off — the members' portal is a menu, not a
   *  way to send the kitchen anything. */
  qty?: number
  onQty?: (next: number) => void
}) {
  const { t, lang } = useLang()
  const l = lang as 'en' | 'vn'
  const name = pick(l, p.name_en, p.name_vn)
  const desc = pick(l, p.description_en, p.description_vn)
  const avail = pick(l, p.availability_en, p.availability_vn)
  const money = price(p.price_vnd)
  const hasMore = !!(desc || avail || p.photo_path || p.allergens.length || p.dietary.length)
  // Only something with a price can be ordered. "On request" means the club has
  // not agreed a price with the kitchen, and a member should be talking to a
  // person about it rather than adding it to a list.
  const canOrder = !!onQty && p.price_vnd != null
  const n = qty ?? 0

  return (
    <li className={`mb-item ${open ? 'is-open' : ''} ${n > 0 ? 'is-wanted' : ''}`}>
      {/* A DIV, not a button. The row used to be one, and a stepper cannot live
          inside a button — nested buttons are invalid and the inner taps get
          swallowed. The name is its own button now; the stepper is a sibling. */}
      <div className="mb-row">
        <button className="mb-open" onClick={onToggle} aria-expanded={open} disabled={!hasMore}>
          <span className="mb-name">
            {name}
            {/* The whole promise of this menu is that it is quick, so the wait is
                on the row rather than hidden behind a tap. It is how a member
                actually chooses between two plates at eleven at night. */}
            {p.lead_time_minutes ? (
              <span className="mb-wait">{p.lead_time_minutes} {t('min', 'phút')}</span>
            ) : null}
          </span>
        </button>

        {canOrder && (
          <span className="mb-step">
            <button className="mb-step-btn" onClick={() => onQty!(Math.max(0, n - 1))}
                    disabled={n === 0} aria-label={`${t('One fewer', 'Bớt một')} ${name}`}>−</button>
            <span className="mb-step-n" aria-live="polite">{n || ''}</span>
            <button className="mb-step-btn" onClick={() => onQty!(Math.min(50, n + 1))}
                    aria-label={`${t('One more', 'Thêm một')} ${name}`}>+</button>
          </span>
        )}

        <span className="mb-price">
          {money ?? <em className="mb-tbc">{t('on request', 'liên hệ')}</em>}
        </span>
      </div>

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
/* Standing alone where the venue name is suppressed, it has to carry the line
   on its own — so it is gold and readable rather than a whisper under a name
   that is not there. */
.mb-vtag.is-lead { margin-top: 0; font-size: 11px; opacity: 1; color: var(--gold); }
.mb.is-kiosk .mb-vtag.is-lead { font-size: 13px; }
.mb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

/* A named list inside one restaurant. Quieter than the venue's own heading —
   it is a subdivision, not a second restaurant — but in the serif, so it reads
   as a heading rather than as another dish. */
/* THE LINE-UP. One heading and the marks side by side — four near-identical
   blocks each repeating the same date read as a fault, where a row of logos
   reads as an announcement. Quieter than the menu above it, because it is a
   promise rather than something anyone can order tonight. */
.mb-coming { margin-top: 12px; padding-top: 26px; border-top: 1px solid var(--hair); }
.mb-coming-head { font-family: var(--serif); font-size: 15px; font-weight: 500;
                  letter-spacing: .18em; text-transform: uppercase;
                  color: var(--gold); margin: 0 0 22px; }
.mb-coming-row { display: flex; flex-wrap: wrap; align-items: center;
                 gap: 34px 46px; opacity: .72; }
.mb-coming-logo { width: 140px; height: 58px; object-fit: contain;
                  object-position: center; display: block; }
.mb-coming-name { font-family: var(--serif); font-size: 19px; letter-spacing: .03em; }
.mb.is-kiosk .mb-coming-head { font-size: 17px; }
.mb.is-kiosk .mb-coming-logo { width: 180px; height: 74px; }
.mb.is-kiosk .mb-coming-name { font-size: 23px; }
@media (max-width: 600px) {
  .mb-coming-row { gap: 24px 30px; }
  .mb-coming-logo { width: 104px; height: 46px; }
  .mb-coming-name { font-size: 16px; }
}

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
.mb-row { display: flex; align-items: baseline; gap: 18px; width: 100%;
          padding: 7px 0; color: inherit; }
.mb-open { flex: 1; min-width: 0; background: none; border: none; text-align: left;
           cursor: pointer; padding: 0; color: inherit; font: inherit;
           -webkit-tap-highlight-color: transparent; transition: opacity .2s ease; }
.mb-open:focus { outline: none; }
.mb-open:focus-visible { outline: none; box-shadow: inset 3px 0 0 var(--gold); }
.mb-open[disabled] { cursor: default; }
.mb-open:active { opacity: .62; }
.mb-row.is-static { cursor: default; }

/* THE STEPPER. Big enough to hit standing up, and quiet until it is used —
   a row of bright controls down a menu would compete with the food. */
.mb-step { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 auto;
           -webkit-tap-highlight-color: transparent; }
.mb-step-btn { width: 34px; height: 34px; border-radius: 50%; cursor: pointer;
               background: none; border: 1px solid var(--hair); color: var(--cream);
               font-family: var(--mono); font-size: 17px; line-height: 1;
               display: flex; align-items: center; justify-content: center;
               transition: border-color .15s ease, color .15s ease; }
.mb-step-btn:hover { border-color: var(--gold); color: var(--gold); }
.mb-step-btn:disabled { opacity: .3; cursor: default; border-color: var(--hair); color: var(--cream); }
.mb-step-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.mb-step-n { min-width: 26px; text-align: center; font-family: var(--mono);
             font-size: 14px; color: var(--gold); }
.mb-item.is-wanted .mb-name { color: var(--gold); }
.mb.is-kiosk .mb-step-btn { width: 44px; height: 44px; font-size: 21px; }
.mb.is-kiosk .mb-step-n { min-width: 34px; font-size: 17px; }

/* THE TRAY */
.mb-tray { position: sticky; bottom: calc(var(--kiosk-bar, 0px) + 10px); z-index: 30;
           margin: 34px 0 6px; padding: 14px 18px;
           background: rgba(4, 37, 26, .97); backdrop-filter: blur(12px);
           border: 1px solid rgba(212,184,90,.4); border-radius: 3px; }
.mb-tray-in { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
.mb-tray-lines { flex: 1; min-width: 180px; display: flex; flex-wrap: wrap; gap: 4px 16px;
                 font-family: var(--mono); font-size: 12px; line-height: 1.7; }
.mb-tray-line b { color: var(--gold); font-weight: 400; }
.mb-tray-line.is-quiet { opacity: .6; }
.mb-grid { display: grid; gap: clamp(16px, 2.4vw, 36px); margin-top: 26px;
           grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
 /* NO BOXES (owner, 2026-09-23: "they don't need boxed btw, the logos"), which
    is also the house rule everywhere else on the public pages: hairlines, not
    frames. The logo sits on the ground with room around it; what marks the
    open one is a gold rule under it, not a border round it. */
.mb-tile { display: flex; flex-direction: column; align-items: center; justify-content: center;
           gap: 12px; min-height: 160px; padding: 22px 14px 18px; cursor: pointer;
           background: none; border: none; border-bottom: 1px solid transparent; border-radius: 0;
           color: inherit; font: inherit; text-align: center; position: relative;
           transition: border-color .2s ease, opacity .2s ease, transform .2s ease;
           -webkit-tap-highlight-color: transparent; }
.mb-tile:hover:not(:disabled) { transform: translateY(-2px); }
.mb-tile:hover:not(:disabled) .mb-tile-logo { opacity: 1; }
.mb-tile.is-open { border-bottom-color: var(--gold); }
.mb-tile:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }
.mb-tile:disabled { cursor: default; opacity: .72; }
.mb-tile-face { display: flex; flex-direction: column; align-items: center; gap: 8px; }
 /* BIG AND FULL STRENGTH (owner: "it makes them look dull and small"). Taking
    the frame away had shrunk them twice over — the box was padding them out,
    and they were dimmed to .88 besides. The logo IS the tile now, so it gets
    the room and its own colour. */
.mb-tile-logo { max-width: min(230px, 96%); max-height: 96px; object-fit: contain; }
.mb-tile.is-shut .mb-tile-logo, .mb-tile.is-soon .mb-tile-logo { opacity: .45; }
.mb-tile-name { font-family: 'Rampant Sans', Georgia, serif; font-size: clamp(19px, 2.4vw, 26px); line-height: 1.15; }
.mb-tile-tag { font-family: var(--mono); font-size: 10.5px; line-height: 1.5; opacity: .5; max-width: 22ch; }
.mb-tile-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px;
                font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; }
.mb-tile-count { color: rgba(229,212,194,.6); }
.mb-tile-wait { color: var(--gold); }
.mb-tile-when { color: rgba(229,212,194,.45); }
.mb-tile-when.is-shut { color: #C49555; }
.mb-tile-soon { color: rgba(229,212,194,.5); }
.mb-tile-chev { position: absolute; right: 4px; top: 6px; font-size: 11px; opacity: .3; }
.mb-tile.is-open .mb-tile-chev { opacity: .8; color: var(--gold); }
/* The expanded menu spans the whole grid, so it opens UNDER the row that was
   tapped rather than squeezing into one column.
   NOT .mb-open: that class is the dish-name button inside every row, and
   reusing it made "how many menus are open" count every dish on the page. */
.mb-drawer { grid-column: 1 / -1; border-left: 2px solid var(--gold); padding: 4px 0 18px 18px;
             animation: mb-open-in .35s cubic-bezier(.16,.84,.44,1); }
@keyframes mb-open-in { from { opacity: 0; transform: translateY(-6px); } }
.mb.is-kiosk .mb-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.mb.is-kiosk .mb-tile { min-height: 168px; }
.mb.is-kiosk .mb-tile-logo { max-height: 104px; }
.mb.is-kiosk .mb-tile-meta { font-size: 12px; }
@media (max-width: 560px) {
  .mb-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .mb-tile { min-height: 128px; padding: 14px 8px 12px; }
  .mb-tile-logo { max-height: 66px; }
  .mb-drawer { padding-left: 12px; }
}
@media (prefers-reduced-motion: reduce) { .mb-tile { transition: none; } .mb-open { animation: none; } }

.mb-vstatus { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; margin-top: 8px;
              font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
.mb-vwait { color: var(--gold); }
.mb-vwhen { color: rgba(229,212,194,.5); }
.mb-vstatus.is-shut .mb-vwhen { color: #C49555; }
.mb.is-kiosk .mb-vstatus { font-size: 12.5px; }
/* A shut kitchen keeps its menu readable — somebody may be planning tomorrow —
   but it is plainly not tonight's. */
.mb-vhead.is-shut .mb-logo, .mb-vhead.is-shut .mb-vname { opacity: .45; }
.mb-tray-shut { flex-basis: 100%; font-family: var(--mono); font-size: 11.5px; line-height: 1.6;
                color: #C49555; }
.mb-tray-right { display: flex; align-items: center; gap: 18px; flex: 0 0 auto; }
.mb-tray-total { font-family: var(--mono); font-size: 16px; white-space: nowrap; text-align: right; }
.mb-tray-inc { display: block; font-size: 10px; opacity: .55; margin-top: 3px; letter-spacing: .02em; }
.mb-tray-go { background: var(--gold); color: #052E20; border: none; border-radius: 2px;
              font-family: var(--mono); font-size: 11.5px; letter-spacing: .12em;
              text-transform: uppercase; padding: 12px 20px; cursor: pointer;
              -webkit-tap-highlight-color: transparent; }
.mb-tray-go:disabled { opacity: .45; cursor: default; }
.mb-tray-addnote { background: none; border: none; padding: 8px 0 0; cursor: pointer; font-family: var(--mono);
                   font-size: 12px; color: var(--gold); border-bottom: 1px solid transparent; }
.mb-tray-addnote:hover { border-bottom-color: var(--gold); }
.mb-tray-notebox { position: relative; margin-top: 10px; }
.mb-tray-notebox label { display: block; font-family: var(--mono); font-size: 10px; letter-spacing: .16em;
                         text-transform: uppercase; color: var(--gold); margin-bottom: 6px; }
.mb-tray-notebox textarea { width: 100%; resize: none; padding: 11px 44px 11px 12px; border-radius: 3px;
                            background: rgba(0,0,0,.25); border: 1px solid rgba(229,212,194,.25);
                            color: #F2E6D8; font-family: var(--mono); font-size: 15px; line-height: 1.5; }
.mb-tray-notebox textarea:focus { outline: none; border-color: var(--gold); }
.mb-tray-left { position: absolute; right: 10px; bottom: 10px; font-family: var(--mono); font-size: 10px; opacity: .4; }
.mb-tray-note { font-family: var(--mono); font-size: 10px; line-height: 1.7;
                opacity: .5; margin-top: 10px; }
.mb.is-kiosk .mb-tray-lines { font-size: 14px; }
.mb.is-kiosk .mb-tray-total { font-size: 20px; }
.mb.is-kiosk .mb-tray-go { font-size: 14px; padding: 16px 26px; }
.mb.is-kiosk .mb-tray-note { font-size: 12px; }
@media (max-width: 600px) {
  .mb-tray-right { width: 100%; justify-content: space-between; }
}
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
.mb-open:hover .mb-name { color: var(--gold); }
.mb-open[disabled]:hover .mb-name { color: inherit; }

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
.mb.is-kiosk .mb.is-kiosk .mb-open:hover .mb-name { color: inherit; }
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
  /* Three tabs where there were two: the label shrinks rather than wrapping
     "The Dining Room" onto a third line and shoving the menu down the page. */
  .mb-tab { font-size: 13.5px; padding: 12px 3px 14px; }
  .mb-tab-sub { font-size: 8.5px; letter-spacing: .08em; }
  .mb-name { font-size: 14px; }
  .mb-price { font-size: 13px; min-width: 88px; }
  .mb-row { gap: 14px; }
  .mb-watermark { right: -34%; opacity: .035; }
    .mb-crest { height: 58px; }
  .mb-wordmark { font-size: 21px; }
}
`
