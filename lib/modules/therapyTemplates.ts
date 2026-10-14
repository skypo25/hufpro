/**
 * Vorläufige MVP-Abschnitte für Therapie-Module.
 * Felder sind datengetrieben → später anpassbar ohne Formular-Rewrite.
 */

import type { AppAnimalTypeKey, DocumentationModuleId } from '@/lib/modules/types'

export type TherapyFieldDef = {
  id: string
  label: string
  /** rich = HTML-Editor, text = plain */
  kind: 'rich' | 'text'
  hint?: string
}

export type TherapySectionDef = {
  id: string
  title: string
  optional?: boolean
  fields: TherapyFieldDef[]
  /** Wenn gesetzt: nur für diese Tierarten */
  animalTypes?: readonly AppAnimalTypeKey[]
}

const COMMON_SESSION: TherapySectionDef = {
  id: 'session',
  title: 'Sitzung',
  fields: [
    { id: 'chief_complaint', label: 'Hauptanliegen / Anlass', kind: 'rich' },
    { id: 'session_notes', label: 'Allgemeiner Befund', kind: 'rich' },
  ],
}

const COMMON_TREATMENT: TherapySectionDef = {
  id: 'treatment',
  title: 'Behandlung',
  fields: [
    { id: 'interventions', label: 'Durchgeführte Behandlung', kind: 'rich' },
    { id: 'recommendations', label: 'Empfehlungen / Übungen', kind: 'rich', hint: 'optional' },
  ],
  optional: true,
}

const COMMON_COURSE: TherapySectionDef = {
  id: 'course',
  title: 'Verlauf',
  optional: true,
  fields: [{ id: 'course_notes', label: 'Behandlungsverlauf / Vergleich', kind: 'rich' }],
}

const PHYSIO_EXTRA: TherapySectionDef[] = [
  {
    id: 'gait',
    title: 'Gangbild und Bewegungsanalyse',
    fields: [
      { id: 'gait_analysis', label: 'Gangbild', kind: 'rich' },
      { id: 'movement_limits', label: 'Funktionelle Einschränkungen', kind: 'rich' },
    ],
  },
  {
    id: 'palpation',
    title: 'Muskulatur und Palpation',
    optional: true,
    fields: [
      { id: 'muscle_findings', label: 'Muskulatur / Palpation', kind: 'rich' },
      { id: 'joint_mobility', label: 'Gelenkbeweglichkeit', kind: 'rich' },
    ],
  },
  {
    id: 'equine_saddle',
    title: 'Pferd: Ausrüstung / Belastung',
    optional: true,
    animalTypes: ['horse'],
    fields: [{ id: 'equipment_load', label: 'Sattel / Zaum / Belastung', kind: 'rich' }],
  },
  {
    id: 'small_activity',
    title: 'Kleintier: Alltag / Aktivität',
    optional: true,
    animalTypes: ['dog', 'cat', 'small'],
    fields: [{ id: 'daily_activity', label: 'Alltagsaktivität / Spaziergänge', kind: 'rich' }],
  },
]

const OSTEO_EXTRA: TherapySectionDef[] = [
  {
    id: 'osteo_exam',
    title: 'Osteopathische Untersuchung',
    fields: [
      { id: 'tissue_findings', label: 'Gewebebefunde', kind: 'rich' },
      { id: 'mobility_findings', label: 'Beweglichkeit', kind: 'rich' },
      { id: 'functional_limits', label: 'Funktionelle Einschränkungen', kind: 'rich' },
    ],
  },
]

const HEIL_EXTRA: TherapySectionDef[] = [
  {
    id: 'symptoms',
    title: 'Symptome und Untersuchung',
    fields: [
      { id: 'symptoms', label: 'Symptome', kind: 'rich' },
      { id: 'exam_findings', label: 'Untersuchungsbefunde', kind: 'rich' },
    ],
  },
  {
    id: 'plan',
    title: 'Behandlungsplan',
    optional: true,
    fields: [
      { id: 'treatment_plan', label: 'Plan', kind: 'rich' },
      { id: 'measures', label: 'Angewendete Maßnahmen', kind: 'rich' },
    ],
  },
]

export function therapySectionsForModule(
  moduleId: DocumentationModuleId,
  animalType: string | null | undefined
): TherapySectionDef[] {
  const key = (animalType ?? 'horse').toLowerCase() as AppAnimalTypeKey
  let extra: TherapySectionDef[] = []
  if (moduleId === 'physio') extra = PHYSIO_EXTRA
  else if (moduleId === 'osteo') extra = OSTEO_EXTRA
  else if (moduleId === 'heilpraktik') extra = HEIL_EXTRA

  const filtered = extra.filter((s) => {
    if (!s.animalTypes) return true
    return s.animalTypes.includes(key === 'other' ? 'other' : key)
  })

  return [COMMON_SESSION, ...filtered, COMMON_TREATMENT, COMMON_COURSE]
}

export function therapyAiTypeForModule(
  moduleId: DocumentationModuleId
): 'physio' | 'osteo' | 'heilpraktiker' | 'huf' {
  if (moduleId === 'physio') return 'physio'
  if (moduleId === 'osteo') return 'osteo'
  if (moduleId === 'heilpraktik') return 'heilpraktiker'
  return 'huf'
}
