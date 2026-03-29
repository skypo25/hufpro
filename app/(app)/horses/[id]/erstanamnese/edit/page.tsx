import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
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
    <main className="mx-auto w-full max-w-[1280px] space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/animals" className="text-[#52b788] hover:underline">
          {animalsNavLabel(term)}
        </Link>
        <span>›</span>
        <Link href={`/animals/${horse.id}`} className="text-[#52b788] hover:underline">
          {horse.name || singular}
        </Link>
        <span>›</span>
        <Link href={viewHref} className="text-[#52b788] hover:underline">
          Erstanamnese
        </Link>
        <span>›</span>
        <span className="text-[#6B7280]">Bearbeiten</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Erstanamnese bearbeiten
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          {horse.name || singular}
        </p>
      </div>

      <ErstanamneseEditForm horseId={horse.id} initialClinical={clinical} backHref={viewHref} />
    </main>
  )
}
