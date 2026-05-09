'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { ATLAS_REGIONS, SAIGON, type AtlasRegion } from '@/lib/whisky-atlas-data'

interface Props {
  counts: Record<string, number>
  height?: number
}

interface Marker extends AtlasRegion {
  count: number
  size: number
}

const HOME = { lat: SAIGON.lat, lng: SAIGON.lng }

export default function AtlasGlobe({ counts, height = 560 }: Props) {
  const ref = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

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

  // Initial camera + auto-rotate. Poll until the Globe ref is wired up by
  // react-globe.gl, since onGlobeReady can fire synchronously during render
  // (which would warn about state updates on an unmounted component).
  useEffect(() => {
    if (!width) return
    let cancelled = false
    let raf = 0
    const init = () => {
      if (cancelled) return
      const g = ref.current
      if (!g) { raf = requestAnimationFrame(init); return }
      try {
        g.pointOfView({ lat: SAIGON.lat, lng: SAIGON.lng, altitude: 2.0 }, 0)
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
    }
    init()
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [width])


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
        pointAltitude={(d: object) => {
          const c = (d as Marker).count
          // Square-root curve, gentler than linear, taller than the previous
          // pass. 1 bottle ≈ 0.06, 4 ≈ 0.10, 9 ≈ 0.14, 25 ≈ 0.22, capped beyond.
          return 0.015 + Math.sqrt(Math.min(c, 36)) * 0.045
        }}
        pointColor={(d: object) => (d as Marker).count > 0 ? '#FF7A1F' : 'rgba(255, 122, 31, 0.7)'}
        pointLabel={(d: object) => {
          const m = d as Marker
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const chips = m.character.slice(0, 3).map(c => `
            <span style="font-family: 'Google Sans Code', monospace; font-size: 8px;
                         letter-spacing: 0.05em; padding: 2px 7px; border-radius: 9px;
                         background: rgba(40,72,60,0.12); color: #28483C; margin-right: 4px;">
              ${esc(c)}
            </span>`).join('')
          const distilleries = m.distilleries.slice(0, 3).map(esc).join(' · ')
          return `
            <div style="font-family: 'Rampant Sans', serif; color: #052E20;
                        background: #E5D4C2; padding: 12px 14px; border-radius: 8px;
                        box-shadow: 0 12px 32px rgba(5,46,32,0.32);
                        max-width: 260px; line-height: 1.4;">
              <div style="font-size: 14px; font-weight: 500;">
                ${m.flag} ${esc(m.name)}
                ${m.native && m.native !== m.name
                  ? `<span style="font-family: 'Google Sans Code', monospace; font-size: 9px; color: #5E6650; margin-left: 6px; letter-spacing: 0.06em;">${esc(m.native)}</span>`
                  : ''}
              </div>
              ${m.count > 0
                ? `<div style="font-family: 'Google Sans Code', monospace; font-size: 10px; color: #FF7A1F; margin-top: 4px; font-weight: 600;">${m.count > 99 ? '99+' : m.count} ${m.count === 1 ? 'bottle' : 'bottles'} in the Rampant Room</div>`
                : ''}
              <div style="font-family: 'Google Sans Code', monospace; font-size: 10px; color: #5E6650; margin-top: 8px; line-height: 1.55;">
                ${esc(m.blurb)}
              </div>
              ${chips ? `<div style="margin-top: 8px;">${chips}</div>` : ''}
              ${distilleries ? `
                <div style="font-family: 'Google Sans Code', monospace; font-size: 9px; color: #5E6650; margin-top: 8px; opacity: 0.7; letter-spacing: 0.04em;">
                  ${distilleries}
                </div>` : ''}
            </div>`
        }}

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
    </div>
  )
}
