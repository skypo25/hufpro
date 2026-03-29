/**
 * Modularer „Fachlicher Erstkontext“ für Tier-Anlage (AnimalForm).
 * Persistiert unter horses.intake.clinicalFirstContext + intake.profilePhotoPath.
 */

export type ClinicalAnamnesisMore = {
  feedingNotes: string
  digestionNotable: string
  allergiesDetail: string
  behaviorStress: string
  vetFindings: string
  ownerObservations: string
  vaccination: string
  /** Legacy-Feld Verträglichkeit (nicht im sichtbaren Kern, bleibt erhalten) */
  compatibility: string
}

export type ClinicalAnamnesis = {
  mainComplaint: string
  complaintsSince: string
  acuteOrChronic: string
  currentMeds: string
  knownConditions: string
  more: ClinicalAnamnesisMore
}

export type ClinicalLocomotionMore = {
  lameness: string
  trainingLimits: string
  loadBendingObs: string
  vetDiagnosisMovement: string
  otherMovementObs: string
}

export type ClinicalLocomotion = {
  affectedRegion: string
  movementLimitation: string
  problemContext: string
  priorTreatments: string
  trainingLevel: string
  more: ClinicalLocomotionMore
}

export type ClinicalHistory = {
  priorInjuries: string
  operationsScars: string
  recurringIssues: string
  equipmentIssues: string
  otherHistory: string
}

export type ClinicalFirstContext = {
  anamnesis: ClinicalAnamnesis
  locomotion: ClinicalLocomotion
  history: ClinicalHistory
}

export const emptyClinicalAnamnesisMore = (): ClinicalAnamnesisMore => ({
  feedingNotes: '',
  digestionNotable: '',
  allergiesDetail: '',
  behaviorStress: '',
  vetFindings: '',
  ownerObservations: '',
  vaccination: '',
  compatibility: '',
})

export const emptyClinicalFirstContext = (): ClinicalFirstContext => ({
  anamnesis: {
    mainComplaint: '',
    complaintsSince: '',
    acuteOrChronic: '',
    currentMeds: '',
    knownConditions: '',
    more: emptyClinicalAnamnesisMore(),
  },
  locomotion: {
    affectedRegion: '',
    movementLimitation: '',
    problemContext: '',
    priorTreatments: '',
    trainingLevel: '',
    more: {
      lameness: '',
      trainingLimits: '',
      loadBendingObs: '',
      vetDiagnosisMovement: '',
      otherMovementObs: '',
    },
  },
  history: {
    priorInjuries: '',
    operationsScars: '',
    recurringIssues: '',
    equipmentIssues: '',
    otherHistory: '',
  },
})

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** Aus gespeichertem intake-JSON lesen (ohne Legacy-Flachfelder). */
export function clinicalFromIntakeJson(intake: unknown): ClinicalFirstContext | null {
  if (!isRecord(intake)) return null
  const raw = intake.clinicalFirstContext
  if (!isRecord(raw)) return null
  const an = isRecord(raw.anamnesis) ? raw.anamnesis : {}
  const anMore = isRecord(an.more) ? an.more : {}
  const loc = isRecord(raw.locomotion) ? raw.locomotion : {}
  const locMore = isRecord(loc.more) ? loc.more : {}
  const hist = isRecord(raw.history) ? raw.history : {}
  return {
    anamnesis: {
      mainComplaint: String(an.mainComplaint ?? ''),
      complaintsSince: String(an.complaintsSince ?? ''),
      acuteOrChronic: String(an.acuteOrChronic ?? ''),
      currentMeds: String(an.currentMeds ?? ''),
      knownConditions: String(an.knownConditions ?? ''),
      more: {
        feedingNotes: String(anMore.feedingNotes ?? ''),
        digestionNotable: String(anMore.digestionNotable ?? ''),
        allergiesDetail: String(anMore.allergiesDetail ?? ''),
        behaviorStress: String(anMore.behaviorStress ?? ''),
        vetFindings: String(anMore.vetFindings ?? ''),
        ownerObservations: String(anMore.ownerObservations ?? ''),
        vaccination: String(anMore.vaccination ?? ''),
        compatibility: String(anMore.compatibility ?? ''),
      },
    },
    locomotion: {
      affectedRegion: String(loc.affectedRegion ?? ''),
      movementLimitation: String(loc.movementLimitation ?? ''),
      problemContext: String(loc.problemContext ?? ''),
      priorTreatments: String(loc.priorTreatments ?? ''),
      trainingLevel: String(loc.trainingLevel ?? ''),
      more: {
        lameness: String(locMore.lameness ?? ''),
        trainingLimits: String(locMore.trainingLimits ?? ''),
        loadBendingObs: String(locMore.loadBendingObs ?? ''),
        vetDiagnosisMovement: String(locMore.vetDiagnosisMovement ?? ''),
        otherMovementObs: String(locMore.otherMovementObs ?? ''),
      },
    },
    history: {
      priorInjuries: String(hist.priorInjuries ?? ''),
      operationsScars: String(hist.operationsScars ?? ''),
      recurringIssues: String(hist.recurringIssues ?? ''),
      equipmentIssues: String(hist.equipmentIssues ?? ''),
      otherHistory: String(hist.otherHistory ?? ''),
    },
  }
}

