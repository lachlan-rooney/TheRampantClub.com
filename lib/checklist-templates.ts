// Hardcoded templates for the opening and closing shift checklists.
// Items are keyed by id so a future schema migration can rename labels
// without losing the historical checked state.
//
// Edit this file to add / remove / rename items. Existing checklist rows
// in the DB keep whatever items they recorded; the page falls back to the
// template only when there is no row for the date yet.

export interface ChecklistItem {
  id: string
  label: string
}

export const OPENING_ITEMS: ChecklistItem[] = [
  { id: 'doors-unlocked',     label: 'Doors unlocked, alarm disarmed' },
  { id: 'lights-hvac',        label: 'Lights and HVAC checked, music system tested' },
  { id: 'cash-float',          label: 'Cash float counted and signed off' },
  { id: 'bar-setup',           label: 'Bar setup — glassware polished, ice, mixers stocked' },
  { id: 'whisky-inventory',    label: 'Whisky inventory verified against the bar list' },
  { id: 'lockers-checked',     label: 'Member lockers checked — any bottles out for service?' },
  { id: 'tables-set',          label: 'Tables wiped, candles lit, menus placed' },
  { id: 'bathrooms-inspected', label: 'Bathrooms inspected, stocked, lit' },
  { id: 'bookings-reviewed',   label: "Tonight's bookings reviewed; MX Daily read" },
  { id: 'staff-briefed',       label: 'Staff briefed — any VIPs, allergies, anniversaries flagged' },
]

export const CLOSING_ITEMS: ChecklistItem[] = [
  { id: 'cash-reconciled',     label: 'Cash counted, reconciled, secured' },
  { id: 'pos-closed',          label: 'POS closed out, day report saved' },
  { id: 'bottles-returned',    label: 'Bottles returned to lockers or back-bar' },
  { id: 'glassware-washed',    label: 'Glassware washed, polished, put away' },
  { id: 'tables-reset',        label: 'Tables reset for tomorrow' },
  { id: 'bathrooms-cleaned',   label: 'Bathrooms cleaned and stocked' },
  { id: 'rubbish-out',         label: 'Rubbish, linen, recycling out' },
  { id: 'hvac-music',          label: 'HVAC set to overnight, music off' },
  { id: 'doors-locked',        label: 'Doors locked, alarm armed' },
  { id: 'handover-note',       label: 'Handover note written for tomorrow morning' },
]

export function templateFor(kind: 'opening' | 'closing'): ChecklistItem[] {
  return kind === 'opening' ? OPENING_ITEMS : CLOSING_ITEMS
}
