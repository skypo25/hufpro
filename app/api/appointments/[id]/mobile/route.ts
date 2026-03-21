import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function buildStableAddress(c: {
  stable_differs?: boolean | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
}) {
  const useStable =
    c.stable_differs &&
    (c.stable_street?.trim() || c.stable_zip?.trim() || c.stable_city?.trim())
  if (useStable) {
    const parts = [c.stable_street, [c.stable_zip, c.stable_city].filter(Boolean).join(' ')].filter(
      Boolean
    )
    return parts.join('\n')
  }
  const parts = [c.street, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean)
  return parts.join('\n')
}

function buildStableAddressForNav(c: {
  stable_differs?: boolean | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
}) {
  const useStable =
    c.stable_differs &&
    (c.stable_street?.trim() || c.stable_zip?.trim() || c.stable_city?.trim())
  if (useStable) {
    const parts = [c.stable_street, [c.stable_zip, c.stable_city].filter(Boolean).join(' ')].filter(
      Boolean
    )
    return parts.join(', ')
  }
  const parts = [c.street, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean)
  return parts.join(', ')
}

function buildCustomerAddressForNav(c: {
  street?: string | null
  postal_code?: string | null
  city?: string | null
}) {
  const parts = [c.street?.trim(), [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean)
  return parts.join(', ') || null
}

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

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Appointment ID fehlt.' }, { status: 400 })
  }

  const { data: appointment, error: aptErr } = await supabase
    .from('appointments')
    .select('id, customer_id, appointment_date, notes, type, status, duration_minutes, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (aptErr || !appointment) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  }

  const customerId = appointment.customer_id
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Kunde zugeordnet' }, { status: 404 })
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select(
      'id, customer_number, name, first_name, last_name, phone, email, street, postal_code, city, company, stable_differs, stable_name, stable_street, stable_city, stable_zip, stable_contact, stable_phone, preferred_days, directions, interval_weeks, created_at'
    )
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
  }

  const { data: aptHorseRows } = await supabase
    .from('appointment_horses')
    .select('horse_id')
    .eq('appointment_id', id)
    .eq('user_id', user.id)

  const horseIds = (aptHorseRows || []).map((r) => r.horse_id)
  let horses: Array<{
    id: string
    name: string | null
    breed: string | null
    sex: string | null
    birth_year: number | null
    care_interval: string | null
  }> = []

  if (horseIds.length > 0) {
    const { data: horseData } = await supabase
      .from('horses')
      .select('id, name, breed, sex, birth_year, care_interval')
      .eq('user_id', user.id)
      .in('id', horseIds)
    horses = horseData || []
  }

  const { data: pastApts } = await supabase
    .from('appointments')
    .select('id, appointment_date, type, status')
    .eq('customer_id', customerId)
    .eq('user_id', user.id)
    .not('appointment_date', 'is', null)
    .order('appointment_date', { ascending: false })
    .limit(10)

  const pastAppointments = (pastApts || []).filter(
    (a) => a.appointment_date && new Date(a.appointment_date) < new Date()
  )

  const customerName =
    customer.name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
    'Kunde'
  const stableDisplay = customer.stable_name || customer.stable_city || customer.city || ''
  const stableAddress = buildStableAddress(customer)
  const stableAddressForNav = buildStableAddressForNav(customer)
  const customerAddressForNav = buildCustomerAddressForNav(customer)
  const stableAddressForNavOnly =
    customer.stable_differs &&
    (customer.stable_street?.trim() || customer.stable_zip || customer.stable_city)
      ? [customer.stable_street?.trim(), [customer.stable_zip, customer.stable_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      : null

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .single()
  const settings = (settingsRow?.settings ?? {}) as { preferredNavApp?: string }
  const preferredNavApp =
    settings.preferredNavApp === 'apple' || settings.preferredNavApp === 'waze'
      ? settings.preferredNavApp
      : 'google'

  const aptDate = appointment.appointment_date
  const duration = appointment.duration_minutes ?? 60
  const startTime = aptDate
    ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(
        new Date(aptDate)
      )
    : ''
  const endDate = aptDate
    ? new Date(new Date(aptDate).getTime() + duration * 60 * 1000)
    : null
  const endTime = endDate
    ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(endDate)
    : ''
  const timeRange = startTime && endTime ? `${startTime} – ${endTime} Uhr` : ''
  const durationLabel =
    duration === 60 ? '1 Stunde' : duration === 30 ? '30 min' : duration === 45 ? '45 min' : `${duration} min`

  const preferredDays = Array.isArray(customer.preferred_days)
    ? customer.preferred_days.join(', ')
    : customer.preferred_days || '-'

  const intervalLabel =
    customer.interval_weeks != null
      ? `${customer.interval_weeks} Wochen`
      : horses[0]?.care_interval || '-'

  const lastPastAppointment = pastAppointments[0]
  const lastAppointmentDate = lastPastAppointment?.appointment_date
    ? new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(lastPastAppointment.appointment_date))
    : null

  const createdAtFormatted = appointment.created_at
    ? new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(appointment.created_at))
    : null

  const dateLong = aptDate
    ? new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(aptDate))
    : null

  const dayNum = aptDate ? String(new Date(aptDate).getDate()) : '–'
  const monthShort = aptDate
    ? new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(new Date(aptDate))
    : ''

  const customerNumber =
    customer.customer_number != null
      ? `K-${String(customer.customer_number).padStart(4, '0')}`
      : null

  return NextResponse.json({
    appointment: {
      id: appointment.id,
      appointmentDate: appointment.appointment_date,
      type: appointment.type,
      status: appointment.status,
      notes: appointment.notes,
      durationMinutes: duration,
      createdAt: appointment.created_at,
      timeRange,
      durationLabel,
      dateLong,
      dayNum,
      monthShort,
      createdAtFormatted,
    },
    customer: {
      id: customer.id,
      customerNumber,
      name: customerName,
      phone: customer.phone,
      email: customer.email,
      street: customer.street,
      postalCode: customer.postal_code,
      city: customer.city,
      stableName: customer.stable_name,
      stableStreet: customer.stable_street,
      stableCity: customer.stable_city,
      stableZip: customer.stable_zip,
      stableContact: customer.stable_contact,
      stablePhone: customer.stable_phone,
      preferredDays,
      intervalWeeks: customer.interval_weeks,
      intervalLabel,
      directions: customer.directions,
      stableDisplay,
      stableAddress,
      stableAddressForNav,
      customerAddressForNav,
      stableAddressForNavOnly,
    },
    preferredNavApp,
    horses: horses.map((h) => ({
      id: h.id,
      name: h.name,
      breed: h.breed,
      sex: h.sex,
      birthYear: h.birth_year,
      age: h.birth_year != null ? new Date().getFullYear() - h.birth_year : null,
    })),
    lastAppointmentDate,
  })
}
