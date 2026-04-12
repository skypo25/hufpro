/**
 * Öffentliche Verzeichnisdaten — ausschließlich Reads auf directory_public_* Views.
 * Nutzt den Server-Supabase-Client (Anon + ggf. Session); RLS erlaubt SELECT auf Views.
 */

import { cache } from 'react'
import { createSupabasePublicReadClient, createSupabaseServerClient } from '@/lib/supabase-server'
import type {
  DirectoryPublicAnimalTypeRow,
  DirectoryPublicMethodRow,
  DirectoryPublicProfileAnimalRow,
  DirectoryPublicProfileMediaRow,
  DirectoryPublicProfileMethodRow,
  DirectoryPublicProfileRow,
  DirectoryPublicProfileSocialRow,
  DirectoryPublicProfileSpecialtyRow,
  DirectoryPublicProfileSubcategoryRow,
  DirectoryPublicSimilarProfileRow,
  DirectoryPublicSpecialtyRow,
  DirectoryPublicSubcategoryRow,
} from './types'
import { boundingBoxForRadiusKm, haversineDistanceKm } from './haversine'

const VIEW_PROFILES = 'directory_public_profiles'
const VIEW_SPECIALTIES = 'directory_public_specialties'
const VIEW_SUBCATEGORIES = 'directory_public_subcategories'
const VIEW_METHODS = 'directory_public_methods'
const VIEW_ANIMALS = 'directory_public_animal_types'
const VIEW_PROFILE_SPECIALTIES = 'directory_public_profile_specialties'
const VIEW_PROFILE_ANIMALS = 'directory_public_profile_animal_types'
const VIEW_PROFILE_SUBCATEGORIES = 'directory_public_profile_subcategories'
const VIEW_PROFILE_METHODS = 'directory_public_profile_methods'
const VIEW_MEDIA = 'directory_public_profile_media'
const VIEW_SOCIAL = 'directory_public_profile_social_links'

function directoryDataError(operation: string, error: { message: string }): Error {
  const base = `${operation}: ${error.message}`
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|getaddrinfo/i.test(error.message)) {
    return new Error(
      `${base} — Verbindung zu Supabase fehlgeschlagen. Lokal oft: \`supabase start\`, dann NEXT_PUBLIC_SUPABASE_URL (z. B. http://127.0.0.1:54321 statt localhost) und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local prüfen.`
    )
  }
  return new Error(base)
}

