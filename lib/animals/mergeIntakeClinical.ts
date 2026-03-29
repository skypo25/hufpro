import {
  clinicalFirstContextHasContent,
  type ClinicalFirstContext,
} from '@/lib/animals/clinicalIntakeTypes'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Übernimmt bestehendes `horses.intake` und setzt `clinicalFirstContext` plus
 * die aus der Anamnese abgeleiteten health/husbandry/behavior-Felder (wie AnimalForm).
 * Ändert keine internalNotes, neutered, profilePhotoPath o. Ä.
 * Setzt bei inhaltlicher Erstanamnese `clinicalFirstContextCreatedAt` (einmalig) und
 * `clinicalFirstContextUpdatedAt` (bei jedem Speichern).
 */
export function mergeIntakeWithClinical(
  existingIntake: unknown,
  clinical: ClinicalFirstContext,
  options?: { now?: string }
): Record<string, unknown> {
  const base = isRecord(existingIntake) ? { ...existingIntake } : {}
  const now = options?.now ?? new Date().toISOString()
  const has = clinicalFirstContextHasContent(clinical)
  const prevCreated =
    typeof base.clinicalFirstContextCreatedAt === 'string' ? base.clinicalFirstContextCreatedAt : undefined
  const prevUpdated =
    typeof base.clinicalFirstContextUpdatedAt === 'string' ? base.clinicalFirstContextUpdatedAt : undefined

  const timeFields: Record<string, unknown> = {}
  if (has) {
    timeFields.clinicalFirstContextUpdatedAt = now
    timeFields.clinicalFirstContextCreatedAt = prevCreated ?? now
  } else {
    if (prevCreated) timeFields.clinicalFirstContextCreatedAt = prevCreated
    if (prevUpdated) timeFields.clinicalFirstContextUpdatedAt = prevUpdated
  }

  const mainComplaintParts = clinical.anamnesis.mainComplaint
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const prevHealth = isRecord(base.health) ? base.health : {}
  const prevHusbandry = isRecord(base.husbandry) ? base.husbandry : {}
  const prevBehavior = isRecord(base.behavior) ? base.behavior : {}

  return {
    ...base,
    ...timeFields,
    clinicalFirstContext: clinical,
    health: {
      ...prevHealth,
      diagnoses: clinical.anamnesis.knownConditions.trim() || null,
      medication: clinical.anamnesis.currentMeds.trim() || null,
      allergies: clinical.anamnesis.more.allergiesDetail.trim() || null,
      reason: mainComplaintParts.length ? mainComplaintParts : null,
      vaccination: clinical.anamnesis.more.vaccination.trim() || null,
    },
    husbandry: {
      ...prevHusbandry,
      feeding: clinical.anamnesis.more.feedingNotes.trim() || null,
      activity: clinical.locomotion.trainingLevel.trim() || null,
    },
    behavior: {
      ...prevBehavior,
      treatmentBehavior: clinical.anamnesis.more.behaviorStress.trim() || null,
      compatibility: clinical.anamnesis.more.compatibility.trim() || null,
      notes: clinical.anamnesis.more.ownerObservations.trim() || null,
    },
  }
}
