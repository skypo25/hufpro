'use server'

import { redirect } from 'next/navigation'

import type { DirectoryClaimFormState } from '@/lib/directory/claims/formState'
import { fetchPublicProfileBySlug } from '@/lib/directory/public/data'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function submitDirectoryClaim(
  _prev: DirectoryClaimFormState,
  formData: FormData
): Promise<DirectoryClaimFormState> {
  const slug = String(formData.get('slug') ?? '').trim()
  if (!slug) {
    return { ok: false, error: 'Ungültiger Aufruf.' }
  }

  const displayName = String(formData.get('display_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const proofUrlRaw = String(formData.get('proof_url') ?? '').trim()
  const proofUrl = proofUrlRaw === '' ? null : proofUrlRaw

  if (!displayName || !email || !message) {
    return { ok: false, error: 'Bitte Name, E-Mail und Nachricht ausfüllen.' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Bitte melde dich an, um ein Profil zu beanspruchen.' }
  }

  const profile = await fetchPublicProfileBySlug(slug)
  if (!profile) {
    return { ok: false, error: 'Profil nicht gefunden.' }
  }

  const { error } = await supabase.from('directory_claims').insert({
    directory_profile_id: profile.id,
    claimant_user_id: user.id,
    status: 'pending',
    claimant_display_name: displayName,
    claimant_email: email,
    message,
    proof_url: proofUrl,
  })

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'Für dieses Profil liegt bereits ein offener Antrag vor. Bitte warte auf die Bearbeitung.',
      }
    }
    const raw = error.message ?? ''
    if (raw.includes('claimant_display_name') || raw.includes('schema cache')) {
      return {
        ok: false,
        error:
          'Datenbank-Schema veraltet: Migration „directory_claims“-Antragsfelder fehlt. Bitte Supabase-Migration `20260407140000_directory_claims_application_fields.sql` ausführen (lokal: `supabase db push`, Remote: SQL Editor oder Dashboard-Migrations).',
      }
    }
    if (raw.includes('row-level security') && raw.includes('directory_claims')) {
      return {
        ok: false,
        error:
          'Speichern durch RLS blockiert. Bitte Migration `20260407150000_directory_claim_insert_rls_helper.sql` ausführen (Claim-INSERT nutzt die Hilfsfunktion `directory_profile_is_claimable`).',
      }
    }
    return { ok: false, error: `Speichern fehlgeschlagen: ${error.message}` }
  }

  redirect(`/behandler/${slug}/claim?submitted=1`)
}
