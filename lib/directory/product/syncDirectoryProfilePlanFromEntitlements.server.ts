import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Setzt directory_plan / directory_premium_source aus aktiven Top-Entitlements.
 * Priorität Quelle: app > paid (directory_subscription/manuell) > none.
 */
export async function syncDirectoryProfilePlanFromEntitlements(
  admin: SupabaseClient,
  directoryProfileId: string
): Promise<void> {
  const { data: rows, error } = await admin
    .from('directory_profile_top_entitlements')
    .select('source')
    .eq('directory_profile_id', directoryProfileId)
    .or('active_until.is.null,active_until.gt.now()')

  if (error) {
    console.warn('[directory-plan-sync]', directoryProfileId, error.message)
    return
  }

  const sources = new Set((rows ?? []).map((r) => (r as { source: string }).source))
  let directory_premium_source: 'none' | 'paid' | 'app' = 'none'
  if (sources.has('app_subscription')) {
    directory_premium_source = 'app'
  } else if (sources.has('directory_subscription') || sources.has('manual')) {
    directory_premium_source = 'paid'
  }

  const directory_plan = directory_premium_source === 'none' ? 'free' : 'premium'

  await admin
    .from('directory_profiles')
    .update({
      directory_plan,
      directory_premium_source,
      updated_at: new Date().toISOString(),
    })
    .eq('id', directoryProfileId)
}
