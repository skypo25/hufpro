import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { userHasFeature, type AdminFeatureFlagKey } from '@/lib/admin/featureFlags'
import { isAdminUserId } from '@/lib/admin/config'

/** Server-Seiten: Feature-Flag prüfen (Admins immer durch). */
export async function requireUserFeature(key: AdminFeatureFlagKey, fallbackHref = '/dashboard') {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (isAdminUserId(user.id)) return user
  const ok = await userHasFeature(user.id, key)
  if (!ok) redirect(`${fallbackHref}?feature=${encodeURIComponent(key)}`)
  return user
}
