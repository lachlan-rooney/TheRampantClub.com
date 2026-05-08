'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { ATLAS_REGIONS, SAIGON, type AtlasRegion } from '@/lib/whisky-atlas-data'

interface Props {
  counts: Record<string, number>
  onSelect: (r: AtlasRegion) => void
  height?: number
}

interface Marker extends AtlasRegion {
  count: number
  size: number
}

const HOME = { lat: SAIGON.lat, lng: SAIGON.lng }

export default function AtlasGlobe({ counts, onSelect, height = 560 }: Props) {
  const ref = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: height })

  // Track container width so the globe is responsive
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      setSize({ w, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [height])

  // Markers
  const markers: Marker[] = useMemo(() => ATLAS_REGIONS.map(r => {
    const count = counts[r.key] || 0
    return { ...r, count, size: 0.45 + Math.min(count, 12) * 0.06 }
  }), [counts])

  // Arcs from each region to Sài Gòn — only for regions we stock from
  const arcs = useMemo(() => markers
    .filter(m => m.count > 0 && (m.lat !== HOME.lat || m.lng !== HOME.lng))
    .map(m => ({
      startLat: m.lat, startLng: m.lng,
      endLat: HOME.lat, endLng: HOME.lng,
      label: m.name,
    })), [markers])

  // Initial camera + auto-rotate
  useEffect(() => {
    const g = ref.current
    if (!g) return
    g.pointOfView({ lat: 28, lng: 80, altitude: 2.4 }, 0)
    const controls = g.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean }
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.35
    controls.enableZoom = true
    // Stop rotating once the user interacts
    const onInteract = () => { controls.autoRotate = false }
    const dom = (g as unknown as { renderer: () => { domElement: HTMLElement } }).renderer().domElement
    dom.addEventListener('pointerdown', onInteract)
    return () => dom.removeEventListener('pointerdown', onInteract)
  }, [size.w])

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      {size.w > 0 && (
        <Globe
          ref={ref}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#D4B85A"
          atmosphereAltitude={0.18}

          pointsData={markers}
          pointLat="lat"
          pointLng="lng"
          pointRadius="size"
          pointAltitude={(d: object) => 0.01 + ((d as Marker).count) * 0.012}
          pointColor={(d: object) => (d as Marker).count > 0 ? '#D4B85A' : 'rgba(229,212,194,0.55)'}
          pointLabel={(d: object) => {
            const m = d as Marker
            return `
              <div style="font-family: 'Rampant Sans', serif; font-size: 14px; color: #052E20;
                          background: #E5D4C2; padding: 8px 12px; border-radius: 6px;
                          box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
                ${m.flag} ${m.name}
                ${m.count > 0
                  ? `<div style="font-family: 'Google Sans Code', monospace; font-size: 10px; color: #5E6650; margin-top: 2px;">${m.count} ${m.count === 1 ? 'bottle' : 'bottles'} in cabinet</div>`
                  : ''}
              </div>`
          }}
          onPointClick={(d: object) => onSelect(d as Marker)}

          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={() => ['rgba(212,184,90,0.6)', 'rgba(229,212,194,0.15)']}
          arcDashLength={0.4}
          arcDashGap={0.6}
          arcDashAnimateTime={2200}
          arcStroke={0.4}
        />
      )}
    </div>
  )
}
