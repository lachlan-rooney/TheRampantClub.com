'use client'

// Bespoke SVG chart primitives. Kept inline so the dashboard inherits the
// project palette (deep green / cream / gold) without recharts overrides.

const PALETTE = ['#D4B85A', '#7AB07A', '#5E6650', '#C27070', '#E58F4A', '#9E8FC4', '#5B8FA8']

export function Donut({
  data, total, size = 160, thickness = 24, centerLabel, centerValue,
}: {
  data: { label: string; value: number; color?: string }[]
  total?: number
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string | number
}) {
  const sum = total ?? data.reduce((s, d) => s + d.value, 0)
  const r = size / 2 - thickness / 2
  const cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * r

  if (sum === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(229,212,194,0.06)" strokeWidth={thickness} />
        <text x={cx} y={cy + 4} textAnchor="middle" style={{ fontSize: 11, fontFamily: "'Google Sans Code', monospace", fill: '#B2AA98' }}>—</text>
      </svg>
    )
  }

  let offset = 0
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(229,212,194,0.06)" strokeWidth={thickness} />
      {data.filter(d => d.value > 0).map((d, i) => {
        const pct = d.value / sum
        const dash = C * pct
        const node = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={d.color || PALETTE[i % PALETTE.length]}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        )
        offset += dash
        return node
      })}
      {(centerValue != null || centerLabel) && (
        <>
          <text
            x={cx} y={cy - 2}
            textAnchor="middle"
            style={{ fontSize: 24, fontFamily: "'Rampant Sans', serif", fontWeight: 600, fill: '#E5D4C2' }}
          >
            {centerValue ?? sum}
          </text>
          {centerLabel && (
            <text
              x={cx} y={cy + 16}
              textAnchor="middle"
              style={{ fontSize: 9, fontFamily: "'Google Sans Code', monospace", fill: '#B2AA98', letterSpacing: '0.10em' }}
            >
              {centerLabel.toUpperCase()}
            </text>
          )}
        </>
      )}
    </svg>
  )
}

export function Sparkline({
  values, width = 120, height = 32, color = '#D4B85A', fill = true,
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
}) {
  if (values.length < 2) {
    return <svg width={width} height={height}><line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke="rgba(229,212,194,0.15)" strokeWidth={1} /></svg>
  }
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const dx = width / (values.length - 1)
  const points = values.map((v, i) => `${(i * dx).toFixed(1)},${(height - ((v - min) / range) * (height - 2) - 1).toFixed(1)}`)
  const line = `M ${points.join(' L ')}`
  const area = `${line} L ${width},${height} L 0,${height} Z`
  const last = values[values.length - 1]
  const lastY = height - ((last - min) / range) * (height - 2) - 1
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={area} fill={color} opacity={0.12} />}
      <path d={line} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={lastY} r={2.5} fill={color} />
    </svg>
  )
}

export function HBars({
  data, max, width = 280, barHeight = 18, gap = 6, valueFormatter,
}: {
  data: { label: string; value: number; color?: string }[]
  max?: number
  width?: number
  barHeight?: number
  gap?: number
  valueFormatter?: (v: number) => string
}) {
  const m = max ?? Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 140, fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: barHeight, background: 'rgba(229,212,194,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(d.value / m) * 100}%`,
              background: d.color || PALETTE[i % PALETTE.length],
              transition: 'width 0.5s ease',
              minWidth: d.value > 0 ? 2 : 0,
            }} />
          </div>
          <div style={{ width: 40, textAlign: 'right', fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#E5D4C2', fontWeight: 500 }}>
            {valueFormatter ? valueFormatter(d.value) : d.value}
          </div>
        </div>
      ))}
    </div>
  )
}

