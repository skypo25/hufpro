import 'server-only'

import { cache } from 'react'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import {
  isFeatureEnabled,
  type AdminFeatureFlagKey,
  type UserFeatureFlags,
} from '@/lib/admin/featureFlagsShared'

export type { AdminFeatureFlagKey, UserFeatureFlags }
export { ADMIN_FEATURE_FLAG_KEYS, isFeatureEnabled } from '@/lib/admin/featureFlagsShared'

export const getUserFeatureFlagsCached = cache(async (userId: string): Promise<UserFeatureFlags> => {
  const db = createSupabaseServiceRoleClient()
  const { data } = await db
    .from('admin_user_meta')
    .select('feature_flags')
    .eq('user_id', userId)
    .maybeSingle()
  return ((data?.feature_flags ?? {}) as UserFeatureFlags) || {}
})

export async function userHasFeature(
  userId: string,
  key: AdminFeatureFlagKey
): Promise<boolean> {
  const flags = await getUserFeatureFlagsCached(userId)
  return isFeatureEnabled(flags, key)
}
