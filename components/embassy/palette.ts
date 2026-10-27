// THE SPIRITS EMBASSY — the two colours, and the logo.
//
// The Embassy Tết page is a FORK of the club's, not a variant of it: the only
// differences are these constants and the lockup. Owner, 2026-10-27:
// "an exact copy of the TRC one in the following club colours".
//
// Why a fork and not a theme: GOLD is imported from components/public/kit by
// ten separate tet components. Threading a theme through all ten on the day of
// a live event would have put the club's own /tet one mistake away. The fork
// shares the data layer and the public kit — which is colour-agnostic, it
// takes ground and ink as props — and nothing else.
//
// ⚠ IF YOU CHANGE THE CLUB'S /tet, THE EMBASSY COPY DOES NOT FOLLOW. That is
// the price of the fork and it is deliberate. scripts/verify-embassy-tet.mjs
// checks the two stay in step on the things that matter.

/** The club's #052E20 deep green becomes Embassy navy. */
export const GROUND = '#151d2a'
/** The club's #D4B85A becomes Embassy gold. */
export const GOLD = '#d2b37f'
/** Unchanged — cream reads correctly on the navy, and the owner specified two colours. */
export const CREAM = '#E5D4C2'

/** True vector, 17 paths, landscape lockup (viewBox 0 0 107 43). */
export const TSE_LOGO = '/images/brand/tse-gold.svg'
