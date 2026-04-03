import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { resolveDataExportRetentionDays } from '@/lib/systemSettings.server'

const BATCH = 40

type Row = { id: string; storage_bucket: string; storage_object_path: string }

/**
 * Entfernt abgeschlossene Export-ZIPs aus dem Storage und löscht die zugehörigen Job-Zeilen.
 * Läuft mit Service Role (Cron).
 */
export async function cleanupExpiredDataExports(): Promise<{
  retentionDays: number
  cutoffIso: string
  removed: number
  errors: string[]
}> {
  const retentionDays = await resolveDataExportRetentionDays()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const admin = createSupabaseServiceRoleClient()
  const errors: string[] = []
  let removed = 0

  while (true) {
    const { data: rows, error: qErr } = await admin
      .from('data_export_jobs')
      .select('id, storage_bucket, storage_object_path')
      .eq('status', 'complete')
      .not('storage_object_path', 'is', null)
      .not('storage_bucket', 'is', null)
      .lt('completed_at', cutoff)
      .limit(BATCH)

    if (qErr) {
      errors.push(`query: ${qErr.message}`)
      break
    }
    const list = (rows ?? []) as Row[]
    if (list.length === 0) break

    for (const row of list) {
      const bucket = row.storage_bucket?.trim()
      const path = row.storage_object_path?.trim()
      if (!bucket || !path) {
        const { error: delOnly } = await admin.from('data_export_jobs').delete().eq('id', row.id)
        if (delOnly) errors.push(`${row.id} (nur DB): ${delOnly.message}`)
        else removed += 1
        continue
      }

      const { error: rmErr } = await admin.storage.from(bucket).remove([path])
      if (rmErr) {
        errors.push(`storage ${row.id}: ${rmErr.message}`)
        continue
      }

      const { error: delErr } = await admin.from('data_export_jobs').delete().eq('id', row.id)
      if (delErr) {
        errors.push(`db ${row.id}: ${delErr.message}`)
        continue
      }
      removed += 1
    }

    if (list.length < BATCH) break
  }

  return { retentionDays, cutoffIso: cutoff, removed, errors }
}
