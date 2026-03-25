/**
 * Globale Suche: Dokumentationstreffer — documentation_records primär,
 * hoof_records ergänzend; Links nutzen hoof_records.id (legacy).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  dayFromSession,
  mergeSortTime,
  parseLegacyHoofRecordId,
} from '@/lib/documentation/recordListMergeHelpers'

/** Gleiche Struktur wie bisher in SearchPageContent / API (hoof_records-Join). */
export type SearchDocumentationHit = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
  doc_number: string | null
  horses?: {
    name: string | null
    customers?: { name: string | null } | { name: string | null }[] | null
  } | null
}

type DocSearchRow = {
  animal_id: string
  session_date: string
  summary_html: string | null
  recommendations_html: string | null
  internal_notes: string | null
  doc_number: string | null
  metadata: unknown
  created_at: string
  horses: SearchDocumentationHit['horses']
}

type HoofSearchRow = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
  /** Nur gesetzt, wenn die DB-Spalte hoof_records.doc_number existiert. */
  doc_number?: string | null
  created_at: string | null
  updated_at: string | null
  horses: SearchDocumentationHit['horses']
}

function pickPrimary(a: string | null, b: string | null): string | null {
  if (a != null && String(a).trim() !== '') return a
  return b ?? null
}

function mergeDocPrimary(doc: SearchDocumentationHit, hoof: SearchDocumentationHit): SearchDocumentationHit {
  return {
    id: doc.id,
    horse_id: doc.horse_id || hoof.horse_id,
    record_date: doc.record_date ?? hoof.record_date,
    hoof_condition: pickPrimary(doc.hoof_condition, hoof.hoof_condition),
    treatment: pickPrimary(doc.treatment, hoof.treatment),
    notes: pickPrimary(doc.notes, hoof.notes),
    doc_number: pickPrimary(doc.doc_number, hoof.doc_number),
    horses: doc.horses ?? hoof.horses ?? null,
  }
}

function mapDocRow(row: DocSearchRow, legacyId: string): SearchDocumentationHit {
  return {
    id: legacyId,
    horse_id: row.animal_id,
    record_date: dayFromSession(row.session_date),
    hoof_condition: row.summary_html,
    treatment: row.recommendations_html,
    notes: row.internal_notes,
    doc_number: row.doc_number,
    horses: row.horses ?? null,
  }
}

function mapHoofRow(row: HoofSearchRow): SearchDocumentationHit {
  return {
    id: row.id,
    horse_id: row.horse_id,
    record_date: row.record_date,
    hoof_condition: row.hoof_condition,
    treatment: row.treatment,
    notes: row.notes,
    doc_number: row.doc_number ?? null,
    horses: row.horses ?? null,
  }
}

/**
 * Bis zu 50 Treffer für „Dokumentationen“; Sortierung nach Datum/Zeit absteigend.
 */
