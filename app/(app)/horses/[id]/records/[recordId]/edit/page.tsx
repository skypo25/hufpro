import { redirect } from 'next/navigation'
import RecordCreateForm from '@/components/records/RecordCreateForm'
import TherapyRecordForm from '@/components/records/TherapyRecordForm'
import { createRecord, updateRecord } from '@/app/(app)/horses/[id]/records/actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { deriveAppProfile } from '@/lib/appProfile'
import { professionToTherapyAiType } from '@/lib/professionToTherapyType'

type EditRecordPageProps = {
  params: Promise<{
    id: string
    recordId: string
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
  customers:
    | {
        name: string | null
        stable_name: string | null
        stable_city: string | null
        city: string | null
      }
    | {
        name: string | null
        stable_name: string | null
        stable_city: string | null
        city: string | null
      }[]
    | null
}

type HoofRecordBase = {
  id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
}

type HoofRecordRow = HoofRecordBase & {
  general_condition?: string | null
  gait?: string | null
  handling_behavior?: string | null
  horn_quality?: string | null
  hoofs_json?: unknown
  checklist_json?: unknown
}

function getRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export default async function EditRecordPage({ params }: EditRecordPageProps) {
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

  const { id: horseId, recordId } = await params

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
        customers (
          name,
          stable_name,
          stable_city,
          city
        )
      `
    )
    .eq('id', horseId)
    .eq('user_id', user.id)
    .single<HorseRow>()

  const { data: record, error: recordError } = await supabase
    .from('hoof_records')
    .select('id, record_date, hoof_condition, treatment, notes')
    .eq('id', recordId)
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .single<HoofRecordBase>()

  if (recordError || !record) {
    return (
      <main className="max-w-[1200px]">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Dokumentation nicht gefunden</h1>
        </div>
      </main>
    )
  }

  let extended: Pick<HoofRecordRow, 'general_condition' | 'gait' | 'handling_behavior' | 'horn_quality' | 'hoofs_json' | 'checklist_json'> | null = null
  const { data: extendedRow } = await supabase
    .from('hoof_records')
    .select('general_condition, gait, handling_behavior, horn_quality, hoofs_json, checklist_json')
    .eq('id', recordId)
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (extendedRow) {
    extended = extendedRow as Pick<HoofRecordRow, 'general_condition' | 'gait' | 'handling_behavior' | 'horn_quality' | 'hoofs_json' | 'checklist_json'>
  }

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
          customer?.stable_name ||
          customer?.stable_city ||
          customer?.city ||
          null,
        memo: horseRow.special_notes || horseRow.notes || null,
      }
    : null

  const { data: allRecords } = await supabase
    .from('hoof_records')
    .select('id, record_date, hoof_condition, treatment, notes')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .order('record_date', { ascending: false })

  const currentIdx = allRecords?.findIndex((r) => r.id === recordId) ?? -1
  const prevRecordRow = currentIdx >= 0 && currentIdx < (allRecords?.length ?? 0) - 1 ? allRecords?.[currentIdx + 1] : null

  const lastRecord =
    prevRecordRow?.id
      ? {
          date: prevRecordRow.record_date,
          text: [prevRecordRow.hoof_condition, prevRecordRow.treatment, prevRecordRow.notes]
            .filter(Boolean)
            .join(' · ') || '',
        }
      : null

  const defaultRecordDate = record.record_date
    ? record.record_date.slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  if (profile.docType === 'therapy') {
    const therapyHorse = horse
      ? {
          id: horse.id,
          name: horse.name,
          customerName: horse.customerName,
          stableName: horse.stableName,
        }
      : null
    const preservedExtendedFields = {
      general_condition: extended?.general_condition ?? null,
      gait: extended?.gait ?? null,
      handling_behavior: extended?.handling_behavior ?? null,
      horn_quality: extended?.horn_quality ?? null,
      hoofs_json: extended?.hoofs_json ?? null,
      checklist_json: extended?.checklist_json ?? null,
      notes: record.notes ?? null,
    }
    return (
      <div className="mx-auto w-full max-w-[1200px]">
        <TherapyRecordForm
          horse={therapyHorse}
          defaultRecordDate={defaultRecordDate}
          therapyAiType={professionToTherapyAiType(profile.profession)}
          saveAction={createRecord}
          mode="edit"
          recordId={recordId}
          initialRecordDate={record.record_date ?? undefined}
          initialSummaryNotes={record.hoof_condition ?? ''}
          initialRecommendationNotes={record.treatment ?? ''}
          updateAction={updateRecord}
          preservedExtendedFields={preservedExtendedFields}
        />
      </div>
    )
  }

  const { data: photos } = await supabase
    .from('hoof_photos')
    .select('id, file_path, photo_type, annotations_json, width, height')
    .eq('hoof_record_id', recordId)
    .eq('user_id', user.id)

  const existingPhotos: {
    id: string
    file_path: string
    photo_type: string
    annotations_json?: unknown
    width?: number | null
    height?: number | null
  }[] = []
  const existingPhotoUrls: Record<string, string> = {}
  if (photos?.length) {
    for (const p of photos) {
      if (!p.file_path || !p.photo_type) continue
      existingPhotos.push({
        id: p.id,
        file_path: p.file_path,
        photo_type: p.photo_type,
        annotations_json: p.annotations_json ?? undefined,
        width: p.width ?? null,
        height: p.height ?? null,
      })
      const { data: signed } = await supabase.storage
        .from('hoof-photos')
        .createSignedUrl(p.file_path, 60 * 60)
      if (signed?.signedUrl) {
        existingPhotoUrls[p.photo_type] = signed.signedUrl
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <RecordCreateForm
        horse={horse}
        defaultRecordDate={defaultRecordDate}
        defaultRecordType="Regeltermin"
        lastRecord={lastRecord ?? null}
        textBlocks={[]}
        saveAction={createRecord}
        erstterminBodyPhotos={[]}
        erstterminRecordDate={null}
        mode="edit"
        recordId={recordId}
        initialRecordDate={record.record_date ?? undefined}
        initialSummaryNotes={record.hoof_condition ?? ''}
        initialRecommendationNotes={record.treatment ?? ''}
        initialNotes={record.notes ?? ''}
        initialGeneralCondition={extended?.general_condition ?? undefined}
        initialGait={extended?.gait ?? undefined}
        initialHandlingBehavior={extended?.handling_behavior ?? undefined}
        initialHornQuality={extended?.horn_quality ?? undefined}
        initialHoofsJson={extended?.hoofs_json}
        initialChecklistJson={extended?.checklist_json}
        updateAction={updateRecord}
        existingPhotos={existingPhotos}
        existingPhotoUrls={existingPhotoUrls}
      />
    </div>
  )
}
