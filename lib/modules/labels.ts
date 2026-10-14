import { MODULE_CATALOG } from '@/lib/modules/catalog'
import type { DocumentationModuleId } from '@/lib/modules/types'
import { isDocumentationModuleId } from '@/lib/modules/catalog'

/** Anzeige-Label für Listen / PDF / Akte. */
export function documentationModuleLabel(params: {
  documentationModule?: string | null
  documentationKind?: string | null
  therapyDiscipline?: string | null
}): string {
  if (isDocumentationModuleId(params.documentationModule)) {
    return MODULE_CATALOG[params.documentationModule as DocumentationModuleId].label
  }
  if (params.documentationKind === 'hoof') return MODULE_CATALOG.hoof.label
  if (params.therapyDiscipline === 'physio') return MODULE_CATALOG.physio.label
  if (params.therapyDiscipline === 'osteo') return MODULE_CATALOG.osteo.label
  if (params.therapyDiscipline === 'heilpraktik') return MODULE_CATALOG.heilpraktik.label
  if (params.documentationKind === 'therapy') return 'Therapie'
  return 'Dokumentation'
}
