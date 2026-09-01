import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AppPage from '@/components/layout/AppPage'
import {
  animalsNavLabel,
  animalSingularLabel,
  deriveAppProfile,
} from '@/lib/appProfile'
import { legacyFlatFromHorseIntake, resolveClinicalForForm } from '@/lib/animals/clinicalIntakeTypes'
import ErstanamneseEditForm from '@/components/animals/ErstanamneseEditForm'

type Props = { params: Promise<{ id: string }> }

export default async function ErstanamneseEditPage({ params }: Props) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  if (profile.isHufbearbeiter) {
    redirect(`/animals/${id}`)
  }

  const term = profile.terminology
  const singular = animalSingularLabel(term)

  const { data: horse, error } = await supabase
    .from('horses')
    .select('id, name, intake, special_notes')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !horse) notFound()

  const clinical = resolveClinicalForForm(horse.intake, legacyFlatFromHorseIntake(horse))
  const viewHref = `/animals/${horse.id}/erstanamnese`

  return (
    <AppPage>
      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Erstanamnese bearbeiten
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          {horse.name || singular}
        </p>
      </div>

      <ErstanamneseEditForm horseId={horse.id} initialClinical={clinical} backHref={viewHref} />
    </AppPage>
  )
}
