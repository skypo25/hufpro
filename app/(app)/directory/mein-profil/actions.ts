'use server'

import { revalidatePath } from 'next/cache'
import { upsertOwnedDirectoryProfileFromWizard } from '@/lib/directory/onboarding/submitWizardProfile'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function submitDirectoryProfileWizardForOwnerAction(payload: unknown) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, error: 'Nicht eingeloggt.' }
  }
  const result = await upsertOwnedDirectoryProfileFromWizard({ userId: user.id, raw: payload })
  if (result.ok && result.slug) {
    revalidatePath(`/behandler/${result.slug}`)
    revalidatePath('/behandler')
  }
  return result
}

