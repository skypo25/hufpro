import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { loadRecordListForHorseView } from '@/lib/documentation/loadRecordListForHorseView'
import { deriveAppProfile } from '@/lib/appProfile'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'
import { createHoofPhotoSignedUrls } from '@/lib/photos/createHoofPhotoSignedUrls'

type CustomerRelation =
  | {
      id: string
      name: string | null
      phone: string | null
    }
  | {
      id: string
      name: string | null
      phone: string | null
    }[]
  | null

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  animal_type?: string | null
  neutered?: string | null
  weight_kg?: number | string | null
  coat_color?: string | null
  chip_id?: string | null
  usage: string | null
  housing: string | null
  hoof_status: string | null
  care_interval: string | null
  customer_id: string | null
  customers: CustomerRelation
}

type DokuRow = {
  id: string
  record_date: string | null
  photoCount: number
}

function getAgeFromBirthYear(birthYear: number | null) {
  if (!birthYear) return null
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  if (age < 0 || age > 60) return null
  return age
}

function relationOwner(value: CustomerRelation) {
  return Array.isArray(value) ? value[0] || null : value || null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: horseId } = await params

  if (!horseId) {
    return NextResponse.json({ error: 'Horse ID fehlt.' }, { status: 400 })
  }

  const [settingsResult, horseResult] = await Promise.all([
    supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('horses')
      .select(
        `
      id,
      name,
      breed,
      sex,
      birth_year,
      animal_type,
      neutered,
      weight_kg,
      coat_color,
      chip_id,
      usage,
      housing,
      hoof_status,
      care_interval,
      customer_id,
      customers (
        id,
        name,
        phone
      )
    `
      )
      .eq('id', horseId)
      .eq('user_id', user.id)
      .single<Horse>(),
  ])

  if (horseResult.error) {
    return NextResponse.json({ error: horseResult.error.message }, { status: 500 })
  }

  const horse = horseResult.data
  if (!horse) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const settings = settingsResult.data?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  const owner = relationOwner(horse.customers)
  const nowIso = new Date().toISOString()

  const [aptLinksResult, recordListResult] = await Promise.all([
    supabase
      .from('appointment_horses')
      .select('appointment_id')
      .eq('horse_id', horseId)
      .eq('user_id', user.id),
    loadRecordListForHorseView(supabase, user.id, horseId),
  ])

  const aptIds = [
    ...new Set((aptLinksResult.data ?? []).map((l: { appointment_id: string }) => l.appointment_id)),
  ]

  let nextAppointment: string | null = null
  let lastTreatment: string | null = null

  if (aptIds.length > 0) {
    const [nextResult, lastResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('appointment_date')
        .eq('user_id', user.id)
        .in('id', aptIds)
        .gte('appointment_date', nowIso)
        .order('appointment_date', { ascending: true })
        .limit(1),
      supabase
        .from('appointments')
        .select('appointment_date')
        .eq('user_id', user.id)
        .in('id', aptIds)
        .lte('appointment_date', nowIso)
        .order('appointment_date', { ascending: false })
        .limit(1),
    ])
    nextAppointment =
      (nextResult.data?.[0] as { appointment_date?: string } | undefined)?.appointment_date || null
    lastTreatment =
      (lastResult.data?.[0] as { appointment_date?: string } | undefined)?.appointment_date || null
  }

  const { recordRows, wholeBodyPhotoSources, latestRecordId } = recordListResult

  const dokuRows: DokuRow[] = recordRows.slice(0, 20).map((row) => ({
    id: row.record.id,
    record_date: row.record.record_date,
    photoCount: row.photoCount,
  }))

  let wholeBodyRecordDate: string | null = null
  if (latestRecordId && recordRows[0]?.record.record_date) {
    wholeBodyRecordDate = recordRows[0].record.record_date
  }

  let wholeBodyPhotos: { id: string; imageUrl: string; label: string }[] = []
  if (wholeBodyPhotoSources.length > 0) {
    const paths = wholeBodyPhotoSources
      .map((p) => p.file_path)
      .filter((p): p is string => Boolean(p))
    const signedByPath = await createHoofPhotoSignedUrls(supabase, paths, 60 * 60)

    wholeBodyPhotos = wholeBodyPhotoSources
      .map((p) => {
        if (!p.file_path) return null
        const imageUrl = signedByPath.get(p.file_path)
        if (!imageUrl) return null
        return {
          id: p.id,
          imageUrl,
          label: (p.photo_type && SLOT_LABELS[p.photo_type]) ?? p.photo_type ?? 'Ganzkörper',
        }
      })
      .filter((x): x is { id: string; imageUrl: string; label: string } => x != null)

    wholeBodyPhotos.sort(
      (a, b) => (a.label.includes('links') ? 0 : 1) - (b.label.includes('links') ? 0 : 1)
    )
  }

  return NextResponse.json({
    terminology: profile.terminology,
    showErstanamnese: !profile.isHufbearbeiter,
    horse: {
      id: horse.id,
      name: horse.name,
      breed: horse.breed,
      sex: horse.sex,
      birthYear: horse.birth_year,
      age: getAgeFromBirthYear(horse.birth_year),
      animalType: horse.animal_type ?? null,
      neutered: horse.neutered ?? null,
      weightKg: horse.weight_kg ?? null,
      coatColor: horse.coat_color ?? null,
      chipId: horse.chip_id ?? null,
      usage: horse.usage,
      housing: horse.housing,
      hoofStatus: horse.hoof_status,
      careInterval: horse.care_interval,
    },
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          phone: owner.phone,
        }
      : null,
    lastTreatment,
    nextAppointment,
    dokumentationen: dokuRows,
    wholeBodyPhotos,
    wholeBodyRecordDate,
  })
}
