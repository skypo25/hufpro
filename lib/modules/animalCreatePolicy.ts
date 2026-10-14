/**
 * Welche Tierarten ein Nutzer anlegen darf (Union der aktiven Module).
 * animal_focus ist nur optionaler Soft-Filter für die UI, keine Extra-Rechte.
 */

import { animalTypesForModules, normalizeAppAnimalType } from '@/lib/modules/catalog'
import type { AppAnimalTypeKey, DocumentationModuleId } from '@/lib/modules/types'

export function allowedAnimalTypesForEnabledModules(
  enabled: readonly DocumentationModuleId[]
): AppAnimalTypeKey[] {
  return animalTypesForModules(enabled)
}

/**
 * Soft-Filter: Fokus schränkt die angebotenen Typen ein, erweitert sie aber nicht.
 */
export function filterAnimalTypesByFocus(
  allowed: readonly AppAnimalTypeKey[],
  animalFocus: string | null | undefined
): AppAnimalTypeKey[] {
  const focus = (animalFocus ?? '').trim()
  if (focus === 'nur_pferde') {
    return allowed.filter((t) => t === 'horse')
  }
  if (focus === 'kleintiere') {
    return allowed.filter((t) => t !== 'horse')
  }
  return [...allowed]
}

export function isAnimalTypeAllowed(
  enabled: readonly DocumentationModuleId[],
  animalType: string | null | undefined
): boolean {
  const key = normalizeAppAnimalType(animalType)
  return allowedAnimalTypesForEnabledModules(enabled).includes(key)
}
