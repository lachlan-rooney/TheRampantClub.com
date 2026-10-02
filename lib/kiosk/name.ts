/** What to call a member on screen.
 *
 * ONE COPY, because there were two and they disagreed. The card-tap path
 * (app/api/kiosk/member/identify) preferred the nickname and fell back to the
 * full name; the post-login path (app/api/kiosk/member/me) did
 * `full.split(/\s+/)[0]` and nothing else. So tapping a card greeted you
 * properly and typing your number greeted you as whatever your name began
 * with — "Mr Rooney" came back as **"Good afternoon Mr"**, which is how this
 * was found.
 *
 * ── WHY NOT JUST TAKE THE FIRST WORD ──────────────────────────────────────
 * Two reasons, and the club has both on its roster:
 *
 *  · AN HONORIFIC IS NOT A NAME. "Mr Rooney", "Miss Lan", "Dr Pham" all begin
 *    with a word nobody is called.
 *  · VIETNAMESE NAME ORDER PUTS THE GIVEN NAME LAST. "Nguyễn Văn Bình" is
 *    called Bình, never Nguyễn — greeting him by the family name is the error
 *    an English-shaped split makes every time, and most of the club's members
 *    and all of its staff have names in that order.
 *
 * The nickname is still preferred over all of it: it is the name the club
 * actually uses, entered by a person for exactly this purpose.
 */

// Lower-cased, no punctuation. Vietnamese forms included because the roster is
// mostly Vietnamese and the desk types them.
const HONORIFICS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'sir', 'dame', 'lord', 'lady',
  'anh', 'chi', 'chị', 'em', 'co', 'cô', 'chu', 'chú', 'bac', 'bác', 'ong', 'ông', 'ba', 'bà',
])

const isHonorific = (w: string) =>
  HONORIFICS.has(w.toLowerCase().replace(/[.,]/g, ''))

/** Does this name read in Vietnamese order (family name first)? Decided by the
 *  SHAPE of the name, not by guessing nationality: three or more parts, all of
 *  them short, is the Vietnamese pattern — "Nguyễn Văn Bình". A long part
 *  ("Christopher") says otherwise. Two-part names are left alone either way,
 *  because "Lan Nguyen" and "John Smith" cannot be told apart and getting it
 *  wrong on a two-part name is worse than taking the first. */
const looksVietnamese = (parts: string[]) =>
  parts.length >= 3 && parts.every(p => p.length <= 8)

export function displayFirstName(nickname: string | null | undefined, fullName: string | null | undefined): string | null {
  const nick = (nickname || '').trim()
  if (nick) {
    const n = nick.split(/\s+/).filter(w => !isHonorific(w))
    if (n.length) return n[0]
  }

  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean).filter(w => !isHonorific(w))
  if (!parts.length) return null
  if (parts.length === 1) return parts[0]
  return looksVietnamese(parts) ? parts[parts.length - 1] : parts[0]
}
