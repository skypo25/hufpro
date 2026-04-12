import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DirectoryListingHomeBlocks } from '@/components/directory/public/listing/DirectoryListingHomeBlocks'
import { DirectoryListingHomeHero } from '@/components/directory/public/listing/DirectoryListingHomeHero'
import { DirectoryListingPremiumShell } from '@/components/directory/public/listing/DirectoryListingPremiumShell'
import { DirectoryListingSearchNotice } from '@/components/directory/public/listing/DirectoryListingSearchNotice'
import { DirectoryListingSearchStrip } from '@/components/directory/public/listing/DirectoryListingSearchStrip'
import { directoryProfileCreateHref } from '@/lib/directory/public/appBaseUrl'
import type { ListPublicProfilesResult, ProfileTaxonomyLabels } from '@/lib/directory/public/data'
import {
  fetchPublicAnimalTypeNameById,
  fetchPublicCountsByAnimalTypeIds,
  fetchPublicCountsBySpecialtyIds,
  fetchPublicListingChipLabelsForProfiles,
  fetchPublicMethodNameById,
  fetchPublicMethods,
  fetchPublicSpecialtyNameById,
  fetchPublicSubcategories,
  fetchPublicSubcategoryNameById,
  fetchPublicTaxonomyLabelsForProfiles,
  listPublicProfiles,
  listPublicProfilesNear,
  fetchPublicAnimalTypes,
  fetchPublicSpecialties,
} from '@/lib/directory/public/data'
import type { GeocodeHit } from '@/lib/directory/public/geocodeLocation'
import { geocodeLocationQuery, resolveDirectoryGeocodingUserAgent } from '@/lib/directory/public/geocodeLocation'
import { resolveBehandlerHeroSrc } from '@/lib/directory/public/heroImage'
import { listingSpecialtyHeadline } from '@/lib/directory/public/listingHeadlines'
import {
  buildBehandlerListingHref,
  DEFAULT_RADIUS_KM,
  listingQueryHasActiveFilters,
  parseBehandlerListingQuery,
} from '@/lib/directory/public/listingParams'
import { sanitizeBehandlerListingQuery } from '@/lib/directory/public/taxonomyCoherence'
import type { DirectoryPublicSpecialtyRow } from '@/lib/directory/public/types'

type PageProps = {
  searchParams: Promise<{
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
    /** Nach Profil-Wizard: Entwurf gespeichert (noch nicht im öffentlichen Verzeichnis). */
    entwurf?: string
  }>
}

const WIZARD_DRAFT_SAVED_MESSAGE =
  'Dein Eintrag wurde gespeichert. Er ist zunächst ein Entwurf und erscheint unter /behandler erst, wenn er veröffentlicht wurde (Freigabe).'

const CATEGORY_CODES = [
  'tierphysiotherapie',
  'tierosteopathie',
  'tierheilpraktik',
  'hufschmied',
  'barhufbearbeitung',
  'pferdedentist',
] as const

const MIN_LOCATION_LEN_FOR_GEOCODE = 2

function pickCategorySpecialties(specialties: DirectoryPublicSpecialtyRow[]): DirectoryPublicSpecialtyRow[] {
  return CATEGORY_CODES.map((code) => specialties.find((s) => s.code === code)).filter(
    Boolean
  ) as DirectoryPublicSpecialtyRow[]
}

