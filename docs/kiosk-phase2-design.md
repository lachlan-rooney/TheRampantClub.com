# Kiosk Phase 2 — modes, member session, event board

Design record for branch `kiosk-phase2-modes-board`. SQL lives in `db/kiosk_phase2.sql`.
Status: **design approved in part — three decisions still open (§9). Nothing run, no app code yet.**

Phase 1 shipped the enrolled device session (`kiosk_devices`), the staff picker
(PIN → `logged_by` / `guardian_staff_id`) and the gated `/kiosk/staff` shell.
Phase 2 adds a member identity and the idle board to the *same* tablet.

---

## 1 · The three modes

| Cookie | Layer | Life |
|---|---|---|
| `trc_kiosk_device` | Phase 1 boundary — enrolled tablet | 1 year, revocable |
| `trc_kiosk_staff` | Phase 1 attribution — who is acting | 12h |
| `trc_kiosk_member` **(new)** | access boundary — opaque session token | 10 min hard |

MODE is derived server-side from which cookies are live, never from the URL:

```
member cookie + live session  → MEMBER
else staff cookie present     → STAFF
else                          → BOARD
```

`BOARD → STAFF` and `BOARD → MEMBER` are the only entries. Every exit returns to
BOARD. There is no `MEMBER ↔ STAFF` edge.

### Where MODE is enforced

1. **Data layer (the real one).** A member-mode request is served by a Supabase
   client bearing a minted *member* JWT. `auth.uid()` is that member's profile id,
   so `is_admin_uid()` is false and every admin policy refuses. Staff data is not
   hidden — it is unreadable.
2. **Middleware.** `/kiosk/staff/*` gains a second check: if a member session is
   live on this device, redirect to `/kiosk/board`. One extra anon RPC
   (`kiosk_member_session_live`), mirroring the existing `kiosk_device_active` call.
3. **Entry transition.** Minting a member session clears `trc_kiosk_staff` in the
   same response, so staff re-PIN is structural rather than a UI rule.

> **Phase 1 gap this closes.** `middleware.ts` currently gates `/kiosk/staff` on the
> device token alone. In member mode that cookie is still valid, so a back-gesture
> to `/kiosk/staff` renders the staff shell today. Phase 1's picker means it shows
> the picker rather than PII — but the requirement is *structurally impossible*,
> not *shows a picker*. Point 2 is a required part of Phase 2.

---

## 2 · The member session

The PIN mints an **opaque** 32-byte token (not a JWT); only its SHA-256 is stored.
Per request the server calls `kiosk_member_touch(device, session)`; on success it
mints a **60-second HS256 JWT** (`sub` = profile id, `role: authenticated`) with
`node:crypto` and attaches it as `Authorization` on a Supabase client.

**The JWT never reaches the browser.** That one rule delivers most of the scope
requirement: the tablet holds only an opaque handle, so no account-level GoTrue
call can be made from it, nothing is portable off-device, and no refresh token
exists anywhere.

- **TTL** 10 min hard, never extended · **idle** 90s
- **Bound** to the device row — a token replayed off-device fails the `device_id` match
- **Non-refreshable** — no refresh token is ever issued
- **Revocation** — `kiosk_member_touch` re-checks `kiosk_devices.revoked_at` every
  request; revoking the device kills live sessions immediately (`device_revoked`)
- One tablet, one member: a new login ends any prior session as `superseded`

**Open dependency.** `SUPABASE_JWT_SECRET` is not in `.env.local` (only URL, anon and
service-role, all legacy `eyJ` keys). It must be added to `.env.local` and Vercel, and
the mint must be **empirically proven** against PostgREST before anything is built on
it — Supabase has been migrating projects to asymmetric signing keys, and if this one
has moved, the shared secret will not verify. Fallback: a GoTrue admin-generated
session held server-side with the refresh token discarded.

---

## 3 · Member PIN and lockout

`member_kiosk_pins` — bcrypt, 6 digits, plaintext never stored. All three new tables
carry **RLS enabled with zero policies** — unreadable by anon *and* authenticated;
definer functions only.

