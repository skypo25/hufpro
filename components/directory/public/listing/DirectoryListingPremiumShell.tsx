'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import AddressAutocomplete from '@/components/customers/AddressAutocomplete'
import { DirectoryListingEmptyState } from '@/components/directory/public/listing/DirectoryListingEmptyState'
import { DirectoryListingMapProfileModal } from '@/components/directory/public/listing/DirectoryListingMapProfileModal'
import { DirectoryListingMapboxMap } from '@/components/directory/public/listing/DirectoryListingMapboxMap'
import {
  directoryPremiumInitialsFromName,
  directoryPremiumIsNewProfile,
} from '@/components/directory/public/listing/directoryListingPremiumHelpers'
import { directoryAboutUrl } from '@/lib/directory/public/appBaseUrl'
import { directorySpecialtyDisplayName } from '@/lib/directory/public/labels'
import type {
  ProfileListingChipLabels,
  ProfileTaxonomyLabels,
} from '@/lib/directory/public/data'
import {
  buildBehandlerListingHref,
  DEFAULT_RADIUS_KM,
  DIRECTORY_AUTOCOMPLETE_COUNTRY_CODES,
  DIRECTORY_PHOTON_DACH_BBOX,
  DIRECTORY_PHOTON_PLACE_LAYERS,
  RADIUS_KM_OPTIONS,
  type BehandlerListingQuery,
  type RadiusKmOption,
} from '@/lib/directory/public/listingParams'
import {
  isHoofSpecialtyCode,
  isNonEquineAnimalCode,
  listingQueryAfterAnimalTypeToggle,
  listingQueryClearAnimalIfHoofSpecialtyMismatch,
  listingQueryWithBarhufDefaultAnimal,
} from '@/lib/directory/public/taxonomyCoherence'
import type {
  DirectoryPublicAnimalTypeRow,
  DirectoryPublicMethodRow,
  DirectoryPublicProfileRow,
  DirectoryPublicSpecialtyRow,
  DirectoryPublicSubcategoryRow,
} from '@/lib/directory/public/types'

import './directory-listing-premium.css'

const MAP_VISIBILITY_LS_KEY = 'dlp-listing-map-visible'

