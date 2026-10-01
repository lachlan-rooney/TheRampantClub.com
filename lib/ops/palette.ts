// TRC Operations Hub — IDENTITY colours, kept out of STATUS colours' way.
//
// Owner, 2026-10-01: "The colours overlap with the overdue, done etc. Maybe we
// find a way to make them differentiated. Maybe the colours of the boards can
// be muted vibey colours, Navy, Dark purple, etc etc. Then the red yellow and
// green can remain for the progress?"
//
// He is right, and it was worse than it looked. The old board palette was not
// merely similar to the status palette — it WAS the status palette. Gold
// #D4B85A was offered as a board colour and is "upcoming"; rust #C27070 is
// "overdue" AND "urgent" AND the delete button; olive #5E6650 is normal
// priority; sage and fairway sit where "done" green lives; amber #C45A28 is a
// hair from "due soon". On the live boards, Vinamilk wore the exact upcoming
// gold, The Open wore near-done green, and two Tết boards wore priority olive.
// Nothing was wrong on any screen — every screen was just saying two things at
// once with the same ink.
//
// ── THE RULE, and it is the whole point ───────────────────────────────────
//
//   STATUS IS WARM.      Green, red, amber, gold, grey — lib/ops/status.ts.
//                        It answers "how is this going?"
//   IDENTITY IS COOL.    Navy through teal to plum — this file.
//                        It answers "what does this belong to?"
//
// The two families do not meet: every colour here sits between roughly 180°
// and 320° on the wheel, and every status colour sits between 0° and 120°.
// That gap is the design. A dot can never be mistaken for an alarm, and a bar
// turning red means one thing only. It also survives being looked at quickly
// by somebody standing up, which is how these boards are actually read.
//
// ── WHY ONE FILE FOR BOTH BOARDS AND LABELS ───────────────────────────────
// A board's edge and a card's [label] chip are both IDENTITY, and both sit on
// the same card as the status pill. They share this palette for the same
// reason the board and the Gantt share status.ts: two lists drift, one cannot.
// If a label chip and a board dot ever wear the same colour that is a small
// ambiguity between two kinds of identity — survivable. Either of them being
// read as "overdue" is not.
//
// Readability: every hex here is light enough to carry on the house green
// (#052E20) as a 3px edge and an 8px dot, and muted enough not to shout over
// the cream type beside it.

export type BoardColour = { hex: string; name: [string, string] }

export const BOARD_COLOURS: BoardColour[] = [
  { hex: '#64748B', name: ['Slate', 'Xám đá'] },
  { hex: '#3C5A8F', name: ['Navy', 'Xanh hải quân'] },
  { hex: '#4B87A8', name: ['Steel', 'Xanh thép'] },
  { hex: '#3E7F7C', name: ['Teal', 'Xanh mòng két'] },
  { hex: '#5E58A6', name: ['Indigo', 'Chàm'] },
  { hex: '#7A5190', name: ['Plum', 'Mận'] },
  { hex: '#9A5E92', name: ['Orchid', 'Lan tím'] },
  { hex: '#566270', name: ['Ink', 'Mực'] },
]

// Slate, not the old olive. The default has to be the most neutral thing in
// the family rather than a colour with an opinion — a board nobody has chosen
// a colour for should look unchosen.
export const DEFAULT_BOARD_COLOUR = BOARD_COLOURS[0].hex

// The [label] chips on a card. The same eight, in a different order so that a
// board and the first label on it are unlikely to land on the same colour by
// accident — labelColour() hashes the text into this list, and boards are
// picked by hand from the top of the other.
export const LABEL_COLOURS: string[] = [
  '#4B87A8', '#7A5190', '#3E7F7C', '#9A5E92',
  '#3C5A8F', '#64748B', '#5E58A6', '#566270',
]

/** Is this hex one a human could mistake for a status? Used by the picker's
 *  caption, and worth keeping honest if anybody adds a colour above. */
export const RESERVED_FOR_STATUS = ['#7AB07A', '#C27070', '#E0934A', '#D4B85A', '#7E7864']
