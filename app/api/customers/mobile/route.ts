import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCurrentWeekRange } from '@/lib/date'
import {
  buildBillingNavLineFromCustomer,
  pickPrimaryStallHorse,
  stallDisplayLabel,
} from '@/lib/nav/horseStableAddress'
import { formatCustomerAnimalsSummary } from '@/lib/animalTypeDisplay'

type Customer = {
  id: string
  customer_number?: number | null
  name: string | null
  first_name?: string | null
  last_name?: string | null
  phone: string | null
  email: string | null
  city: string | null
  street?: string | null
  postal_code?: string | null
  created_at?: string | null
}

type Horse = {
  id: string
  name: string | null
  customer_id: string | null
  animal_type?: string | null
  stable_name?: string | null
  stable_city?: string | null
  stable_street?: string | null
  stable_zip?: string | null
}
type Appointment = { id: string; customer_id: string | null; appointment_date: string | null }
type AppointmentHorse = { appointment_id: string; horse_id: string }

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const filter = searchParams.get('filter') || 'all'
  const sort = searchParams.get('sort') || 'name_asc'
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

  let customerIdsFromSearch: string[] = []
  let customerIdsFromHorses: string[] = []

  if (q) {
    const { data: textMatch } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .or(
        [
          `name.ilike.%${q}%`,
          `first_name.ilike.%${q}%`,
          `last_name.ilike.%${q}%`,
          `city.ilike.%${q}%`,
          `street.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
          ...(Number.isInteger(Number(q)) ? [`customer_number.eq.${Number(q)}`] : []),
        ].join(',')
      )
      .returns<{ id: string }[]>()
    customerIdsFromSearch = (textMatch || []).map((r) => r.id)

    const { data: horsesMatch } = await supabase
      .from('horses')
      .select('customer_id')
      .eq('user_id', user.id)
      .not('customer_id', 'is', null)
      .or(`name.ilike.%${q}%,breed.ilike.%${q}%,stable_name.ilike.%${q}%,stable_city.ilike.%${q}%`)
      .returns<{ customer_id: string | null }[]>()
    customerIdsFromHorses = (horsesMatch || [])
      .map((r) => r.customer_id)
      .filter((id): id is string => Boolean(id))
  }

  const allFilteredIds = q.length > 0 ? [...new Set([...customerIdsFromSearch, ...customerIdsFromHorses])] : null

  let query = supabase
    .from('customers')
    .select(
      'id, customer_number, name, first_name, last_name, phone, email, city, street, postal_code, created_at'
    )
    .eq('user_id', user.id)

  if (allFilteredIds !== null) {
    if (allFilteredIds.length === 0) {
      return NextResponse.json({
        customers: [],
        total: 0,
        customerCount: 0,
        horseCount: 0,
        appointmentsThisWeek: 0,
      })
    }
    query = query.in('id', allFilteredIds)
  }

  const { data: customers, error } = await query.returns<Customer[]>()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const customerIds = (customers || []).map((c) => c.id)
  const nowIso = new Date().toISOString()

  let horses: Horse[] = []
  let appointments: Appointment[] = []
  let appointmentHorseRows: AppointmentHorse[] = []

  if (customerIds.length > 0) {
    const [{ data: horseData }, { data: appointmentData }] = await Promise.all([
      supabase
        .from('horses')
        .select('id, name, customer_id, animal_type, stable_name, stable_city, stable_street, stable_zip')
        .eq('user_id', user.id)
        .in('customer_id', customerIds)
        .returns<Horse[]>(),
      supabase
        .from('appointments')
        .select('id, customer_id, appointment_date')
        .eq('user_id', user.id)
        .in('customer_id', customerIds)
        .gte('appointment_date', nowIso)
        .order('appointment_date', { ascending: true })
        .returns<Appointment[]>(),
    ])
    horses = horseData || []
    appointments = appointmentData || []
    const appointmentIds = appointments.map((a) => a.id)
    if (appointmentIds.length > 0) {
      const { data: linkData } = await supabase
        .from('appointment_horses')
        .select('appointment_id, horse_id')
        .eq('user_id', user.id)
        .in('appointment_id', appointmentIds)
        .returns<AppointmentHorse[]>()
      appointmentHorseRows = linkData || []
    }
  }

  const horsesByCustomer = new Map<string, Horse[]>()
  for (const horse of horses) {
    if (!horse.customer_id) continue
    const existing = horsesByCustomer.get(horse.customer_id) || []
    horsesByCustomer.set(horse.customer_id, [...existing, horse])
  }
  const horseCountByAppointment = new Map<string, number>()
  for (const row of appointmentHorseRows) {
    horseCountByAppointment.set(row.appointment_id, (horseCountByAppointment.get(row.appointment_id) || 0) + 1)
  }
  const nextAppointmentByCustomer = new Map<string, { date: string; horseCount: number }>()
  for (const appointment of appointments) {
    if (!appointment.customer_id || !appointment.appointment_date) continue
    if (!nextAppointmentByCustomer.has(appointment.customer_id)) {
      nextAppointmentByCustomer.set(appointment.customer_id, {
        date: appointment.appointment_date,
        horseCount: horseCountByAppointment.get(appointment.id) || 0,
      })
    }
  }

  type Row = {
    customer: Customer
    horseCount: number
    animalsSummary: string
    horseNames: string[]
    nextAppointment: string | null
    nextAppointmentHorseCount: number
    navAddress: string
    locationLine: string
  }

  let rows: Row[] = (customers || []).map((customer) => {
    const customerHorses = horsesByCustomer.get(customer.id) || []
    const next = nextAppointmentByCustomer.get(customer.id)
    const stallHorse = pickPrimaryStallHorse(customerHorses)
    const navAddress = buildBillingNavLineFromCustomer(customer) || ''
    return {
      customer,
      horseCount: customerHorses.length,
      animalsSummary: formatCustomerAnimalsSummary(customerHorses),
      horseNames: customerHorses.map((h) => h.name).filter((n): n is string => Boolean(n)),
      nextAppointment: next?.date ?? null,
      nextAppointmentHorseCount: next?.horseCount ?? 0,
      navAddress,
      locationLine: stallDisplayLabel(stallHorse ?? {}, customer.city) || customer.city || '',
    }
  })

  if (filter === 'with_appointment') {
    rows = rows.filter((r) => r.nextAppointment != null)
  } else if (filter === 'without_appointment') {
    rows = rows.filter((r) => r.nextAppointment == null)
  } else if (filter === 'new') {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffIso = cutoff.toISOString()
    rows = rows.filter((r) => (r.customer.created_at ?? '') >= cutoffIso)
  }

  switch (sort) {
    case 'name_desc':
      rows.sort((a, b) => (b.customer.name || '').localeCompare(a.customer.name || '', 'de'))
      break
    case 'next_appointment':
      rows.sort((a, b) => {
        if (!a.nextAppointment && !b.nextAppointment) return 0
        if (!a.nextAppointment) return 1
        if (!b.nextAppointment) return -1
        return a.nextAppointment.localeCompare(b.nextAppointment)
      })
      break
    case 'horses_desc':
      rows.sort((a, b) => b.horseCount - a.horseCount)
      break
    case 'newest':
      rows.sort(
        (a, b) =>
          new Date(b.customer.created_at || 0).getTime() - new Date(a.customer.created_at || 0).getTime()
      )
      break
    default:
      rows.sort((a, b) => (a.customer.name || '').localeCompare(b.customer.name || '', 'de'))
  }

  const total = rows.length
  const filteredHorseCount = rows.reduce((s, r) => s + r.horseCount, 0)
  const paged = rows.slice(offset, offset + limit)

  const { weekStart, weekEnd } = getCurrentWeekRange()
  const allAppointmentsThisWeek = await supabase
    .from('appointments')
    .select('id')
    .eq('user_id', user.id)
    .gte('appointment_date', weekStart.toISOString())
    .lt('appointment_date', weekEnd.toISOString())
  const appointmentsThisWeek = (allAppointmentsThisWeek.data ?? []).length

  return NextResponse.json({
    customers: paged.map((r) => ({
      id: r.customer.id,
      customer_number: r.customer.customer_number,
      name: r.customer.name,
      phone: r.customer.phone,
      email: r.customer.email,
      city: r.customer.city,
      locationLine: r.locationLine,
      horseCount: r.horseCount,
      animalsSummary: r.animalsSummary,
      horseNames: r.horseNames,
      nextAppointment: r.nextAppointment,
      nextAppointmentHorseCount: r.nextAppointmentHorseCount,
      navAddress: r.navAddress,
    })),
    total,
    customerCount: total,
    horseCount: filteredHorseCount,
    appointmentsThisWeek,
  })
}
