import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/** Aktives Top-/Premium-Entitlement (App-Abo, Directory-Produkt oder manuell). */
export async function directoryProfileHasActiveTop(
  admin: SupabaseClient,
  directoryProfileId: string
): Promise<boolean> {
  const { count, error } = await admin
    .from('directory_profile_top_entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('directory_profile_id', directoryProfileId)
    .or('active_until.is.null,active_until.gt.now()')

  if (error) return false
  return (count ?? 0) > 0
}
