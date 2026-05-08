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
  const [width, setWidth] = useState(0)
  const [ready, setReady] = useState(false)

  // Track container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Markers
  const markers: Marker[] = useMemo(() => ATLAS_REGIONS.map(r => {
    const count = counts[r.key] || 0
    return { ...r, count, size: 0.85 + Math.min(count, 12) * 0.10 }
  }), [counts])

  // Arcs from each stocked region to Sài Gòn
  const arcs = useMemo(() => markers
    .filter(m => m.count > 0 && (m.lat !== HOME.lat || m.lng !== HOME.lng))
    .map(m => ({
      startLat: m.lat, startLng: m.lng,
      endLat: HOME.lat, endLng: HOME.lng,
    })), [markers])

  // Initial camera + auto-rotate, once Globe is ready and width is known
  useEffect(() => {
    const g = ref.current
    if (!g || !ready || width === 0) return
    try {
      g.pointOfView({ lat: 28, lng: 80, altitude: 2.4 }, 0)
      const controls = g.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean }
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.35
      controls.enableZoom = true
      const renderer = g.renderer()
      const stop = () => { controls.autoRotate = false }
      renderer.domElement.addEventListener('pointerdown', stop, { once: true })
    } catch (err) {
      console.warn('[AtlasGlobe] init', err)
    }
  }, [ready, width])

  // Always render — let the globe size to 0×height initially, expand as soon as
  // we have a real width. Avoids the "never mounts because width was 0" trap.
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, position: 'relative' }}
    >
      <Globe
        ref={ref}
        width={width || 800}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="/images/atlas/earth-cream.jpg"
        bumpImageUrl="/images/atlas/earth-topology.png"
        atmosphereColor="#28483C"
        atmosphereAltitude={0.16}

        pointsData={markers}
        pointLat="lat"
        pointLng="lng"
        pointRadius="size"
        pointAltitude={(d: object) => 0.01 + ((d as Marker).count) * 0.012}
        pointColor={(d: object) => (d as Marker).count > 0 ? '#FF7A1F' : 'rgba(255, 122, 31, 0.7)'}
        pointLabel={(d: object) => {
          const m = d as Marker
          return `
            <div style="font-family: 'Rampant Sans', serif; font-size: 14px; color: #052E20;
                        background: #E5D4C2; padding: 8px 12px; border-radius: 6px;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
              ${m.flag} ${m.name}
              ${m.count > 0
                ? `<div style="font-family: 'Google Sans Code', monospace; font-size: 10px; color: #5E6650; margin-top: 2px;">${m.count} ${m.count === 1 ? 'bottle' : 'bottles'} in the Rampant Room</div>`
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

        onGlobeReady={() => setReady(true)}
      />
    </div>
  )
}
