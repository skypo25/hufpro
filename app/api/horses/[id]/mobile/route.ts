import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { loadRecordListForHorseView } from '@/lib/documentation/loadRecordListForHorseView'
import { deriveAppProfile } from '@/lib/appProfile'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'

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
    return NextResponse.json(
      { error: 'Horse ID fehlt.' },
      { status: 400 }
    )
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)

  const { data: horse, error: horseError } = await supabase
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
    .single<Horse>()

  if (horseError) {
    return NextResponse.json({ error: horseError.message }, { status: 500 })
  }

  if (!horse) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const owner = relationOwner(horse.customers)
  const nowIso = new Date().toISOString()

  // Nächster Termin: über appointment_horses (Pferde sind über Verknüpfungstabelle zugeordnet)
  const { data: aptLinks } = await supabase
    .from('appointment_horses')
    .select('appointment_id')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
  const aptIds = [...new Set((aptLinks ?? []).map((l: { appointment_id: string }) => l.appointment_id))]
  let nextAppointment: string | null = null
  if (aptIds.length > 0) {
    const { data: nextApts } = await supabase
      .from('appointments')
      .select('appointment_date')
      .eq('user_id', user.id)
      .in('id', aptIds)
      .gte('appointment_date', nowIso)
      .order('appointment_date', { ascending: true })
      .limit(1)
    const first = nextApts?.[0] as { appointment_date?: string } | undefined
    nextAppointment = first?.appointment_date || null
  }

  // Letzte Bearbeitung: Datum des letzten vergangenen Termins (nicht Dokumentation)
  let lastTreatment: string | null = null
  if (aptIds.length > 0) {
    const { data: lastApts } = await supabase
      .from('appointments')
      .select('appointment_date')
      .eq('user_id', user.id)
      .in('id', aptIds)
      .lte('appointment_date', nowIso)
      .order('appointment_date', { ascending: false })
      .limit(1)
    const first = lastApts?.[0] as { appointment_date?: string } | undefined
    lastTreatment = first?.appointment_date || null
  }

  let dokuRows: DokuRow[] = []
  let wholeBodyPhotos: { id: string; imageUrl: string; label: string }[] = []
  let wholeBodyRecordDate: string | null = null
  try {
    const { recordRows, wholeBodyPhotoSources, latestRecordId } = await loadRecordListForHorseView(
      supabase,
      user.id,
      horseId
    )
    dokuRows = recordRows.slice(0, 20).map((row) => ({
      id: row.record.id,
      record_date: row.record.record_date,
      photoCount: row.photoCount,
    }))
    if (latestRecordId && recordRows[0]?.record.record_date) {
      wholeBodyRecordDate = recordRows[0].record.record_date
    }
    if (wholeBodyPhotoSources.length > 0) {
      const withUrls = await Promise.all(
        wholeBodyPhotoSources.map(async (p) => {
          if (!p.file_path) return null
          const { data: signed } = await supabase.storage
            .from('hoof-photos')
            .createSignedUrl(p.file_path, 60 * 60)
          if (!signed?.signedUrl) return null
          return {
            id: p.id,
            imageUrl: signed.signedUrl,
            label: (p.photo_type && SLOT_LABELS[p.photo_type]) ?? p.photo_type ?? 'Ganzkörper',
          }
        })
      )
      wholeBodyPhotos = withUrls.filter(
        (x): x is { id: string; imageUrl: string; label: string } => x != null
      )
      wholeBodyPhotos.sort(
        (a, b) => (a.label.includes('links') ? 0 : 1) - (b.label.includes('links') ? 0 : 1)
      )
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Dokumentationsliste konnte nicht geladen werden.'
    return NextResponse.json({ error: message }, { status: 500 })
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