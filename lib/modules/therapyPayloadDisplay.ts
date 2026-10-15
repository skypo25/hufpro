/**
 * Anzeige-Helfer für therapy_payload (Detail + PDF).
 * Fokus: neu angelegte Docs — kein Legacy-Mapping nötig.
 */

import { MODULE_CATALOG, isDocumentationModuleId } from '@/lib/modules/catalog'
import {
  therapySectionsForModule,
  type TherapySectionDef,
} from '@/lib/modules/therapyTemplates'
import type { BodyMapState } from '@/lib/modules/bodyMapTemplates'
import type { DocumentationModuleId } from '@/lib/modules/types'

export type TherapyDisplaySection = {
  id: string
  title: string
  fields: Array<{ id: string; label: string; value: string }>
}

export type TherapyDisplay = {
  moduleId: DocumentationModuleId | null
  moduleLabel: string
  discipline: string | null
  animalType: string | null
  sections: TherapyDisplaySection[]
  bodyMap: BodyMapState | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stripToPlain(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseBodyMap(raw: unknown): BodyMapState | null {
  const obj = asRecord(raw)
  if (!obj) return null
  const animal = typeof obj.animal === 'string' ? obj.animal : null
  if (animal !== 'horse' && animal !== 'dog' && animal !== 'cat') return null
  const markersRaw = Array.isArray(obj.markers) ? obj.markers : []
  const markers = markersRaw
    .map((m) => {
      const row = asRecord(m)
      if (!row) return null
      const id = typeof row.id === 'string' ? row.id : null
      const view = typeof row.view === 'string' ? row.view : null
      const x = typeof row.x === 'number' ? row.x : null
      const y = typeof row.y === 'number' ? row.y : null
      if (!id || !view || x == null || y == null) return null
      return {
        id,
        view: view as BodyMapState['markers'][number]['view'],
        templateId: typeof row.templateId === 'string' ? row.templateId : `${animal}_${view}`,
        templateVersion:
          typeof row.templateVersion === 'number' ? row.templateVersion : 1,
        x,
        y,
        markerType: (typeof row.markerType === 'string'
          ? row.markerType
          : 'finding') as BodyMapState['markers'][number]['markerType'],
        findingText: typeof row.findingText === 'string' ? row.findingText : '',
        treatmentText:
          typeof row.treatmentText === 'string' ? row.treatmentText : '',
        updatedAt:
          typeof row.updatedAt === 'string'
            ? row.updatedAt
            : new Date().toISOString(),
      }
    })
    .filter((m): m is NonNullable<typeof m> => m != null)
  return { animal, markers }
}

function fieldValuesFromPayload(payload: Record<string, unknown>): Record<string, string> {
  const sections = asRecord(payload.sections)
  const out: Record<string, string> = {}
  if (!sections) return out
  for (const [k, v] of Object.entries(sections)) {
    if (typeof v === 'string' && v.trim()) out[k] = stripToPlain(v)
  }
  return out
}

function buildSections(
  defs: TherapySectionDef[],
  values: Record<string, string>
): TherapyDisplaySection[] {
  const out: TherapyDisplaySection[] = []
  for (const def of defs) {
    const fields = def.fields
      .map((f) => {
        const value = values[f.id]?.trim() ?? ''
        if (!value) return null
        return { id: f.id, label: f.label, value }
      })
      .filter((f): f is NonNullable<typeof f> => f != null)
    if (fields.length === 0) continue
    out.push({ id: def.id, title: def.title, fields })
  }
  return out
}

/**
 * Baut eine Anzeige-Struktur aus documentation_records.therapy_payload (+ optional metadata).
 */
export function parseTherapyDisplay(params: {
  therapyPayload: unknown
  documentationKind?: string | null
  therapyDiscipline?: string | null
  metadata?: unknown
}): TherapyDisplay | null {
  const kind = params.documentationKind
  const payload = asRecord(params.therapyPayload)

  const meta = asRecord(params.metadata)
  const metaModule = meta?.documentation_module
  let moduleId: DocumentationModuleId | null = null
  if (isDocumentationModuleId(metaModule)) moduleId = metaModule
  else if (isDocumentationModuleId(payload?.module_id)) moduleId = payload.module_id
  else if (params.therapyDiscipline === 'physio') moduleId = 'physio'
  else if (params.therapyDiscipline === 'osteo') moduleId = 'osteo'
  else if (params.therapyDiscipline === 'heilpraktik') moduleId = 'heilpraktik'

  const isTherapy =
    kind === 'therapy' ||
    moduleId === 'physio' ||
    moduleId === 'osteo' ||
    moduleId === 'heilpraktik' ||
    Boolean(payload)

  if (!isTherapy) return null

  const animalType =
    (typeof payload?.animal_type === 'string' ? payload.animal_type : null) ??
    null
  const values = payload ? fieldValuesFromPayload(payload) : {}
  const defs = moduleId
    ? therapySectionsForModule(moduleId, animalType)
    : therapySectionsForModule('heilpraktik', animalType)

  const sections = buildSections(defs, values)
  // Falls Template nichts matched, alle non-empty Keys als „Weitere Angaben“
  if (sections.length === 0 && Object.keys(values).length > 0) {
    sections.push({
      id: 'raw',
      title: 'Angaben',
      fields: Object.entries(values).map(([id, value]) => ({
        id,
        label: id,
        value,
      })),
    })
  }

  return {
    moduleId,
    moduleLabel: moduleId ? MODULE_CATALOG[moduleId].label : 'Therapie',
    discipline: params.therapyDiscipline ?? moduleId,
    animalType,
    sections,
    bodyMap: payload ? parseBodyMap(payload.body_map) : null,
  }
}