**The PIN is the member's, and only the member's** (amended 2026-09-08). No function
accepts or returns a plaintext PIN except `set_my_kiosk_pin`, called *as the member*
from the member portal where they are already authenticated. It derives the member
from `auth.uid()` — `member_no` is never a parameter, so a caller cannot set a PIN for
anyone but themselves. An admin-issued PIN would be known to staff at the moment of
issuance, spoken across a bar or sent over Zalo, and it is the same staff who hold the
tablet. Nobody at the club should ever know a member's six digits.

Admin keeps exactly two powers, neither of which sets or reveals a value:
`reset_member_kiosk_pin` (clears the hash → "no PIN set") and
`clear_member_kiosk_lockout`. The original `set_member_kiosk_pin` is dropped.

Weak-PIN rejection (`kiosk_pin_is_weak`) is applied at the member's own entry point:
all-same, repeated pairs and triples, ascending and descending runs, and a blocklist.

Lockout is keyed on **membership number, not device**, so walking to the next tablet
gains nothing:

- **5 fails / 15 min** → locked 15 minutes
- **10 fails / 24h** → hard lock, admin clears
- Surfaced in the admin portal via `member_kiosk_pin_status()` — metadata only;
  `pin_hash` is returned by nothing

Two details that matter more than they look:

- `member_pin_attempts.member_no` is deliberately **not** a foreign key. Attempts
  against numbers that do not exist must still be counted, or the counter itself
  becomes an oracle for which numbers are live.
- `kiosk_member_login` returns **`null` for every failure** — wrong PIN, unknown
  member, no PIN issued, locked out, dead device, unlinked profile — and burns a
  dummy bcrypt when the member is unknown, so timing does not leak either.

Membership numbers are **typed or tapped, never listed**. A list on a bar-top screen
publishes the live numbers and puts names in front of whoever is standing there.

---

## 4 · NFC — card yes, phone no

**Decision: card only. Phone is out of scope for Phase 2, and no hooks are prepared.**

Phone tap is host card emulation: a member app on ~99 phones, and iPhone additionally
needs a Wallet pass with VAS plus certificate and entitlement. The outcome would be
Android members tapping their phone and iPhone members unable to — a split arrival
ritual in a club this size. If it is wanted later, the cross-platform version is a
rotating code in the member portal.

**Tap identifies; PIN authorises.** A card serial is a lookup key, not a secret — it
is readable and clonable with cheap hardware, and cards get lent and lost. The tap
never mints a session.

```
BOARD → card tap → PIN screen (first name + number pre-filled) → 6-digit PIN → MEMBER
```

### The two screens have different exposures

| | Public display `/kiosk/[floor]` | Enrolled-tablet PIN screen (new) |
|---|---|---|
| Shows | Full name **and credit balance** | **First name only** |
| Duration | Transient arrival greeting | Sits open ~20s while six digits are thumbed |
| Change in Phase 2 | **None — keeps exactly what it does today** | Constrained as below |

The PIN screen carries **nothing else**: no balance, no visit history, no full name,
no membership tier. First name keeps the warmth and weakens the card→name
confirmation for anyone holding a found card.

- The name lives in component state only, never persisted.
- **Abandon → BOARD after 15s since last input** (or 15s after arrival if nothing is
  typed), and the name clears with the transition.
- Suggested, not locked: 3 wrong PINs on a device returns to BOARD immediately.
  Server-side lockout counting is unaffected.

### A narrower identify endpoint is required

The existing `/api/kiosk/lookup` returns full name **and credit balance** — correct for
the public kiosk, over-broad for this screen. Phase 2 adds a device-gated
`/api/kiosk/member/identify` returning `{ member_no, first_name }` and nothing else.

**Deriving the first name.** Prefer `members.nickname`; fall back to the first token of
`full_name`. Naive first-token splitting is wrong for Vietnamese name order — "Nguyen
Van Binh" would be greeted as "Nguyen", the family name. `nickname` already exists on
`members` and is the correct field for what we call someone; populating it for VN
members is an operational task, not a schema change.

### Web NFC constraints (carried from the Phase 1 implementation)

`app/kiosk/[floor]/page.tsx` uses `NDEFReader`. Three constraints apply, and the
third needs an on-device check:

1. **Chrome on Android only.** A Samsung tablet is the supported case; iOS/Safari
   cannot do this at all.
