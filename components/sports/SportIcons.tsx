// Hand-drawn SVG sport icons. Use currentColor so they pick up the parent's
// text colour — keeps them on-brand without baking palette in.

const STROKE = 1.4

export function GolfIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6.5" y1="21" x2="6.5" y2="3.5" />
      <path d="M6.5 3.5 L17 6.5 L6.5 9.5 Z" fill="currentColor" stroke="none" />
      <ellipse cx="6.5" cy="21" rx="4" ry="0.9" />
    </svg>
  )
}

export function TennisIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-32 10 10)">
        <ellipse cx="10" cy="10" rx="5" ry="6.2" />
        {/* strings */}
        <line x1="5.2" y1="10" x2="14.8" y2="10" strokeWidth={0.5} />
        <line x1="10" y1="4" x2="10" y2="16" strokeWidth={0.5} />
      </g>
      {/* handle */}
      <line x1="14.5" y1="14.5" x2="20" y2="20.5" strokeWidth={1.6} />
      <line x1="19.5" y1="20" x2="20.5" y2="21" strokeWidth={2} />
    </svg>
  )
}

export function PadelIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.5" y="2.2" width="11" height="13.5" rx="2.6" />
      <line x1="12" y1="15.7" x2="12" y2="22" />
      {/* dotted face */}
      <circle cx="9.5" cy="6"   r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="6"  r="0.7" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="9.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="12"  cy="12"  r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function HashIcon({ size = 28 }: { size?: number }) {
  // Classic stickman mid-stride. Slight forward lean, arms and legs split
  // for a sense of motion.
  const w = STROKE + 0.2
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {/* head */}
      <circle cx="13" cy="4" r="1.8" fill="currentColor" stroke="none" />
      {/* torso (slight forward lean) */}
      <line x1="13" y1="6" x2="11.5" y2="13" />
      {/* front arm — punching forward */}
      <line x1="12.5" y1="8" x2="17" y2="9.5" />
      {/* back arm — driven behind */}
      <line x1="12.5" y1="8" x2="8" y2="11" />
      {/* front leg — striking forward */}
      <line x1="11.5" y1="13" x2="16" y2="18" />
      {/* small foot on front leg */}
      <line x1="16" y1="18" x2="17.6" y2="18.2" />
      {/* back leg — driving off */}
      <line x1="11.5" y1="13" x2="7" y2="19.5" />
      {/* small foot on back leg */}
      <line x1="7" y1="19.5" x2="5.4" y2="20" />
    </svg>
  )
}

export function CrestIcon({ size = 28 }: { size?: number }) {
  // Generic shield/crest for the "Other" tile.
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5 L19.5 5 V12 C19.5 16.5 16 20 12 21.5 C8 20 4.5 16.5 4.5 12 V5 Z" />
      <path d="M9 11 L12 13.5 L15 11 M12 13.5 V17" strokeWidth={STROKE * 0.75} />
    </svg>
  )
}

const ICONS: Record<string, (p: { size?: number }) => React.JSX.Element> = {
  golf:   GolfIcon,
  tennis: TennisIcon,
  padel:  PadelIcon,
  hash:   HashIcon,
  misc:   CrestIcon,
}

export default function SportIcon({ id, size }: { id: string; size?: number }) {
  const Icon = ICONS[id] || CrestIcon
  return <Icon size={size} />
}
