/**
 * Record-Liste auf der Pferde-Detailseite: primär documentation_*,
 * Ergänzung/Fallback über hoof_* (URLs bleiben hoof_records.id).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  dayFromSession,
  mergeSortTime,
  parseLegacyHoofRecordId,
} from '@/lib/documentation/recordListMergeHelpers'

export type HorseRecordListRecord = {
  id: string
  horse_id: string
  record_date: string | null
  created_at: string | null
  updated_at: string | null
  doc_number: string | null
}

export type HorseRecordListRow = {
  record: HorseRecordListRecord
  photoCount: number
}

export type WholeBodyPhotoSource = {
  id: string
  file_path: string | null
  photo_type: string | null
}

type DocListRow = {
  id: string
  session_date: string
  doc_number: string | null
  metadata: unknown
  created_at: string
  updated_at: string
}

type HoofListRow = {
  id: string
  horse_id: string
  record_date: string | null
  created_at: string | null
  updated_at: string | null
}

type MergedRow = {
  legacyHoofId: string
  horseId: string
  record: HorseRecordListRecord
  documentationRecordId: string | null
  sortTime: number
}

function isWholeBodySlot(photoType: string | null | undefined): boolean {
  return photoType === 'whole_left' || photoType === 'whole_right'
}

function countNonWholePhotos(
  photos: Pick<{ photo_type: string | null }, 'photo_type'>[]
): number {
  return photos.filter((p) => !isWholeBodySlot(p.photo_type)).length
}

export type LoadRecordListForHorseViewResult = {
  recordRows: HorseRecordListRow[]
  wholeBodyPhotoSources: WholeBodyPhotoSource[]
  /** Jüngster Eintrag nach Sortierung (hoof_records.id) */
  latestRecordId: string | null
}

/**
 * `recordRows` wie von {@link loadRecordListForHorseView}: neueste zuerst (`sortTime` absteigend).
 * Liefert das Datum des **direkt chronologisch vorgängigen** Besuchs (älterer Nachbar zur aktuellen `recordId`).
 */
export function getPreviousVisitRecordDateFromMergedList(
  recordRows: HorseRecordListRow[],
  currentRecordId: string
): string | null {
  const idx = recordRows.findIndex((r) => r.record.id === currentRecordId)
  if (idx < 0) return null
  return recordRows[idx + 1]?.record.record_date ?? null
}

/**
 * Datum des jüngsten Besuchs nach Merge-Sortierung, z. B. Kontext beim Neuanlegen.
 */
export function getLatestVisitRecordDateFromMergedList(
  recordRows: HorseRecordListRow[]
): string | null {
  return recordRows[0]?.record.record_date ?? null
}

/**
 * Lädt die Dokumentationsliste für ein Pferd: documentation_records primär,
 * hoof_records/hoof_photos für Lücken und Fallback.
 */
