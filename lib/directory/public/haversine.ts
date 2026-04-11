/** Erdkugel-Annahme wie üblich für Entfernungen unter einigen hundert Kilometern. */

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Axis-aligned Bounding Box, das den Kreis um (centerLat, centerLng) mit radiusKm enthält.
 * Für Deutschland / Mitteleuropa ohne Datumsgrenze ausreichend.
 */
export function boundingBoxForRadiusKm(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const r = Math.max(0, radiusKm)
  const latDelta = r / 111
  const cosLat = Math.cos(toRad(centerLat))
  const lngDelta = cosLat > 0.01 ? r / (111 * cosLat) : 180

  return {
    minLat: Math.max(-85, centerLat - latDelta),
    maxLat: Math.min(85, centerLat + latDelta),
    minLng: centerLng - lngDelta,
    maxLng: centerLng + lngDelta,
  }
}

/**
 * Zielpunkt auf Großkreis von (lat,lng) mit Entfernung km und Anflugwinkel (0° = Nord, 90° = Ost).
 */
export function destinationPointKm(
  lat: number,
  lng: number,
  distanceKm: number,
  bearingDeg: number
): { lat: number; lng: number } {
  const dRad = distanceKm / EARTH_RADIUS_KM
  const φ1 = toRad(lat)
  const λ1 = toRad(lng)
  const θ = toRad(bearingDeg)
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(dRad) + Math.cos(φ1) * Math.sin(dRad) * Math.cos(θ))
  let λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(dRad) * Math.cos(φ1),
      Math.cos(dRad) - Math.sin(φ1) * Math.sin(φ2)
    )
  const lon = ((((λ2 * 180) / Math.PI + 540) % 360) - 180) as number
  return { lat: (φ2 * 180) / Math.PI, lng: lon }
}

/** Ring für GeoJSON-Polygon: Kreis um Mittelpunkt (Annäherung, gleiche Kugel wie Haversine). */
export function circlePolygonRingLngLat(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  steps = 72
): [number, number][] {
  const r = Math.max(0, radiusKm)
  if (r === 0) return [[centerLng, centerLat]]
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 360
    const p = destinationPointKm(centerLat, centerLng, r, bearing)
    ring.push([p.lng, p.lat])
  }
  return ring
}
