import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
  usage: string | null
  housing: string | null
  hoof_status: string | null
  care_interval: string | null
  customer_id: string | null
  customers: CustomerRelation
}

type HoofRecord = {
  id: string
  horse_id: string
  record_date: string | null
}

type Appointment = {
  id: string
  horse_id: string | null
  appointment_date: string | null
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

  const { data: horse, error: horseError } = await supabase
    .from('horses')
    .select(
      `
      id,
      name,
      breed,
      sex,
      birth_year,
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

  const { data: nextAppointments } = await supabase
    .from('appointments')
    .select('id, horse_id, appointment_date')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .gte('appointment_date', nowIso)
    .order('appointment_date', { ascending: true })
    .limit(1)
    .returns<Appointment[]>()

  const nextAppointment = nextAppointments?.[0]?.appointment_date || null

  const { data: lastRecords } = await supabase
    .from('hoof_records')
    .select('id, horse_id, record_date')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .order('record_date', { ascending: false })
    .limit(1)
    .returns<HoofRecord[]>()

  const lastTreatment = lastRecords?.[0]?.record_date || null

  const { data: records } = await supabase
    .from('hoof_records')
    .select('id, horse_id, record_date')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .order('record_date', { ascending: false })
    .limit(20)
    .returns<HoofRecord[]>()

  const dokuRows: DokuRow[] = []

  if (records && records.length > 0) {
    const recordIds = records.map((r) => r.id)

    const { data: photos } = await supabase
      .from('hoof_photos')
      .select('id, hoof_record_id')
      .eq('user_id', user.id)
      .in('hoof_record_id', recordIds)

    const countByRecord = new Map<string, number>()

    for (const photo of photos || []) {
      const rid = (photo as { hoof_record_id: string | null }).hoof_record_id
      if (!rid) continue
      countByRecord.set(rid, (countByRecord.get(rid) || 0) + 1)
    }

    for (const record of records) {
      dokuRows.push({
        id: record.id,
        record_date: record.record_date,
        photoCount: countByRecord.get(record.id) || 0,
      })
    }
  }

  return NextResponse.json({
    horse: {
      id: horse.id,
      name: horse.name,
      breed: horse.breed,
      sex: horse.sex,
      birthYear: horse.birth_year,
      age: getAgeFromBirthYear(horse.birth_year),
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
  })
}