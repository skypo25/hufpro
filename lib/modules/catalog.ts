/**
 * Zentrale Modul-Definitionen und Profession → Modul-Mapping.
 * Erweiterbar; später ggf. Admin-editierbar.
 */

import type {
  AppAnimalTypeKey,
  DocumentationModuleId,
  ModuleDefinition,
} from '@/lib/modules/types'
import { DOCUMENTATION_MODULE_IDS } from '@/lib/modules/types'

/** Onboarding-/Settings-Berufsgruppen (lib/appProfile Profession). */
export type ProfessionCode =
  | 'hufbearbeiter'
  | 'tierheilpraktiker'
  | 'tierphysiotherapeut'
  | 'osteopath'
  | 'sonstiges'
  | string

/**
 * Weitere Synonyme können später ergänzt werden (z. B. Hufschmied),
 * ohne bestehende Profession-Werte zu ändern.
 */
export const PROFESSION_TO_MODULE: Readonly<Record<string, DocumentationModuleId>> = {
  hufbearbeiter: 'hoof',
  hufschmied: 'hoof',
  barhufbearbeitung: 'hoof',
  tierphysiotherapeut: 'physio',
  tierphysiotherapie: 'physio',
  osteopath: 'osteo',
  tierosteopath: 'osteo',
  tierosteopathie: 'osteo',
  tierheilpraktiker: 'heilpraktik',
  tierheilpraktik: 'heilpraktik',
  sonstiges: 'heilpraktik',
}

const THERAPY_ANIMALS: readonly AppAnimalTypeKey[] = [
  'horse',
  'dog',
  'cat',
  'small',
  'other',
]

export const MODULE_CATALOG: Readonly<Record<DocumentationModuleId, ModuleDefinition>> = {
  hoof: {
    id: 'hoof',
    label: 'Hufbearbeitung',
    animalTypes: ['horse'],
    supportsBodyMap: false,
    documentationKind: 'hoof',
    therapyDiscipline: null,
  },
  physio: {
    id: 'physio',
    label: 'Tierphysiotherapie',
    animalTypes: THERAPY_ANIMALS,
    supportsBodyMap: true,
    documentationKind: 'therapy',
    therapyDiscipline: 'physio',
  },
  osteo: {
    id: 'osteo',
    label: 'Tierosteopathie',
    animalTypes: THERAPY_ANIMALS,
    supportsBodyMap: true,
    documentationKind: 'therapy',
    therapyDiscipline: 'osteo',
  },
  heilpraktik: {
    id: 'heilpraktik',
    label: 'Tierheilpraktik',
    animalTypes: THERAPY_ANIMALS,
    supportsBodyMap: true,
    documentationKind: 'therapy',
    therapyDiscipline: 'heilpraktik',
  },
}

export function isDocumentationModuleId(value: unknown): value is DocumentationModuleId {
  return typeof value === 'string' && (DOCUMENTATION_MODULE_IDS as readonly string[]).includes(value)
}

export function getModuleDefinition(id: DocumentationModuleId): ModuleDefinition {
  return MODULE_CATALOG[id]
}

export function listModuleDefinitions(): ModuleDefinition[] {
  return DOCUMENTATION_MODULE_IDS.map((id) => MODULE_CATALOG[id])
}

/** Berufsgruppe(n) → Modul-IDs (Unique, Reihenfolge der Eingabe). */
export function modulesFromProfessions(professions: unknown): DocumentationModuleId[] {
  const list: string[] = Array.isArray(professions)
    ? professions.filter((p): p is string => typeof p === 'string')
    : typeof professions === 'string'
      ? [professions]
      : []

  const out: DocumentationModuleId[] = []
  for (const raw of list) {
    const key = raw.trim().toLowerCase()
    const mod = PROFESSION_TO_MODULE[key]
    if (mod && !out.includes(mod)) out.push(mod)
  }
  return out
}

/** Union der Tierarten aller aktiven Module. */
export function animalTypesForModules(
  moduleIds: readonly DocumentationModuleId[]
): AppAnimalTypeKey[] {
  const set = new Set<AppAnimalTypeKey>()
  for (const id of moduleIds) {
    const def = MODULE_CATALOG[id]
    if (!def) continue
    for (const t of def.animalTypes) set.add(t)
  }
  return [...set]
}

export function moduleSupportsAnimalType(
  moduleId: DocumentationModuleId,
  animalType: AppAnimalTypeKey | string | null | undefined
): boolean {
  const def = MODULE_CATALOG[moduleId]
  if (!def) return false
  const key = normalizeAppAnimalType(animalType)
  return def.animalTypes.includes(key)
}

/** Leer/null → horse (wie bestehende App-Konvention). */
export function normalizeAppAnimalType(
  animalType: string | null | undefined
): AppAnimalTypeKey {
  const t = (animalType ?? '').trim().toLowerCase()
  if (t === 'dog') return 'dog'
  if (t === 'cat') return 'cat'
  if (t === 'small') return 'small'
  if (t === 'other') return 'other'
  return 'horse'
}

/** Module, die eine Tierart unterstützen (aus einer Kandidatenliste). */
export function modulesCompatibleWithAnimal(
  enabledModules: readonly DocumentationModuleId[],
  animalType: string | null | undefined
): DocumentationModuleId[] {
  return enabledModules.filter((id) => moduleSupportsAnimalType(id, animalType))
}
