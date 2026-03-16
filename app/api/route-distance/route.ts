import { NextResponse } from 'next/server'

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Proxiert eine OSRM-Routenabfrage (Entfernung + Dauer zwischen zwei Punkten).
 * GET /api/route-distance?originLon=7.0&originLat=50.5&destLon=7.1&destLat=50.6
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const originLon = searchParams.get('originLon')
  const originLat = searchParams.get('originLat')
  const destLon = searchParams.get('destLon')
  const destLat = searchParams.get('destLat')
  const lon1 = Number(originLon)
  const lat1 = Number(originLat)
  const lon2 = Number(destLon)
  const lat2 = Number(destLat)
  if (
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon2) ||
    !Number.isFinite(lat2)
  ) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }
  try {
    const url = `${OSRM_URL}/${lon1},${lat1};${lon2},${lat2}?overview=false`
    const res = await fetch(url)
    const data = await res.json()
    const route = data?.routes?.[0]
    const distanceM = route?.distance
    const durationS = route?.duration
    if (typeof distanceM !== 'number') {
      return NextResponse.json({ distanceKm: null, durationMin: null })
    }
    const distanceKm = Math.round((distanceM / 1000) * 10) / 10
    const durationMin = typeof durationS === 'number' ? Math.round(durationS / 60) : null
    return NextResponse.json({ distanceKm, durationMin })
  } catch {
    return NextResponse.json({ distanceKm: null, durationMin: null })
  }
}
