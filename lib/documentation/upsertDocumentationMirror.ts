import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildDocumentationRowPayload,
  normalizeProfession,
  type HoofRecordMirrorInput,
} from '@/lib/documentation/deriveDocumentationFromHoof'

export type MirrorResult = { ok: true } | { ok: false; error: string }

function rowFromUnknown(row: Record<string, unknown>): HoofRecordMirrorInput | null {
  const id = row.id
  const user_id = row.user_id
  const horse_id = row.horse_id
  if (typeof id !== 'string' || typeof user_id !== 'string' || typeof horse_id !== 'string') {
    return null
  }
  return {
    id,
    user_id,
    horse_id,
    record_date: (row.record_date as string | null) ?? null,
    record_type: (row.record_type as string | null) ?? null,
    hoof_condition: (row.hoof_condition as string | null) ?? null,
    treatment: (row.treatment as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    general_condition: (row.general_condition as string | null) ?? null,
    gait: (row.gait as string | null) ?? null,
    handling_behavior: (row.handling_behavior as string | null) ?? null,
    horn_quality: (row.horn_quality as string | null) ?? null,
    hoofs_json: row.hoofs_json ?? null,
    checklist_json: row.checklist_json ?? null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
    doc_number: (row.doc_number as string | null | undefined) ?? null,
  }
}

/**
 * Spiegelt eine hoof_records-Zeile nach documentation_records (Insert oder Update).
 * Verknüpfung: metadata.legacy_hoof_record_id = hoof.id
 */
export async function upsertDocumentationMirrorFromHoofRow(
  supabase: SupabaseClient,
  hoofRowRaw: Record<string, unknown>,
  settings: Record<string, unknown> | null | undefined
): Promise<MirrorResult> {
  const hoofRow = rowFromUnknown(hoofRowRaw)
  if (!hoofRow) {
    return { ok: false, error: 'Ungültige hoof_records-Zeile für Spiegelung.' }
  }

  const profession = normalizeProfession(settings?.profession)
  const payload = buildDocumentationRowPayload(hoofRow, profession)

  const { data: existing, error: selectError } = await supabase
    .from('documentation_records')
    .select('id')
    .filter('metadata->>legacy_hoof_record_id', 'eq', hoofRow.id)
    .maybeSingle()

  if (selectError) {
    return { ok: false, error: selectError.message }
  }

  const dbRow = {
    user_id: payload.user_id,
    animal_id: payload.animal_id,
    session_date: payload.session_date,
    documentation_kind: payload.documentation_kind,
    therapy_discipline: payload.therapy_discipline,
    animal_type: payload.animal_type,
    session_type: payload.session_type,
    title: payload.title,
    summary_html: payload.summary_html,
    recommendations_html: payload.recommendations_html,
    internal_notes: payload.internal_notes,
    doc_number: payload.doc_number,
    hoof_payload: payload.hoof_payload,
    therapy_payload: payload.therapy_payload,
    metadata: payload.metadata,
    updated_at: payload.updated_at,
  }

  if (existing?.id) {
    const { error: updateError } = await supabase.from('documentation_records').update(dbRow).eq('id', existing.id)

    if (updateError) {
      return { ok: false, error: updateError.message }
    }
    return { ok: true }
  }

  const insertRow = {
    ...dbRow,
    created_at: payload.created_at,
  }

  const { error: insertError } = await supabase.from('documentation_records').insert(insertRow)

  if (insertError) {
    // Unique legacy id (z. B. Race / Backfill): nochmal als Update
    if (insertError.code === '23505') {
      const { data: again, error: againErr } = await supabase
        .from('documentation_records')
        .select('id')
        .filter('metadata->>legacy_hoof_record_id', 'eq', hoofRow.id)
        .maybeSingle()
      if (againErr || !again?.id) {
        return { ok: false, error: insertError.message }
      }
      const { error: upErr } = await supabase.from('documentation_records').update(dbRow).eq('id', again.id)
      if (upErr) return { ok: false, error: upErr.message }
      return { ok: true }
    }
    return { ok: false, error: insertError.message }
  }
  return { ok: true }
}