2. **HTTPS required.**
3. **A user gesture is required before `scan()`.** ⚠ **This bites harder on the board
   than on the floor kiosk.** The board is an idle screen that may sit untouched for
   hours or days, so the first card of the evening can arrive with no prior touch and
   simply not scan.

**Mitigation plan for the board:**

- On mount, query `navigator.permissions.query({ name: 'nfc' })`. If `granted`, call
  `scan()` immediately with no gesture. This is the primary fix and covers the
  sat-all-night case after the first-ever grant. *Chrome's exact post-grant behaviour
  must be confirmed on the tablet — it is the one assumption here.*
- If `prompt`, keep the gesture listener but make the affordance honest. The floor
  kiosk already models this: its idle copy reads "Tap the screen to enable card
  sign-in" rather than implying it is listening. The board must never claim to be
  scanning when it is not.
- Do not permanently disarm on failure. The current `{ once: true }` listener is
  removed before `scan()` is known to have succeeded, so a thrown `scan()` leaves the
  page with no listener and no retry. Re-arm on throw.
- The board already polls on `next_transition_at`; on each tick, if the status is not
  `scanning` and permission is `granted`, retry `scan()`. Covers backgrounding and
  restore.
- Operationally: a staff touch when opening the room is the belt-and-braces.

**Eyeball test:** leave the board overnight, return, and tap a card cold with no prior
touch. That single test decides whether the mitigation is sufficient.

---

## 5 · The event board

**Source: the existing `calendar_entries`.** No new calendar. It already carries
`space`, date, times, `kind`, and an RLS-enforced `visibility` split.

`bookings` is **never consulted** — a member's reservation is PII and has no place on
a screen facing the room.

Five columns were missing and are added additively:

| Column | Why |
|---|---|
| `show_on_board` | explicit opt-in; not every member-visible entry belongs on a tablet |
| `doors_open_at` | ARRIVAL had no start |
| `board_note`, `board_note_vn` | the welcome line in TRC voice, bilingual — `description` is an internal operational note |
| `title_vn` | the Vietnamese half of the headline |

States are computed **per call in SQL**, in `Asia/Ho_Chi_Minh`. `kiosk_board()` also
returns `next_transition_at`, so a tablet left on for days advances on a poll with no
reload and no client-side state to go stale:

```
no_event → arrival (doors→start) → live (start→end) → wind_down (end +45m) → no_event
```

Board mode has no identity by design and therefore cannot read through RLS. Safety is
**structural**: `kiosk_board()` returns a fixed set of ten non-PII columns and nothing
else. `NO EVENT` must read as deliberate, not broken.

Voice: understated, dry, no exclamation marks, bilingual EN/VN. Brand `#052e20` /
`#e5d4c2`. Legible from a few feet, not a dense dashboard.

---

## 6 · Member mode landing (proof only)

`members` and `visits` are **admin-only** — neither has a member-own policy. So the
name cannot come from `members`, and "most recent visit" does not work under
member-own RLS today.

The landing therefore reads **`profiles.display_name`** and
**`member_taste_profiles.vector`** — both already member-own, both proven in S0–S2d.
Phase 2 proves the identity model against **zero new member RLS**, which is a stronger
proof than adding policies to make it work.

**The `visits` policy stays commented out, permanently** — not merely deferred. There
is a second reason beyond the clean proof: `visits` carries the Ritual —
`data_for_next_overture`, `last_continuum_note`, phase state, and the join to
`harmony_observations`. A member-own policy on that table gives a member row-level
access to the machinery of how they are handled, including grievance context. That is
the line between invisible personalisation and surveillance.

When the visit line is wanted in Phase 3 it comes from a **view or definer function
returning date and room and nothing else** — never a policy on `visits`. Recorded here
so it is not relitigated.

The full on-site portal is **Phase 3**, built on this proven session.

---

## 7 · What Phase 2 does not touch

- Phase 1 staff flow
- The public display kiosk `/kiosk/[floor]` and its NFC tap — including the full name
  and credit balance it shows today
- `start_visit_for_member`
- Any phone-tap groundwork

---

## 8 · Verification

Minted-session tests against ZZ-TEST fixtures, cleaned up after. Hardest on 1–3.

1. **Mode is a data-layer boundary** — a MEMBER-mode session requesting a
   staff/dossier/Harmony resource is refused at the data layer. Tested against the API,
   not the screen.
