// Curated fallbacks for the Tonight panel when admin hasn't set today's picks.
// Picks rotate deterministically by day-of-year so the same dram/vinyl/quote
// shows for everyone on a given day.

export interface SeedPick {
  label: string
  note: string
}

export const SEED_DRAMS: SeedPick[] = [
  { label: 'Lagavulin 16',          note: 'Peat, iodine, smoke. The Islay benchmark.' },
  { label: 'Yamazaki 12',           note: 'Mizunara oak, sandalwood, dried apricot.' },
  { label: 'Highland Park 18',      note: 'Heather honey and a wisp of orcadian smoke.' },
  { label: 'Glenfarclas 25',        note: 'Sherry casks, Christmas cake, deep amber.' },
  { label: 'Springbank 15',         note: 'Coastal, oily, gently smoked. Campbeltown soul.' },
  { label: 'Hibiki Harmony',        note: 'Plum wine cask, rose, sandalwood.' },
  { label: 'Talisker 10',           note: 'Sea spray, white pepper, the lift of the tide.' },
  { label: 'Bowmore 12',            note: 'Honey, lemon zest, Atlantic peat.' },
  { label: 'Caol Ila 12',           note: 'Lemon-tinged smoke. The bright Islay.' },
  { label: 'Macallan 18 Sherry Oak', note: 'Christmas spice, orange peel, dried fruit.' },
  { label: 'Nikka From The Barrel', note: 'Caramel, oak, cocoa. Punchy at 51.4%.' },
  { label: 'Glenfiddich 21 Reserva', note: 'Caribbean rum cask, banana, coconut.' },
  { label: 'Ardbeg Uigeadail',      note: 'Sherry sweetness wrestling Islay smoke.' },
  { label: 'Balvenie 14 Caribbean Cask', note: 'Soft toffee, vanilla, gentle warmth.' },
  { label: 'Aberlour A’bunadh',         note: 'Cask strength sherry monster. Belt up.' },
  { label: 'Glendronach 18 Allardice', note: 'Pedro Ximénez fruit, raisin, polished oak.' },
  { label: 'Hakushu 12',            note: 'Forest, moss, green apple. The mountain whisky.' },
  { label: 'Compass Box The Peat Monster', note: 'Smoky blended malt for the truth-seekers.' },
  { label: 'Mortlach 12',           note: 'Beast of Dufftown — meaty, sulphurous, glorious.' },
  { label: 'Kavalan Solist Sherry', note: 'Taiwanese tropical sherry bomb.' },
  { label: 'Dalmore 18',            note: 'Marmalade, dark chocolate, sherry depth.' },
  { label: 'Laphroaig 10',          note: 'Iodine and seaweed — the medicinal classic.' },
  { label: 'Clynelish 14',          note: 'Coastal wax, beeswax, Highland sea air.' },
  { label: 'Redbreast 21',          note: 'Irish pot still complexity. Tropical fruits, oak spice.' },
  { label: 'Mars Komagatake',       note: 'Japan’s highest distillery. Crisp pear, light smoke.' },
  { label: 'Glenmorangie 18',       note: 'Olorosso finish, honey, dried fig.' },
  { label: 'Bunnahabhain 18',       note: 'Unpeated Islay. Sherry, salt, walnut.' },
  { label: 'Rosebank 30',           note: 'Floral Lowland gem, sadly silent for years.' },
  { label: 'GlenDronach 21',        note: 'Sherry-forward, deep, contemplative.' },
  { label: 'Karuizawa 1981',        note: 'Mythical. If we have it, ask very politely.' },
]