/** Für PostgREST `.or()` — Kommas/Klammern würden die Filter-Syntax brechen. */
function sanitizeIlikeFragment(s: string): string {
  return s
    .trim()
    .replace(/%/g, ' ')
    .replace(/_/g, ' ')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ListPublicProfilesParams = {
  city?: string | null
  specialtyId?: string | null
  animalTypeId?: string | null
  subcategoryId?: string | null
  methodId?: string | null
  serviceType?: string | null
  page?: number
  pageSize?: number
  /** Standard: alphabetisch. `newest`: nach created_at (View-Spalte). */
  sort?: 'display_name' | 'newest'
}

export type ListPublicProfilesResult = {
  profiles: DirectoryPublicProfileRow[]
  totalCount: number
  /** Effektive Seite nach Clamp (wenn ?page zu groß war). */
  page: number
  pageSize: number
  totalPages: number
  /** Nur bei Umkreissuche (`listPublicProfilesNear`): Distanz je Profil-ID (km). */
  distancesKmByProfileId?: Map<string, number>
}

const NEARBY_FETCH_CAP = 2000

function profileRowCoords(row: DirectoryPublicProfileRow): { lat: number; lng: number } | null {
  const lat = row.latitude != null ? Number(row.latitude) : NaN
  const lng = row.longitude != null ? Number(row.longitude) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** Umkreissuche: Sortierung nach Distanz (Standard), Name oder Neuigkeit. */
export type ListPublicProfilesNearSort = 'distance' | 'display_name' | 'newest'

export type ListPublicProfilesNearParams = {
  searchLat: number
  searchLng: number
  radiusKm: number
  specialtyId?: string | null
  animalTypeId?: string | null
  subcategoryId?: string | null
  methodId?: string | null
  serviceType?: string | null
  page?: number
  pageSize?: number
  sort?: ListPublicProfilesNearSort
}

/**
 * Umkreissuche: Haversine in der App nach grobem Bounding-Box-Filter in Postgres.
 * Kein PostGIS nötig; für sehr große Trefferzahlen innerhalb der Box ist NEARBY_FETCH_CAP die Obergrenze.
 */
export async function listPublicProfilesNear(
  params: ListPublicProfilesNearParams
): Promise<ListPublicProfilesResult> {
  const pageSize = Math.min(Math.max(params.pageSize ?? 24, 1), 48)
  const requestedPage = Math.max(params.page ?? 1, 1)
  const radiusKm = Math.max(0, params.radiusKm)

  const supabase = await createSupabaseServerClient()
  const specialtyId = params.specialtyId?.trim() || null
  const animalTypeId = params.animalTypeId?.trim() || null
  const subcategoryId = params.subcategoryId?.trim() || null
  const methodId = params.methodId?.trim() || null
  const profileIdsFilter = await resolveListingProfileIdsFilter(supabase, {
    specialtyId,
    animalTypeId,
    subcategoryId,
    methodId,
  })

  if (profileIdsFilter !== null && profileIdsFilter.length === 0) {
    return {
      profiles: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      distancesKmByProfileId: new Map(),
    }
  }

  const stRaw = params.serviceType?.trim()
  const st =
    stRaw === 'stationary' || stRaw === 'mobile' || stRaw === 'both' ? stRaw : null

  const { minLat, maxLat, minLng, maxLng } = boundingBoxForRadiusKm(
    params.searchLat,
    params.searchLng,
    radiusKm
  )

  let q = supabase
    .from(VIEW_PROFILES)
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', minLat)
    .lte('latitude', maxLat)
    .gte('longitude', minLng)
    .lte('longitude', maxLng)
    .order('display_name', { ascending: true })
    .limit(NEARBY_FETCH_CAP)

  if (profileIdsFilter !== null) q = q.in('id', profileIdsFilter)
  if (st) q = q.eq('service_type', st)

  const { data, error } = await q
  if (error) throw directoryDataError('listPublicProfilesNear', error)

  const rows = (data ?? []) as DirectoryPublicProfileRow[]

  type Scored = { row: DirectoryPublicProfileRow; km: number }
  const geoScored: Scored[] = []
  for (const row of rows) {
    const c = profileRowCoords(row)
    if (!c) continue
    const km = haversineDistanceKm(params.searchLat, params.searchLng, c.lat, c.lng)
    if (km <= radiusKm) geoScored.push({ row, km })
  }

  /** Ohne Koordinaten sind Profile in der Bounding-Box-Suche unsichtbar. Mit gleicher Fach-Filterliste
   * erscheinen sie am Ende der Trefferliste (ohne km), sobald mindestens ein Taxonomie-Filter aktiv ist. */
  let noGeoScored: Scored[] = []
  if (profileIdsFilter !== null && profileIdsFilter.length > 0) {
    let sq = supabase
      .from(VIEW_PROFILES)
      .select('*')
      .in('id', profileIdsFilter)
      .or('latitude.is.null,longitude.is.null')
    if (st) sq = sq.eq('service_type', st)
    const { data: supData, error: supErr } = await sq.limit(NEARBY_FETCH_CAP)
    if (supErr) throw directoryDataError('listPublicProfilesNear (ohne Geo)', supErr)
    const seen = new Set(geoScored.map((s) => s.row.id))
    for (const row of (supData ?? []) as DirectoryPublicProfileRow[]) {
      if (seen.has(row.id)) continue
      const c = profileRowCoords(row)
      if (c) continue
      noGeoScored.push({ row, km: Number.POSITIVE_INFINITY })
    }
  }

  const scored: Scored[] = [...geoScored, ...noGeoScored]

  const nearSort: ListPublicProfilesNearSort = params.sort ?? 'distance'
  scored.sort((a, b) => {
    if (nearSort === 'display_name') {
      return a.row.display_name.localeCompare(b.row.display_name, 'de')
    }
    if (nearSort === 'newest') {
      const ta = a.row.created_at ? new Date(a.row.created_at).getTime() : 0
      const tb = b.row.created_at ? new Date(b.row.created_at).getTime() : 0
      if (tb !== ta) return tb - ta
      return a.row.display_name.localeCompare(b.row.display_name, 'de')
    }
    const aInf = !Number.isFinite(a.km)
    const bInf = !Number.isFinite(b.km)
    if (aInf !== bInf) return aInf ? 1 : -1
    const d = a.km - b.km
    if (d !== 0) return d
    return a.row.display_name.localeCompare(b.row.display_name, 'de')
  })

  const totalCount = scored.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const from = (page - 1) * pageSize
  const slice = scored.slice(from, from + pageSize)

  const distancesKmByProfileId = new Map<string, number>()
  for (const s of slice) {
    if (Number.isFinite(s.km)) {
      distancesKmByProfileId.set(s.row.id, Math.round(s.km * 10) / 10)
    }
  }

  return {
    profiles: slice.map((s) => s.row),
    totalCount,
    page,
    pageSize,
    totalPages,
    distancesKmByProfileId,
  }
}

export type ProfileTaxonomyLabels = {
  specialties: string[]
  animals: string[]
}

export async function fetchPublicSpecialties(): Promise<DirectoryPublicSpecialtyRow[]> {
  const supabase = createSupabasePublicReadClient()
  const { data, error } = await supabase
    .from(VIEW_SPECIALTIES)
    .select('id, code, name, description, sort_order, parent_specialty_id')
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicSpecialties', error)
  return (data ?? []) as DirectoryPublicSpecialtyRow[]
}

export async function fetchPublicAnimalTypes(): Promise<DirectoryPublicAnimalTypeRow[]> {
  const supabase = createSupabasePublicReadClient()
  const { data, error } = await supabase
    .from(VIEW_ANIMALS)
    .select('id, code, name, sort_order')
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicAnimalTypes', error)
  return (data ?? []) as DirectoryPublicAnimalTypeRow[]
}

export async function fetchPublicSubcategories(): Promise<DirectoryPublicSubcategoryRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_SUBCATEGORIES)
    .select('id, code, name, directory_specialty_id, directory_specialty_code, sort_order')
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicSubcategories', error)
  return (data ?? []) as DirectoryPublicSubcategoryRow[]
}