export async function searchDocumentationHits(
  supabase: SupabaseClient,
  userId: string,
  searchQuery: string
): Promise<SearchDocumentationHit[]> {
  const q = searchQuery.trim()
  if (!q) return []

  const pattern = `%${q}%`

  const docSelect = `
    animal_id,
    session_date,
    summary_html,
    recommendations_html,
    internal_notes,
    doc_number,
    metadata,
    created_at,
    horses (
      name,
      customers ( name )
    )
  `

  const { data: docByText, error: docTextErr } = await supabase
    .from('documentation_records')
    .select(docSelect)
    .eq('user_id', userId)
    .eq('documentation_kind', 'hoof')
    .or(
      `summary_html.ilike.${pattern},recommendations_html.ilike.${pattern},internal_notes.ilike.${pattern},doc_number.ilike.${pattern}`
    )
    .order('session_date', { ascending: false })
    .limit(50)
    .returns<DocSearchRow[]>()

  if (docTextErr) {
    throw new Error(`documentation_records (Suche Text): ${docTextErr.message}`)
  }

  const { data: horsesByName, error: horseNameErr } = await supabase
    .from('horses')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', pattern)

  if (horseNameErr) {
    throw new Error(`horses (Suche Name): ${horseNameErr.message}`)
  }

  const horseIds = (horsesByName ?? []).map((r) => r.id)

  let docByHorse: DocSearchRow[] = []
  if (horseIds.length > 0) {
    const { data, error: docHorseErr } = await supabase
      .from('documentation_records')
      .select(docSelect)
      .eq('user_id', userId)
      .eq('documentation_kind', 'hoof')
      .in('animal_id', horseIds)
      .order('session_date', { ascending: false })
      .limit(50)
      .returns<DocSearchRow[]>()

    if (docHorseErr) {
      throw new Error(`documentation_records (Suche Pferd): ${docHorseErr.message}`)
    }
    docByHorse = data ?? []
  }

  // Kein hoof_records.doc_number: Spalte fehlt in älteren DBs; Nummer-Suche läuft über documentation_records.
  const hoofSelect = `
    id, horse_id, record_date, hoof_condition, treatment, notes,
    created_at, updated_at,
    horses (name, customers(name))
  `

  const { data: hoofByText, error: hoofTextErr } = await supabase
    .from('hoof_records')
    .select(hoofSelect)
    .eq('user_id', userId)
    .or(`hoof_condition.ilike.${pattern},treatment.ilike.${pattern},notes.ilike.${pattern}`)
    .order('record_date', { ascending: false })
    .limit(50)
    .returns<HoofSearchRow[]>()

  if (hoofTextErr) {
    throw new Error(`hoof_records (Suche Text): ${hoofTextErr.message}`)
  }

  let hoofByHorse: HoofSearchRow[] = []
  if (horseIds.length > 0) {
    const { data, error: hoofHorseErr } = await supabase
      .from('hoof_records')
      .select(hoofSelect)
      .eq('user_id', userId)
      .in('horse_id', horseIds)
      .order('record_date', { ascending: false })
      .limit(50)
      .returns<HoofSearchRow[]>()

    if (hoofHorseErr) {
      throw new Error(`hoof_records (Suche Pferd): ${hoofHorseErr.message}`)
    }
    hoofByHorse = data ?? []
  }

  type Entry = { hit: SearchDocumentationHit; sortTime: number; fromDoc: boolean }
  const byId = new Map<string, Entry>()

  for (const row of [...(docByText ?? []), ...docByHorse]) {
    const leg = parseLegacyHoofRecordId(row.metadata)
    if (!leg) continue
    const hit = mapDocRow(row, leg)
    const st = mergeSortTime(hit.record_date, row.created_at)
    const prev = byId.get(leg)
    if (!prev || st > prev.sortTime) {
      byId.set(leg, { hit, sortTime: st, fromDoc: true })
    }
  }

  for (const row of [...(hoofByText ?? []), ...hoofByHorse]) {
    const hHit = mapHoofRow(row)
    const st = mergeSortTime(hHit.record_date, row.created_at ?? row.updated_at)
    const cur = byId.get(row.id)
    if (!cur) {
      byId.set(row.id, { hit: hHit, sortTime: st, fromDoc: false })
    } else if (cur.fromDoc) {
      cur.hit = mergeDocPrimary(cur.hit, hHit)
      cur.sortTime = Math.max(cur.sortTime, st)
    } else if (st > cur.sortTime) {
      cur.hit = hHit
      cur.sortTime = st
    }
  }

  const sorted = [...byId.values()]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 50)
    .map((x) => x.hit)

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.info('[search documentation hits]', {
      query: q,
      docText: (docByText ?? []).length,
      docHorse: docByHorse.length,
      hoofText: (hoofByText ?? []).length,
      hoofHorse: hoofByHorse.length,
      merged: sorted.length,
    })
  }

  return sorted
}
