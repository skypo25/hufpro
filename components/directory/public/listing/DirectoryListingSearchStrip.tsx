'use client'

import { useEffect, useMemo, useState } from 'react'

import type { DirectoryPublicAnimalTypeRow, DirectoryPublicSpecialtyRow } from '@/lib/directory/public/types'
import type { BehandlerListingQuery } from '@/lib/directory/public/listingParams'
import {
  DIRECTORY_AUTOCOMPLETE_COUNTRY_CODES,
  DIRECTORY_PHOTON_DACH_BBOX,
  DIRECTORY_PHOTON_PLACE_LAYERS,
  RADIUS_KM_OPTIONS,
} from '@/lib/directory/public/listingParams'
import AddressAutocomplete from '@/components/customers/AddressAutocomplete'
import {
  BARHUF_SPECIALTY_CODE,
  isHoofSpecialtyCode,
  isNonEquineAnimalCode,
} from '@/lib/directory/public/taxonomyCoherence'

export function DirectoryListingSearchStrip({
  specialties,
  animalTypes,
  values,
}: {
  specialties: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  values: BehandlerListingQuery
}) {
  const [specialtyId, setSpecialtyId] = useState(values.specialtyId)
  const [animalTypeId, setAnimalTypeId] = useState(values.animalTypeId)
  const [location, setLocation] = useState(values.location)

  useEffect(() => {
    setLocation(values.location)
  }, [values.location])

  useEffect(() => {
    setSpecialtyId(values.specialtyId)
    const spec = specialties.find((s) => s.id === values.specialtyId)
    let nextAnimal = values.animalTypeId
    if (spec?.code === BARHUF_SPECIALTY_CODE && !nextAnimal) {
      const pferdId = animalTypes.find((a) => a.code === 'pferd')?.id
      if (pferdId) nextAnimal = pferdId
    }
    setAnimalTypeId(nextAnimal)
  }, [values.specialtyId, values.animalTypeId, specialties, animalTypes])

  const visibleAnimals = useMemo(() => {
    const spec = specialties.find((s) => s.id === specialtyId)
    if (spec && isHoofSpecialtyCode(spec.code)) {
      return animalTypes.filter((a) => !isNonEquineAnimalCode(a.code))
    }
    return animalTypes
  }, [specialtyId, specialties, animalTypes])

  const onSpecialtyChange = (nextId: string) => {
    setSpecialtyId(nextId)
    const spec = specialties.find((s) => s.id === nextId)
    if (spec?.code === BARHUF_SPECIALTY_CODE) {
      const pferdId = animalTypes.find((a) => a.code === 'pferd')?.id
      if (pferdId) setAnimalTypeId(pferdId)
      return
    }
    if (spec && isHoofSpecialtyCode(spec.code)) {
      const cur = animalTypes.find((a) => a.id === animalTypeId)
      if (cur && isNonEquineAnimalCode(cur.code)) setAnimalTypeId('')
    }
  }

  return (
    <div className="search-section" data-directory-section="search">
      <form method="get" action="/behandler" className="search-bar">
        {values.serviceType ? <input type="hidden" name="serviceType" value={values.serviceType} /> : null}
        <input type="hidden" name="location" value={location} />
        <div className="sb-field sb-field--location">
          <i className="bi bi-geo-alt-fill" aria-hidden />
          <AddressAutocomplete
            value={location}
            onValueChange={setLocation}
            persistQueryOnSelect
            bbox={DIRECTORY_PHOTON_DACH_BBOX}
            allowedCountryCodes={DIRECTORY_AUTOCOMPLETE_COUNTRY_CODES}
            photonLayers={DIRECTORY_PHOTON_PLACE_LAYERS}
            placeholder="Ort oder Postleitzahl…"
            id="directory-search-location"
            ariaLabel="Ort oder PLZ"
            className="dir-loc-ac-input"
          />
        </div>
        <div className="sb-field sb-field--radius">
          <i className="bi bi-crosshair2" aria-hidden />
          <select name="radiusKm" defaultValue={String(values.radiusKm)} aria-label="Suchradius">
            {RADIUS_KM_OPTIONS.map((km) => (
              <option key={km} value={km}>
                {km} km Umkreis
              </option>
            ))}
          </select>
        </div>
        <div className="sb-field sb-field--specialty">
          <i className="bi bi-heart-pulse-fill" aria-hidden />
          <select
            name="specialtyId"
            value={specialtyId}
            onChange={(e) => onSpecialtyChange(e.target.value)}
            aria-label="Fachrichtung"
          >
            <option value="">Alle Fachrichtungen</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sb-field sb-field--animal">
          <i className="bi bi-feather" aria-hidden />
          <select
            name="animalTypeId"
            value={animalTypeId}
            onChange={(e) => setAnimalTypeId(e.target.value)}
            aria-label="Tierart"
          >
            <option value="">Alle Tierarten</option>
            {visibleAnimals.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="sb-btn">
          <i className="bi bi-search" aria-hidden />
          Suchen
        </button>
      </form>
    </div>
  )
}
