/**
 * Fachregeln: passende Module für Tierart / Dokumentationsstart.
 * Rein / shared — keine DB. Server und Client nutzen dieselben Regeln.
 */

import { modulesCompatibleWithAnimal } from '@/lib/modules/catalog'
import type { DocumentationModuleId } from '@/lib/modules/types'

export type ModuleResolveResult =
  | { status: 'none'; candidates: [] }
  | { status: 'single'; candidates: [DocumentationModuleId]; moduleId: DocumentationModuleId }
  | { status: 'choice'; candidates: DocumentationModuleId[] }

/**
 * 0 → keine Doku öffnen
 * 1 → automatisch
 * ≥2 → Auswahl
 *
 * preferredModule (z. B. vom Termin): bleibt in candidates, wird nicht
 * als einziges erzwungen — Caller kann vorauswählen.
 */
export function resolveModulesForAnimal(
  enabledModules: readonly DocumentationModuleId[],
  animalType: string | null | undefined,
  preferredModule?: DocumentationModuleId | null
): ModuleResolveResult {
  const candidates = modulesCompatibleWithAnimal(enabledModules, animalType)

  if (candidates.length === 0) {
    return { status: 'none', candidates: [] }
  }

  if (candidates.length === 1) {
    const moduleId = candidates[0]!
    return { status: 'single', candidates: [moduleId], moduleId }
  }

  // Mehrere: preferred nur validieren/sortieren für UI-Vorauswahl
  if (preferredModule && candidates.includes(preferredModule)) {
    const rest = candidates.filter((c) => c !== preferredModule)
    return { status: 'choice', candidates: [preferredModule, ...rest] }
  }

  return { status: 'choice', candidates }
}

export function canCreateDocumentationForModule(params: {
  enabledModules: readonly DocumentationModuleId[]
  moduleId: DocumentationModuleId
  animalType: string | null | undefined
}): boolean {
  const { enabledModules, moduleId, animalType } = params
  if (!enabledModules.includes(moduleId)) return false
  return modulesCompatibleWithAnimal([moduleId], animalType).length === 1
}
