import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { countDocumentationByHorseIds } from '@/lib/documentation/countDocumentationByHorseIds'
import { formatAnimalTypeLabel } from '@/lib/animalTypeDisplay'

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex?: string | null
  birth_year?: number | null
  animal_type?: string | null
  usage?: string | null
  hoof_status?: string | null
  special_notes?: string | null
  customer_id: string | null
  stable_name?: string | null
  stable_city?: string | null
  stable_street?: string | null
  stable_zip?: string | null
}

type Customer = {
  id: string
  name: string | null
  city: string | null
  interval_weeks?: string | null
}

function getAgeFromBirthYear(birthYear: number | null) {
  if (!birthYear) return null
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  if (age < 0 || age > 60) return null
  return age
}

function isBarhuf(horse: Horse) {
  return (horse.hoof_status || '').toLowerCase().includes('barhuf')
}

function isHufschutz(horse: Horse) {
  const v = (horse.hoof_status || '').toLowerCase()
  return v.includes('hufschuhe') || v.includes('kunststoff') || v.includes('scoot')
}

function isKorrektur(horse: Horse) {
  const v = `${horse.hoof_status || ''} ${horse.special_notes || ''}`.toLowerCase()
  return (
    v.includes('korrektur') ||
    v.includes('trachten') ||
    v.includes('sohle') ||
    v.includes('problem')
  )
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const sort = searchParams.get('sort') || 'name_asc'
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)
  const includeStats = offset === 0

  const { data: horses, error } = await supabase
    .from('horses')
    .select(
      'id, name, breed, sex, birth_year, animal_type, usage, hoof_status, special_notes, customer_id, stable_name, stable_city, stable_street, stable_zip'
    )
    .eq('user_id', user.id)
    .returns<Horse[]>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const horseList = horses || []
  const customerIds = [
    ...new Set(horseList.map((h) => h.customer_id).filter(Boolean)),
  ] as string[]

  let customers: Customer[] = []
  if (customerIds.length > 0) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, name, city, interval_weeks')
      .eq('user_id', user.id)
      .in('id', customerIds)
      .returns<Customer[]>()
    customers = customerData || []
  }

  const customersById = new Map(customers.map((c) => [c.id, c]))

  type Row = {
    horse: Horse
    customer: Customer | null
    nextAppointment: string | null
    documentationCount: number
    intervalWeeks: string | null
  }

  let rows: Row[] = horseList.map((horse) => ({
    horse,
    customer: horse.customer_id ? customersById.get(horse.customer_id) || null : null,
    nextAppointment: null,
    documentationCount: 0,
    intervalWeeks: horse.customer_id
      ? customersById.get(horse.customer_id)?.interval_weeks ?? null
      : null,
  }))

  if (q) {
    rows = rows.filter((row) => {
      const haystack = [
        row.horse.name,
        row.horse.breed,
        row.horse.sex,
        row.horse.usage,
        row.horse.animal_type,
        formatAnimalTypeLabel(row.horse.animal_type),
        row.customer?.name,
        row.customer?.city,
        row.horse.stable_name,
        row.horse.stable_city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }

  // Für next_appointment-Sort: Termine nur für gefilterte IDs (nicht alle Docs)
  if (sort === 'next_appointment' && rows.length > 0) {
    const sortHorseIds = rows.map((r) => r.horse.id)
    const nextByHorse = await loadNextAppointmentsByHorse(supabase, user.id, sortHorseIds)
    for (const row of rows) {
      row.nextAppointment = nextByHorse.get(row.horse.id) || null
    }
  }

  switch (sort) {
    case 'name_desc':
      rows.sort((a, b) => (b.horse.name || '').localeCompare(a.horse.name || '', 'de'))
      break
    case 'owner_asc':
      rows.sort((a, b) =>
        (a.customer?.name || '').localeCompare(b.customer?.name || '', 'de')
      )
      break
    case 'next_appointment':
      rows.sort((a, b) => {
        if (!a.nextAppointment && !b.nextAppointment) return 0
        if (!a.nextAppointment) return 1
        if (!b.nextAppointment) return -1
        return a.nextAppointment.localeCompare(b.nextAppointment)
      })
      break
    case 'breed':
      rows.sort((a, b) =>
        (a.horse.breed || '').localeCompare(b.horse.breed || '', 'de')
      )
      break
    case 'age_asc': {
      const age = (r: Row) => getAgeFromBirthYear(r.horse.birth_year ?? null) ?? 999
      rows.sort((a, b) => age(a) - age(b))
      break
    }
    default:
      rows.sort((a, b) => (a.horse.name || '').localeCompare(b.horse.name || '', 'de'))
  }

  const total = rows.length
  const paged = rows.slice(offset, offset + limit)
  const pageHorseIds = paged.map((r) => r.horse.id)

  // Anreicherung nur für die sichtbare Seite
  if (pageHorseIds.length > 0) {
    const [nextByHorse, documentationCountByHorse] = await Promise.all([
      sort === 'next_appointment'
        ? Promise.resolve(
            new Map(
              paged
                .filter((r) => r.nextAppointment)
                .map((r) => [r.horse.id, r.nextAppointment as string])
            )
          )
        : loadNextAppointmentsByHorse(supabase, user.id, pageHorseIds),
      countDocumentationByHorseIds(supabase, user.id, pageHorseIds).catch(() => {
        return new Map<string, number>()
      }),
    ])

    for (const row of paged) {
      if (sort !== 'next_appointment') {
        row.nextAppointment = nextByHorse.get(row.horse.id) || null
      }
      row.documentationCount = documentationCountByHorse.get(row.horse.id) || 0
    }
  }

  function getOwnerLocation(h: Horse, c: Customer | null) {
    if (h.stable_name) return h.stable_name
    if (h.stable_city) return h.stable_city
    return c?.city || null
  }

  function formatInterval(val: string | null) {
    if (!val) return null
    const num = Number(String(val).replace(/[^\d.,]/g, '').replace(',', '.'))
    if (!Number.isFinite(num) || num <= 0) return null
    return `${num.toString().replace('.', ',')} Wo`
  }

  const payload: Record<string, unknown> = {
    horses: paged.map((r) => ({
      id: r.horse.id,
      name: r.horse.name,
      breed: r.horse.breed,
      sex: r.horse.sex,
      birthYear: r.horse.birth_year,
      age: getAgeFromBirthYear(r.horse.birth_year ?? null),
      animalType: r.horse.animal_type ?? null,
      usage: r.horse.usage,
      hoofStatus: r.horse.hoof_status,
      customerId: r.horse.customer_id ?? null,
      customerName: r.customer?.name ?? null,
      customerStable: getOwnerLocation(r.horse, r.customer),
      nextAppointment: r.nextAppointment,
      documentationCount: r.documentationCount,
      intervalWeeks: formatInterval(r.intervalWeeks),
    })),
    total,
  }

  if (includeStats) {
    const intervals = customers
      .map((c) => c.interval_weeks)
      .filter(Boolean)
      .map((v) => Number(String(v).replace(/[^\d.,]/g, '').replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0)
    const avgInterval =
      intervals.length > 0
        ? (intervals.reduce((s, n) => s + n, 0) / intervals.length)
            .toFixed(1)
            .replace('.', ',')
        : null

    payload.horseCount = horseList.length
    payload.customerCount = customers.length
    payload.barhufCount = horseList.filter(isBarhuf).length
    payload.hoofschutzCount = horseList.filter(isHufschutz).length
    payload.correctionCount = horseList.filter(isKorrektur).length
    payload.avgInterval = avgInterval ?? '–'
    payload.dogsCount = horseList.filter((a) => (a.animal_type ?? '').trim() === 'dog').length
    payload.catsCount = horseList.filter((a) => (a.animal_type ?? '').trim() === 'cat').length
    payload.typeHorseCount = horseList.filter((a) => {
      const ty = (a.animal_type ?? '').trim()
      return !ty || ty === 'horse'
    }).length
    payload.smallAnimalsCount = horseList.filter(
      (a) => (a.animal_type ?? '').trim() === 'small'
    ).length
    payload.otherAnimalsCount = horseList.filter(
      (a) => (a.animal_type ?? '').trim() === 'other'
    ).length
  }

  return NextResponse.json(payload)
}

async function loadNextAppointmentsByHorse(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  horseIds: string[]
) {
  const nextAppointmentByHorse = new Map<string, string>()
  if (horseIds.length === 0) return nextAppointmentByHorse

  const { data: linkData } = await supabase
    .from('appointment_horses')
    .select('appointment_id, horse_id')
    .eq('user_id', userId)
    .in('horse_id', horseIds)
    .returns<{ appointment_id: string; horse_id: string }[]>()

  const appointmentLinks = linkData || []
  const appointmentIds = [...new Set(appointmentLinks.map((l) => l.appointment_id))]
  if (appointmentIds.length === 0) return nextAppointmentByHorse

  const { data: appointmentData } = await supabase
    .from('appointments')
    .select('id, appointment_date')
    .eq('user_id', userId)
    .in('id', appointmentIds)
    .gte('appointment_date', new Date().toISOString())
    .order('appointment_date', { ascending: true })
    .returns<{ id: string; appointment_date: string | null }[]>()

  const appointmentsById = new Map((appointmentData || []).map((a) => [a.id, a]))
  for (const link of appointmentLinks) {
    const appointment = appointmentsById.get(link.appointment_id)
    if (!appointment?.appointment_date) continue
    const existing = nextAppointmentByHorse.get(link.horse_id)
    if (!existing || appointment.appointment_date < existing) {
      nextAppointmentByHorse.set(link.horse_id, appointment.appointment_date)
    }
  }
  return nextAppointmentByHorse
}
