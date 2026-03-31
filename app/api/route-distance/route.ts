import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CACHE_REVALIDATE_SECONDS } from '@/lib/cache/tags'

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

function roundCoord(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/**
 * Proxiert eine OSRM-Routenabfrage (Entfernung + Dauer zwischen zwei Punkten).
 * GET /api/route-distance?originLon=7.0&originLat=50.5&destLon=7.1&destLat=50.6
 * Erfordert Authentifizierung.
 *
 * Cache: nur nach Auth; Key aus gerundeten Koordinaten (kein PII, gleiche Strecke → gleicher Eintrag).
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const r1 = roundCoord(lon1, 5)
  const r2 = roundCoord(lat1, 5)
  const r3 = roundCoord(lon2, 5)
  const r4 = roundCoord(lat2, 5)

  const payload = await unstable_cache(
    async () => {
      try {
        const url = `${OSRM_URL}/${r1},${r2};${r3},${r4}?overview=false`
        const res = await fetch(url)
        const data = await res.json()
        const route = data?.routes?.[0]
        const distanceM = route?.distance
        const durationS = route?.duration
        if (typeof distanceM !== 'number') {
          return { distanceKm: null as number | null, durationMin: null as number | null }
        }
        const distanceKm = Math.round((distanceM / 1000) * 10) / 10
        const durationMin = typeof durationS === 'number' ? Math.round(durationS / 60) : null
        return { distanceKm, durationMin }
      } catch {
        return { distanceKm: null as number | null, durationMin: null as number | null }
      }
    },
    ['route-distance', String(r1), String(r2), String(r3), String(r4)],
    { revalidate: CACHE_REVALIDATE_SECONDS.routeDistance }
  )()

  return NextResponse.json(payload)
}
