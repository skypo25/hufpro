import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  animalsNavLabel,
  animalSingularLabel,
  deriveAppProfile,
} from '@/lib/appProfile'
import { formatAnimalTypeLabel } from '@/lib/animalTypeDisplay'
import {
  clinicalFirstContextHasContent,
  clinicalIntakeTimestampsFromIntake,
  erstanamneseDateLeadForMeta,
  legacyFlatFromHorseIntake,
  resolveClinicalForForm,
} from '@/lib/animals/clinicalIntakeTypes'
import { ErstanamneseReadOnly } from '@/components/animals/ErstanamneseReadOnly'

type Props = { params: Promise<{ id: string }> }

export default async function ErstanamnesePage({ params }: Props) {
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
  const backToAkteLabel = term === 'pferd' ? 'Zurück zur Pferdeakte' : 'Zurück zur Tierakte'
  const nameFallback = singular

  const { data: horse, error } = await supabase
    .from('horses')
    .select('id, name, animal_type, intake, special_notes')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !horse) notFound()

  const clinical = resolveClinicalForForm(horse.intake, legacyFlatFromHorseIntake(horse))
  const hasContent = clinicalFirstContextHasContent(clinical)
  const { createdAt, updatedAt } = clinicalIntakeTimestampsFromIntake(horse.intake)
  const dateLead = erstanamneseDateLeadForMeta(hasContent, createdAt, updatedAt)
  const backHref = `/animals/${horse.id}`
  const editHref = `/animals/${horse.id}/erstanamnese/edit`

  const metaLine = [
    dateLead,
    horse.name?.trim() || nameFallback,
    formatAnimalTypeLabel(horse.animal_type),
  ]
    .filter(Boolean)
    .join(' · ')

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
        <Link href={backHref} className="text-[#52b788] hover:underline">
          {horse.name || singular}
        </Link>
        <span>›</span>
        <span className="text-[#6B7280]">Erstanamnese</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
            Erstanamnese
          </h1>
          {metaLine ? (
            <p className="mt-1 text-[14px] text-[#6B7280]">{metaLine}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-[18px] py-[10px] text-[13px] font-medium text-[#1B1F23] shadow-sm hover:border-[#9CA3AF]"
          >
            <i className="bi bi-arrow-left text-[15px]" aria-hidden />
            {backToAkteLabel}
          </Link>
          <Link
            href={editHref}
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-[18px] py-[10px] text-[13px] font-medium text-white shadow-sm hover:bg-[#0f301b]"
          >
            <i className="bi bi-pencil-square text-[15px]" aria-hidden />
            Erstanamnese bearbeiten
          </Link>
        </div>
      </div>

      {hasContent ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-3.5">
          <i className="bi bi-check-circle-fill text-[16px] text-[#16A34A]" aria-hidden />
          <span className="text-[13px] font-medium text-[#166534]">Erstanamnese erfasst</span>
        </div>
      ) : null}

      {!hasContent && (
        <div className="rounded-xl border border-[#E5E2DC] bg-[#fafaf9] px-5 py-4 text-[14px] text-[#6B7280]">
          Noch keine Erstanamnese erfasst. Über <strong className="text-[#1B1F23]">Erstanamnese bearbeiten</strong>{' '}
          oder beim Anlegen des Tieres kannst du die fachlichen Angaben eintragen.
        </div>
      )}

      <ErstanamneseReadOnly clinical={clinical} />
    </main>
  )
}
