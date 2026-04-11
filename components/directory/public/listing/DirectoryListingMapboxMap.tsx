'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { DirectoryListingMapPoint } from '@/components/directory/public/listing/directoryListingMapTypes'
import { boundingBoxForRadiusKm, circlePolygonRingLngLat } from '@/lib/directory/public/haversine'

export type { DirectoryListingMapPoint } from '@/components/directory/public/listing/directoryListingMapTypes'

const RADIUS_SOURCE = 'dlp-service-radius'
const RADIUS_FILL = 'dlp-service-radius-fill'
const RADIUS_LINE = 'dlp-service-radius-line'

type Props = {
  points: DirectoryListingMapPoint[]
  searchCenter: { lat: number; lng: number } | null
  activeId: string | null
  /** Fehlt (z. B. Server-Profilseite), bleibt die Karte passiv. */
  onMarkerClick?: (id: string) => void
  /** Optional: Einsatzradius (z. B. Profilansicht — ein Punkt + Kreis) */
  serviceRadius?: { lat: number; lng: number; radiusKm: number } | null
  /** Zusätzliche Klassen am Karten-Container (z. B. Profil-Wrapper-Höhe) */
  rootClassName?: string
  mapAriaLabel?: string
  /** Mausrad: Seite scrollen statt Karte zoomen (sinnvoll in Profil / Wizard). Suchkarte: true. */
  scrollZoom?: boolean
}

/** Öffentlicher Mapbox-Token (URL-Limits beachten). */
const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL?.trim() ||
  'mapbox://styles/skypo25/cmnqdynt2000k01qw267lb8yd'

/** BCP-47: ohne Setzung zeigen Vektorkarten oft englische Namen (z. B. „Cologne“ statt „Köln“). */
function mapboxMapLanguage(): 'auto' | string {
  const raw = process.env.NEXT_PUBLIC_MAPBOX_MAP_LANGUAGE?.trim()
  if (!raw) return 'de'
  if (raw.toLowerCase() === 'auto') return 'auto'
  return raw
}