export async function fetchPublicMethods(): Promise<DirectoryPublicMethodRow[]> {
  const supabase = createSupabasePublicReadClient()
  const { data, error } = await supabase
    .from(VIEW_METHODS)
    .select('id, code, name, directory_specialty_id, directory_specialty_code, sort_order')
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicMethods', error)
  return (data ?? []) as DirectoryPublicMethodRow[]
}

/** Für SEO-Titel auf der Listing-Seite (einzelner Lookup). */
export const fetchPublicSpecialtyNameById = cache(async function fetchPublicSpecialtyNameById(
  id: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from(VIEW_SPECIALTIES).select('name').eq('id', id).maybeSingle()
  if (error) return null
  return (data as { name: string } | null)?.name ?? null
})

export const fetchPublicAnimalTypeNameById = cache(async function fetchPublicAnimalTypeNameById(
  id: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from(VIEW_ANIMALS).select('name').eq('id', id).maybeSingle()
  if (error) return null
  return (data as { name: string } | null)?.name ?? null
})

export const fetchPublicSubcategoryNameById = cache(async function fetchPublicSubcategoryNameById(
  id: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from(VIEW_SUBCATEGORIES).select('name').eq('id', id).maybeSingle()
  if (error) return null
  return (data as { name: string } | null)?.name ?? null
})

export const fetchPublicMethodNameById = cache(async function fetchPublicMethodNameById(
  id: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from(VIEW_METHODS).select('name').eq('id', id).maybeSingle()
  if (error) return null
  return (data as { name: string } | null)?.name ?? null
})

async function resolveListingProfileIdsFilter(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filters: {
    specialtyId: string | null
    animalTypeId: string | null
    subcategoryId: string | null
    methodId: string | null
  }
): Promise<string[] | null> {
  const { specialtyId, animalTypeId, subcategoryId, methodId } = filters
  let profileIdsFilter: string[] | null = null

  const intersect = (ids: string[]) => {
    if (profileIdsFilter === null) profileIdsFilter = ids
    else profileIdsFilter = profileIdsFilter.filter((id) => ids.includes(id))
  }

  if (specialtyId) {
    const { data: directRows, error: eSpec } = await supabase
      .from(VIEW_PROFILE_SPECIALTIES)
      .select('directory_profile_id')
      .eq('directory_specialty_id', specialtyId)

    if (eSpec) throw directoryDataError('listPublicProfiles (specialty)', eSpec)

    const fromDirect = [
      ...new Set(
        (directRows ?? []).map((r) => (r as { directory_profile_id: string }).directory_profile_id)
      ),
    ]

    const { data: subRefRows, error: eSubRef } = await supabase
      .from(VIEW_SUBCATEGORIES)
      .select('id')
      .eq('directory_specialty_id', specialtyId)

    if (eSubRef) throw directoryDataError('listPublicProfiles (specialty subcats)', eSubRef)

    const subIds = [...new Set((subRefRows ?? []).map((r) => (r as { id: string }).id))]

    let fromSubcats: string[] = []
    if (subIds.length > 0) {
      const { data: psRows, error: ePs } = await supabase
        .from(VIEW_PROFILE_SUBCATEGORIES)
        .select('directory_profile_id')
        .in('directory_subcategory_id', subIds)

      if (ePs) throw directoryDataError('listPublicProfiles (specialty via subcats)', ePs)
      fromSubcats = [
        ...new Set(
          (psRows ?? []).map((r) => (r as { directory_profile_id: string }).directory_profile_id)
        ),
      ]
    }

    intersect([...new Set([...fromDirect, ...fromSubcats])])
  }

  if (animalTypeId) {
    const { data, error } = await supabase
      .from(VIEW_PROFILE_ANIMALS)
      .select('directory_profile_id')
      .eq('directory_animal_type_id', animalTypeId)

    if (error) throw directoryDataError('listPublicProfiles (animal)', error)
    intersect([
      ...new Set((data ?? []).map((r) => (r as { directory_profile_id: string }).directory_profile_id)),
    ])
  }

  if (subcategoryId) {
    const { data, error } = await supabase
      .from(VIEW_PROFILE_SUBCATEGORIES)
      .select('directory_profile_id')
      .eq('directory_subcategory_id', subcategoryId)

    if (error) throw directoryDataError('listPublicProfiles (subcategory)', error)
    intersect([
      ...new Set((data ?? []).map((r) => (r as { directory_profile_id: string }).directory_profile_id)),
    ])
  }

  if (methodId) {
    const { data, error } = await supabase
      .from(VIEW_PROFILE_METHODS)
      .select('directory_profile_id')
      .eq('directory_method_id', methodId)

    if (error) throw directoryDataError('listPublicProfiles (method)', error)
    intersect([
      ...new Set((data ?? []).map((r) => (r as { directory_profile_id: string }).directory_profile_id)),
    ])
  }

  return profileIdsFilter
}

