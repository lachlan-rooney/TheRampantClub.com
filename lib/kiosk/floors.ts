// space string → floor page, and the floor's menu. The board knows which ROOM it
// stands in (the space_tables join key); the floor pages are keyed by slug. This is
// the only place those two vocabularies meet, and the only place a menu path lives.
//
// Note the floor-1 asymmetry: the space string is 'Library Bar', no "The", while
// the page calls it The Library Bar. The KEY is always the space string — it is
// what kiosk_devices.room stores and what calendar_entries joins on.
export const SPACE_TO_FLOOR: Record<string, string> = {
  'Library Bar':         'library-bar',
  'The Studio':          'studio',
  'The Dining Room':     'dining-room',
  'The Rampant Room':    'rampant-room',
  'Source & Origin Lab': 'source-origin-lab',
}

export const FLOOR_MENUS: Record<string, string> = {
  'library-bar':  '/documents/menus/library-bar.pdf',
  'dining-room':  '/documents/menus/nam-friends-tonight.pdf',
  'rampant-room': '/documents/menus/nam-friends-tonight.pdf',
}

/** The menu for the room a tablet stands in, or null. */
export const menuForSpace = (space?: string | null): string | null =>
  space ? FLOOR_MENUS[SPACE_TO_FLOOR[space]] ?? null : null
