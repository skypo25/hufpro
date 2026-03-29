import { redirect } from 'next/navigation'
import RecordCreateForm from '@/components/records/RecordCreateForm'
import TherapyRecordForm from '@/components/records/TherapyRecordForm'
import { createRecord } from '@/app/(app)/horses/[id]/records/actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'
import { deriveAppProfile } from '@/lib/appProfile'
import { professionToTherapyAiType } from '@/lib/professionToTherapyType'
import { loadRecordListForHorseView } from '@/lib/documentation/loadRecordListForHorseView'
import { loadRecordDetailFromDocumentation } from '@/lib/documentation/loadRecordForDetailView'

type NewRecordPageProps = {
  params: Promise<{
    id: string
  }>
}

type HorseRow = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  special_notes: string | null
  notes: string | null
  stable_name: string | null
  stable_city: string | null
  customers:
    | {
        name: string | null
        city: string | null
      }
    | {
        name: string | null
        city: string | null
      }[]
    | null
}

function getRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function getTodayISODate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWholeBodySlot(photoType: string | null | undefined): boolean {
  return photoType === 'whole_left' || photoType === 'whole_right'
}

export default async function NewHoofRecordPage({ params }: NewRecordPageProps) {
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

  const { data: horseRow } = await supabase
    .from('horses')
    .select(
      `
        id,
        name,
        breed,
        sex,
        birth_year,
        special_notes,
        notes,
        stable_name,
        stable_city,
        customers (
          name,
          city
        )
      `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single<HorseRow>()

  const customer = getRelation(horseRow?.customers ?? null)

  const horse = horseRow?.id
    ? {
        id: horseRow.id,
        name: horseRow.name || 'Pferd',
        breed: horseRow.breed,
        sex: horseRow.sex,
        birthYear: horseRow.birth_year,
        customerName: customer?.name || 'Kunde',
        stableName:
          horseRow.stable_name ||
          horseRow.stable_city ||
          customer?.city ||
          null,
        memo: horseRow.special_notes || horseRow.notes || null,
      }
    : null

  const list = await loadRecordListForHorseView(supabase, user.id, id)

  let lastRecord: { date: string | null; text: string } | null = null
  const erstterminBodyPhotos: { url: string; label: string }[] = []
  let erstterminRecordDate: string | null = null
  let defaultRecordType: 'Regeltermin' | 'ersttermin' = 'ersttermin'

  if (list.recordRows.length > 0) {
    defaultRecordType = 'Regeltermin'
    const latestId = list.recordRows[0].record.id

    const latestDocLoad = await loadRecordDetailFromDocumentation(supabase, user.id, id, latestId)

    if (latestDocLoad.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.info('[new-record] letzter Eintrag: documentation_*', { latestId })
      }
      const r = latestDocLoad.record
      lastRecord = {
        date: r.record_date,
        text: [r.hoof_condition, r.treatment, r.notes].filter(Boolean).join(' · ') || '',
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[new-record] letzter Eintrag: Fallback hoof_*', { latestId, reason: latestDocLoad.reason })
      }
      const { data: hr } = await supabase
        .from('hoof_records')
        .select('record_date, notes, hoof_condition, treatment')
        .eq('id', latestId)
        .eq('horse_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (hr) {
        lastRecord = {
          date: hr.record_date,
          text: [hr.hoof_condition, hr.treatment, hr.notes].filter(Boolean).join(' · ') || '',
        }
      }
    }

    if (profile.docType !== 'therapy') {
      const oldestRow = list.recordRows[list.recordRows.length - 1].record
      const oldestId = oldestRow.id
      erstterminRecordDate = oldestRow.record_date

      const oldestDocLoad =
        oldestId === latestId
          ? latestDocLoad
          : await loadRecordDetailFromDocumentation(supabase, user.id, id, oldestId)

      if (oldestDocLoad.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.info('[new-record] Ersttermin-Kontext: documentation_* Fotos', { oldestId })
        }
        const whole = oldestDocLoad.photos.filter((p) => isWholeBodySlot(p.photo_type))
        for (const p of whole) {
          if (!p.file_path || !p.photo_type) continue
          const { data: signed } = await supabase.storage
            .from('hoof-photos')
            .createSignedUrl(p.file_path, 60 * 60)
          if (signed?.signedUrl) {
            erstterminBodyPhotos.push({
              url: signed.signedUrl,
              label: SLOT_LABELS[p.photo_type] ?? p.photo_type,
            })
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[new-record] Ersttermin-Kontext: Fallback hoof_* Fotos', {
            oldestId,
            reason: oldestDocLoad.reason,
          })
        }
        const { data: bodyPhotos } = await supabase
          .from('hoof_photos')
          .select('file_path, photo_type')
          .eq('hoof_record_id', oldestId)
          .eq('user_id', user.id)
          .in('photo_type', ['whole_left', 'whole_right'])

        if (bodyPhotos?.length) {
          for (const p of bodyPhotos) {
            if (!p.file_path || !p.photo_type) continue
            const { data: signed } = await supabase.storage
              .from('hoof-photos')
              .createSignedUrl(p.file_path, 60 * 60)
            if (signed?.signedUrl) {
              erstterminBodyPhotos.push({
                url: signed.signedUrl,
                label: SLOT_LABELS[p.photo_type] ?? p.photo_type,
              })
            }
          }
        }
      }
    }
  }

  const defaultRecordDate = getTodayISODate()

  const therapyHorse = horse
    ? {
        id: horse.id,
        name: horse.name,
        customerName: horse.customerName,
        stableName: horse.stableName,
      }
    : null

  if (profile.docType === 'therapy') {
    const therapyAiType = professionToTherapyAiType(profile.profession)
    return (
      <div className="mx-auto w-full max-w-[1200px]">
        <TherapyRecordForm
          horse={therapyHorse}
          defaultRecordDate={defaultRecordDate}
          lastRecord={lastRecord}
          therapyAiType={therapyAiType}
          saveAction={createRecord}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <RecordCreateForm
        horse={horse}
        defaultRecordDate={defaultRecordDate}
        defaultRecordType={defaultRecordType}
        lastRecord={lastRecord}
        textBlocks={[]}
        saveAction={createRecord}
        erstterminBodyPhotos={erstterminBodyPhotos}
        erstterminRecordDate={erstterminRecordDate}
      />
    </div>
  )
}