export async function listPublicProfiles(
  params: ListPublicProfilesParams
): Promise<ListPublicProfilesResult> {
  const pageSize = Math.min(Math.max(params.pageSize ?? 24, 1), 48)
  const requestedPage = Math.max(params.page ?? 1, 1)

  const supabase = await createSupabaseServerClient()

  const specialtyId = params.specialtyId?.trim() || null
  const animalTypeId = params.animalTypeId?.trim() || null
  const subcategoryId = params.subcategoryId?.trim() || null
  const methodId = params.methodId?.trim() || null
  const profileIdsFilter = await resolveListingProfileIdsFilter(supabase, {
    specialtyId,
    animalTypeId,
    subcategoryId,
    methodId,
  })

  if (profileIdsFilter !== null && profileIdsFilter.length === 0) {
    return {
      profiles: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
    }
  }

  const stRaw = params.serviceType?.trim()
  const st =
    stRaw === 'stationary' || stRaw === 'mobile' || stRaw === 'both' ? stRaw : null

  let countQuery = supabase.from(VIEW_PROFILES).select('*', { count: 'exact', head: true })
  if (profileIdsFilter !== null) countQuery = countQuery.in('id', profileIdsFilter)
  const cityTrim = params.city?.trim()
  if (cityTrim) {
    const safe = sanitizeIlikeFragment(cityTrim)
    if (safe.length > 0) {
      countQuery = countQuery.or(`city.ilike.%${safe}%,postal_code.ilike.%${safe}%`)
    }
  }
  if (st) countQuery = countQuery.eq('service_type', st)

  const { count: countResult, error: countError } = await countQuery

  if (countError) throw directoryDataError('listPublicProfiles (count)', countError)

  const totalCount = countResult ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const makeDataQuery = () => {
    let q = supabase.from(VIEW_PROFILES).select('*')
    if (profileIdsFilter !== null) q = q.in('id', profileIdsFilter)
    if (cityTrim) {
      const safe = sanitizeIlikeFragment(cityTrim)
      if (safe.length > 0) {
        q = q.or(`city.ilike.%${safe}%,postal_code.ilike.%${safe}%`)
      }
    }
    if (st) q = q.eq('service_type', st)
    return q
  }

  const sort = params.sort === 'newest' ? 'newest' : 'display_name'

  let rows: DirectoryPublicProfileRow[] = []
  if (sort === 'newest') {
    const withCreated = await makeDataQuery()
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('display_name', { ascending: true })
      .range(from, to)
    if (
      withCreated.error &&
      /created_at|does not exist/i.test(withCreated.error.message)
    ) {
      const byName = await makeDataQuery()
        .order('display_name', { ascending: true })
        .range(from, to)
      if (byName.error) throw directoryDataError('listPublicProfiles', byName.error)
      rows = (byName.data ?? []) as DirectoryPublicProfileRow[]
    } else if (withCreated.error) {
      throw directoryDataError('listPublicProfiles', withCreated.error)
    } else {
      rows = (withCreated.data ?? []) as DirectoryPublicProfileRow[]
    }
  } else {
    const byName = await makeDataQuery().order('display_name', { ascending: true }).range(from, to)
    if (byName.error) throw directoryDataError('listPublicProfiles', byName.error)
    rows = (byName.data ?? []) as DirectoryPublicProfileRow[]
  }

  return {
    profiles: rows,
    totalCount,
    page,
    pageSize,
    totalPages,
  }
}

