'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { upsertOwnedDirectoryProfileFromWizard } from '@/lib/directory/onboarding/submitWizardProfile'

export async function submitDirectoryProfileWizardForOwnerAction(payload: unknown) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, error: 'Nicht eingeloggt.' }
  }
  return upsertOwnedDirectoryProfileFromWizard({ userId: user.id, raw: payload })
}