export function DirectoryListingMapboxMap({
  points,
  searchCenter,
  activeId,
  onMarkerClick = () => {},
  serviceRadius = null,
  rootClassName,
  mapAriaLabel = 'Karte der Ergebnisse (Mapbox)',
  scrollZoom = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<InstanceType<typeof import('mapbox-gl').default.Map> | null>(null)
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const markersRef = useRef<InstanceType<typeof import('mapbox-gl').default.Marker>[]>([])
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  const [mapReady, setMapReady] = useState(false)
  const [noToken, setNoToken] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()
    const el = containerRef.current
    if (!el) return

    if (!token) {
      setNoToken(true)
      return
    }
    setNoToken(false)

    let cancelled = false

    void (async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      await import('mapbox-gl/dist/mapbox-gl.css')
      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = token
      mapboxRef.current = mapboxgl

      const map = new mapboxgl.Map({
        container: el,
        style: MAPBOX_STYLE,
        center: [10.45, 51.2],
        zoom: 5,
        scrollZoom: true,
        attributionControl: true,
        language: mapboxMapLanguage(),
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      map.on('load', () => {
        if (cancelled) return
        mapRef.current = map
        setMapReady(true)
      })
    })()

    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
      mapboxRef.current = null
      setMapReady(false)
    }
  }, [scrollZoom])

  const redraw = useCallback(() => {
    const map = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!map || !mapboxgl || !map.isStyleLoaded()) return

    if (map.getLayer(RADIUS_FILL)) map.removeLayer(RADIUS_FILL)
    if (map.getLayer(RADIUS_LINE)) map.removeLayer(RADIUS_LINE)
    if (map.getSource(RADIUS_SOURCE)) map.removeSource(RADIUS_SOURCE)

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const lngLats: [number, number][] = []

    const rKm =
      serviceRadius && Number.isFinite(serviceRadius.radiusKm) && serviceRadius.radiusKm > 0
        ? serviceRadius.radiusKm
        : null
    if (rKm != null) {
      const ring = circlePolygonRingLngLat(serviceRadius!.lat, serviceRadius!.lng, rKm)
      map.addSource(RADIUS_SOURCE, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] },
        },
      })
      map.addLayer({
        id: RADIUS_FILL,
        type: 'fill',
        source: RADIUS_SOURCE,
        paint: { 'fill-color': '#52b788', 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: RADIUS_LINE,
        type: 'line',
        source: RADIUS_SOURCE,
        paint: {
          'line-color': '#52b788',
          'line-width': 2,
          'line-opacity': 0.55,
        },
      })
    }

    if (searchCenter) {
      lngLats.push([searchCenter.lng, searchCenter.lat])
      const dot = document.createElement('div')
      dot.className = 'dlp-map-search-dot'
      dot.setAttribute('title', 'Suchmittelpunkt')
      const m = new mapboxgl.Marker({ element: dot, anchor: 'center' })
        .setLngLat([searchCenter.lng, searchCenter.lat])
        .addTo(map)
      markersRef.current.push(m)
    }

    for (const p of points) {
      lngLats.push([p.lng, p.lat])
      const wrap = document.createElement('div')
      wrap.className = 'dlp-map-marker-wrap'
      const isActive = p.id === activeId
      const pin = document.createElement('div')
      pin.className = `dlp-mapbox-pin${isActive ? ' dlp-mapbox-pin--active' : ''}`
      pin.textContent = p.initials
      wrap.appendChild(pin)

      const marker = new mapboxgl.Marker({ element: wrap, anchor: 'bottom' })
        .setLngLat([p.lng, p.lat])
        .addTo(map)

      wrap.addEventListener('click', () => {
        onMarkerClickRef.current(p.id)
      })

      markersRef.current.push(marker)
    }

    if (lngLats.length === 0 && !(rKm != null)) {
      map.jumpTo({ center: [10.45, 51.2], zoom: 6 })
    } else if (lngLats.length === 1 && rKm == null) {
      map.jumpTo({ center: lngLats[0]!, zoom: 12 })
    } else if (lngLats.length === 0 && rKm != null && serviceRadius) {
      const box = boundingBoxForRadiusKm(serviceRadius.lat, serviceRadius.lng, rKm)
      map.fitBounds(
        [
          [box.minLng, box.minLat],
          [box.maxLng, box.maxLat],
        ],
        { padding: 32, maxZoom: 11, duration: 0 }
      )
    } else {
      const b = new mapboxgl.LngLatBounds(lngLats[0]!, lngLats[0]!)
      for (const c of lngLats) b.extend(c)
      if (rKm != null && serviceRadius) {
        const box = boundingBoxForRadiusKm(serviceRadius.lat, serviceRadius.lng, rKm)
        b.extend([box.minLng, box.minLat])
        b.extend([box.maxLng, box.maxLat])
      }
      map.fitBounds(b, {
        padding: 40,
        maxZoom: rKm != null ? 11 : 13,
        duration: 0,
      })
    }

    queueMicrotask(() => map.resize())
  }, [points, searchCenter, activeId, serviceRadius])

  useEffect(() => {
    if (!mapReady) return
    redraw()
  }, [mapReady, redraw])

  if (noToken) {
    return (
      <div className="dlp-map-root dlp-map-root--fallback" role="status">
        <p className="dlp-map-fallback-msg">Karte ist derzeit nicht verfügbar.</p>
        {process.env.NODE_ENV === 'development' ? (
          <p className="dlp-map-fallback-hint">
            Setze <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in <code>.env.local</code> (öffentlicher Mapbox-Token).
          </p>
        ) : null}
      </div>
    )
  }

  const rootCls = ['dlp-map-root', rootClassName].filter(Boolean).join(' ')

  return (
    <div ref={containerRef} className={rootCls} role="application" aria-label={mapAriaLabel} />
  )
}