export type AnimalFormLegacyFlat = {
  diagnoses?: string
  meds?: string
  allergies?: string
  reason?: string[]
  vetName?: string
  vetPhone?: string
  vaccination?: string
  housing?: string
  feeding?: string
  activity?: string
  supplements?: string
  behavior?: string
  compatibility?: string
  specialNotes?: string
}

/** Alte Flachfelder → Klinik-Struktur (wenn noch kein clinicalFirstContext in DB). */
export function clinicalFromLegacyFlat(f: AnimalFormLegacyFlat): ClinicalFirstContext {
  const c = emptyClinicalFirstContext()
  c.anamnesis.knownConditions = (f.diagnoses ?? '').trim()
  c.anamnesis.currentMeds = (f.meds ?? '').trim()
  c.anamnesis.more.allergiesDetail = (f.allergies ?? '').trim()
  const reasons = Array.isArray(f.reason) ? f.reason.filter(Boolean) : []
  c.anamnesis.mainComplaint = reasons.join(', ')
  const vetN = (f.vetName ?? '').trim()
  const vetP = (f.vetPhone ?? '').trim()
  if (vetN || vetP) {
    c.anamnesis.more.vetFindings = [vetN && `Name: ${vetN}`, vetP && `Tel.: ${vetP}`].filter(Boolean).join(' · ')
  }
  c.anamnesis.more.vaccination = (f.vaccination ?? '').trim()
  const feedLines = [
    f.housing && `Haltung: ${f.housing}`,
    f.feeding && `Fütterung (bisher): ${f.feeding}`,
    f.supplements && `Nahrungsergänzung: ${f.supplements}`,
  ].filter(Boolean)
  c.anamnesis.more.feedingNotes = feedLines.join('\n')
  c.anamnesis.more.behaviorStress = (f.behavior ?? '').trim()
  c.anamnesis.more.compatibility = (f.compatibility ?? '').trim()
  c.anamnesis.more.ownerObservations = (f.specialNotes ?? '').trim()
  c.locomotion.trainingLevel = (f.activity ?? '').trim()
  return c
}

export function profilePhotoPathFromIntake(intake: unknown): string | null {
  if (!isRecord(intake)) return null
  const p = intake.profilePhotoPath
  return typeof p === 'string' && p.trim() ? p.trim() : null
}

