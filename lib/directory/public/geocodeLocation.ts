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
 * Erster gesetzter Wert für eine kontaktierbare Origin im User-Agent (Nominatim-Richtlinie).
 * Kein Fallback auf eine Marketing-Domain ohne Env — nur explizite Deploy-/Site-URLs.
 */
function siteOriginForGeocodingUserAgent(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_DIRECTORY_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim()
  if (!raw) return null
  try {
    const withScheme = raw.startsWith('http') ? raw : `https://${raw.replace(/^\/+/, '')}`
    return new URL(withScheme).origin
  } catch {
    return null
  }
}

/**
 * User-Agent für Nominatim (und kompatible `/search`-APIs).
 *
 * 1. `DIRECTORY_GEOCODING_USER_AGENT` wenn gesetzt (empfohlen für Produktion).
 * 2. Sonst automatisch `AniDocs-Verzeichnis/1.0 (+<Origin>)` aus
 *    `NEXT_PUBLIC_DIRECTORY_SITE_URL` | `NEXT_PUBLIC_SITE_URL` | `NEXT_PUBLIC_APP_URL` | `VERCEL_URL`
 *    (auf Vercel ist `VERCEL_URL` gesetzt → Umkreis-Geocode ohne Extra-Variable).
 */
export function resolveDirectoryGeocodingUserAgent(): string | null {
  const explicit = process.env.DIRECTORY_GEOCODING_USER_AGENT?.trim()
  if (explicit) return explicit
  const origin = siteOriginForGeocodingUserAgent()
  if (!origin) return null
  return `AniDocs-Verzeichnis/1.0 (+${origin})`
}

/**
 * Server-only: wandelt Ort/PLZ in einen Punkt um.
 *
 * **Betrieb:** `DIRECTORY_GEOCODING_USER_AGENT` setzen **oder** eine der öffentlichen Site-URLs /
 * `VERCEL_URL`, damit {@link resolveDirectoryGeocodingUserAgent} einen gültigen UA erzeugt.
 * Ohne erkennbare App-URL und ohne expliziten UA: kein externer Call → `null`.
 *
 * Optional: `DIRECTORY_GEOCODE_BASE_URL` (Default: öffentliches Nominatim — nur moderat nutzen;
 * für Produktion eigene Instanz oder kommerziellen Geocoder empfohlen, siehe Doku).
 */
export const geocodeLocationQuery = cache(async (query: string): Promise<GeocodeHit | null> => {
  const q = query.trim()
  if (q.length < 2) return null
  if (q.length > MAX_QUERY_LEN) return null

  const userAgent = resolveDirectoryGeocodingUserAgent()
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
