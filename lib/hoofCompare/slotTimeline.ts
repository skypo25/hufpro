/**
 * Chronologische Fotos pro Pferd und Slot (documentation_records + documentation_photos).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { dayFromSession, parseLegacyHoofRecordId } from '@/lib/documentation/recordListMergeHelpers'
import { toCanonicalPhotoSlot, type PhotoSlotKey } from '@/lib/photos/photoTypes'

export type SlotTimelineEntry = {
  legacyRecordId: string
  recordDate: string | null
  docNumber: string | null
  filePath: string
  photoId: string
  recordTypeLabel: string | null
}

function recordTypeFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const v = (metadata as { legacy_record_type?: unknown }).legacy_record_type
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Alle Dokumentationen mit einem Foto im gewählten Slot, chronologisch aufsteigend. */
export async function loadSlotTimelineForHorse(
  supabase: SupabaseClient,
  userId: string,
  horseId: string,
  slotKey: PhotoSlotKey
): Promise<SlotTimelineEntry[]> {
  const { data: docs, error } = await supabase
    .from('documentation_records')
    .select('id, session_date, doc_number, metadata')
    .eq('animal_id', horseId)
    .eq('user_id', userId)
    .eq('documentation_kind', 'hoof')

  if (error) throw new Error(`documentation_records (timeline): ${error.message}`)

  const docIds = (docs ?? []).map((d) => d.id as string)
  if (docIds.length === 0) return []

  const { data: photos, error: pErr } = await supabase
    .from('documentation_photos')
    .select('id, documentation_record_id, file_path, photo_type')
    .eq('user_id', userId)
    .in('documentation_record_id', docIds)

  if (pErr) throw new Error(`documentation_photos (timeline): ${pErr.message}`)

  const legacyByDoc = new Map<string, string>()
  for (const d of docs ?? []) {
    const row = d as { id: string; metadata?: unknown }
    const leg = parseLegacyHoofRecordId(row.metadata)
    if (leg) legacyByDoc.set(row.id, leg)
  }

  const docById = new Map((docs ?? []).map((d) => [d.id as string, d as { session_date?: string; doc_number?: string | null; metadata?: unknown }]))

  const byLegacy = new Map<string, SlotTimelineEntry>()

  for (const p of photos ?? []) {
    const row = p as {
      id: string
      documentation_record_id: string
      file_path: string | null
      photo_type: string | null
    }
    const canon = toCanonicalPhotoSlot(row.photo_type)
    if (canon !== slotKey || !row.file_path) continue
    const leg = legacyByDoc.get(row.documentation_record_id)
    if (!leg) continue
    const doc = docById.get(row.documentation_record_id)
    const next: SlotTimelineEntry = {
      legacyRecordId: leg,
      recordDate: doc ? dayFromSession(doc.session_date) : null,
      docNumber: doc?.doc_number ?? null,
      filePath: row.file_path,
      photoId: row.id,
      recordTypeLabel: doc ? recordTypeFromMetadata(doc.metadata) : null,
    }
    const prev = byLegacy.get(leg)
    if (!prev) {
      byLegacy.set(leg, next)
    } else {
      const prevT = prev.recordDate ? Date.parse(prev.recordDate) : 0
      const nextT = next.recordDate ? Date.parse(next.recordDate) : 0
      if (nextT >= prevT) byLegacy.set(leg, next)
    }
  }

  const entries = [...byLegacy.values()]
  entries.sort((a, b) => {
    const ta = a.recordDate ? Date.parse(a.recordDate) : 0
    const tb = b.recordDate ? Date.parse(b.recordDate) : 0
    return ta - tb
  })
  return entries
}