2. **No lateral escape** — no back-navigation, deep link or refresh from MEMBER mode
   reaches an authenticated STAFF view; entering MEMBER provably clears staff state.
3. **Member sees only their own** — member A's kiosk session cannot read member B's data.
4. **PIN hardening** — hashed; lockout counts per membership number and survives
   switching devices; wrong-PIN and unknown-member are identical; lockout visible in admin.
5. **Session scope** — no account-level or destructive actions; expires on TTL and idle;
   dies when the device is revoked; fails if replayed off-device.
6. **Board** — correct state with an event and the deliberate fallback without;
   time-driven transitions fire without reload after an overnight idle; no PII in the
   rendered output *or the underlying response*.
7. Phase 1 staff flow unbroken · public kiosk / NFC tap unbroken · `tsc` clean.

Plus the on-tablet eyeball: staff PIN in → hand over → member PIN in → their own view →
walk away and watch it time out to the board → confirm staff must re-PIN. And the cold
overnight NFC tap from §4.

**If check 1 or 2 fails, the single-tablet model is unsafe and the devices split instead.**

---

## 9 · Open decisions

1. ~~The room list.~~ **Closed — see §11.** Five rooms, no new space.
2. **`SUPABASE_JWT_SECRET`** — **STILL OPEN, and it is the hard gate.** Not present in
   `.env.local` as of 2026-09-08; `scripts/probe-jwt-mint.mjs` exits 2 (BLOCKED) and the
   session layer stays unbuilt until it passes or fails explicitly.
3. ~~The `visits` line.~~ **Closed — zero new member RLS. See §6.**

## 10 · Decisions locked

- Card tap yes, phone tap no — out of scope, no hooks prepared (2026-09-08)
- Tap identifies, PIN authorises
- PIN screen: **first name only**, nothing else; clears on abandon
- Public `/kiosk/[floor]` unchanged, name and credit balance included
- Membership numbers typed or tapped, never listed
- Members set their own PIN; no admin function accepts or reveals one (2026-09-08)
- Member landing reads `profiles` + `member_taste_profiles` only — zero new member RLS
- Rooms: five spaces, no new one needed — **confirmed by Lachlan, 2026-09-08** (§11)

**A note on how one of these was reached.** The room resolution was written into this
doc as a locked decision before it had been confirmed. The conclusion was right, but
the framing turned a reading of incomplete seed data into something load-bearing.
Where a name cannot be matched to seed data in future: **report the gap, do not resolve
it.** Absent seed data is at least as likely as an unrecorded rename.

---

## 11 · The rooms

One tablet per room. `kiosk_devices.room` stores the **join key** — the exact string in
`bookings.space` / `calendar_entries.space`. The floor and the display name are
presentation only.

| Floor | Display name | `room` (join key) | Seeded in `space_tables` |
|---|---|---|---|
| 1 | The Library Bar | `Library Bar` | yes |
| 2 | The Studio | `The Studio` | yes |
| 3 | The Dining Room | `The Dining Room` | yes |
| 4 | The Rampant Room | `The Rampant Room` | yes |
| 5 | Source & Origin Lab | `Source & Origin Lab` | yes |

**Floor 1 is the one trap.** It displays as "The Library Bar" but its space string is
`Library Bar`, with no "The" — the only one of the five where display and key differ.
Storing the display name would silently join nothing and the board would sit on
`no_event` forever. The admin enrol picker therefore reads
`select distinct space from space_tables` and stores that value verbatim; it never
accepts free text and never stores a display name.

**Naming notes — confirmed by Lachlan, 2026-09-08**

- *DT Gallery* is a name of the past: that room is now **The Studio** (floor 2).
- *Private Dining Room* is a name of the past: it is now **The Dining Room** (floor 3).
- The five seeded spaces are correct and complete. No space is missing.

**Canonical string: `The Dining Room`.** It is what members and staff say out loud, it
is what all three admin pickers and `VisitsPanel` already use, and `board_note` copy
reads under it — "Tonight in The Dining Room" is the sentence people say. *Private
Dining Room* survives only in one stale legacy array (§11a) and is not canonical.
- `Sports Club` is a valid `bookings.space` value but is deliberately unseeded in
  `space_tables` (zero bookable units). It takes no kiosk.