export function StackedBars({
  data, width = 360, height = 120, labels,
}: {
  data: { day: string; topups: number; charges: number }[]
  width?: number
  height?: number
  labels?: boolean
}) {
  const max = Math.max(1, ...data.flatMap(d => [d.topups, d.charges]))
  const barW = (width - 16) / data.length
  return (
    <svg width={width} height={height + (labels ? 16 : 0)} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const x = 8 + i * barW
        const tH = (d.topups / max) * (height - 8)
        const cH = (d.charges / max) * (height - 8)
        return (
          <g key={d.day}>
            <rect x={x + 1} y={height - tH} width={Math.max(2, barW * 0.4 - 1)} height={tH} fill="#7AB07A" rx={1} />
            <rect x={x + barW * 0.5} y={height - cH} width={Math.max(2, barW * 0.4 - 1)} height={cH} fill="#D4B85A" rx={1} />
            {labels && (
              <text x={x + barW / 2} y={height + 12} textAnchor="middle" style={{ fontSize: 8, fontFamily: "'Google Sans Code', monospace", fill: '#7E7864' }}>
                {d.day.slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function LineChart({
  data, width = 360, height = 100, valueKey = 'count',
}: {
  data: Array<Record<string, string | number>>
  width?: number
  height?: number
  valueKey?: string
}) {
  if (data.length < 2) return <svg width={width} height={height} />
  const vals = data.map(d => Number(d[valueKey]) || 0)
  const max = Math.max(1, ...vals)
  const dx = (width - 24) / (data.length - 1)
  const points = vals.map((v, i) => `${(12 + i * dx).toFixed(1)},${(height - 16 - (v / max) * (height - 32)).toFixed(1)}`)
  const line = `M ${points.join(' L ')}`
  const area = `${line} L ${12 + (vals.length - 1) * dx},${height - 16} L 12,${height - 16} Z`
  // Gridlines
  const gridY = [0.25, 0.5, 0.75].map(p => height - 16 - p * (height - 32))
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {gridY.map((y, i) => (
        <line key={i} x1={12} y1={y} x2={width - 12} y2={y} stroke="rgba(229,212,194,0.06)" strokeWidth={0.5} />
      ))}
      <path d={area} fill="#D4B85A" opacity={0.08} />
      <path d={line} stroke="#D4B85A" strokeWidth={1.6} fill="none" strokeLinejoin="round" />
      {vals.map((v, i) => (
        <circle
          key={i}
          cx={12 + i * dx}
          cy={height - 16 - (v / max) * (height - 32)}
          r={2}
          fill="#D4B85A"
        />
      ))}
      {/* x-axis sparse labels (first, mid, last) */}
      {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
        <text
          key={i}
          x={12 + i * dx}
          y={height - 2}
          textAnchor="middle"
          style={{ fontSize: 8, fontFamily: "'Google Sans Code', monospace", fill: '#7E7864' }}
        >
          {String(data[i].month || data[i].day || '').slice(2, 7)}
        </text>
      ))}
    </svg>
  )
}

export function Funnel({
  stages, conversion,
}: {
  stages: { stage: string; count: number }[]
  conversion: number
}) {
  const max = Math.max(1, ...stages.map(s => s.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stages.map((s, i) => {
        const w = (s.count / max) * 100
        const isOnboarded = i === stages.length - 1
        return (
          <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 150, fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', letterSpacing: '0.06em' }}>
              {s.stage}
            </div>
            <div style={{ flex: 1, position: 'relative', height: 24 }}>
              <div style={{
                height: '100%',
                width: `${Math.max(2, w)}%`,
                background: isOnboarded
                  ? 'linear-gradient(90deg, rgba(122,176,122,0.18), rgba(122,176,122,0.40))'
                  : 'linear-gradient(90deg, rgba(212,184,90,0.12), rgba(212,184,90,0.30))',
                border: `1px solid ${isOnboarded ? 'rgba(122,176,122,0.50)' : 'rgba(212,184,90,0.40)'}`,
                borderRadius: 3,
                transition: 'width 0.5s ease',
              }} />
              <div style={{
                position: 'absolute', top: 0, left: 8, height: 24,
                display: 'flex', alignItems: 'center',
                fontFamily: "'Google Sans Code', monospace", fontSize: 11,
                color: isOnboarded ? '#7AB07A' : '#D4B85A', fontWeight: 600,
              }}>
                {s.count}
              </div>
            </div>
          </div>
        )
      })}
      <div style={{
        marginTop: 8, padding: '8px 12px',
        background: 'rgba(122,176,122,0.06)', border: '1px solid rgba(122,176,122,0.18)',
        borderRadius: 4,
        fontFamily: "'Google Sans Code', monospace", fontSize: 11,
        color: '#7AB07A', letterSpacing: '0.06em',
      }}>
        Conversion: <strong>{conversion}%</strong> (Lead → Onboarded)
      </div>
    </div>
  )
}

export { PALETTE }