/** Anzahl veröffentlichter Profile pro Fachrichtung (parallel, je eine Count-Query auf der Public-Junction-View). */
export async function fetchPublicCountsBySpecialtyIds(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (ids.length === 0) return map
  const supabase = await createSupabaseServerClient()
  await Promise.all(
    ids.map(async (id) => {
      const { count, error } = await supabase
        .from(VIEW_PROFILE_SPECIALTIES)
        .select('directory_profile_id', { count: 'exact', head: true })
        .eq('directory_specialty_id', id)
      if (error) throw directoryDataError('fetchPublicCountsBySpecialtyIds', error)
      map.set(id, count ?? 0)
    })
  )
  return map
}

export async function fetchPublicCountsByAnimalTypeIds(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (ids.length === 0) return map
  const supabase = await createSupabaseServerClient()
  await Promise.all(
    ids.map(async (id) => {
      const { count, error } = await supabase
        .from(VIEW_PROFILE_ANIMALS)
        .select('directory_profile_id', { count: 'exact', head: true })
        .eq('directory_animal_type_id', id)
      if (error) throw directoryDataError('fetchPublicCountsByAnimalTypeIds', error)
      map.set(id, count ?? 0)
    })
  )
  return map
}

/**
 * Erstes Titelbild je Profil (`photo` bevorzugt, sonst `logo`) für Premium-Karten.
 */
export async function fetchPublicHeroPhotoUrlsByProfileIds(
  profileIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (profileIds.length === 0) return map

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_MEDIA)
    .select('directory_profile_id, media_type, url, sort_order')
    .in('directory_profile_id', profileIds)
    .not('url', 'is', null)
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicHeroPhotoUrlsByProfileIds', error)

  type Row = {
    directory_profile_id: string
    media_type: string
    url: string | null
    sort_order: number
  }

  const byProfile = new Map<string, Row[]>()
  for (const row of (data ?? []) as Row[]) {
    if (!row.url?.trim()) continue
    const list = byProfile.get(row.directory_profile_id) ?? []
    list.push(row)
    byProfile.set(row.directory_profile_id, list)
  }

  for (const [pid, rows] of byProfile) {
    const photo = rows.find((r) => r.media_type === 'photo')
    const logo = rows.find((r) => r.media_type === 'logo')
    const url = (photo ?? logo)?.url
    if (url) map.set(pid, url.trim())
  }

  return map
}

export type ProfileListingChipLabels = {
  subcategories: string[]
  methods: string[]
}

/** Spezialisierungen & Methoden je Profil (Karten-Tags im Premium-Listing). */
export async function fetchPublicListingChipLabelsForProfiles(
  profileIds: string[]
): Promise<Map<string, ProfileListingChipLabels>> {
  const result = new Map<string, ProfileListingChipLabels>()
  if (profileIds.length === 0) return result

  for (const id of profileIds) {
    result.set(id, { subcategories: [], methods: [] })
  }

  const supabase = await createSupabaseServerClient()

  const { data: subLinks, error: e1 } = await supabase
    .from(VIEW_PROFILE_SUBCATEGORIES)
    .select('directory_profile_id, directory_subcategory_id')
    .in('directory_profile_id', profileIds)

  if (e1) throw directoryDataError('fetchPublicListingChipLabelsForProfiles (sub links)', e1)

  const { data: metLinks, error: e2 } = await supabase
    .from(VIEW_PROFILE_METHODS)
    .select('directory_profile_id, directory_method_id')
    .in('directory_profile_id', profileIds)

  if (e2) throw directoryDataError('fetchPublicListingChipLabelsForProfiles (method links)', e2)

  const subIds = [
    ...new Set(
      (subLinks ?? []).map((r) => (r as { directory_subcategory_id: string }).directory_subcategory_id)
    ),
  ]
  const metIds = [
    ...new Set(
      (metLinks ?? []).map((r) => (r as { directory_method_id: string }).directory_method_id)
    ),
  ]

  const [subNameById, metNameById] = await Promise.all([
    (async () => {
      const m = new Map<string, string>()
      if (subIds.length === 0) return m
      const { data: rows, error } = await supabase.from(VIEW_SUBCATEGORIES).select('id, name').in('id', subIds)
      if (error) throw directoryDataError('fetchPublicListingChipLabelsForProfiles (sub names)', error)
      for (const r of (rows ?? []) as { id: string; name: string }[]) {
        m.set(r.id, r.name)
      }
      return m
    })(),
    (async () => {
      const m = new Map<string, string>()
      if (metIds.length === 0) return m
      const { data: rows, error } = await supabase.from(VIEW_METHODS).select('id, name').in('id', metIds)
      if (error) throw directoryDataError('fetchPublicListingChipLabelsForProfiles (method names)', error)
      for (const r of (rows ?? []) as { id: string; name: string }[]) {
        m.set(r.id, r.name)
      }
      return m
    })(),
  ])

  const subByProfile = new Map<string, string[]>()
  for (const row of subLinks ?? []) {
    const r = row as { directory_profile_id: string; directory_subcategory_id: string }
    const name = subNameById.get(r.directory_subcategory_id)
    if (!name) continue
    const list = subByProfile.get(r.directory_profile_id) ?? []
    list.push(name)
    subByProfile.set(r.directory_profile_id, list)
  }

  const metByProfile = new Map<string, string[]>()
  for (const row of metLinks ?? []) {
    const r = row as { directory_profile_id: string; directory_method_id: string }
    const name = metNameById.get(r.directory_method_id)
    if (!name) continue
    const list = metByProfile.get(r.directory_profile_id) ?? []
    list.push(name)
    metByProfile.set(r.directory_profile_id, list)
  }

  for (const pid of profileIds) {
    const subs = [...new Set(subByProfile.get(pid) ?? [])].sort((a, b) => a.localeCompare(b, 'de'))
    const meths = [...new Set(metByProfile.get(pid) ?? [])].sort((a, b) => a.localeCompare(b, 'de'))
    result.set(pid, { subcategories: subs, methods: meths })
  }

  return result
}

