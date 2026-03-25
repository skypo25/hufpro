import type { SupabaseClient } from '@supabase/supabase-js'

/** Wie Backfill: NULL/leer → legacy_unknown */
export function normalizePhotoTypeForDocumentation(raw: string | null | undefined): string {
  const t = raw == null ? '' : String(raw).trim()
  return t || 'legacy_unknown'
}

export async function getDocumentationRecordIdByLegacyHoofId(
  supabase: SupabaseClient,
  hoofRecordId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('documentation_records')
    .select('id')
    .filter('metadata->>legacy_hoof_record_id', 'eq', hoofRecordId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`documentation_records Lookup: ${error.message}`)
  return data?.id ?? null
}

/**
 * Löscht documentation_records inkl. documentation_photos (FK CASCADE).
 */
export async function deleteDocumentationRecordByLegacyHoofId(
  supabase: SupabaseClient,
  hoofRecordId: string,
  userId: string
): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from('documentation_records')
    .select('id')
    .filter('metadata->>legacy_hoof_record_id', 'eq', hoofRecordId)
    .eq('user_id', userId)
    .maybeSingle()

  if (selErr) throw new Error(`documentation_records Lookup: ${selErr.message}`)
  if (!row?.id) return

  const { error } = await supabase.from('documentation_records').delete().eq('id', row.id).eq('user_id', userId)
  if (error) throw new Error(`documentation_records löschen: ${error.message}`)
}

export async function deleteDocumentationRecordsForLegacyHoofIds(
  supabase: SupabaseClient,
  hoofRecordIds: string[],
  userId: string
): Promise<void> {
  for (const id of hoofRecordIds) {
    await deleteDocumentationRecordByLegacyHoofId(supabase, id, userId)
  }
}

type HoofPhotoMirrorShape = {
  file_path: string | null
  photo_type: string | null
  annotations_json?: unknown
  width?: number | null
  height?: number | null
  file_size?: number | null
  mime_type?: string | null
}

/**
 * Nach erfolgreichem INSERT in hoof_photos: gleiche Zeile in documentation_photos.
 * Entfernt vorher den Slot in documentation_photos (wie hoof: ein Bild pro Slot).
 */
export async function mirrorDocumentationPhotoAfterHoofInsert(
  supabase: SupabaseClient,
  hoofRecordId: string,
  userId: string,
  hoofRow: HoofPhotoMirrorShape
): Promise<void> {
  const docId = await getDocumentationRecordIdByLegacyHoofId(supabase, hoofRecordId, userId)
  if (!docId) {
    throw new Error(
      'Kein documentation_records-Eintrag für diese Hufdokumentation (legacy_hoof_record_id). Bitte Dokumentation erneut speichern oder Backfill prüfen.'
    )
  }

  const slotNorm = normalizePhotoTypeForDocumentation(hoofRow.photo_type)

  const { error: delErr } = await supabase
    .from('documentation_photos')
    .delete()
    .eq('documentation_record_id', docId)
    .eq('user_id', userId)
    .eq('photo_type', slotNorm)

  if (delErr) throw new Error(`documentation_photos (Slot leeren): ${delErr.message}`)

  const filePath = hoofRow.file_path
  if (!filePath) {
    throw new Error('documentation_photos Spiegel: file_path fehlt.')
  }

  const { error: insErr } = await supabase.from('documentation_photos').insert({
    user_id: userId,
    documentation_record_id: docId,
    file_path: filePath,
    photo_type: slotNorm,
    annotations_json: hoofRow.annotations_json ?? null,
    width: hoofRow.width ?? null,
    height: hoofRow.height ?? null,
    file_size: hoofRow.file_size ?? null,
    mime_type: hoofRow.mime_type ?? null,
    sort_order: null,
  })

  if (insErr) throw new Error(`documentation_photos (Insert): ${insErr.message}`)
}

export async function mirrorDocumentationPhotoAnnotations(
  supabase: SupabaseClient,
  hoofRecordId: string,
  userId: string,
  slot: string,
  annotationsJson: unknown
): Promise<void> {
  const docId = await getDocumentationRecordIdByLegacyHoofId(supabase, hoofRecordId, userId)
  if (!docId) {
    throw new Error(
      'Kein documentation_records-Eintrag für Annotationen-Spiegel (legacy_hoof_record_id). Bitte Dokumentation erneut speichern oder Backfill prüfen.'
    )
  }

  const pt = normalizePhotoTypeForDocumentation(slot)
  const { error } = await supabase
    .from('documentation_photos')
    .update({ annotations_json: annotationsJson })
    .eq('documentation_record_id', docId)
    .eq('user_id', userId)
    .eq('photo_type', pt)

  if (error) throw new Error(`documentation_photos (Annotationen): ${error.message}`)
}

export type HoofPhotoRowForMirror = {
  file_path: string | null
  photo_type: string | null
}

/**
 * Löscht die gespiegelten documentation_photos-Zeilen zu den angegebenen hoof_photos-Zeilen.
 * Reihenfolge: vor oder nach hoof_photos-DELETE; hier vorzugsweise davor.
 */
export async function deleteDocumentationPhotosMirroringHoofRows(
  supabase: SupabaseClient,
  hoofRecordId: string,
  userId: string,
  hoofPhotoRows: HoofPhotoRowForMirror[]
): Promise<void> {
  if (hoofPhotoRows.length === 0) return

  const docId = await getDocumentationRecordIdByLegacyHoofId(supabase, hoofRecordId, userId)
  if (!docId) {
    throw new Error(
      'Kein documentation_records-Eintrag für Foto-Löschung (legacy_hoof_record_id). Bitte Dokumentation erneut speichern oder Backfill prüfen.'
    )
  }

  for (const row of hoofPhotoRows) {
    if (!row.file_path) continue
    const pt = normalizePhotoTypeForDocumentation(row.photo_type)
    const { error } = await supabase
      .from('documentation_photos')
      .delete()
      .eq('documentation_record_id', docId)
      .eq('user_id', userId)
      .eq('file_path', row.file_path)
      .eq('photo_type', pt)

    if (error) throw new Error(`documentation_photos löschen: ${error.message}`)
  }
}
