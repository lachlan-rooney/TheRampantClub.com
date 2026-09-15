import type { Ink } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// THE ROOMS' PICTURES — what each menu is illustrated with.
// ───────────────────────────────────────────────────────────────────────────
// Art only: the menus' names, floors and PDFs stay in the pages' own data.
//
//   · the floor's rampant-lion mark, keyed by FLOOR so a menu added later
//     picks up its lion without anyone remembering to add it here
//   · the room itself, where there is a photograph of it (the backdrops the
//     spaces page uses). The Source & Origin Lab has none yet, so it is drawn
//     instead — the lion with the Duncan Taylor bottle and the botanical glass.
//     When the lab is photographed, add its slug to ROOM_PHOTO.

export const FLOOR_MARK: Record<number, Ink> = {
  1: 'floor-library-bar',
  2: 'floor-studio',
  3: 'floor-dining',
  4: 'floor-rampant-room',
  5: 'floor-lab',
}

export const ROOM_PHOTO: Record<string, { src: string; position: string }> = {
  'library-bar':  { src: '/images/floors/library-bar-backdrop.jpg',  position: '50% 42%' },
  'dining-room':  { src: '/images/floors/dining-room-backdrop.jpg',  position: '50% 55%' },
  'rampant-room': { src: '/images/floors/rampant-room-backdrop.jpg', position: '50% 60%' },
  // Not a photograph of the lab — the club's amber-lit bottles, standing in for
  // the room until it is photographed (2026-09-15, owner's choice). Replace with
  // the lab's own picture when there is one.
  'source-origin-lab': { src: '/images/brand/whisky-amber-1080.webp', position: '50% 45%' },
}
