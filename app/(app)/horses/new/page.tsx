import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import HorseForm from '@/components/horses/HorseForm'
import { emptyHorseFormData } from '@/components/horses/horseFormDefaults'
import AnimalForm from '@/components/animals/AnimalForm'
import { deriveAppProfile, animalsNavLabel, newAnimalButtonLabel } from '@/lib/appProfile'

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

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, customer_number, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return (
      <main className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Fehler</h1>
          <p className="text-red-600">
            Kunden konnten nicht geladen werden: {error.message}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/animals" className="text-[#52b788] hover:underline">
          {animalsNavLabel(term)}
        </Link>
        <span>›</span>
        <span>{newAnimalButtonLabel(term)}</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          {newAnimalButtonLabel(term)}
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Pflichtfelder sind mit * gekennzeichnet
        </p>
      </div>

      {profile.requiresAnimalTypeChoice ? (
        <AnimalForm customers={customers || []} initialCustomerId={customerId || ''} />
      ) : (
        <HorseForm
          mode="create"
          customers={customers || []}
          initialData={{
            ...emptyHorseFormData,
            customerId: customerId || '',
          }}
        />
      )}
    </main>
  )
}