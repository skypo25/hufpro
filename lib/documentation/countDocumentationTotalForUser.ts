/**
 * Gesamtanzahl Dokumentationen pro Nutzer (Dashboard-Kennzahl).
 * Primär documentation_records, hoof_records als Fallback – Ergebnis: max(doc, hoof).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function countDocumentationTotalForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const [{ count: docCount, error: docErr }, { count: hoofCount, error: hoofErr }] =
    await Promise.all([
      supabase
        .from('documentation_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('hoof_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

  if (docErr) {
    throw new Error(`documentation_records (Gesamtanzahl): ${docErr.message}`)
  }
  if (hoofErr) {
    throw new Error(`hoof_records (Gesamtanzahl): ${hoofErr.message}`)
  }

  return Math.max(docCount ?? 0, hoofCount ?? 0)
}