**Deferred, not scheduled.** Normalising `Library Bar` → `The Library Bar` would remove
the trap permanently, but see §11a — the reference surface is wider than three arrays.
The enrol picker reading `space_tables` verbatim removes the trap for Phase 2 without
touching a single booking row.

---

## 11a · Every reference to a space string (enumerated before any rename)

**Decision: ALIAS/display-layer, NOT rename.** The rename is *not* clean — it crosses
four tables and five hardcoded arrays carrying **two divergent vocabularies**.

**Tables with a space column**

| Table | Column | Vocabulary |
|---|---|---|
| `space_tables` | `space` | current (the seed, and the source of truth) |
| `bookings` | `space varchar(40)` | current — but its column comment still documents the legacy list |
| `calendar_entries` | `space` | current — the board's join |
| `visits` | `space` | **mixed** — free text, written by two different pickers |

**Hardcoded arrays in the app**

| File | Vocabulary |
|---|---|
| `app/admin/calendar/page.tsx:53` | current |
| `app/admin/bookings/new/page.tsx:25` | current |
| `app/admin/bookings/[id]/edit/page.tsx:15` | current |
| `app/admin/mis/VisitsPanel.tsx:26` | current, plus `''` and `Other` |
| `app/admin/mis/visits/[id]/page.tsx:109` | **LEGACY** — `Lounge · Library · Bar · Cigar Terrace · Private Dining` |

**The finding that settles it.** `app/admin/mis/visits/[id]/page.tsx` still offers the
pre-refit vocabulary, and `visits.space` is free text, so historical rows hold strings
from a set that no longer matches any room. *That* is where "Private Dining Room" in
the brief came from — a legacy `visits` value, not a missing space.

A rename would therefore have to reconcile a third vocabulary in live historical data
to be honest, and a half-renamed space silently orphans bookings. Out of scope for
Phase 2. `kiosk_devices.room` reads `space_tables` verbatim and joins
`calendar_entries.space` — both current-vocabulary — so the board is correct without
touching any of this.

**Separate task, not scheduled:** reconcile `app/admin/mis/visits/[id]/page.tsx` onto
the current vocabulary and decide what to do with legacy `visits.space` values.

---

## 12 · Consent (schema now, capture UI is Phase 3)

There is no terms or privacy consent capture anywhere today: members are admitted by
invitation and their accounts are activated, so there has never been a member-facing
sign-up screen to hang one on. The schema lands now, while the portal is already being
opened for PIN setting.

**Consent as schema, not a checkbox that gates a button.** A tick that isn't stored
proves nothing once terms change, and makes selective re-consent impossible.

- `terms_versions` — doc key, version, effective date, body or a pointer to it
- `member_consents` — **append-only**; withdrawal inserts `granted = false` rather than
  mutating, so the history is the evidence. Current state = latest row per
  `(member_no, doc_key)`
- **Three separate consents, never bundled:** `membership_terms`, `privacy`, and
  `marketing` — opt-in, and withdrawable without disturbing the other two, because they
  are separate rows with separate latest-state
- `my_consent_state()` flags a member holding a superseded version. Marketing is opt-in,
  so never having answered is not a pending action
- **No member INSERT policy exists.** Writes go through `record_my_consent()`, which
  derives `member_no` from `auth.uid()`, so a member cannot forge `given_at`, `method`,
  or another member's row. Structural, not a validation rule someone can forget
- `'kiosk'` is deliberately **not** a valid `method`. The kiosk reads consent currency
  and never captures it — nobody agrees to terms on a bar-top tablet with a queue behind
  them

**No copy is seeded.** The terms and privacy text is written in TRC voice once TNJ Law
confirms what Vietnam's regime currently requires (Decree 13 and anything since), and
the privacy notice has to describe the MIS honestly — preference profiles with
confidence scoring and decay, and Harmony Log entries that include grievances about the
member.

**Biometrics.** The entrance facial recognition on the equipment list, if it is ever
deployed, cannot ride on a general privacy consent — it is a separate, explicit,
separately-withdrawable purpose. Nothing is built for it, and **no `doc_key` is reserved
for it deliberately**: adding one later should be a considered act with counsel, not an
enum value someone finds already waiting.
