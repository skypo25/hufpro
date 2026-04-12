import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { DirectoryProfileCreateWizard } from '@/components/directory/onboarding/DirectoryProfileCreateWizard'
import {
  fetchPublicAnimalTypes,
  fetchPublicMethods,
  fetchPublicSpecialties,
  fetchPublicSubcategories,
} from '@/lib/directory/public/data'
import { createSupabaseServerClient } from '@/lib/supabase-server'

import '@/components/directory/onboarding/profile-create-wizard.css'

/** Taxonomie immer zur Laufzeit laden (kein leeres Bundle vom Build ohne DB). */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Profil erstellen – anidocs',
  description: 'Tierbehandler-Profil in wenigen Schritten anlegen.',
}

function normalizePaket(raw: string | string[] | undefined): 'gratis' | 'premium' {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toLowerCase() ?? ''
  if (v === 'premium') return 'premium'
  return 'gratis'
}

export default async function DirectoryProfileCreatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const paketRaw = (Array.isArray(sp.paket) ? sp.paket[0] : sp.paket)?.toString().trim().toLowerCase() ?? ''
  if (paketRaw === 'app') {
    redirect('/behandler/app-starten')
  }

  const paket = normalizePaket(sp.paket)

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/behandler/profil/registrieren?paket=${paket}`)
  }

  const directoryOnboardingProduct = paket === 'premium' ? ('directory_premium' as const) : ('free' as const)

  const { data: ownedProfile } = user
    ? await supabase
        .from('directory_profiles')
        .select('id')
        .eq('claimed_by_user_id', user.id)
        .maybeSingle()
    : { data: null }

  const existingProfileId = (ownedProfile as { id?: string } | null)?.id ?? null

  const premiumSubRaw = (Array.isArray(sp.premium_sub) ? sp.premium_sub[0] : sp.premium_sub)?.toString().trim() ?? ''
  const wizardResumePremiumSub =
    premiumSubRaw === 'success' ? ('success' as const) : premiumSubRaw === 'canceled' ? ('canceled' as const) : null

  const [specialties, subcategories, methods, animals] = await Promise.all([
    fetchPublicSpecialties(),
    fetchPublicSubcategories(),
    fetchPublicMethods(),
    fetchPublicAnimalTypes(),
  ])

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[15px] text-[#6b7280]">Profil-Assistent wird geladen…</div>
      }
    >
      <DirectoryProfileCreateWizard
        specialties={specialties}
        subcategories={subcategories}
        methods={methods}
        animals={animals}
        directoryOnboardingProduct={directoryOnboardingProduct}
        successRedirectTo={null}
        publicPaket={paket}
        wizardResumeProfileId={existingProfileId}
        wizardResumePremiumSub={wizardResumePremiumSub}
      />
    </Suspense>
  )
}