/** Für Formular-Initialisierung: gespeichertes clinicalFirstContext oder Legacy-Flachfelder. */
export function resolveClinicalForForm(
  intake: unknown,
  legacy: AnimalFormLegacyFlat
): ClinicalFirstContext {
  return clinicalFromIntakeJson(intake) ?? clinicalFromLegacyFlat(legacy)
}

/** ISO-Zeitstempel aus `horses.intake` (optional, ab Speicher-Logik Erstanamnese/Tierformular). */
export function clinicalIntakeTimestampsFromIntake(intake: unknown): {
  createdAt: string | null
  updatedAt: string | null
} {
  if (!isRecord(intake)) return { createdAt: null, updatedAt: null }
  const c = intake.clinicalFirstContextCreatedAt
  const u = intake.clinicalFirstContextUpdatedAt
  return {
    createdAt: typeof c === 'string' && c.trim() ? c.trim() : null,
    updatedAt: typeof u === 'string' && u.trim() ? u.trim() : null,
  }
}

function formatGermanDateFromIso(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Anzeige „Erstellt am …“ / Hinweis für Erstanamnese-Header */
export function erstanamneseRecordedCaption(
  hasContent: boolean,
  createdAt: string | null,
  updatedAt: string | null
): string {
  if (!hasContent) return 'Noch keine Erstanamnese gespeichert'
  const dc = formatGermanDateFromIso(createdAt)
  if (dc) return `Erstellt am ${dc}`
  const du = formatGermanDateFromIso(updatedAt)
  if (du) return `Zuletzt bearbeitet am ${du}`
  return 'Datum unbekannt'
}

/**
 * Meta-Zeile unter „Erstanamnese“: Datum **vor** Name/Tierart (nur wenn Anamnese-Inhalt da ist).
 */
export function erstanamneseDateLeadForMeta(
  hasContent: boolean,
  createdAt: string | null,
  updatedAt: string | null
): string | null {
  if (!hasContent) return null
  const dc = formatGermanDateFromIso(createdAt)
  if (dc) return `Erstellt am ${dc}`
  const du = formatGermanDateFromIso(updatedAt)
  if (du) return `Zuletzt bearbeitet am ${du}`
  return 'Datum unbekannt'
}

/** True, wenn irgendwo in der Erstanamnese (strukturiert) Text steht. */
export function clinicalFirstContextHasContent(c: ClinicalFirstContext): boolean {
  function anyText(v: unknown): boolean {
    if (typeof v === 'string') return v.trim().length > 0
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.values(v).some(anyText)
    }
    return false
  }
  return anyText(c)
}

/** Legacy-Flachfelder aus gespeichertem Pferd (wie bisher im Bearbeiten-Formular). */
export function legacyFlatFromHorseIntake(horse: {
  intake?: unknown
  special_notes?: string | null
}): AnimalFormLegacyFlat {
  if (!isRecord(horse.intake)) {
    return { specialNotes: horse.special_notes ?? '' }
  }
  const i = horse.intake
  const health = isRecord(i.health) ? i.health : {}
  const husbandry = isRecord(i.husbandry) ? i.husbandry : {}
  const behavior = isRecord(i.behavior) ? i.behavior : {}
  return {
    diagnoses: String(health.diagnoses ?? ''),
    meds: String(health.medication ?? ''),
    allergies: String(health.allergies ?? ''),
    reason: Array.isArray(health.reason) ? (health.reason as string[]) : [],
    vetName: String(health.vetName ?? ''),
    vetPhone: String(health.vetPhone ?? ''),
    vaccination: String(health.vaccination ?? ''),
    housing: String(husbandry.housing ?? ''),
    feeding: String(husbandry.feeding ?? ''),
    activity: String(husbandry.activity ?? ''),
    supplements: String(husbandry.supplements ?? ''),
    behavior: String(behavior.treatmentBehavior ?? ''),
    compatibility: String(behavior.compatibility ?? ''),
    specialNotes: horse.special_notes || String(behavior.notes ?? ''),
  }
}
