/**
 * Dokumentationsmodule — unabhängig von Berufsbezeichnungen (profession[]).
 */

export const DOCUMENTATION_MODULE_IDS = [
  'hoof',
  'physio',
  'osteo',
  'heilpraktik',
] as const

export type DocumentationModuleId = (typeof DOCUMENTATION_MODULE_IDS)[number]

/** Bestehende horses.animal_type-Werte — keine neuen Typen erfinden. */
export const APP_ANIMAL_TYPE_KEYS = [
  'horse',
  'dog',
  'cat',
  'small',
  'other',
] as const

export type AppAnimalTypeKey = (typeof APP_ANIMAL_TYPE_KEYS)[number]

export type ModuleEntitlementSource = 'onboarding' | 'admin' | 'migration'

export type ModuleEntitlementRow = {
  user_id: string
  module_id: DocumentationModuleId
  enabled: boolean
  source: ModuleEntitlementSource
  granted_at: string
  granted_by: string | null
  updated_at: string
  updated_by: string | null
}

export type ModuleDefinition = {
  id: DocumentationModuleId
  label: string
  /** Unterstützte Tierarten (horses.animal_type). */
  animalTypes: readonly AppAnimalTypeKey[]
  /** Ob interaktive Körperkarte (Pferd/Hund/Katze) angeboten wird. */
  supportsBodyMap: boolean
  /** documentation_records.documentation_kind */
  documentationKind: 'hoof' | 'therapy'
  /** documentation_records.therapy_discipline (null bei hoof) */
  therapyDiscipline: 'physio' | 'osteo' | 'heilpraktik' | 'other' | null
}
