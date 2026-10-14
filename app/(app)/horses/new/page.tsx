import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import HorseForm from '@/components/horses/HorseForm'
import { emptyHorseFormData } from '@/components/horses/horseFormDefaults'
import AnimalForm from '@/components/animals/AnimalForm'
import { deriveAppProfile, newAnimalButtonLabel } from '@/lib/appProfile'
import AppPage from '@/components/layout/AppPage'
import { getEnabledDocumentationModulesCached } from '@/lib/modules/entitlements.server'
import {
  allowedAnimalTypesForEnabledModules,
  filterAnimalTypesByFocus,
} from '@/lib/modules/animalCreatePolicy'
import type { AnimalType } from '@/components/animals/AnimalForm'

type NewHorsePageProps = {
  searchParams: Promise<{
    customerId?: string
  }>
}

export default async function NewHorsePage({ searchParams }: NewHorsePageProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { customerId } = await searchParams

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  const term = profile.terminology
  const { enabled } = await getEnabledDocumentationModulesCached(user.id)
  const allowedTypes = filterAnimalTypesByFocus(
    allowedAnimalTypesForEnabledModules(enabled),
    typeof settings?.animal_focus === 'string' ? settings.animal_focus : profile.animalFocus
  ) as AnimalType[]
  const onlyHorse = allowedTypes.length === 1 && allowedTypes[0] === 'horse'
  const needsTypeChoice = allowedTypes.length > 1

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, customer_number, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return (
      <AppPage>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Fehler</h1>
          <p className="text-red-600">
            Kunden konnten nicht geladen werden: {error.message}
          </p>
        </div>
      </AppPage>
    )
  }

  return (
    <AppPage>
      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          {newAnimalButtonLabel(term)}
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Pflichtfelder sind mit * gekennzeichnet
        </p>
      </div>

      {needsTypeChoice ? (
        <AnimalForm
          customers={customers || []}
          initialCustomerId={customerId || ''}
          allowedAnimalTypes={allowedTypes}
        />
      ) : onlyHorse || allowedTypes.includes('horse') ? (
        <HorseForm
          mode="create"
          customers={customers || []}
          initialData={{
            ...emptyHorseFormData,
            customerId: customerId || '',
          }}
        />
      ) : (
        <AnimalForm
          customers={customers || []}
          initialCustomerId={customerId || ''}
          allowedAnimalTypes={allowedTypes.length > 0 ? allowedTypes : ['dog', 'cat', 'small', 'other']}
        />
      )}
    </AppPage>
  )
}