export async function loadRecordListForHorseView(
  supabase: SupabaseClient,
  userId: string,
  horseId: string
): Promise<LoadRecordListForHorseViewResult> {
  // Kein hoof_records.doc_number: Spalte fehlt in älteren DBs; Nummer kommt aus documentation_records.
  const { data: hoofRows, error: hoofErr } = await supabase
    .from('hoof_records')
    .select('id, horse_id, record_date, created_at, updated_at')
    .eq('horse_id', horseId)
    .eq('user_id', userId)
    .returns<HoofListRow[]>()

  if (hoofErr) {
    throw new Error(`hoof_records (Liste): ${hoofErr.message}`)
  }

  const { data: docRows, error: docErr } = await supabase
    .from('documentation_records')
    .select('id, session_date, doc_number, metadata, created_at, updated_at')
    .eq('animal_id', horseId)
    .eq('user_id', userId)
    .returns<DocListRow[]>()

  if (docErr) {
    throw new Error(`documentation_records (Liste): ${docErr.message}`)
  }

  const legacyToDoc = new Map<string, DocListRow>()
  for (const row of docRows ?? []) {
    const leg = parseLegacyHoofRecordId(row.metadata)
    if (!leg) continue
    if (!legacyToDoc.has(leg)) legacyToDoc.set(leg, row)
  }

  const merged: MergedRow[] = []

  for (const hoof of hoofRows ?? []) {
    const doc = legacyToDoc.get(hoof.id)
    const recordDate = doc
      ? dayFromSession(doc.session_date) ?? hoof.record_date
      : hoof.record_date
    const createdAt = doc ? doc.created_at : hoof.created_at
    const updatedAt = doc ? doc.updated_at : hoof.updated_at
    const docNumber = doc ? (doc.doc_number ?? null) : null

    const record: HorseRecordListRecord = {
      id: hoof.id,
      horse_id: hoof.horse_id,
      record_date: recordDate,
      created_at: createdAt,
      updated_at: updatedAt,
      doc_number: docNumber ?? null,
    }

    merged.push({
      legacyHoofId: hoof.id,
      horseId,
      record,
      documentationRecordId: doc?.id ?? null,
      sortTime: mergeSortTime(recordDate, createdAt),
    })
  }

  merged.sort((a, b) => b.sortTime - a.sortTime)

  const docBacked = merged.filter((m) => m.documentationRecordId != null).length
  const hoofOnly = merged.length - docBacked

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.info('[horse-detail record-list]', {
      horseId,
      total: merged.length,
      docBacked,
      hoofOnlyFallback: hoofOnly,
    })
  }

  const docIds = [
    ...new Set(merged.map((m) => m.documentationRecordId).filter(Boolean)),
  ] as string[]

  const allLegacyHoofIds = merged.map((m) => m.legacyHoofId)

  const docCountByLegacy = new Map<string, number>()

  if (docIds.length > 0) {
    const { data: docPhotos, error: dpErr } = await supabase
      .from('documentation_photos')
      .select('documentation_record_id, photo_type')
      .eq('user_id', userId)
      .in('documentation_record_id', docIds)

    if (dpErr) {
      throw new Error(`documentation_photos (Liste): ${dpErr.message}`)
    }

    const byDocId = new Map<string, { photo_type: string | null }[]>()
    for (const p of docPhotos ?? []) {
      const row = p as { documentation_record_id: string | null; photo_type: string | null }
      const rid = row.documentation_record_id
      if (!rid) continue
      const arr = byDocId.get(rid) ?? []
      arr.push({ photo_type: row.photo_type })
      byDocId.set(rid, arr)
    }

    const docIdToLegacy = new Map<string, string>()
    for (const m of merged) {
      if (m.documentationRecordId) {
        docIdToLegacy.set(m.documentationRecordId, m.legacyHoofId)
      }
    }

    for (const [docId, photos] of byDocId) {
      const leg = docIdToLegacy.get(docId)
      if (!leg) continue
      docCountByLegacy.set(leg, countNonWholePhotos(photos))
    }
  }

  const hoofCountByLegacy = new Map<string, number>()
  if (allLegacyHoofIds.length > 0) {
    const { data: hoofPhotos, error: hpErr } = await supabase
      .from('hoof_photos')
      .select('hoof_record_id, photo_type')
      .eq('user_id', userId)
      .in('hoof_record_id', allLegacyHoofIds)

    if (hpErr) {
      throw new Error(`hoof_photos (Liste): ${hpErr.message}`)
    }

    const byHoof = new Map<string, { photo_type: string | null }[]>()
    for (const p of hoofPhotos ?? []) {
      const row = p as { hoof_record_id: string | null; photo_type: string | null }
      const hid = row.hoof_record_id
      if (!hid) continue
      const arr = byHoof.get(hid) ?? []
      arr.push({ photo_type: row.photo_type })
      byHoof.set(hid, arr)
    }

    for (const hid of allLegacyHoofIds) {
      const photos = byHoof.get(hid) ?? []
      hoofCountByLegacy.set(hid, countNonWholePhotos(photos))
    }
  }

  function resolvePhotoCount(m: MergedRow): number {
    const hoofN = hoofCountByLegacy.get(m.legacyHoofId) ?? 0
    if (!m.documentationRecordId) return hoofN
    const docN = docCountByLegacy.get(m.legacyHoofId) ?? 0
    if (docN > 0) return docN
    return hoofN
  }

  const recordRows: HorseRecordListRow[] = merged.map((m) => ({
    record: m.record,
    photoCount: resolvePhotoCount(m),
  }))

  const latest = merged[0]
  let wholeBodyPhotoSources: WholeBodyPhotoSource[] = []

  if (latest) {
    if (latest.documentationRecordId) {
      const { data: wb, error: wbErr } = await supabase
        .from('documentation_photos')
        .select('id, file_path, photo_type')
        .eq('user_id', userId)
        .eq('documentation_record_id', latest.documentationRecordId)
        .in('photo_type', ['whole_left', 'whole_right'])

      if (wbErr) {
        throw new Error(`documentation_photos (Ganzkörper): ${wbErr.message}`)
      }

      const docs = (wb ?? []) as WholeBodyPhotoSource[]
      if (docs.length > 0) {
        wholeBodyPhotoSources = docs
      } else {
        const { data: hoofWb, error: hpWbErr } = await supabase
          .from('hoof_photos')
          .select('id, file_path, photo_type')
          .eq('user_id', userId)
          .eq('hoof_record_id', latest.legacyHoofId)
          .in('photo_type', ['whole_left', 'whole_right'])

        if (hpWbErr) {
          throw new Error(`hoof_photos (Ganzkörper Fallback): ${hpWbErr.message}`)
        }
        wholeBodyPhotoSources = (hoofWb ?? []) as WholeBodyPhotoSource[]
      }
    } else {
      const { data: hoofWb, error: hpWbErr } = await supabase
        .from('hoof_photos')
        .select('id, file_path, photo_type')
        .eq('user_id', userId)
        .eq('hoof_record_id', latest.legacyHoofId)
        .in('photo_type', ['whole_left', 'whole_right'])

      if (hpWbErr) {
        throw new Error(`hoof_photos (Ganzkörper): ${hpWbErr.message}`)
      }
      wholeBodyPhotoSources = (hoofWb ?? []) as WholeBodyPhotoSource[]
    }
  }

  return {
    recordRows,
    wholeBodyPhotoSources,
    latestRecordId: latest?.legacyHoofId ?? null,
  }
}
