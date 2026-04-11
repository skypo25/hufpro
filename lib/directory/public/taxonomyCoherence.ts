/**
 * Konsistenz Huf-Fachrichtungen ↔ Kleintier-Tierarten:
 * Hufbearbeitung / Barhuf / Hufschmied passen nicht zu Hund, Katze, Kleintiere.
 */

import type { BehandlerListingQuery } from '@/lib/directory/public/listingParams'

type SpecRow = { id: string; code: string }
type AnimalRow = { id: string; code: string }

export const HOOF_SPECIALTY_CODES = new Set(['hufbearbeitung', 'barhufbearbeitung', 'hufschmied'])

/** Tierarten, die in der Regel keine Huf-Fachrichtung sind. */
export const NON_EQUINE_ANIMAL_CODES = new Set(['hund', 'katze', 'kleintiere'])

/** Barhufbearbeitung: sinnvolle Voreinstellung Tierart „Pferde“. */
export const BARHUF_SPECIALTY_CODE = 'barhufbearbeitung' as const

/** Wenn Fachrichtung Barhuf ist und keine Tierart gesetzt → Tierart „Pferd“. */
export function listingQueryWithBarhufDefaultAnimal(
  q: BehandlerListingQuery,
  specialties: SpecRow[],
  animalTypes: AnimalRow[]
): BehandlerListingQuery {
  const next = { ...q }
  const specCode = next.specialtyId ? specialties.find((s) => s.id === next.specialtyId)?.code : undefined
  if (specCode !== BARHUF_SPECIALTY_CODE || next.animalTypeId) return next
  const pferdId = animalTypes.find((a) => a.code === 'pferd')?.id
  if (pferdId) next.animalTypeId = pferdId
  return next
}

export function isHoofSpecialtyCode(code: string | null | undefined): boolean {
  if (!code) return false
  return HOOF_SPECIALTY_CODES.has(code)
}

export function isNonEquineAnimalCode(code: string | null | undefined): boolean {
  if (!code) return false
  return NON_EQUINE_ANIMAL_CODES.has(code)
}

type SubRow = { id: string; directory_specialty_code: string }
type MetRow = { id: string; directory_specialty_code: string | null }

/**
 * Entfernt widersprüchliche Filter aus der URL-Query (z. B. Katze + Barhuf-Methode).
 */
export function sanitizeBehandlerListingQuery(
  q: BehandlerListingQuery,
  specialties: SpecRow[],
  animalTypes: AnimalRow[],
  subcategories: SubRow[],
  methods: MetRow[]
): { q: BehandlerListingQuery; changed: boolean } {
  const next = { ...q }
  let changed = false

  const specCode = next.specialtyId ? specialties.find((s) => s.id === next.specialtyId)?.code : undefined
  const aniCode = next.animalTypeId ? animalTypes.find((a) => a.id === next.animalTypeId)?.code : undefined

  if (isHoofSpecialtyCode(specCode) && isNonEquineAnimalCode(aniCode)) {
    next.animalTypeId = ''
    changed = true
  }

  const effectiveAniCode = next.animalTypeId
    ? animalTypes.find((a) => a.id === next.animalTypeId)?.code
    : undefined

  if (isNonEquineAnimalCode(effectiveAniCode)) {
    if (next.subcategoryId) {
      const sub = subcategories.find((s) => s.id === next.subcategoryId)
      if (sub && isHoofSpecialtyCode(sub.directory_specialty_code)) {
        next.subcategoryId = ''
        changed = true
      }
    }
    if (next.methodId) {
      const met = methods.find((m) => m.id === next.methodId)
      const mc = met?.directory_specialty_code
      if (isHoofSpecialtyCode(mc)) {
        next.methodId = ''
        changed = true
      }
    }
  }

  const withBarhuf = listingQueryWithBarhufDefaultAnimal(next, specialties, animalTypes)
  if (withBarhuf.animalTypeId !== next.animalTypeId) {
    next.animalTypeId = withBarhuf.animalTypeId
    changed = true
  }

  return { q: next, changed }
}

/** Sidebar: Tierart auf Kleintier stellen → Huf-Spezialisierung / -Methode entfernen. */
export function listingQueryAfterAnimalTypeToggle(
  q: BehandlerListingQuery,
  animalTypeId: string,
  animalTypes: AnimalRow[],
  subcategories: SubRow[],
  methods: MetRow[]
): BehandlerListingQuery {
  const toggled = q.animalTypeId === animalTypeId ? '' : animalTypeId
  const next = { ...q, animalTypeId: toggled, page: 1 }
  const aniCode = next.animalTypeId ? animalTypes.find((a) => a.id === next.animalTypeId)?.code : undefined
  if (isNonEquineAnimalCode(aniCode)) {
    if (next.subcategoryId) {
      const sub = subcategories.find((s) => s.id === next.subcategoryId)
      if (sub && isHoofSpecialtyCode(sub.directory_specialty_code)) next.subcategoryId = ''
    }
    if (next.methodId) {
      const met = methods.find((m) => m.id === next.methodId)
      if (isHoofSpecialtyCode(met?.directory_specialty_code ?? undefined)) next.methodId = ''
    }
  }
  return next
}

/** Suchleiste: Fachrichtung auf Huf → unpassende Tierart zurücksetzen. */
export function listingQueryClearAnimalIfHoofSpecialtyMismatch(
  q: BehandlerListingQuery,
  specialties: SpecRow[],
  animalTypes: AnimalRow[]
): BehandlerListingQuery {
  const next = { ...q }
  const specCode = next.specialtyId ? specialties.find((s) => s.id === next.specialtyId)?.code : undefined
  const aniCode = next.animalTypeId ? animalTypes.find((a) => a.id === next.animalTypeId)?.code : undefined
  if (isHoofSpecialtyCode(specCode) && isNonEquineAnimalCode(aniCode)) {
    next.animalTypeId = ''
  }
  return next
}