/**
 * Eine Roundtrip-Batch: Fachrichtungs- und Tierart-Namen je Profil (für Listing-Karten).
 */
export async function fetchPublicTaxonomyLabelsForProfiles(
  profileIds: string[]
): Promise<Map<string, ProfileTaxonomyLabels>> {
  const result = new Map<string, ProfileTaxonomyLabels>()
  if (profileIds.length === 0) return result

  const supabase = await createSupabaseServerClient()

  const { data: specLinks, error: e1 } = await supabase
    .from(VIEW_PROFILE_SPECIALTIES)
    .select('directory_profile_id, directory_specialty_id, is_primary')
    .in('directory_profile_id', profileIds)

  if (e1) throw directoryDataError('fetchPublicTaxonomyLabelsForProfiles (spec links)', e1)

  const { data: aniLinks, error: e2 } = await supabase
    .from(VIEW_PROFILE_ANIMALS)
    .select('directory_profile_id, directory_animal_type_id')
    .in('directory_profile_id', profileIds)

  if (e2) throw directoryDataError('fetchPublicTaxonomyLabelsForProfiles (animal links)', e2)

  const { data: profSubLinks, error: eSubLinks } = await supabase
    .from(VIEW_PROFILE_SUBCATEGORIES)
    .select('directory_profile_id, directory_subcategory_id')
    .in('directory_profile_id', profileIds)

  if (eSubLinks) throw directoryDataError('fetchPublicTaxonomyLabelsForProfiles (sub links)', eSubLinks)

  const linkedSubIds = [
    ...new Set(
      (profSubLinks ?? []).map((r) => (r as { directory_subcategory_id: string }).directory_subcategory_id)
    ),
  ]

  const subIdToSpecId = new Map<string, string>()
  if (linkedSubIds.length > 0) {
    const { data: subMeta, error: eMeta } = await supabase
      .from(VIEW_SUBCATEGORIES)
      .select('id, directory_specialty_id')
      .in('id', linkedSubIds)

    if (eMeta) throw directoryDataError('fetchPublicTaxonomyLabelsForProfiles (sub meta)', eMeta)
    for (const row of subMeta ?? []) {
      const r = row as { id: string; directory_specialty_id: string }
      subIdToSpecId.set(r.id, r.directory_specialty_id)
    }
  }

  const specIdsFromLinks = [
    ...new Set((specLinks ?? []).map((r) => (r as { directory_specialty_id: string }).directory_specialty_id)),
  ]
  const specIdsFromSubs = [...new Set(subIdToSpecId.values())]
  const specIds = [...new Set([...specIdsFromLinks, ...specIdsFromSubs])]
  const aniIds = [...new Set((aniLinks ?? []).map((r) => (r as { directory_animal_type_id: string }).directory_animal_type_id))]

  const [specRows, aniRows] = await Promise.all([
    fetchPublicSpecialtiesByIds(specIds),
    fetchPublicAnimalTypesByIds(aniIds),
  ])

  const specNameById = new Map(specRows.map((s) => [s.id, s.name]))
  const aniNameById = new Map(aniRows.map((a) => [a.id, a.name]))

  for (const id of profileIds) {
    result.set(id, { specialties: [], animals: [] })
  }

  const specByProfile = new Map<string, { id: string; name: string; primary: boolean }[]>()
  for (const row of specLinks ?? []) {
    const r = row as {
      directory_profile_id: string
      directory_specialty_id: string
      is_primary: boolean
    }
    const name = specNameById.get(r.directory_specialty_id)
    if (!name) continue
    const list = specByProfile.get(r.directory_profile_id) ?? []
    list.push({ id: r.directory_specialty_id, name, primary: r.is_primary })
    specByProfile.set(r.directory_profile_id, list)
  }

  for (const [pid, list] of specByProfile) {
    list.sort((a, b) => Number(b.primary) - Number(a.primary))
    result.get(pid)!.specialties = list.map((x) => x.name)
  }

  const inferredNamesByProfile = new Map<string, string[]>()
  for (const row of profSubLinks ?? []) {
    const r = row as { directory_profile_id: string; directory_subcategory_id: string }
    const specRef = subIdToSpecId.get(r.directory_subcategory_id)
    if (!specRef) continue
    const name = specNameById.get(specRef)
    if (!name) continue
    const cur = inferredNamesByProfile.get(r.directory_profile_id) ?? []
    if (!cur.includes(name)) cur.push(name)
    inferredNamesByProfile.set(r.directory_profile_id, cur)
  }

  for (const pid of profileIds) {
    const entry = result.get(pid)
    if (!entry) continue
    const inferred = (inferredNamesByProfile.get(pid) ?? []).filter((n) => !entry.specialties.includes(n))
    inferred.sort((a, b) => a.localeCompare(b, 'de'))
    entry.specialties = [...entry.specialties, ...inferred]
  }

  const aniByProfile = new Map<string, string[]>()
  for (const row of aniLinks ?? []) {
    const r = row as { directory_profile_id: string; directory_animal_type_id: string }
    const name = aniNameById.get(r.directory_animal_type_id)
    if (!name) continue
    const list = aniByProfile.get(r.directory_profile_id) ?? []
    list.push(name)
    aniByProfile.set(r.directory_profile_id, list)
  }

  for (const [pid, names] of aniByProfile) {
    const entry = result.get(pid)
    if (entry) entry.animals = [...names].sort((a, b) => a.localeCompare(b, 'de'))
  }

  return result
}

