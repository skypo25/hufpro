import { redirect } from 'next/navigation'
import RecordCreateForm from '@/components/records/RecordCreateForm'
import { createRecord } from '@/app/(app)/horses/[id]/records/actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'

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

type HoofRecordRow = {
  id: string
  record_date: string | null
  notes: string | null
  hoof_condition: string | null
  treatment: string | null
}

function getRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function getTodayISODate() {
  // YYYY-MM-DD (für Anzeige/DB ok; wird als string gespeichert)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function NewHoofRecordPage({ params }: NewRecordPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
          customer?.stable_name ||
          customer?.stable_city ||
          customer?.city ||
          null,
        memo: horseRow.special_notes || horseRow.notes || null,
      }
    : null

  const { data: lastRecordRow } = await supabase
    .from('hoof_records')
    .select('id, record_date, notes, hoof_condition, treatment')
    .eq('horse_id', id)
    .eq('user_id', user.id)
    .order('record_date', { ascending: false })
    .limit(1)
    .single<HoofRecordRow>()

  const lastRecord =
    lastRecordRow?.id
      ? {
          date: lastRecordRow.record_date,
          text:
            [
              lastRecordRow.hoof_condition,
              lastRecordRow.treatment,
              lastRecordRow.notes,
            ]
              .filter(Boolean)
              .join(' · ') || '',
        }
      : null

  const erstterminBodyPhotos: { url: string; label: string }[] = []
  let erstterminRecordDate: string | null = null
  const { data: firstRecordRow } = await supabase
    .from('hoof_records')
    .select('id, record_date')
    .eq('horse_id', id)
    .eq('user_id', user.id)
    .order('record_date', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; record_date: string | null }>()

  if (firstRecordRow?.id) {
    erstterminRecordDate = firstRecordRow.record_date ?? null
    const { data: bodyPhotos } = await supabase
      .from('hoof_photos')
      .select('file_path, photo_type')
      .eq('hoof_record_id', firstRecordRow.id)
      .eq('user_id', user.id)
      .in('photo_type', ['whole_left', 'whole_right'])

    if (bodyPhotos?.length) {
      for (const p of bodyPhotos) {
        if (!p.file_path) continue
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

  const defaultRecordDate = getTodayISODate()
  const defaultRecordType = lastRecordRow ? 'Regeltermin' : 'ersttermin'

  return (
    <div className="w-full max-w-[1200px]">
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