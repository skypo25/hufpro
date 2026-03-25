/**
 * Dokumentationsanzahl pro Pferd für Übersichten (Desktop / Mobile-API).
 * Primär documentation_records, hoof_records als Fallback – Merge: max(doc, hoof).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * @returns Map horseId → Anzahl (0 wenn keine Einträge)
 */
export async function countDocumentationByHorseIds(
  supabase: SupabaseClient,
  userId: string,
  horseIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (horseIds.length === 0) return out

  const { data: docRows, error: docErr } = await supabase
    .from('documentation_records')
    .select('animal_id')
    .eq('user_id', userId)
    .in('animal_id', horseIds)

  if (docErr) {
    throw new Error(`documentation_records (count): ${docErr.message}`)
  }

  const { data: hoofRows, error: hoofErr } = await supabase
    .from('hoof_records')
    .select('horse_id')
    .eq('user_id', userId)
    .in('horse_id', horseIds)

  if (hoofErr) {
    throw new Error(`hoof_records (count): ${hoofErr.message}`)
  }

  const docCount = new Map<string, number>()
  for (const row of docRows ?? []) {
    const aid = (row as { animal_id: string | null }).animal_id
    if (!aid) continue
    docCount.set(aid, (docCount.get(aid) || 0) + 1)
  }

  const hoofCount = new Map<string, number>()
  for (const row of hoofRows ?? []) {
    const hid = (row as { horse_id: string | null }).horse_id
    if (!hid) continue
    hoofCount.set(hid, (hoofCount.get(hid) || 0) + 1)
  }

  for (const id of horseIds) {
    out.set(id, Math.max(docCount.get(id) || 0, hoofCount.get(id) || 0))
  }

  return out
}
