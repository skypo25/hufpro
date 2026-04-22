import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import HorseForm from '@/components/horses/HorseForm'
import { deriveAppProfile, animalsNavLabel, animalSingularLabel } from '@/lib/appProfile'
import AnimalForm, { type AnimalFormInitialData, type AnimalType } from '@/components/animals/AnimalForm'
import { profilePhotoPathFromIntake, resolveClinicalForForm } from '@/lib/animals/clinicalIntakeTypes'
import { deleteHorseAndRedirect } from '../actions'

type EditHorsePageProps = {
  params: Promise<{
    id: string
  }>
}

type HorseRow = {
  id: string
  customer_id: string | null
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  birth_date: string | null
  usage: string | null
  housing: string | null
  hoof_status: string | null
  care_interval: string | null
  special_notes: string | null
  notes: string | null
  stable_name?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  stable_country?: string | null
  stable_contact?: string | null
  stable_phone?: string | null
  stable_directions?: string | null
  stable_drive_time?: string | null
  animal_type?: string | null
  neutered?: string | null
  weight_kg?: number | null
  coat_color?: string | null
  chip_id?: string | null
  intake?: any
}

export default async function EditHorsePage({
  params,
}: EditHorsePageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  const term = profile.terminology
  const singularLabel = animalSingularLabel(term)

  const { data: horse, error: horseError } = await supabase
    .from('horses')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single<HorseRow>()

  if (horseError || !horse) {
    return (
      <main className="mx-auto max-w-[920px] space-y-7">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {singularLabel} konnte nicht geladen werden.
        </div>
      </main>
    )
  }

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, customer_number, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (customersError) {
    return (
      <main className="mx-auto max-w-[920px] space-y-7">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kunden konnten nicht geladen werden: {customersError.message}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[920px] space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/animals" className="text-[var(--accent)] hover:underline">
          {animalsNavLabel(term)}
        </Link>
        <span>›</span>
        <Link href={`/animals/${horse.id}`} className="text-[var(--accent)] hover:underline">
          {horse.name || singularLabel}
        </Link>
        <span>›</span>
        <span>{singularLabel} bearbeiten</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          {singularLabel} bearbeiten
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Änderungen werden direkt auf den bestehenden Datensatz gespeichert
        </p>
      </div>

      {profile.requiresAnimalTypeChoice ? (
        <AnimalForm
          mode="edit"
          customers={customers || []}
          initialData={{
            id: horse.id,
            customerId: horse.customer_id || '',
            animalType: ((horse.animal_type || 'dog') as AnimalType) ?? 'dog',
            name: horse.name || '',
            breed: horse.breed || '',
            sex: horse.sex || '',
            birthYear: horse.birth_year ? String(horse.birth_year) : '',
            weightKg: horse.weight_kg != null ? String(horse.weight_kg).replace('.', ',') : '',
            coatColor: horse.coat_color || '',
            chipId: horse.chip_id || '',
            internalNotes: horse.notes || String(horse.intake?.internalNotes ?? ''),
            neutered:
              horse.neutered === 'yes' || horse.neutered === 'no' || horse.neutered === 'unknown'
                ? (horse.neutered as 'unknown' | 'yes' | 'no')
                : (horse.intake?.neutered as 'unknown' | 'yes' | 'no') || 'unknown',
            stableName: horse.stable_name || '',
            stableStreet: horse.stable_street || '',
            stableZip: horse.stable_zip || '',
            stableCity: horse.stable_city || '',
            stableCountry: horse.stable_country || 'Deutschland',
            stableContact: horse.stable_contact || '',
            stablePhone: horse.stable_phone || '',
            stableDirections: horse.stable_directions || '',
            stableDriveTime: horse.stable_drive_time ?? null,
            rawIntake: horse.intake,
            clinicalFirstContext: resolveClinicalForForm(horse.intake, {
              diagnoses: String(horse.intake?.health?.diagnoses ?? ''),
              meds: String(horse.intake?.health?.medication ?? ''),
              allergies: String(horse.intake?.health?.allergies ?? ''),
              reason: Array.isArray(horse.intake?.health?.reason) ? horse.intake.health.reason : [],
              vetName: String(horse.intake?.health?.vetName ?? ''),
              vetPhone: String(horse.intake?.health?.vetPhone ?? ''),
              vaccination: String(horse.intake?.health?.vaccination ?? ''),
              housing: String(horse.intake?.husbandry?.housing ?? ''),
              feeding: String(horse.intake?.husbandry?.feeding ?? ''),
              activity: String(horse.intake?.husbandry?.activity ?? ''),
              supplements: String(horse.intake?.husbandry?.supplements ?? ''),
              behavior: String(horse.intake?.behavior?.treatmentBehavior ?? ''),
              compatibility: String(horse.intake?.behavior?.compatibility ?? ''),
              specialNotes: horse.special_notes || String(horse.intake?.behavior?.notes ?? ''),
            }),
            profilePhotoPath: profilePhotoPathFromIntake(horse.intake),
          } satisfies AnimalFormInitialData}
          deleteAction={deleteHorseAndRedirect.bind(null, horse.id)}
        />
      ) : (
        <HorseForm
          mode="edit"
          customers={customers || []}
          deleteAction={deleteHorseAndRedirect.bind(null, horse.id)}
          initialData={{
            id: horse.id,
            customerId: horse.customer_id || '',
            name: horse.name || '',
            breed: horse.breed || '',
            sex: horse.sex || '',
            birthYear: horse.birth_year ? String(horse.birth_year) : '',
            birthDate: horse.birth_date || '',
            usage: horse.usage || '',
            housing: horse.housing || '',
            hoofStatus: horse.hoof_status || '',
            careInterval: horse.care_interval || '',
            specialNotes: horse.special_notes || '',
            notes: horse.notes || '',
            stableName: horse.stable_name || '',
            stableStreet: horse.stable_street || '',
            stableZip: horse.stable_zip || '',
            stableCity: horse.stable_city || '',
            stableCountry: horse.stable_country || 'Deutschland',
            stableContact: horse.stable_contact || '',
            stablePhone: horse.stable_phone || '',
            stableDirections: horse.stable_directions || '',
            stableDriveTime: horse.stable_drive_time ?? null,
          }}
        />
      )}
    </main>
  )
}