'use client'

import { useEffect, useRef, useState, CSSProperties } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// GoogleMapPicker — drop a pin on a satellite map, get GPS coordinates.
// No address geocoding — pure lat/lng. For "move" services, supports a second
// pin (destination) and shows the straight-line distance between them.
//
// Needs the env var NEXT_PUBLIC_GOOGLE_MAPS_KEY (a domain-restricted Maps
// JavaScript API key). If it's not set yet, the component renders a graceful
// "configure the key to activate the map" placeholder — the build never breaks.
// ─────────────────────────────────────────────────────────────────────────────

export type LatLng = { lat: number; lng: number }

type Props = {
  /** "single" = one pin (the site). "move" = two pins (origin + destination). */
  mode?: 'single' | 'move'
  /** Default map center if the user hasn't dropped a pin yet. Flagstaff, AZ by default. */
  defaultCenter?: LatLng
  defaultZoom?: number
  onChange?: (value: { origin: LatLng | null; destination: LatLng | null; distanceMiles: number | null }) => void
}

const FLAGSTAFF: LatLng = { lat: 35.1983, lng: -111.6513 }

declare global {
  interface Window {
    google?: any
    __gmapsLoading?: Promise<void>
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.maps) return Promise.resolve()
  if (window.__gmapsLoading) return window.__gmapsLoading
  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(s)
  })
  return window.__gmapsLoading
}

function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613 // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function GoogleMapPicker({
  mode = 'single',
  defaultCenter = FLAGSTAFF,
  defaultZoom = 14,
  onChange,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const originMarkerRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const lineRef = useRef<any>(null)
  const [status, setStatus] = useState<'no-key' | 'loading' | 'ready' | 'error'>(apiKey ? 'loading' : 'no-key')
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [destination, setDestination] = useState<LatLng | null>(null)
  // "which pin am I placing next" — only relevant in move mode
  const [placing, setPlacing] = useState<'origin' | 'destination'>('origin')

  useEffect(() => {
    const dist = origin && destination ? haversineMiles(origin, destination) : null
    onChange?.({ origin, destination, distanceMiles: dist })
    // redraw the connecting line
    if (mapRef.current && window.google?.maps) {
      if (lineRef.current) { lineRef.current.setMap(null); lineRef.current = null }
      if (origin && destination) {
        lineRef.current = new window.google.maps.Polyline({
          path: [origin, destination],
          geodesic: true,
          strokeColor: '#FF9500',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          map: mapRef.current,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination])

  useEffect(() => {
    if (!apiKey) return
    let cancelled = false
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapDivRef.current) return
        const g = window.google.maps
        const map = new g.Map(mapDivRef.current, {
          center: defaultCenter,
          zoom: defaultZoom,
          mapTypeId: 'hybrid', // satellite imagery + labels — the "Google Earth" feel
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: true,
        })
        mapRef.current = map
        map.addListener('click', (e: any) => {
          const pos: LatLng = { lat: e.latLng.lat(), lng: e.latLng.lng() }
          const dropMarker = (which: 'origin' | 'destination') => {
            const ref = which === 'origin' ? originMarkerRef : destMarkerRef
            if (ref.current) ref.current.setMap(null)
            ref.current = new g.Marker({
              position: pos,
              map,
              label: which === 'origin' ? (mode === 'move' ? 'A' : '') : 'B',
              title: which === 'origin' ? (mode === 'move' ? 'Current location' : 'Site') : 'Destination',
            })
            ref.current.addListener('dragend', () => {})
          }
          if (mode === 'single') {
            setOrigin(pos)
            dropMarker('origin')
          } else {
            if (placing === 'origin') {
              setOrigin(pos)
              dropMarker('origin')
              setPlacing('destination')
            } else {
              setDestination(pos)
              dropMarker('destination')
            }
          }
        })
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  const fmt = (p: LatLng | null) => (p ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : '—')
  const distance = origin && destination ? haversineMiles(origin, destination) : null

  const wrapStyle: CSSProperties = {
    fontFamily: "'Courier New', monospace",
    color: '#9ec5ff',
    fontSize: 13,
  }

  if (status === 'no-key') {
    return (
      <div style={{ ...wrapStyle, border: '1px dashed #2a3a5a', borderRadius: 8, padding: 20, background: '#070d18', textAlign: 'center' }}>
        <div style={{ color: '#FF9500', marginBottom: 6 }}>🗺️ Map picker — pending setup</div>
        <div style={{ color: '#6a8aba', fontSize: 12, lineHeight: 1.6 }}>
          The satellite map activates once the Google Maps API key is configured
          (<code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code>). Until then, you can still submit —
          we&apos;ll follow up for the exact location.
        </div>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      {mode === 'move' && (
        <div style={{ marginBottom: 8, fontSize: 12, color: placing === 'origin' ? '#00d4aa' : '#FF9500' }}>
          {placing === 'origin'
            ? '▸ Click the map to drop pin A — where the building is now.'
            : '▸ Now click — drop pin B — the destination.'}
          {origin && (
            <button
              type="button"
              onClick={() => { setPlacing('origin'); setOrigin(null); setDestination(null);
                if (originMarkerRef.current) originMarkerRef.current.setMap(null)
                if (destMarkerRef.current) destMarkerRef.current.setMap(null) }}
              style={{ marginLeft: 10, background: 'transparent', border: '1px solid #2a3a5a', color: '#9ec5ff', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            >reset pins</button>
          )}
        </div>
      )}
      {mode === 'single' && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#00d4aa' }}>
          ▸ Click the map to drop a pin on the site.{origin && (
            <button type="button" onClick={() => { setOrigin(null); if (originMarkerRef.current) originMarkerRef.current.setMap(null) }}
              style={{ marginLeft: 10, background: 'transparent', border: '1px solid #2a3a5a', color: '#9ec5ff', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>reset pin</button>
          )}
        </div>
      )}
      <div ref={mapDivRef} style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden', border: '1px solid #1a2a4a' }} />
      {status === 'error' && (
        <div style={{ marginTop: 8, color: '#ff7a7a', fontSize: 12 }}>
          Couldn&apos;t load the map (check the API key restrictions / billing). You can still submit — we&apos;ll follow up for the location.
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7 }}>
        <div><span style={{ color: '#4a9eff' }}>{mode === 'move' ? 'PIN A (current):' : 'SITE:'}</span> {fmt(origin)}</div>
        {mode === 'move' && <div><span style={{ color: '#4a9eff' }}>PIN B (destination):</span> {fmt(destination)}</div>}
        {distance != null && <div style={{ color: '#FF9500' }}>≈ {distance.toFixed(1)} miles (straight line)</div>}
      </div>
    </div>
  )
}
