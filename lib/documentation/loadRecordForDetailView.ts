/**
 * Lädt Daten für Record-Detail (Desktop + Mobile) primär aus documentation_*,
 * mit Mapping in die bisherige hoof_*-View-Form.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Entspricht der View-Erwartung in page.tsx (HoofRecord + Fotos) */
export type RecordDetailHoofRecord = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
  created_at?: string | null
  updated_at?: string | null
  general_condition?: string | null
  gait?: string | null
  handling_behavior?: string | null
  horn_quality?: string | null
  hoofs_json?: unknown
  record_type?: string | null
  doc_number?: string | null
}

export type RecordDetailHoofPhoto = {
  id: string
  file_path: string | null
  photo_type: string | null
  annotations_json?: unknown
  width?: number | null
  height?: number | null
}

type DocRow = {
  id: string
  animal_id: string
  session_date: string
  summary_html: string | null
  recommendations_html: string | null
  internal_notes: string | null
  doc_number: string | null
  hoof_payload: unknown
  metadata: unknown
  created_at: string
  updated_at: string
  documentation_kind: string
}

function parseMetadataLegacyRecordType(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const v = (metadata as { legacy_record_type?: unknown }).legacy_record_type
  return typeof v === 'string' ? v : null
}

function extractHoofPayload(payload: unknown): {
  general: {
    general_condition: string | null
    gait: string | null
    handling_behavior: string | null
    horn_quality: string | null
  }
  hoofs: unknown
} | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as {
    general?: Record<string, unknown>
    hoofs?: unknown
  }
  const g = p.general && typeof p.general === 'object' ? p.general : {}
  return {
    general: {
      general_condition: typeof g.general_condition === 'string' ? g.general_condition : null,
      gait: typeof g.gait === 'string' ? g.gait : null,
      handling_behavior: typeof g.handling_behavior === 'string' ? g.handling_behavior : null,
      horn_quality: typeof g.horn_quality === 'string' ? g.horn_quality : null,
    },
    hoofs: Array.isArray(p.hoofs) ? p.hoofs : [],
  }
}

/**
 * Baut die View-Zeile aus documentation_records + hoof_payload.
 * recordId bleibt die legacy hoof_records.id (URL/Actions).
 */
export function mapDocumentationRowToRecordDetail(
  recordId: string,
  horseId: string,
  row: DocRow
): RecordDetailHoofRecord {
  const payloadParsed = extractHoofPayload(row.hoof_payload)
  const general = payloadParsed?.general ?? {
    general_condition: null,
    gait: null,
    handling_behavior: null,
    horn_quality: null,
  }

  return {
    id: recordId,
    horse_id: horseId,
    record_date: row.session_date?.slice(0, 10) ?? null,
    hoof_condition: row.summary_html,
    treatment: row.recommendations_html,
    notes: row.internal_notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    general_condition: general.general_condition,
    gait: general.gait,
    handling_behavior: general.handling_behavior,
    horn_quality: general.horn_quality,
    hoofs_json: payloadParsed?.hoofs ?? [],
    record_type: parseMetadataLegacyRecordType(row.metadata),
    doc_number: row.doc_number,
  }
}

function mapDocPhotoRow(p: {
  id: string
  file_path: string | null
  photo_type: string
  annotations_json?: unknown
  width?: number | null
  height?: number | null
}): RecordDetailHoofPhoto {
  return {
    id: p.id,
    file_path: p.file_path,
    photo_type: p.photo_type,
    annotations_json: p.annotations_json,
    width: p.width,
    height: p.height,
  }
}

export type LoadRecordDetailFromDocumentationResult =
  | { ok: true; record: RecordDetailHoofRecord; photos: RecordDetailHoofPhoto[] }
  | { ok: false; reason: string }

/**
 * Lädt documentation_records + documentation_photos und mappt auf die Detail-View.
 * recordId = legacy hoof_records.id (URL).
 */
export async function loadRecordDetailFromDocumentation(
  supabase: SupabaseClient,
  userId: string,
  horseId: string,
  recordId: string
): Promise<LoadRecordDetailFromDocumentationResult> {
  const { data: docRow, error: docErr } = await supabase
    .from('documentation_records')
    .select(
      'id, animal_id, session_date, summary_html, recommendations_html, internal_notes, doc_number, hoof_payload, metadata, created_at, updated_at, documentation_kind'
    )
    .filter('metadata->>legacy_hoof_record_id', 'eq', recordId)
    .eq('user_id', userId)
    .eq('animal_id', horseId)
    .maybeSingle()

  if (docErr) {
    return { ok: false, reason: `documentation_records: ${docErr.message}` }
  }
  if (!docRow) {
    return { ok: false, reason: 'no_documentation_row' }
  }

  const row = docRow as unknown as DocRow

  try {
    const record = mapDocumentationRowToRecordDetail(recordId, horseId, row)

    const { data: photoRows, error: photoErr } = await supabase
      .from('documentation_photos')
      .select('id, file_path, photo_type, annotations_json, width, height')
      .eq('documentation_record_id', row.id)
      .eq('user_id', userId)

    if (photoErr) {
      return { ok: false, reason: `documentation_photos: ${photoErr.message}` }
    }

    const photos: RecordDetailHoofPhoto[] = (photoRows ?? []).map((p) =>
      mapDocPhotoRow(
        p as {
          id: string
          file_path: string | null
          photo_type: string
          annotations_json?: unknown
          width?: number | null
          height?: number | null
        }
      )
    )

    return { ok: true, record, photos }
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'mapping_failed',
    }
  }
}

/** Gleiche Record-Form wie MobileRecordDetail (summary_notes ← hoof_condition). */
export type MobileRecordDetailState = {
  id: string
  record_date: string | null
  record_type: string | null
  general_condition: string | null
  gait: string | null
  handling_behavior: string | null
  horn_quality: string | null
  hoofs_json: unknown
  summary_notes: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  doc_number?: string | null
}

/** Wiederverwendung Desktop-Mapping → Mobile-State (keine zweite Fachlogik). */
export function recordDetailHoofRecordToMobileRecord(r: RecordDetailHoofRecord): MobileRecordDetailState {
  return {
    id: r.id,
    record_date: r.record_date,
    record_type: r.record_type ?? null,
    general_condition: r.general_condition ?? null,
    gait: r.gait ?? null,
    handling_behavior: r.handling_behavior ?? null,
    horn_quality: r.horn_quality ?? null,
    hoofs_json: r.hoofs_json ?? [],
    summary_notes: r.hoof_condition,
    notes: r.notes,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    doc_number: r.doc_number,
  }
}
