/**
 * Record-Liste „Dokumentationen“ auf der Kundenansicht: primär documentation_*,
 * Anzeigefelder wie Record-Detail (summary_html → Hufzustand, …); URLs bleiben hoof_records.id.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  dayFromSession,
  mergeSortTime,
  parseLegacyHoofRecordId,
} from '@/lib/documentation/recordListMergeHelpers'

export type CustomerRecordListRow = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
}

type DocRow = {
  id: string
  animal_id: string
  session_date: string
  summary_html: string | null
  recommendations_html: string | null
  internal_notes: string | null
  metadata: unknown
  created_at: string
  updated_at: string
}

type HoofRow = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Alle Hufdokumentationen der Pferde eines Kunden, sortiert nach Datum (neu zuerst).
 * Nur hoof_records-Zeilen erscheinen (Links); documentation_records überlagert Texte/Datum.
 */
export async function loadRecordListForCustomerView(
  supabase: SupabaseClient,
  userId: string,
  horseIds: string[]
): Promise<CustomerRecordListRow[]> {
  if (horseIds.length === 0) return []

  const { data: hoofRows, error: hoofErr } = await supabase
    .from('hoof_records')
    .select('id, horse_id, record_date, hoof_condition, treatment, notes, created_at, updated_at')
    .eq('user_id', userId)
    .in('horse_id', horseIds)
    .returns<HoofRow[]>()

  if (hoofErr) {
    throw new Error(`hoof_records (Kundenliste): ${hoofErr.message}`)
  }

  const { data: docRows, error: docErr } = await supabase
    .from('documentation_records')
    .select(
      'id, animal_id, session_date, summary_html, recommendations_html, internal_notes, metadata, created_at, updated_at'
    )
    .eq('user_id', userId)
    .in('animal_id', horseIds)
    .returns<DocRow[]>()

  if (docErr) {
    throw new Error(`documentation_records (Kundenliste): ${docErr.message}`)
  }

  const legacyToDoc = new Map<string, DocRow>()
  for (const row of docRows ?? []) {
    const leg = parseLegacyHoofRecordId(row.metadata)
    if (!leg) continue
    if (!legacyToDoc.has(leg)) legacyToDoc.set(leg, row)
  }

  const merged: { row: CustomerRecordListRow; sortTime: number }[] = []

  for (const hoof of hoofRows ?? []) {
    const doc = legacyToDoc.get(hoof.id)
    const recordDate = doc
      ? dayFromSession(doc.session_date) ?? hoof.record_date
      : hoof.record_date
    const createdAt = doc ? doc.created_at : hoof.created_at
    const hoof_condition = doc ? (doc.summary_html ?? hoof.hoof_condition) : hoof.hoof_condition
    const treatment = doc
      ? (doc.recommendations_html ?? hoof.treatment)
      : hoof.treatment
    const notes = doc ? (doc.internal_notes ?? hoof.notes) : hoof.notes

    merged.push({
      row: {
        id: hoof.id,
        horse_id: hoof.horse_id,
        record_date: recordDate,
        hoof_condition,
        treatment,
        notes,
      },
      sortTime: mergeSortTime(recordDate, createdAt ?? null),
    })
  }

  merged.sort((a, b) => b.sortTime - a.sortTime)

  if (process.env.NODE_ENV === 'development') {
    const docBacked = merged.filter((m) => legacyToDoc.has(m.row.id)).length
    // eslint-disable-next-line no-console
    console.info('[customer-record-list]', {
      horseIdsCount: horseIds.length,
      rows: merged.length,
      docBacked,
      hoofOnlyFallback: merged.length - docBacked,
    })
  }

  return merged.map((m) => m.row)
}