export const SEED_VINYLS: SeedPick[] = [
  { label: 'Bill Evans Trio — Sunday at the Village Vanguard', note: 'Live, intimate, 1961.' },
  { label: 'Miles Davis — Kind of Blue',                       note: 'Modal jazz, eternally cool.' },
  { label: 'John Coltrane — A Love Supreme',                   note: '32 minutes of devotion.' },
  { label: 'Nina Simone — I Put a Spell on You',               note: 'Smoke, longing, command.' },
  { label: 'Tom Waits — Closing Time',                         note: 'The right record at last orders.' },
  { label: 'Stan Getz / João Gilberto — Getz/Gilberto',           note: 'Bossa nova, eternally summer.' },
  { label: 'Chứ Linh — Asia Vol. 12',                              note: 'Saigon nostalgia on vinyl.' },
  { label: 'Ahmad Jamal — At The Pershing',                    note: 'Minimal, swinging, perfect.' },
  { label: 'Dexter Gordon — Go!',                              note: 'Hard bop you can sip to.' },
  { label: 'Sade — Diamond Life',                              note: 'Smooth jazz that earned its halo.' },
  { label: 'Billie Holiday — Lady in Satin',                   note: 'Voice as scar tissue.' },
  { label: 'Ella & Louis',                                     note: 'Comfort itself.' },
  { label: 'Chet Baker — Sings',                               note: 'The whisper that defined cool.' },
  { label: 'Gil Scott-Heron — Pieces of a Man',                note: 'Spoken word, jazz, fury.' },
  { label: 'Steely Dan — Aja',                                 note: 'Studio musicianship as religion.' },
  { label: 'Pink Floyd — Wish You Were Here',                  note: 'Late hours music.' },
  { label: 'Khruangbin — The Universe Smiles Upon You',        note: 'Texas-Thai groove, low-lit.' },
  { label: 'Gillian Welch — Time (The Revelator)',             note: 'Front-porch reverence.' },
  { label: 'Nick Drake — Pink Moon',                           note: '28 minutes, no waste.' },
  { label: 'D’Angelo — Voodoo',                                  note: 'The slowest groove in the room.' },
  { label: 'Ry Cooder — Buena Vista Social Club',              note: 'Havana on a Sunday afternoon.' },
  { label: 'Astor Piazzolla — Libertango',                     note: 'Tango with a knife in its teeth.' },
  { label: 'Erykah Badu — Mama’s Gun',                          note: 'Soul, smoke, late evening.' },
  { label: 'Dire Straits — Brothers in Arms',                  note: 'A test pressing for any system.' },
  { label: 'Hiện Thục — Trống Trắng',                          note: 'Vietnamese jazz crooning.' },
  { label: 'Frank Sinatra — In the Wee Small Hours',           note: '3 AM, neat pour, Capitol Records.' },
  { label: 'Wynton Kelly Trio with Wes Montgomery — Smokin’ at the Half Note', note: 'Hard-hitting, joyful.' },
  { label: 'The Beatles — Abbey Road',                         note: 'Side B as one suite.' },
  { label: 'Marvin Gaye — What’s Going On',                       note: 'Soul as conversation.' },
  { label: 'León Bridges — Coming Home',                          note: 'A young man channelling Sam Cooke.' },
]

export const SEED_QUOTES: string[] = [
  'There are no whisky snobs here. Only enthusiasts.',
  'Pour for yourself. Stay as long as you like.',
  'Discretion is our default setting.',
  'A bottle is never poorer for being shared.',
  'The best conversations happen between sips.',
  'We do not measure. We pour.',
  'Phones face down. Glasses face up.',
  'No menus. No measures. No permission required.',
  'Strangers in the morning. Friends by closing.',
  'A good dram needs no defence.',
  'The Library Bar keeps later hours than its books.',
  'Loud opinions, soft furnishings.',
  'You’re among Rampants now.',
  'Saigon is a city of revelations. So is the cabinet.',
  'Some clubs collect members. We curate them.',
  'A whisky list is a memoir written backwards.',
  'Distill the day. Drink the result.',
  'House rules: be kind, be curious, be quiet enough.',
  'The Studio rotates. The membership doesn’t.',
  'A Rampant lion does not pour for show.',
]

// Deterministic daily index so the same fallback shows for everyone
// regardless of timezone — based on UTC date.
export function dayIndex(seed: number): number {
  const start = Date.UTC(2026, 0, 1)
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  return Math.abs((today - start) / 86400000 + seed) | 0
}
