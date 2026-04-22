import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { pickPrimaryStallHorse, stallOverviewLine } from '@/lib/nav/horseStableAddress'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: customerId } = await params
  if (!customerId) {
    return NextResponse.json({ error: 'Customer ID fehlt.' }, { status: 400 })
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select(
      'id, customer_number, name, first_name, last_name, phone, email, street, postal_code, city, country, company, drive_time, preferred_days, notes, created_at'
    )
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (customerError || !customer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: horses } = await supabase
    .from('horses')
    .select(
      'id, name, breed, sex, birth_year, usage, animal_type, customer_id, stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions'
    )
    .eq('user_id', user.id)
    .eq('customer_id', customer.id)
    .order('name', { ascending: true })

  const horseList = horses ?? []

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, customer_id, appointment_date, type, status, notes')
    .eq('user_id', user.id)
    .eq('customer_id', customer.id)
    .order('appointment_date', { ascending: false })

  const appointmentIds = (appointments ?? []).map((a) => a.id)
  let appointmentHorseRows: { appointment_id: string; horse_id: string }[] = []

  if (appointmentIds.length > 0) {
    const { data: linkData } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id')
      .eq('user_id', user.id)
      .in('appointment_id', appointmentIds)
    appointmentHorseRows = (linkData ?? []) as { appointment_id: string; horse_id: string }[]
  }

  const horseMetaById = new Map(
    horseList.map((h) => [
      h.id,
      {
        name: h.name || '-',
        animalType: (h as { animal_type?: string | null }).animal_type ?? null,
      },
    ])
  )
  const horseNamesByAppointment = new Map<string, string[]>()
  const appointmentAnimalsByAppointment = new Map<
    string,
    { name: string; animalType: string | null }[]
  >()
  for (const row of appointmentHorseRows) {
    const meta = horseMetaById.get(row.horse_id)
    if (meta) {
      const existingNames = horseNamesByAppointment.get(row.appointment_id) || []
      horseNamesByAppointment.set(row.appointment_id, [...existingNames, meta.name])
      const existingAnimals = appointmentAnimalsByAppointment.get(row.appointment_id) || []
      appointmentAnimalsByAppointment.set(row.appointment_id, [...existingAnimals, meta])
    }
  }

  const now = new Date()
  const futureAppointments = (appointments ?? [])
    .filter((a) => {
      if (!a.appointment_date) return false
      const d = new Date(a.appointment_date)
      return !Number.isNaN(d.getTime()) && d >= now
    })
    .sort(
      (a, b) =>
        new Date(a.appointment_date || '').getTime() -
        new Date(b.appointment_date || '').getTime()
    )
  const pastAppointments = (appointments ?? [])
    .filter((a) => {
      if (!a.appointment_date) return false
      const d = new Date(a.appointment_date)
      return !Number.isNaN(d.getTime()) && d < now
    })
    .sort(
      (a, b) =>
        new Date(b.appointment_date || '').getTime() -
        new Date(a.appointment_date || '').getTime()
    )
    .slice(0, 5)

  const nextAppointment = futureAppointments[0] || null
  const nextAppointmentHorseNames = nextAppointment?.id
    ? horseNamesByAppointment.get(nextAppointment.id) || []
    : []

  const firstHorseIdByAppointment = new Map<string, string>()
  for (const row of appointmentHorseRows) {
    if (!firstHorseIdByAppointment.has(row.appointment_id)) {
      firstHorseIdByAppointment.set(row.appointment_id, row.horse_id)
    }
  }

  const nextDateByHorse = new Map<string, string>()
  for (const apt of futureAppointments) {
    const horseIds = appointmentHorseRows
      .filter((r) => r.appointment_id === apt.id)
      .map((r) => r.horse_id)
    for (const hid of horseIds) {
      if (!nextDateByHorse.has(hid) && apt.appointment_date) {
        nextDateByHorse.set(hid, apt.appointment_date)
      }
    }
  }

  const revenueYear = new Date().getFullYear()
  const monthlyRevenueCents: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const { data: revenueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_date')
    .eq('user_id', user.id)
    .eq('customer_id', customer.id)
    .in('status', ['paid', 'sent'])
    .gte('invoice_date', `${revenueYear}-01-01`)
    .lt('invoice_date', `${revenueYear + 1}-01-01`)

  const revenueInvoiceIds = (revenueInvoices ?? []).map((r) => r.id)
  if (revenueInvoiceIds.length > 0) {
    const { data: revenueItems } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents')
      .in('invoice_id', revenueInvoiceIds)
    const sumByInvoice = new Map<string, number>()
    for (const row of revenueItems ?? []) {
      sumByInvoice.set(
        row.invoice_id,
        (sumByInvoice.get(row.invoice_id) ?? 0) + (row.amount_cents ?? 0)
      )
    }
    for (const inv of revenueInvoices ?? []) {
      const month = new Date(inv.invoice_date).getMonth()
      monthlyRevenueCents[month] =
        (monthlyRevenueCents[month] ?? 0) + (sumByInvoice.get(inv.id) ?? 0)
    }
  }
  const totalRevenueCents = monthlyRevenueCents.reduce((a, b) => a + b, 0)

  const horsesWithNext = horseList.map((h) => {
    const age =
      h.birth_year != null
        ? new Date().getFullYear() - h.birth_year
        : null
    const meta = [h.breed, h.sex, age != null ? `${age} Jahre` : null, h.usage]
      .filter(Boolean)
      .join(' · ')
    return {
      id: h.id,
      name: h.name || '-',
      breed: h.breed,
      sex: h.sex,
      birthYear: h.birth_year,
      usage: h.usage,
      animalType: (h as { animal_type?: string | null }).animal_type ?? null,
      meta: meta || '-',
      nextAppointmentDate: nextDateByHorse.get(h.id) || null,
    }
  })

  const primaryStallHorse = pickPrimaryStallHorse(horseList)
  const nextAptHorseId = nextAppointment?.id
    ? firstHorseIdByAppointment.get(nextAppointment.id)
    : null
  const nextAptHorse = nextAptHorseId
    ? horseList.find((h) => h.id === nextAptHorseId)
    : null
  const nextAppointmentStableDisplay = nextAptHorse ? stallOverviewLine(nextAptHorse) : null

  return NextResponse.json({
    customer: {
      id: customer.id,
      customerNumber: customer.customer_number,
      name: customer.name,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      street: customer.street,
      postalCode: customer.postal_code,
      city: customer.city,
      country: customer.country,
      company: customer.company,
      stableName: primaryStallHorse?.stable_name ?? null,
      stableStreet: primaryStallHorse?.stable_street ?? null,
      stableCity: primaryStallHorse?.stable_city ?? null,
      stableZip: primaryStallHorse?.stable_zip ?? null,
      stableCountry: primaryStallHorse?.stable_country ?? null,
      stableContact: primaryStallHorse?.stable_contact ?? null,
      stablePhone: primaryStallHorse?.stable_phone ?? null,
      driveTime: customer.drive_time,
      preferredDays: customer.preferred_days ?? [],
      directions: primaryStallHorse?.stable_directions ?? null,
      notes: customer.notes,
      createdAt: customer.created_at,
    },
    nextAppointment: nextAppointment
      ? {
          id: nextAppointment.id,
          appointmentDate: nextAppointment.appointment_date,
          type: nextAppointment.type,
          notes: nextAppointment.notes,
          status: nextAppointment.status,
          horseNames: nextAppointmentHorseNames,
          appointmentAnimals: appointmentAnimalsByAppointment.get(nextAppointment.id) || [],
          stableDisplay: nextAppointmentStableDisplay,
        }
      : null,
    horses: horsesWithNext,
    monthlyRevenueCents,
    totalRevenueCents,
    revenueYear,
    monthNames: MONTH_NAMES,
    pastAppointments: pastAppointments.map((a) => ({
      id: a.id,
      appointmentDate: a.appointment_date,
      type: a.type,
      notes: a.notes,
      status: a.status,
      horseNames: horseNamesByAppointment.get(a.id) || [],
      appointmentAnimals: appointmentAnimalsByAppointment.get(a.id) || [],
    })),
    allAppointments: (appointments ?? []).map((a) => ({
      id: a.id,
      appointmentDate: a.appointment_date,
      type: a.type,
      notes: a.notes,
      status: a.status,
      horseNames: horseNamesByAppointment.get(a.id) || [],
      appointmentAnimals: appointmentAnimalsByAppointment.get(a.id) || [],
    })),
  })
}