function persistMapVisibility(visible: boolean) {
  try {
    localStorage.setItem(MAP_VISIBILITY_LS_KEY, visible ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function snapRadiusKm(raw: number): RadiusKmOption {
  const n = Math.round(raw)
  return (RADIUS_KM_OPTIONS as readonly number[]).reduce<RadiusKmOption>(
    (best, x) => (Math.abs(x - n) < Math.abs(best - n) ? (x as RadiusKmOption) : best),
    DEFAULT_RADIUS_KM
  )
}

/** Eindeutige Signatur für Filter-URL — Ladezustand endet, wenn Server neue Props liefert. */
function listingQuerySignature(q: BehandlerListingQuery, destPage: number): string {
  return [
    q.location,
    String(q.radiusKm),
    q.specialtyId,
    q.animalTypeId,
    q.subcategoryId,
    q.methodId,
    q.serviceType,
    q.sort,
    String(destPage),
  ].join('\u001f')
}

export type DirectoryListingPremiumShellProps = {
  query: BehandlerListingQuery
  specialties: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  subcategories: DirectoryPublicSubcategoryRow[]
  methods: DirectoryPublicMethodRow[]
  countsByAnimalTypeId: Map<string, number>
  profiles: DirectoryPublicProfileRow[]
  totalCount: number
  page: number
  totalPages: number
  taxonomyByProfileId: Map<string, ProfileTaxonomyLabels>
  chipsByProfileId: Map<string, ProfileListingChipLabels>
  distancesKmByProfileId?: Map<string, number>
  radiusSearchActive: boolean
  specialtyTitle: string
  locationTitle: string
  profileCreateHref: string
  searchBanner: { variant: 'info' | 'warning'; message: string } | null
  wizardDraftNotice: string | null
  mapSearchCenter: { lat: number; lng: number } | null
}

export function DirectoryListingPremiumShell({
  query,
  specialties,
  animalTypes,
  subcategories,
  methods,
  countsByAnimalTypeId,
  profiles,
  totalCount,
  page,
  totalPages,
  taxonomyByProfileId,
  chipsByProfileId: _chipsByProfileId,
  distancesKmByProfileId,
  radiusSearchActive,
  mapSearchCenter,
  specialtyTitle,
  locationTitle,
  profileCreateHref,
  searchBanner,
  wizardDraftNotice,
}: DirectoryListingPremiumShellProps) {
  const router = useRouter()
  const [listingNavPending, setListingNavPending] = useState(false)
  const [mobSidebarOpen, setMobSidebarOpen] = useState(false)
  const [gridView, setGridView] = useState(true)
  const [fgOpen, setFgOpen] = useState({
    spec: false,
    animals: true,
    radius: true,
    methods: false,
    work: true,
  })
  const [mapActiveProfileId, setMapActiveProfileId] = useState<string | null>(null)
  const [mapModalProfileId, setMapModalProfileId] = useState<string | null>(null)
  const [mapSectionVisible, setMapSectionVisible] = useState(true)

  useEffect(() => {
    try {
      if (localStorage.getItem(MAP_VISIBILITY_LS_KEY) === '0') {
        setMapSectionVisible(false)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const [barLocation, setBarLocation] = useState(query.location)
  const [barRadiusKm, setBarRadiusKm] = useState(query.radiusKm)
  const [barSpecialtyId, setBarSpecialtyId] = useState(query.specialtyId)

  useEffect(() => {
    setBarLocation(query.location)
    setBarRadiusKm(query.radiusKm)
    setBarSpecialtyId(query.specialtyId)
  }, [query.location, query.radiusKm, query.specialtyId])

  const queryPageSignature = useMemo(() => listingQuerySignature(query, page), [query, page])

  useEffect(() => {
    setListingNavPending(false)
    setMapActiveProfileId(null)
    setMapModalProfileId(null)
  }, [queryPageSignature])

  const mapModalProfile = useMemo(() => {
    if (!mapModalProfileId) return null
    return profiles.find((x) => x.id === mapModalProfileId) ?? null
  }, [profiles, mapModalProfileId])

  useEffect(() => {
    if (mapModalProfileId && mapModalProfile === null) {
      setMapModalProfileId(null)
    }
  }, [mapModalProfileId, mapModalProfile])

  useEffect(() => {
    if (!listingNavPending) return
    const t = window.setTimeout(() => setListingNavPending(false), 12_000)
    return () => window.clearTimeout(t)
  }, [listingNavPending])

  const navigate = useCallback(
    (next: BehandlerListingQuery, destPage: number) => {
      if (listingQuerySignature(next, destPage) === listingQuerySignature(query, page)) return
      setMobSidebarOpen(false)
      setListingNavPending(true)
      router.push(buildBehandlerListingHref(next, destPage))
    },
    [router, query, page]
  )

  const subcatsForSpec = useMemo(() => {
    if (!barSpecialtyId) return subcategories
    return subcategories.filter((s) => s.directory_specialty_id === barSpecialtyId)
  }, [subcategories, barSpecialtyId])

  const methodsForSpec = useMemo(() => {
    if (!barSpecialtyId) return methods
    return methods.filter((m) => !m.directory_specialty_id || m.directory_specialty_id === barSpecialtyId)
  }, [methods, barSpecialtyId])

  const queryAnimalCode = useMemo(() => {
    if (!query.animalTypeId) return null
    return animalTypes.find((a) => a.id === query.animalTypeId)?.code ?? null
  }, [query.animalTypeId, animalTypes])

  const effectiveSpecialtyCodeForAnimals = useMemo(() => {
    const id = barSpecialtyId || query.specialtyId
    if (!id) return null
    return specialties.find((s) => s.id === id)?.code ?? null
  }, [barSpecialtyId, query.specialtyId, specialties])

  const visibleAnimalTypes = useMemo(() => {
    if (effectiveSpecialtyCodeForAnimals && isHoofSpecialtyCode(effectiveSpecialtyCodeForAnimals)) {
      return animalTypes.filter((a) => !isNonEquineAnimalCode(a.code))
    }
    return animalTypes
  }, [animalTypes, effectiveSpecialtyCodeForAnimals])

  const subcatsFilteredForUi = useMemo(() => {
    if (queryAnimalCode && isNonEquineAnimalCode(queryAnimalCode)) {
      return subcatsForSpec.filter((s) => !isHoofSpecialtyCode(s.directory_specialty_code))
    }
    return subcatsForSpec
  }, [subcatsForSpec, queryAnimalCode])

  const methodsFilteredForUi = useMemo(() => {
    if (queryAnimalCode && isNonEquineAnimalCode(queryAnimalCode)) {
      return methodsForSpec.filter((m) => !isHoofSpecialtyCode(m.directory_specialty_code))
    }
    return methodsForSpec
  }, [methodsForSpec, queryAnimalCode])

  const filterLabels = useMemo(() => {
    const sub = query.subcategoryId
      ? subcategories.find((s) => s.id === query.subcategoryId)?.name
      : undefined
    const met = query.methodId ? methods.find((m) => m.id === query.methodId)?.name : undefined
    const ani = query.animalTypeId
      ? animalTypes.find((a) => a.id === query.animalTypeId)?.name
      : undefined
    return { sub, met, ani }
  }, [query.subcategoryId, query.methodId, query.animalTypeId, subcategories, methods, animalTypes])

  const runSearch = useCallback(() => {
    const cleared = listingQueryClearAnimalIfHoofSpecialtyMismatch(
      {
        ...query,
        location: barLocation.trim(),
        radiusKm: barRadiusKm,
        specialtyId: barSpecialtyId,
        page: 1,
      },
      specialties,
      animalTypes
    )
    navigate(listingQueryWithBarhufDefaultAnimal(cleared, specialties, animalTypes), 1)
  }, [navigate, query, barLocation, barRadiusKm, barSpecialtyId, specialties, animalTypes])

  const chipsResetHref = buildBehandlerListingHref(
    {
      location: query.location,
      radiusKm: query.radiusKm,
      specialtyId: query.specialtyId,
      animalTypeId: '',
      subcategoryId: '',
      methodId: '',
      serviceType: '',
      sort: query.sort,
      page: 1,
    },
    1
  )

  const sidebarFiltersResetHref = buildBehandlerListingHref(
    {
      ...query,
      subcategoryId: '',
      methodId: '',
      animalTypeId: '',
      serviceType: '',
      page: 1,
    },
    1
  )

  const chipRemove = (patch: Partial<BehandlerListingQuery>) => {
    navigate({ ...query, ...patch, page: 1 }, 1)
  }

  const sortValue =
    query.sort === 'newest'
      ? 'newest'
      : query.sort === 'name'
        ? 'name'
        : query.sort === 'distance'
          ? 'distance'
          : ''

  const onSortChange = (v: string) => {
    const sort =
      v === 'newest'
        ? ('newest' as const)
        : v === 'name'
          ? ('name' as const)
          : v === 'distance'
            ? ('distance' as const)
            : ('' as const)
    navigate({ ...query, sort, page: 1 }, 1)
  }

  const pageNums = useMemo(() => {
    if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const windowSize = 5
    let start = Math.max(1, page - 2)
    const end = Math.min(totalPages, start + windowSize - 1)
    if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [page, totalPages])

  const activeChipCount =
    (query.subcategoryId ? 1 : 0) +
    (query.methodId ? 1 : 0) +
    (query.animalTypeId ? 1 : 0) +
    (query.serviceType ? 1 : 0)

  const commitRadiusRange = (raw: number) => {
    const km = snapRadiusKm(raw)
    if (km === query.radiusKm) return
    navigate({ ...query, radiusKm: km, page: 1 }, 1)
    setBarRadiusKm(km)
  }

  const mapPoints = useMemo(() => {
    return profiles
      .filter(
        (p) =>
          p.latitude != null &&
          p.longitude != null &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      )
      .map((p) => {
        const lat = p.latitude as number
        const lng = p.longitude as number
        const loc = [p.postal_code, p.city].filter(Boolean).join(' ')
        return {
          id: p.id,
          lat,
          lng,
          initials: directoryPremiumInitialsFromName(p.display_name),
          title: p.display_name,
          subtitle: loc || p.practice_name?.trim() || '',
          href: `/behandler/${p.slug}`,
        }
      })
  }, [profiles])

  const onMapMarkerClick = useCallback((id: string) => {
    setMapActiveProfileId(id)
    setMapModalProfileId(id)
    if (typeof document === 'undefined') return
    const el = document.querySelector(`[data-dlp-profile="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const onMapModalClose = useCallback(() => {
    setMapModalProfileId(null)
    setMapActiveProfileId(null)
  }, [])

  return (
    <div className="dlp-root" data-directory-page="listing-premium">
      <nav className="dlp-nav" aria-label="Hauptnavigation">
        <div className="dlp-nav-in">
          <Link className="dlp-logo" href="/behandler">
            <div className="dlp-sq" aria-hidden>
              a
            </div>
            <span>anidocs</span>
          </Link>
          <div className="dlp-nav-links">
            <a href="/behandler">Behandler finden</a>
            <a href={profileCreateHref}>Für Behandler</a>
            <a href={directoryAboutUrl()}>Über uns</a>
          </div>
          <Link className="dlp-nav-cta" href={profileCreateHref}>
            <i className="bi bi-plus-lg" aria-hidden />
            Profil erstellen
          </Link>
        </div>
      </nav>

      {mapSectionVisible ? (
        <section className="dlp-topmap" aria-label="Kartenbereich">
          <div className="dlp-topmap-in">
            <DirectoryListingMapboxMap
              points={mapPoints}
              searchCenter={mapSearchCenter}
              activeId={mapActiveProfileId}
              onMarkerClick={onMapMarkerClick}
            />
          </div>
        </section>
      ) : null}

      <div className="dlp-fbar">
        <div className="dlp-fbar-in">
          <label className="dlp-fb-field dlp-fb-loc">
            <i className="bi bi-geo-alt-fill" aria-hidden />
            <div className="dlp-fb-loc-ac">
              <AddressAutocomplete
                value={barLocation}
                onValueChange={setBarLocation}
                persistQueryOnSelect
                bbox={DIRECTORY_PHOTON_DACH_BBOX}
                allowedCountryCodes={DIRECTORY_AUTOCOMPLETE_COUNTRY_CODES}
                photonLayers={DIRECTORY_PHOTON_PLACE_LAYERS}
                placeholder="Ort oder PLZ…"
                id="directory-premium-location"
                ariaLabel="Ort oder PLZ"
                className="dlp-loc-ac-input"
                onInputKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    runSearch()
                  }
                }}
              />
            </div>
          </label>
          <label className="dlp-fb-field dlp-fb-rad">
            <i className="bi bi-crosshair2" aria-hidden />
            <select
              value={String(barRadiusKm)}
              onChange={(e) => setBarRadiusKm(parseInt(e.target.value, 10) as RadiusKmOption)}
            >
              {RADIUS_KM_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          </label>
          <label className="dlp-fb-field dlp-fb-cat">
            <i className="bi bi-heart-pulse-fill" aria-hidden />
            <select
              value={barSpecialtyId}
              onChange={(e) => setBarSpecialtyId(e.target.value)}
            >
              <option value="">Alle Fachrichtungen</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {directorySpecialtyDisplayName(s.code, s.name)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="dlp-fb-search" onClick={runSearch}>
            <i className="bi bi-search" aria-hidden />
            <span className="dlp-fb-search-txt">Suchen</span>
          </button>
        </div>
      </div>

      <nav className="dlp-bread" aria-label="Brotkrumen">
        <Link href="/">anidocs</Link>
        <span className="dlp-bread-sep" aria-hidden>
          <i className="bi bi-chevron-right" />
        </span>
        <Link href="/behandler">Behandler</Link>
        <span className="dlp-bread-sep" aria-hidden>
          <i className="bi bi-chevron-right" />
        </span>
        <span className="dlp-bread-current">
          {specialtyTitle} in {locationTitle || 'Deutschland'}
        </span>
      </nav>

      {wizardDraftNotice ? (
        <div className="dlp-banner">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            {wizardDraftNotice}
          </p>
        </div>
      ) : null}
      {searchBanner ? (
        <div className="dlp-banner">
          <p
            className={
              searchBanner.variant === 'warning'
                ? 'app-info-callout px-3 py-2 text-sm'
                : 'rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900'
            }
          >
            {searchBanner.message}
          </p>
        </div>
      ) : null}

      <div className="dlp-rhead">
        <div>
          <h1>
            {specialtyTitle} in <span className="dlp-accent-loc">{locationTitle || 'Deutschland'}</span>
          </h1>
          <div className="dlp-rhead-count">
            {totalCount} Ergebnisse
            {radiusSearchActive ? ` im Umkreis von ${query.radiusKm} km` : null}
          </div>
        </div>
        <div className="dlp-rhead-actions">
          <select
            className="dlp-rh-sort"
            aria-label="Sortierung"
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="">Empfohlen</option>
            {radiusSearchActive ? <option value="distance">Entfernung</option> : null}
            <option value="newest">Neueste</option>
            <option value="name">Name A–Z</option>
          </select>
          <button
            type="button"
            className={`dlp-rh-map ${mapSectionVisible ? 'dlp-rh-map--on' : ''}`}
            aria-label={mapSectionVisible ? 'Karte ausblenden' : 'Karte einblenden'}
            aria-pressed={mapSectionVisible}
            onClick={() => {
              const next = !mapSectionVisible
              setMapSectionVisible(next)
              persistMapVisibility(next)
            }}
          >
            <i className={`bi ${mapSectionVisible ? 'bi-map-fill' : 'bi-map'}`} aria-hidden />
            <span className="dlp-rh-map-txt">Karte</span>
          </button>
          <div className="dlp-rh-view">
            <button
              type="button"
              className={`dlp-rh-v ${!gridView ? 'dlp-on' : ''}`}
              aria-label="Listenansicht"
              onClick={() => setGridView(false)}
            >
              <i className="bi bi-list-ul" />
            </button>
            <button
              type="button"
              className={`dlp-rh-v ${gridView ? 'dlp-on' : ''}`}
              aria-label="Kachelansicht"
              onClick={() => setGridView(true)}
            >
              <i className="bi bi-grid-fill" />
            </button>
          </div>
        </div>
      </div>

      <div className="dlp-active-bar">
        <div className="dlp-active-chips">
          {filterLabels.sub ? (
            <span className="dlp-ac">
              {filterLabels.sub}
              <i
                className="bi bi-x-lg"
                role="button"
                tabIndex={0}
                aria-label="Filter entfernen"
                onClick={() => chipRemove({ subcategoryId: '' })}
                onKeyDown={(e) => e.key === 'Enter' && chipRemove({ subcategoryId: '' })}
              />
            </span>
          ) : null}
          {filterLabels.met ? (
            <span className="dlp-ac">
              {filterLabels.met}
              <i
                className="bi bi-x-lg"
                role="button"
                tabIndex={0}
                aria-label="Filter entfernen"
                onClick={() => chipRemove({ methodId: '' })}
                onKeyDown={(e) => e.key === 'Enter' && chipRemove({ methodId: '' })}
              />
            </span>
          ) : null}
          {filterLabels.ani ? (
            <span className="dlp-ac">
              {filterLabels.ani}
              <i
                className="bi bi-x-lg"
                role="button"
                tabIndex={0}
                aria-label="Filter entfernen"
                onClick={() => chipRemove({ animalTypeId: '' })}
                onKeyDown={(e) => e.key === 'Enter' && chipRemove({ animalTypeId: '' })}
              />
            </span>
          ) : null}
          {query.serviceType === 'mobile' ? (
            <span className="dlp-ac">
              Mobil
              <i
                className="bi bi-x-lg"
                role="button"
                tabIndex={0}
                aria-label="Filter entfernen"
                onClick={() => chipRemove({ serviceType: '' })}
                onKeyDown={(e) => e.key === 'Enter' && chipRemove({ serviceType: '' })}
              />
            </span>
          ) : null}
          {query.serviceType === 'stationary' ? (
            <span className="dlp-ac">
              Praxis
              <i
                className="bi bi-x-lg"
                role="button"
                tabIndex={0}
                aria-label="Filter entfernen"
                onClick={() => chipRemove({ serviceType: '' })}
                onKeyDown={(e) => e.key === 'Enter' && chipRemove({ serviceType: '' })}
              />
            </span>
          ) : null}
          {query.serviceType === 'both' ? (
            <span className="dlp-ac">
              Praxis &amp; mobil
              <i
                className="bi bi-x-lg"
                role="button"
                tabIndex={0}
                aria-label="Filter entfernen"
                onClick={() => chipRemove({ serviceType: '' })}
                onKeyDown={(e) => e.key === 'Enter' && chipRemove({ serviceType: '' })}
              />
            </span>
          ) : null}
          {activeChipCount > 0 ? (
            <Link className="dlp-ac-reset" href={chipsResetHref}>
              Zurücksetzen
            </Link>
          ) : null}
        </div>
      </div>

      <div
        className={`dlp-sidebar-overlay ${mobSidebarOpen ? 'dlp-open' : ''}`}
        onClick={() => setMobSidebarOpen(false)}
        role="presentation"
        aria-hidden={!mobSidebarOpen}
      />

      <div className="dlp-page">
        <aside
          className={`dlp-sidebar ${mobSidebarOpen ? 'dlp-open' : ''}`}
          id="dlp-sidebar"
          aria-label="Filter"
        >
          <div className="dlp-sidebar-head">
            <span className="dlp-sidebar-title">Filter</span>
            <button
              type="button"
              className="dlp-sidebar-close"
              aria-label="Schließen"
              onClick={() => setMobSidebarOpen(false)}
            >
              <i className="bi bi-x-lg" aria-hidden />
            </button>
          </div>

          <div className="dlp-fg">
            <button
              type="button"
              className={`dlp-fg-head ${fgOpen.radius ? '' : 'dlp-shut'}`}
              onClick={() => setFgOpen((s) => ({ ...s, radius: !s.radius }))}
            >
              <span className="dlp-fg-title">Umkreis</span>
              <i className="bi bi-chevron-down dlp-fg-toggle" aria-hidden />
            </button>
            <div className="dlp-fg-body">
              <div className="dlp-frange">
                <div className="dlp-frange-top">
                  <span>Entfernung</span>
                  <span className="dlp-frange-val">{query.radiusKm} km</span>
                </div>
                <input
                  key={query.radiusKm}
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  defaultValue={query.radiusKm}
                  aria-label="Umkreis in Kilometern"
                  onPointerUp={(e) =>
                    commitRadiusRange(parseInt((e.currentTarget as HTMLInputElement).value, 10))
                  }
                  onBlur={(e) =>
                    commitRadiusRange(parseInt((e.currentTarget as HTMLInputElement).value, 10))
                  }
                />
                <div className="dlp-frange-labels">
                  <span>5 km</span>
                  <span>50 km</span>
                  <span>100 km</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dlp-fg">
            <button
              type="button"
              className={`dlp-fg-head ${fgOpen.work ? '' : 'dlp-shut'}`}
              onClick={() => setFgOpen((s) => ({ ...s, work: !s.work }))}
            >
              <span className="dlp-fg-title">Arbeitsweise</span>
              <i className="bi bi-chevron-down dlp-fg-toggle" aria-hidden />
            </button>
            <div className="dlp-fg-body">
              <div className="dlp-fg-chips dlp-fg-chips--work">
                <button
                  type="button"
                  className={`dlp-fc ${query.serviceType === 'mobile' ? 'dlp-on' : ''}`}
                  onClick={() =>
                    navigate(
                      {
                        ...query,
                        serviceType: query.serviceType === 'mobile' ? '' : 'mobile',
                        page: 1,
                      },
                      1
                    )
                  }
                >
                  Mobil
                </button>
                <button
                  type="button"
                  className={`dlp-fc ${query.serviceType === 'stationary' ? 'dlp-on' : ''}`}
                  onClick={() =>
                    navigate(
                      {
                        ...query,
                        serviceType: query.serviceType === 'stationary' ? '' : 'stationary',
                        page: 1,
                      },
                      1
                    )
                  }
                >
                  Eigene Praxis
                </button>
              </div>
            </div>
          </div>

          <div className="dlp-fg">
            <button
              type="button"
              className={`dlp-fg-head ${fgOpen.animals ? '' : 'dlp-shut'}`}
              onClick={() => setFgOpen((s) => ({ ...s, animals: !s.animals }))}
            >
              <span className="dlp-fg-title">Tierarten</span>
              <i className="bi bi-chevron-down dlp-fg-toggle" aria-hidden />
            </button>
            <div className="dlp-fg-body">
              {visibleAnimalTypes.map((a) => {
                const cnt = countsByAnimalTypeId.get(a.id) ?? 0
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`dlp-fcheck ${query.animalTypeId === a.id ? 'dlp-on' : ''}`}
                    onClick={() =>
                      navigate(
                        listingQueryAfterAnimalTypeToggle(query, a.id, animalTypes, subcategories, methods),
                        1
                      )
                    }
                  >
                    <span className="dlp-fbox" aria-hidden />
                    {a.name}
                    <span className="dlp-fcnt">{cnt}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="dlp-fg">
            <button
              type="button"
              className={`dlp-fg-head ${fgOpen.spec ? '' : 'dlp-shut'}`}
              onClick={() => setFgOpen((s) => ({ ...s, spec: !s.spec }))}
            >
              <span className="dlp-fg-title">Spezialisierung</span>
              <i className="bi bi-chevron-down dlp-fg-toggle" aria-hidden />
            </button>
            <div className="dlp-fg-body">
              <div className="dlp-fg-chips">
                {subcatsFilteredForUi.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`dlp-fc ${query.subcategoryId === s.id ? 'dlp-on' : ''}`}
                    onClick={() =>
                      navigate(
                        {
                          ...query,
                          subcategoryId: query.subcategoryId === s.id ? '' : s.id,
                          page: 1,
                        },
                        1
                      )
                    }
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="dlp-fg">
            <button
              type="button"
              className={`dlp-fg-head ${fgOpen.methods ? '' : 'dlp-shut'}`}
              onClick={() => setFgOpen((s) => ({ ...s, methods: !s.methods }))}
            >
              <span className="dlp-fg-title">Methoden</span>
              <i className="bi bi-chevron-down dlp-fg-toggle" aria-hidden />
            </button>
            <div className="dlp-fg-body">
              <div className="dlp-fg-chips">
                {methodsFilteredForUi.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`dlp-fc ${query.methodId === m.id ? 'dlp-on' : ''}`}
                    onClick={() =>
                      navigate(
                        {
                          ...query,
                          methodId: query.methodId === m.id ? '' : m.id,
                          page: 1,
                        },
                        1
                      )
                    }
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Link className="dlp-freset" href={sidebarFiltersResetHref} onClick={() => setMobSidebarOpen(false)}>
            <i className="bi bi-arrow-counterclockwise" aria-hidden />
            Filter zurücksetzen
          </Link>
        </aside>

        <div className="dlp-main">
          <div className={`dlp-cards ${gridView ? '' : 'dlp-list-view'}`}>
            {profiles.length === 0 ? (
              <DirectoryListingEmptyState hasActiveFilters radiusSearch={radiusSearchActive} />
            ) : (
              profiles.map((p) => {
                const href = `/behandler/${p.slug}`
                const tax = taxonomyByProfileId.get(p.id)
                const dist = distancesKmByProfileId?.get(p.id)
                const primaryFach = tax?.specialties?.[0] ?? 'Tierbehandler:in'
                const loc = [p.postal_code, p.city].filter(Boolean).join(' ')
                const locLine =
                  dist != null && Number.isFinite(dist)
                    ? `${loc || 'Region'} · ${dist} km`
                    : loc || p.state || 'Region'
                const isTop = p.top_active === true
                const ini = directoryPremiumInitialsFromName(p.display_name)
                const tagA = (tax?.animals ?? []).slice(0, 3)

                return (
                  <Link key={p.id} href={href} className="dlp-card" data-dlp-profile={p.id}>
                    {isTop ? (
                      <span className="dlp-card-fav" aria-hidden="true">
                        <i className="bi bi-stars" />
                        <span className="dlp-card-toplabel">Top Profil</span>
                      </span>
                    ) : null}
                    <div className="dlp-card-body">
                      <div className="dlp-cb-top">
                        <div className="dlp-cb-avatar">{ini}</div>
                        <div className="dlp-cb-info">
                          <div className="dlp-cb-name">
                            {p.display_name}
                            {p.verification_state === 'verified' ? (
                              <span className="dlp-verified" title="Verifiziert" aria-label="Verifiziert">
                                <i className="bi bi-patch-check-fill" aria-hidden />
                              </span>
                            ) : null}
                          </div>
                          <div className="dlp-cb-fach">{primaryFach}</div>
                        </div>
                      </div>
                      <div className="dlp-cb-tags">
                        {tagA.map((t) => (
                          <span key={t} className="dlp-tag dlp-tag-a">
                            {t}
                          </span>
                        ))}
                        {p.service_type === 'mobile' || p.service_type === 'both' ? (
                          <span className="dlp-tag dlp-tag-m">Mobil</span>
                        ) : null}
                        {p.service_type === 'stationary' ? (
                          <span className="dlp-tag dlp-tag-m">Praxis</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="dlp-card-foot">
                      <div className="dlp-cf-loc">
                        <i className="bi bi-geo-alt-fill" aria-hidden />
                        {locLine}
                      </div>
                      <div className="dlp-cf-actions">
                        <span className="dlp-cf-btn dlp-cf-primary">
                          <i className="bi bi-calendar-plus" aria-hidden />
                          Profil ansehen
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {totalPages > 1 ? (
            <nav className="dlp-pagi" aria-label="Seiten">
              {page > 1 ? (
                <Link className="dlp-pg dlp-arr" href={buildBehandlerListingHref(query, page - 1)}>
                  <i className="bi bi-chevron-left" aria-hidden />
                </Link>
              ) : (
                <span className="dlp-pg dlp-arr" aria-disabled>
                  <i className="bi bi-chevron-left" aria-hidden />
                </span>
              )}
              {pageNums.map((n) => (
                <Link
                  key={n}
                  href={buildBehandlerListingHref(query, n)}
                  className={`dlp-pg ${n === page ? 'dlp-on' : ''}`}
                >
                  {n}
                </Link>
              ))}
              {page < totalPages ? (
                <Link className="dlp-pg dlp-arr" href={buildBehandlerListingHref(query, page + 1)}>
                  <i className="bi bi-chevron-right" aria-hidden />
                </Link>
              ) : (
                <span className="dlp-pg dlp-arr" aria-disabled>
                  <i className="bi bi-chevron-right" aria-hidden />
                </span>
              )}
            </nav>
          ) : null}
        </div>
      </div>

      <button type="button" className="dlp-mob-filter-btn" onClick={() => setMobSidebarOpen(true)}>
        <i className="bi bi-sliders" aria-hidden />
        Filter
      </button>

      {listingNavPending ? (
        <div className="dlp-listing-loading" aria-live="polite" aria-busy="true">
          <div className="dlp-listing-loading__panel" role="status">
            <i className="bi bi-arrow-repeat dlp-listing-loading__icon" aria-hidden />
            <span>Ergebnisse werden geladen …</span>
          </div>
        </div>
      ) : null}

      {mapModalProfile ? (
        <DirectoryListingMapProfileModal
          profile={mapModalProfile}
          taxonomy={taxonomyByProfileId.get(mapModalProfile.id)}
          distanceKm={distancesKmByProfileId?.get(mapModalProfile.id)}
          onClose={onMapModalClose}
        />
      ) : null}
    </div>
  )
}
