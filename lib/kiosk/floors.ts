// space string → floor page. The board knows which ROOM it stands in (the
// space_tables join key); the floor pages are keyed by slug. This is the only
// place the two vocabularies meet.
//
// Note the floor-1 asymmetry: the space string is 'Library Bar', with no "The",
// while the page calls it The Library Bar. Keep the KEY as the space string —
// it is what kiosk_devices.room stores and what calendar_entries joins on.
export const SPACE_TO_FLOOR: Record<string, string> = {
  'Library Bar':         'library-bar',
  'The Studio':          'studio',
  'The Dining Room':     'dining-room',
  'The Rampant Room':    'rampant-room',
  'Source & Origin Lab': 'source-origin-lab',
}
