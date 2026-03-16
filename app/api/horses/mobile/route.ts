import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCurrentWeekRange } from '@/lib/date'

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex?: string | null
  birth_year?: number | null
  usage?: string | null
  hoof_status?: string | null
  special_notes?: string | null
  customer_id: string | null
}

type Customer = {
  id: string
  name: string | null
  city: string | null
  stable_name?: string | null
  stable_city?: string | null
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
  const filter = searchParams.get('filter') || 'all'
  const sort = searchParams.get('sort') || 'name_asc'
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

  const { data: horses, error } = await supabase
    .from('horses')
    .select(
      'id, name, breed, sex, birth_year, usage, hoof_status, special_notes, customer_id'
    )
    .eq('user_id', user.id)
    .returns<Horse[]>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const horseList = horses || []
  const customerIds = [
    ...new Set(horseList.map((h) => h.customer_id).filter(Boolean)),
  ] as string[]
  const horseIds = horseList.map((h) => h.id)

  let customers: Customer[] = []
  const appointmentLinks: { appointment_id: string; horse_id: string }[] = []
  const appointments: { id: string; appointment_date: string | null }[] = []
  const hoofRecords: { id: string; horse_id: string | null }[] = []

  if (customerIds.length > 0) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, name, city, stable_name, stable_city, interval_weeks')
      .eq('user_id', user.id)
      .in('id', customerIds)
      .returns<Customer[]>()
    customers = customerData || []
  }

  if (horseIds.length > 0) {
    const { data: linkData } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id')
      .eq('user_id', user.id)
      .in('horse_id', horseIds)
      .returns<{ appointment_id: string; horse_id: string }[]>()
    if (linkData) appointmentLinks.push(...linkData)

    const appointmentIds = [...new Set(appointmentLinks.map((l) => l.appointment_id))]
    if (appointmentIds.length > 0) {
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('id, appointment_date')
        .eq('user_id', user.id)
        .in('id', appointmentIds)
        .gte('appointment_date', new Date().toISOString())
        .order('appointment_date', { ascending: true })
        .returns<{ id: string; appointment_date: string | null }[]>()
      if (appointmentData) appointments.push(...appointmentData)
    }

    const { data: recordData } = await supabase
      .from('hoof_records')
      .select('id, horse_id')
      .in('horse_id', horseIds)
      .returns<{ id: string; horse_id: string | null }[]>()
    if (recordData) hoofRecords.push(...recordData)
  }

  const customersById = new Map(customers.map((c) => [c.id, c]))
  const appointmentsById = new Map(appointments.map((a) => [a.id, a]))

  const nextAppointmentByHorse = new Map<string, string>()
  for (const link of appointmentLinks) {
    const appointment = appointmentsById.get(link.appointment_id)
    if (!appointment?.appointment_date) continue
    const existing = nextAppointmentByHorse.get(link.horse_id)
    if (!existing || appointment.appointment_date < existing) {
      nextAppointmentByHorse.set(link.horse_id, appointment.appointment_date)
    }
  }

  const documentationCountByHorse = new Map<string, number>()
  for (const record of hoofRecords) {
    if (!record.horse_id) continue
    documentationCountByHorse.set(
      record.horse_id,
      (documentationCountByHorse.get(record.horse_id) || 0) + 1
    )
  }

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
    nextAppointment: nextAppointmentByHorse.get(horse.id) || null,
    documentationCount: documentationCountByHorse.get(horse.id) || 0,
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
        row.customer?.name,
        row.customer?.city,
        row.customer?.stable_name,
        row.customer?.stable_city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }

  if (filter === 'barhuf') rows = rows.filter((r) => isBarhuf(r.horse))
  else if (filter === 'hufschutz') rows = rows.filter((r) => isHufschutz(r.horse))
  else if (filter === 'korrektur') rows = rows.filter((r) => isKorrektur(r.horse))

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

  const barhufCount = horseList.filter(isBarhuf).length
  const hoofschutzCount = horseList.filter(isHufschutz).length
  const correctionCount = horseList.filter(isKorrektur).length

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

  function getOwnerLocation(c: Customer | null) {
    if (!c) return null
    if (c.stable_name) return c.stable_name
    return c.stable_city || c.city || null
  }

  function formatInterval(val: string | null) {
    if (!val) return null
    const num = Number(String(val).replace(/[^\d.,]/g, '').replace(',', '.'))
    if (!Number.isFinite(num) || num <= 0) return null
    return `${num.toString().replace('.', ',')} Wo`
  }

  return NextResponse.json({
    horses: paged.map((r) => ({
      id: r.horse.id,
      name: r.horse.name,
      breed: r.horse.breed,
      sex: r.horse.sex,
      birthYear: r.horse.birth_year,
      age: getAgeFromBirthYear(r.horse.birth_year ?? null),
      usage: r.horse.usage,
      hoofStatus: r.horse.hoof_status,
      customerId: r.horse.customer_id ?? null,
      customerName: r.customer?.name ?? null,
      customerStable: getOwnerLocation(r.customer),
      nextAppointment: r.nextAppointment,
      documentationCount: r.documentationCount,
      intervalWeeks: formatInterval(r.intervalWeeks),
    })),
    total,
    horseCount: horseList.length,
    customerCount: customers.length,
    barhufCount,
    hoofschutzCount,
    correctionCount,
    avgInterval: avgInterval ?? '–',
  })
}