function truncateMeta(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams
  const q = parseBehandlerListingQuery(sp)
  const bits: string[] = []
  if (q.location) bits.push(q.location)
  if (q.radiusKm !== DEFAULT_RADIUS_KM) bits.push(`${q.radiusKm} km Umkreis`)
  if (q.specialtyId) {
    const specs = await fetchPublicSpecialties()
    const spec = specs.find((s) => s.id === q.specialtyId)
    if (spec) bits.push(listingSpecialtyHeadline(spec.code, spec.name))
    else {
      const n = await fetchPublicSpecialtyNameById(q.specialtyId)
      if (n) bits.push(n)
    }
  }
  if (q.animalTypeId) {
    const n = await fetchPublicAnimalTypeNameById(q.animalTypeId)
    if (n) bits.push(n)
  }
  if (q.subcategoryId) {
    const n = await fetchPublicSubcategoryNameById(q.subcategoryId)
    if (n) bits.push(n)
  }
  if (q.methodId) {
    const n = await fetchPublicMethodNameById(q.methodId)
    if (n) bits.push(n)
  }
  if (q.serviceType === 'mobile') bits.push('mobil unterwegs')
  if (q.serviceType === 'stationary') bits.push('Praxis')
  if (q.serviceType === 'both') bits.push('Praxis & mobil')

  const filtered = bits.length > 0
  const title = filtered ? `Tierbehandler · ${bits.join(' · ')} | AniDocs` : 'Tierbehandler-Verzeichnis | AniDocs'
  const description = truncateMeta(
    filtered
      ? `Veröffentlichte Tierbehandler durchsuchen: ${bits.join(', ')}. Öffentliches Verzeichnis von AniDocs.`
      : 'Durchsuche das öffentliche Tierbehandler-Verzeichnis — nach Ort, Umkreis, Fachrichtung, Tierart und Angebotsform. Nur veröffentlichte Profile.',
    165
  )

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function BehandlerDirectoryPage({ searchParams }: PageProps) {
  const sp = await searchParams
  let q = parseBehandlerListingQuery(sp)
  const wizardDraftNotice =
    sp.entwurf === '1' || sp.entwurf === 'true' ? WIZARD_DRAFT_SAVED_MESSAGE : null

  const [specialties, animalTypes, heroImageSrc] = await Promise.all([
    fetchPublicSpecialties(),
    fetchPublicAnimalTypes(),
    Promise.resolve(resolveBehandlerHeroSrc()),
  ])

  let subcategories: Awaited<ReturnType<typeof fetchPublicSubcategories>> | null = null
  let methods: Awaited<ReturnType<typeof fetchPublicMethods>> | null = null

  if (listingQueryHasActiveFilters(q)) {
    const [sub, met] = await Promise.all([fetchPublicSubcategories(), fetchPublicMethods()])
    subcategories = sub
    methods = met
    const san = sanitizeBehandlerListingQuery(q, specialties, animalTypes, sub, met)
    if (san.changed) {
      redirect(buildBehandlerListingHref(san.q, san.q.page))
    }
    q = san.q
  }

  const hasActiveFilters = listingQueryHasActiveFilters(q)

  let geocodeHit: GeocodeHit | null = null
  let searchBanner: { variant: 'info' | 'warning'; message: string } | null = null
  let listResult: ListPublicProfilesResult
  let taxonomyByProfileId: Map<string, ProfileTaxonomyLabels>

  if (hasActiveFilters) {
    const locationTrim = q.location.trim()
    const geoConfigured = Boolean(resolveDirectoryGeocodingUserAgent())

    const commonListParams = {
      specialtyId: q.specialtyId || undefined,
      animalTypeId: q.animalTypeId || undefined,
      subcategoryId: q.subcategoryId || undefined,
      methodId: q.methodId || undefined,
      serviceType: q.serviceType || undefined,
      page: q.page,
      pageSize: 24 as const,
    }

    const textListSort = q.sort === 'newest' ? ('newest' as const) : ('display_name' as const)

    let lr = await listPublicProfiles({
      ...commonListParams,
      city: locationTrim || undefined,
      sort: textListSort,
    })

    if (locationTrim.length >= MIN_LOCATION_LEN_FOR_GEOCODE && geoConfigured) {
      const hit = await geocodeLocationQuery(locationTrim)
      if (hit) {
        geocodeHit = hit
        const nearSort =
          q.sort === 'newest' ? 'newest' : q.sort === 'name' ? 'display_name' : 'distance'
        lr = await listPublicProfilesNear({
          ...commonListParams,
          searchLat: hit.lat,
          searchLng: hit.lng,
          radiusKm: q.radiusKm,
          sort: nearSort,
        })
      } else {
        searchBanner = {
          variant: 'warning',
          message:
            'Zu dieser Eingabe wurde kein Ort auf der Karte gefunden. Es wird textuell nach Ort oder PLZ in den Profildaten gesucht — ohne Umkreis und ohne Entfernungsangabe.',
        }
        lr = await listPublicProfiles({
          ...commonListParams,
          city: locationTrim,
          sort: textListSort,
        })
      }
    } else if (locationTrim.length >= MIN_LOCATION_LEN_FOR_GEOCODE && !geoConfigured) {
      searchBanner = {
        variant: 'info',
        message:
          'Umkreissuche (Geocoding) ist für diese Umgebung nicht konfiguriert. Es wird textuell nach Ort oder PLZ gesucht — ohne km-Entfernung. Setze DIRECTORY_GEOCODING_USER_AGENT oder NEXT_PUBLIC_APP_URL / VERCEL_URL (siehe Geocoding-Doku).',
      }
    }

    if (q.page !== lr.page) {
      redirect(buildBehandlerListingHref(q, lr.page))
    }

    listResult = lr
    taxonomyByProfileId =
      listResult.profiles.length > 0
        ? await fetchPublicTaxonomyLabelsForProfiles(listResult.profiles.map((p) => p.id))
        : new Map()
  } else {
    if (q.page > 1) {
      redirect(buildBehandlerListingHref({ ...q, page: 1 }, 1))
    }
    listResult = { profiles: [], totalCount: 0, page: 1, pageSize: 24, totalPages: 1 }
    taxonomyByProfileId = new Map()
  }

  if (hasActiveFilters) {
    if (subcategories === null || methods === null) {
      const [sub, met] = await Promise.all([fetchPublicSubcategories(), fetchPublicMethods()])
      subcategories = sub
      methods = met
    }
    const [countsByAnimalTypeId, chipsByProfileId] = await Promise.all([
      fetchPublicCountsByAnimalTypeIds(animalTypes.map((a) => a.id)),
      listResult.profiles.length > 0
        ? fetchPublicListingChipLabelsForProfiles(listResult.profiles.map((p) => p.id))
        : Promise.resolve(new Map()),
    ])

    let specialtyTitle = 'Tierbehandler'
    if (q.specialtyId) {
      const spec = specialties.find((s) => s.id === q.specialtyId)
      if (spec) specialtyTitle = listingSpecialtyHeadline(spec.code, spec.name)
      else specialtyTitle = (await fetchPublicSpecialtyNameById(q.specialtyId)) ?? 'Tierbehandler'
    }

    const locationTitle =
      (geocodeHit?.displayName?.split(',').slice(0, 2).join(',').trim() ?? q.location.trim()) ||
      'Deutschland'

    return (
      <DirectoryListingPremiumShell
        query={q}
        specialties={specialties}
        animalTypes={animalTypes}
        subcategories={subcategories!}
        methods={methods!}
        countsByAnimalTypeId={countsByAnimalTypeId}
        profiles={listResult.profiles}
        totalCount={listResult.totalCount}
        page={listResult.page}
        totalPages={listResult.totalPages}
        taxonomyByProfileId={taxonomyByProfileId}
        chipsByProfileId={chipsByProfileId}
        distancesKmByProfileId={listResult.distancesKmByProfileId}
        radiusSearchActive={Boolean(listResult.distancesKmByProfileId)}
        mapSearchCenter={geocodeHit ? { lat: geocodeHit.lat, lng: geocodeHit.lng } : null}
        specialtyTitle={specialtyTitle}
        locationTitle={locationTitle}
        profileCreateHref={directoryProfileCreateHref()}
        searchBanner={searchBanner}
        wizardDraftNotice={wizardDraftNotice}
      />
    )
  }

  const categorySpecialties = pickCategorySpecialties(specialties)

  let countsBySpecialtyId = new Map<string, number>()
  let featuredProfiles: Awaited<ReturnType<typeof listPublicProfiles>>['profiles'] = []
  let featuredTaxonomy = new Map<string, ProfileTaxonomyLabels>()

  if (categorySpecialties.length > 0) {
    countsBySpecialtyId = await fetchPublicCountsBySpecialtyIds(categorySpecialties.map((s) => s.id))
  }

  const featured = await listPublicProfiles({ pageSize: 12, page: 1, sort: 'newest' })
  featuredProfiles = featured.profiles
  if (featuredProfiles.length > 0) {
    featuredTaxonomy = await fetchPublicTaxonomyLabelsForProfiles(featuredProfiles.map((p) => p.id))
  }

  return (
    <div data-directory-page="listing" className="dir-listing-page dir-listing-page--home">
      <DirectoryListingHomeHero heroImageSrc={heroImageSrc} />
      <DirectoryListingSearchStrip specialties={specialties} animalTypes={animalTypes} values={q} />

      {wizardDraftNotice ? (
        <div className="mx-auto max-w-[1400px] px-8 pb-2 pt-2">
          <DirectoryListingSearchNotice message={wizardDraftNotice} variant="info" />
        </div>
      ) : null}

      <DirectoryListingHomeBlocks
        categories={categorySpecialties}
        animalTypes={animalTypes}
        countsBySpecialtyId={countsBySpecialtyId}
        featuredProfiles={featuredProfiles}
        taxonomyByProfileId={featuredTaxonomy}
        listingQuery={q}
        showMarketingBlocks
      />
    </div>
  )
}
