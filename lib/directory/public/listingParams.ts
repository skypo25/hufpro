/**
 * Normalisiert Listing-Query-Parameter (URL → Data-Layer).
 * Ungültige UUIDs werden ignoriert, damit Supabase keine Fehler wirft.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const RADIUS_KM_OPTIONS = [5, 10, 25, 30, 50, 100] as const
export type RadiusKmOption = (typeof RADIUS_KM_OPTIONS)[number]
export const DEFAULT_RADIUS_KM: RadiusKmOption = 25

/**
 * Photon: Bounding Box D-A-CH (minLon,minLat,maxLon,maxLat) für Ortssuche im Verzeichnis.
 * Umschließt Deutschland, Österreich und die Schweiz (ohne Nachbarländer).
 */
export const DIRECTORY_PHOTON_DACH_BBOX = '5.85,45.75,17.20,55.08' as const

/** ISO-3166-1 alpha-2 (Kleinbuchstaben) — Autocomplete-Vorschläge filtern. */
export const DIRECTORY_AUTOCOMPLETE_COUNTRY_CODES = ['de', 'at', 'ch'] as const

/**
 * Photon `/api`-Parameter `layer` (mehrfach): nur Siedlungen / Verwaltungsteile, keine Straßen/Häuser.
 * @see https://github.com/komoot/photon/blob/master/docs/api-v1.md
 */
export const DIRECTORY_PHOTON_PLACE_LAYERS = ['city', 'locality', 'district'] as const

export function isLikelyUuid(value: string | undefined | null): boolean {
  if (!value?.trim()) return false
  return UUID_RE.test(value.trim())
}

export function parseRadiusKm(raw: string | undefined): RadiusKmOption {
  const n = parseInt(raw ?? '', 10)
  return (RADIUS_KM_OPTIONS as readonly number[]).includes(n) ? (n as RadiusKmOption) : DEFAULT_RADIUS_KM
}

export type BehandlerListingQuery = {
  /** Freitext Ort / PLZ (Geocode-Ziel); legacy `city` wird beim Parsen übernommen. */
  location: string
  radiusKm: RadiusKmOption
  specialtyId: string
  animalTypeId: string
  subcategoryId: string
  methodId: string
  serviceType: string
  /** `newest` | `name` | `distance` (Umkreis) | leer (= Standard) */
  sort: '' | 'newest' | 'name' | 'distance'
  page: number
}

export function parseBehandlerListingQuery(raw: {
  location?: string
  city?: string
  radiusKm?: string
  specialtyId?: string
  animalTypeId?: string
  subcategoryId?: string
  methodId?: string
  serviceType?: string
  sort?: string
  page?: string
}): BehandlerListingQuery {
  const pageRaw = Math.max(1, parseInt(raw.page ?? '1', 10) || 1)
  const loc = (raw.location ?? raw.city ?? '').trim()
  const sortRaw = raw.sort?.trim()
  const sort =
    sortRaw === 'newest' || sortRaw === 'name' || sortRaw === 'distance'
      ? (sortRaw as 'newest' | 'name' | 'distance')
      : ('' as const)

  return {
    location: loc,
    radiusKm: parseRadiusKm(raw.radiusKm),
    specialtyId: isLikelyUuid(raw.specialtyId) ? raw.specialtyId!.trim() : '',
    animalTypeId: isLikelyUuid(raw.animalTypeId) ? raw.animalTypeId!.trim() : '',
    subcategoryId: isLikelyUuid(raw.subcategoryId) ? raw.subcategoryId!.trim() : '',
    methodId: isLikelyUuid(raw.methodId) ? raw.methodId!.trim() : '',
    serviceType:
      raw.serviceType === 'stationary' || raw.serviceType === 'mobile' || raw.serviceType === 'both'
        ? raw.serviceType
        : '',
    sort,
    page: pageRaw,
  }
}

export function listingQueryHasActiveFilters(q: BehandlerListingQuery): boolean {
  return Boolean(
    q.location ||
      q.specialtyId ||
      q.animalTypeId ||
      q.subcategoryId ||
      q.methodId ||
      q.serviceType
  )
}

/** Für Pagination-Links: nur gesetzte Werte übernehmen. */
export function toListingQueryRecord(q: BehandlerListingQuery): {
  location?: string
  radiusKm?: string
  specialtyId?: string
  animalTypeId?: string
  subcategoryId?: string
  methodId?: string
  serviceType?: string
  sort?: string
} {
  return {
    ...(q.location ? { location: q.location } : {}),
    ...(q.radiusKm !== DEFAULT_RADIUS_KM ? { radiusKm: String(q.radiusKm) } : {}),
    ...(q.specialtyId ? { specialtyId: q.specialtyId } : {}),
    ...(q.animalTypeId ? { animalTypeId: q.animalTypeId } : {}),
    ...(q.subcategoryId ? { subcategoryId: q.subcategoryId } : {}),
    ...(q.methodId ? { methodId: q.methodId } : {}),
    ...(q.serviceType ? { serviceType: q.serviceType } : {}),
    ...(q.sort ? { sort: q.sort } : {}),
  }
}

/** Konsistente Pagination- und Filter-Links. */
export function buildBehandlerListingHref(q: BehandlerListingQuery, page: number): string {
  const p = new URLSearchParams()
  if (q.location) p.set('location', q.location)
  if (q.radiusKm !== DEFAULT_RADIUS_KM) p.set('radiusKm', String(q.radiusKm))
  if (q.specialtyId) p.set('specialtyId', q.specialtyId)
  if (q.animalTypeId) p.set('animalTypeId', q.animalTypeId)
  if (q.serviceType) p.set('serviceType', q.serviceType)
  if (q.subcategoryId) p.set('subcategoryId', q.subcategoryId)
  if (q.methodId) p.set('methodId', q.methodId)
  if (q.sort) p.set('sort', q.sort)
  if (page > 1) p.set('page', String(page))
  const s = p.toString()
  return s ? `/behandler?${s}` : '/behandler'
}

/** Quick-Filter (Mobil/Praxis): Seite zurück auf 1, rest der Query unverändert. */
export function behandlerQueryWithServiceType(
  q: BehandlerListingQuery,
  serviceType: '' | 'mobile' | 'stationary' | 'both'
): BehandlerListingQuery {
  return { ...q, serviceType, page: 1 }
}
