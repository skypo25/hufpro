'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { submitDirectoryProfileWizard, upsertOwnedDirectoryProfileFromWizard } from '@/lib/directory/onboarding/submitWizardProfile'

/**
 * Nicht eingeloggt: anonymes Profil (Entwurf, unclaimed) — für Import/Tests o. ä.
 * Eingeloggt: Profil gehört dem Nutzer (claimed + claimed_by_user_id), wie unter /directory/mein-profil.
 */
export async function submitDirectoryProfileWizardAction(payload: unknown) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    return upsertOwnedDirectoryProfileFromWizard({ userId: user.id, raw: payload })
  }
  return submitDirectoryProfileWizard(payload)
}
