import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  ADMIN_FEATURE_FLAG_KEYS,
  getUserFeatureFlagsCached,
  isFeatureEnabled,
  type AdminFeatureFlagKey,
} from '@/lib/admin/featureFlags'

/** Client-lesbare Feature-Flags des eingeloggten Nutzers (Service-Role Meta). */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const flags = await getUserFeatureFlagsCached(user.id)
  const enabled: Record<AdminFeatureFlagKey, boolean> = {
    ai_assistant: isFeatureEnabled(flags, 'ai_assistant'),
    photo_compare: isFeatureEnabled(flags, 'photo_compare'),
    invoices: isFeatureEnabled(flags, 'invoices'),
    beta: isFeatureEnabled(flags, 'beta'),
  }

  return NextResponse.json({
    flags,
    enabled,
    keys: ADMIN_FEATURE_FLAG_KEYS,
  })
}