export async function fetchPublicProfileBySlug(slug: string): Promise<DirectoryPublicProfileRow | null> {
  const s = slug.trim()
  if (!s) return null

  const supabase = createSupabasePublicReadClient()
  const { data, error } = await supabase.from(VIEW_PROFILES).select('*').eq('slug', s).maybeSingle()

  if (error) throw directoryDataError('fetchPublicProfileBySlug', error)
  return (data as DirectoryPublicProfileRow | null) ?? null
}

export async function fetchPublicProfileSpecialtyLinks(
  profileId: string
): Promise<DirectoryPublicProfileSpecialtyRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_PROFILE_SPECIALTIES)
    .select('id, directory_profile_id, directory_specialty_id, is_primary')
    .eq('directory_profile_id', profileId)

  if (error) throw directoryDataError('fetchPublicProfileSpecialtyLinks', error)
  return (data ?? []) as DirectoryPublicProfileSpecialtyRow[]
}

export async function fetchPublicProfileAnimalLinks(
  profileId: string
): Promise<DirectoryPublicProfileAnimalRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_PROFILE_ANIMALS)
    .select('id, directory_profile_id, directory_animal_type_id')
    .eq('directory_profile_id', profileId)

  if (error) throw directoryDataError('fetchPublicProfileAnimalLinks', error)
  return (data ?? []) as DirectoryPublicProfileAnimalRow[]
}

export async function fetchPublicProfileSubcategoryLinks(
  profileId: string
): Promise<DirectoryPublicProfileSubcategoryRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_PROFILE_SUBCATEGORIES)
    .select('id, directory_profile_id, directory_subcategory_id')
    .eq('directory_profile_id', profileId)

  if (error) throw directoryDataError('fetchPublicProfileSubcategoryLinks', error)
  return (data ?? []) as DirectoryPublicProfileSubcategoryRow[]
}

export async function fetchPublicProfileMethodLinks(
  profileId: string
): Promise<DirectoryPublicProfileMethodRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_PROFILE_METHODS)
    .select('id, directory_profile_id, directory_method_id')
    .eq('directory_profile_id', profileId)

  if (error) throw directoryDataError('fetchPublicProfileMethodLinks', error)
  return (data ?? []) as DirectoryPublicProfileMethodRow[]
}

export async function fetchPublicSpecialtiesByIds(
  ids: string[]
): Promise<DirectoryPublicSpecialtyRow[]> {
  if (ids.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_SPECIALTIES)
    .select('id, code, name, description, sort_order, parent_specialty_id')
    .in('id', ids)
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicSpecialtiesByIds', error)
  return (data ?? []) as DirectoryPublicSpecialtyRow[]
}

export async function fetchPublicAnimalTypesByIds(
  ids: string[]
): Promise<DirectoryPublicAnimalTypeRow[]> {
  if (ids.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_ANIMALS)
    .select('id, code, name, sort_order')
    .in('id', ids)
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicAnimalTypesByIds', error)
  return (data ?? []) as DirectoryPublicAnimalTypeRow[]
}

