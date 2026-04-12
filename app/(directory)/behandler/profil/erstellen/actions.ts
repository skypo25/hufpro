'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { upsertOwnedDirectoryProfileFromWizard } from '@/lib/directory/onboarding/submitWizardProfile'

/**
 * Verzeichnis-Self-Service: nur mit AniDocs-Konto (Profil ist immer claimed).
 * Unclaimed/anonyme Anlage bleibt nur für Import/Server-Skripte (submitDirectoryProfileWizard direkt).
 */
export async function submitDirectoryProfileWizardAction(payload: unknown) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, error: 'Bitte melde dich an, um ein Profil anzulegen.' }
  }
  return upsertOwnedDirectoryProfileFromWizard({ userId: user.id, raw: payload })
}
