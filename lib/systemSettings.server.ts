import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import {
  coerceDataExportRetentionDays,
  DEFAULT_DATA_EXPORT_RETENTION_DAYS,
  getDataExportRetentionDaysFromEnv,
} from '@/lib/export/dataExportRetention'

/**
 * Aufbewahrung fertiger Export-ZIPs: Admin `system_settings`, sonst Env, sonst Standard.
 */
export async function resolveDataExportRetentionDays(): Promise<number> {
  try {
    const db = createSupabaseServiceRoleClient()
    const { data, error } = await db
      .from('system_settings')
      .select('data_export_retention_days')
      .eq('id', 1)
      .maybeSingle()

    if (error || data == null) {
      return getDataExportRetentionDaysFromEnv()
    }

    const n = Number((data as { data_export_retention_days?: unknown }).data_export_retention_days)
    if (!Number.isFinite(n)) return DEFAULT_DATA_EXPORT_RETENTION_DAYS
    return coerceDataExportRetentionDays(n)
  } catch {
    return getDataExportRetentionDaysFromEnv()
  }
}

export type SystemSettingsRow = {
  id: number
  data_export_retention_days: number
  updated_at: string | null
  updated_by: string | null
}

export async function fetchSystemSettingsRow(): Promise<SystemSettingsRow | null> {
  const db = createSupabaseServiceRoleClient()
  const { data, error } = await db.from('system_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return data as SystemSettingsRow
}