export async function fetchPublicSubcategoriesByIds(
  ids: string[]
): Promise<DirectoryPublicSubcategoryRow[]> {
  if (ids.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_SUBCATEGORIES)
    .select('id, code, name, directory_specialty_id, directory_specialty_code, sort_order')
    .in('id', ids)
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicSubcategoriesByIds', error)
  return (data ?? []) as DirectoryPublicSubcategoryRow[]
}

export async function fetchPublicMethodsByIds(
  ids: string[]
): Promise<DirectoryPublicMethodRow[]> {
  if (ids.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_METHODS)
    .select('id, code, name, directory_specialty_id, directory_specialty_code, sort_order')
    .in('id', ids)
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicMethodsByIds', error)
  return (data ?? []) as DirectoryPublicMethodRow[]
}

export async function fetchSimilarPublicProfiles(args: {
  excludeProfileId: string
  primarySpecialtyId: string | null
  state: string | null
  limit?: number
}): Promise<DirectoryPublicSimilarProfileRow[]> {
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 16)
  if (!args.primarySpecialtyId) return []

  const supabase = await createSupabaseServerClient()
  const { data: links, error: linkErr } = await supabase
    .from(VIEW_PROFILE_SPECIALTIES)
    .select('directory_profile_id')
    .eq('directory_specialty_id', args.primarySpecialtyId)

  if (linkErr) throw directoryDataError('fetchSimilarPublicProfiles (links)', linkErr)

  const candidateIds = [
    ...new Set(
      (links ?? []).map((r) => (r as { directory_profile_id: string }).directory_profile_id)
    ),
  ].filter((id) => id !== args.excludeProfileId)

  if (candidateIds.length === 0) return []

  const { data: profs, error: pErr } = await supabase
    .from(VIEW_PROFILES)
    .select('*')
    .in('id', candidateIds)
    .order('display_name', { ascending: true })
    .limit(48)

  if (pErr) throw directoryDataError('fetchSimilarPublicProfiles (profiles)', pErr)

  let rows = (profs ?? []) as DirectoryPublicProfileRow[]
  if (args.state && rows.length > 0) {
    const sameState = rows.filter((r) => r.state === args.state)
    const rest = rows.filter((r) => r.state !== args.state)
    rows = [...sameState, ...rest]
  }
  rows = rows.slice(0, limit)

  const ids = rows.map((r) => r.id)
  const labelByProfile = await fetchPrimarySpecialtyLabelsForProfileIds(ids)

  return rows.map((r) => ({
    ...r,
    primary_specialty_label: labelByProfile.get(r.id) ?? null,
  }))
}

async function fetchPrimarySpecialtyLabelsForProfileIds(
  profileIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (profileIds.length === 0) return out

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_PROFILE_SPECIALTIES)
    .select('directory_profile_id, directory_specialty_id, is_primary')
    .in('directory_profile_id', profileIds)

  if (error) throw directoryDataError('fetchPrimarySpecialtyLabelsForProfileIds', error)

  type Row = {
    directory_profile_id: string
    directory_specialty_id: string
    is_primary: boolean | null
  }
  const chosen = new Map<string, string>()
  for (const r of (data ?? []) as Row[]) {
    if (r.is_primary) {
      chosen.set(r.directory_profile_id, r.directory_specialty_id)
    }
  }
  for (const r of (data ?? []) as Row[]) {
    if (!chosen.has(r.directory_profile_id)) {
      chosen.set(r.directory_profile_id, r.directory_specialty_id)
    }
  }

  const specIds = [...new Set([...chosen.values()])]
  const specs = await fetchPublicSpecialtiesByIds(specIds)
  const nameById = new Map(specs.map((s) => [s.id, s.name]))

  for (const pid of profileIds) {
    const sid = chosen.get(pid)
    if (sid) {
      const n = nameById.get(sid)
      if (n) out.set(pid, n)
    }
  }
  return out
}

export async function fetchPublicProfileMedia(profileId: string): Promise<DirectoryPublicProfileMediaRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_MEDIA)
    .select('id, directory_profile_id, media_type, url, sort_order, alt_text')
    .eq('directory_profile_id', profileId)
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicProfileMedia', error)
  return (data ?? []) as DirectoryPublicProfileMediaRow[]
}

export async function fetchPublicProfileSocial(profileId: string): Promise<DirectoryPublicProfileSocialRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(VIEW_SOCIAL)
    .select('id, directory_profile_id, platform, url, sort_order')
    .eq('directory_profile_id', profileId)
    .order('sort_order', { ascending: true })

  if (error) throw directoryDataError('fetchPublicProfileSocial', error)
  return (data ?? []) as DirectoryPublicProfileSocialRow[]
}
