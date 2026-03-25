/**
 * Reine Ableitung hoof_record (+ Profession) → documentation_records-Felder.
 * Regeln konsistent mit supabase/backfill/backfill_hoof_to_documentation.sql
 */

export type DocumentationKind = 'hoof' | 'therapy'

export type TherapyDiscipline = 'physio' | 'osteo' | 'heilpraktik' | 'other'

export type SessionType = 'first' | 'regular' | 'control' | 'other'

export type HoofRecordMirrorInput = {
  id: string
  user_id: string
  horse_id: string
  record_date: string | null
  record_type: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
  general_condition: string | null
  gait: string | null
  handling_behavior: string | null
  horn_quality: string | null
  hoofs_json: unknown
  checklist_json: unknown
  created_at: string
  updated_at: string
  doc_number?: string | null
}

/** Wie Backfill: leer → hufbearbeiter */
export function normalizeProfession(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : ''
  return s || 'hufbearbeiter'
}

export function deriveDocumentationKind(profession: string): DocumentationKind {
  return profession === 'hufbearbeiter' ? 'hoof' : 'therapy'
}

export function deriveTherapyDiscipline(profession: string): TherapyDiscipline | null {
  if (profession === 'hufbearbeiter') return null
  if (profession === 'tierphysiotherapeut') return 'physio'
  if (profession === 'osteopath') return 'osteo'
  if (profession === 'tierheilpraktiker') return 'heilpraktik'
  return 'other'
}

export function deriveSessionType(recordType: string | null): SessionType | null {
  if (recordType == null || String(recordType).trim() === '') return null
  const t = String(recordType).trim().toLowerCase()
  if (['ersttermin', 'first', 'first_visit'].includes(t)) return 'first'
  if (['regeltermin', 'regular', 'follow_up', 'folge', 'folgebehandlung'].includes(t)) return 'regular'
  if (['kontrolle', 'control'].includes(t)) return 'control'
  return 'other'
}

export function sessionDateFromHoof(row: HoofRecordMirrorInput): string {
  if (row.record_date) {
    const d = String(row.record_date).slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  }
  const created = new Date(row.created_at)
  if (!Number.isNaN(created.getTime())) {
    return created.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

function asJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function buildHoofPayload(row: HoofRecordMirrorInput): Record<string, unknown> {
  const hoofs = asJsonArray(row.hoofs_json)
  const checklist = asJsonArray(row.checklist_json)
  return {
    schema_version: 1,
    general: {
      general_condition: row.general_condition,
      gait: row.gait,
      handling_behavior: row.handling_behavior,
      horn_quality: row.horn_quality,
    },
    hoofs,
    checklist,
  }
}

/** Identisch zum Backfill-Literal für therapy */
export function buildTherapyPayloadMinimal(): Record<string, unknown> {
  return {
    schema_version: 1,
    focus: { regions: [], notes: null },
    modalities: [],
    extensions: {},
  }
}

export function buildDocumentationMetadata(row: HoofRecordMirrorInput): Record<string, unknown> {
  return {
    legacy_hoof_record_id: row.id,
    legacy_record_type: row.record_type,
    backfill_version: 1,
    backfill_source: 'hoof_records',
  }
}

export type DocumentationRowPayload = {
  user_id: string
  animal_id: string
  session_date: string
  documentation_kind: DocumentationKind
  therapy_discipline: TherapyDiscipline | null
  animal_type: 'horse'
  session_type: SessionType | null
  title: null
  summary_html: string | null
  recommendations_html: string | null
  internal_notes: string | null
  doc_number: string | null
  hoof_payload: Record<string, unknown> | null
  therapy_payload: Record<string, unknown> | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export function buildDocumentationRowPayload(
  row: HoofRecordMirrorInput,
  profession: string
): DocumentationRowPayload {
  const kind = deriveDocumentationKind(profession)
  const therapyDiscipline = deriveTherapyDiscipline(profession)
  const sessionType = deriveSessionType(row.record_type)

  const hoofPayload = kind === 'hoof' ? buildHoofPayload(row) : null
  const therapyPayload = kind === 'therapy' ? buildTherapyPayloadMinimal() : null

  return {
    user_id: row.user_id,
    animal_id: row.horse_id,
    session_date: sessionDateFromHoof(row),
    documentation_kind: kind,
    therapy_discipline: therapyDiscipline,
    animal_type: 'horse',
    session_type: sessionType,
    title: null,
    summary_html: row.hoof_condition,
    recommendations_html: row.treatment,
    internal_notes: row.notes,
    doc_number: row.doc_number ?? null,
    hoof_payload: hoofPayload,
    therapy_payload: therapyPayload,
    metadata: buildDocumentationMetadata(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
