import { cache } from 'react'

const DEFAULT_BASE = 'https://nominatim.openstreetmap.org'
const MAX_QUERY_LEN = 140

export type GeocodeHit = {
  lat: number
  lng: number
  /** Anzeige-Label (optional, z. B. aus Nominatim display_name). */
  displayName: string | null
}

function normalizeBaseUrl(raw: string | undefined): string {
  const s = (raw ?? DEFAULT_BASE).trim().replace(/\/$/, '')
  return s.length > 0 ? s : DEFAULT_BASE
}

/**
 * Server-only: wandelt Ort/PLZ in einen Punkt um.
 *
 * **Betrieb:** Setze `DIRECTORY_GEOCODING_USER_AGENT` (Pflicht für Nominatim-Nutzungsrichtlinien),
 * z. B. `AniDocs Verzeichnis (https://anidocs.de)`. Ohne UA: kein externer Call → `null`.
 *
 * Optional: `DIRECTORY_GEOCODE_BASE_URL` (Default: öffentliches Nominatim — nur moderat nutzen;
 * für Produktion eigene Instanz oder kommerziellen Geocoder empfohlen, siehe Doku).
 */
export const geocodeLocationQuery = cache(async (query: string): Promise<GeocodeHit | null> => {
  const q = query.trim()
  if (q.length < 2) return null
  if (q.length > MAX_QUERY_LEN) return null

  const userAgent = process.env.DIRECTORY_GEOCODING_USER_AGENT?.trim()
  if (!userAgent) return null

  const base = normalizeBaseUrl(process.env.DIRECTORY_GEOCODE_BASE_URL)
  const url = new URL(`${base}/search`)
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'de,at,ch')

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[]
    const first = Array.isArray(data) ? data[0] : null
    if (!first?.lat || !first?.lon) return null
    const lat = parseFloat(first.lat)
    const lng = parseFloat(first.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return {
      lat,
      lng,
      displayName: typeof first.display_name === 'string' ? first.display_name : null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
})
