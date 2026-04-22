import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { formatPreferredDaysGerman } from '@/lib/format'
import {
  getAppointmentStartEndFromRow,
  resolveDurationMinutes,
} from '@/lib/appointments/appointmentDisplay'
import { minutesToDurationLabelMobile } from '@/lib/appointments/appointmentDuration'
import { getAppointmentReminderStatusLine } from '@/lib/reminders/reminderStatus'
import {
  buildBillingNavLineFromCustomer,
  buildStallMultilineFromHorse,
  buildStallNavLineFromHorse,
  pickPrimaryStallHorse,
  stallDisplayLabel,
} from '@/lib/nav/horseStableAddress'

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
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (aptErr || !appointment) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  }

  const customerId = appointment.customer_id

  const { data: aptHorseRows } = await supabase
    .from('appointment_horses')
    .select('horse_id')
    .eq('appointment_id', id)
    .eq('user_id', user.id)

  const horseIds = (aptHorseRows || []).map((r) => r.horse_id)
  let horses: Array<{
    id: string
    name: string | null
    animal_type?: string | null
    breed: string | null
    sex: string | null
    birth_year: number | null
    care_interval: string | null
    stable_name?: string | null
    stable_street?: string | null
    stable_zip?: string | null
    stable_city?: string | null
    stable_country?: string | null
    stable_contact?: string | null
    stable_phone?: string | null
    stable_directions?: string | null
  }> = []

  if (horseIds.length > 0) {
    const { data: horseData } = await supabase
      .from('horses')
      .select(
        'id, name, animal_type, breed, sex, birth_year, care_interval, stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions'
      )
      .eq('user_id', user.id)
      .in('id', horseIds)
    horses = horseData || []
  }

  const stallHorse = pickPrimaryStallHorse(horses)

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
  const slot = getAppointmentStartEndFromRow(aptDate, appointment.duration_minutes)
  const durationMinutesResolved = resolveDurationMinutes(appointment.duration_minutes)
  const startTime = slot
    ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(slot.start)
    : ''
  const endTime = slot
    ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(slot.end)
    : ''
  const timeRange = startTime && endTime ? `${startTime} – ${endTime} Uhr` : ''
  const durationLabel = minutesToDurationLabelMobile(appointment.duration_minutes)

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

  const reminderErr =
    typeof appointment === 'object' && appointment !== null && 'reminder_email_error' in appointment
      ? (appointment as { reminder_email_error?: string | null }).reminder_email_error
      : undefined

  const reminderStatus = getAppointmentReminderStatusLine({
    reminderMinutesBefore: appointment.reminder_minutes_before,
    reminderEmailSentAt: appointment.reminder_email_sent_at,
    reminderEmailError: reminderErr,
    appointmentDate: appointment.appointment_date,
  })

  const appointmentPayload = {
    id: appointment.id,
    appointmentDate: appointment.appointment_date,
    type: appointment.type,
    status: appointment.status,
    notes: appointment.notes,
    durationMinutes: durationMinutesResolved,
    createdAt: appointment.created_at,
    timeRange,
    durationLabel,
    dateLong,
    dayNum,
    monthShort,
    createdAtFormatted,
    reminderStatusLine: reminderStatus?.text ?? null,
    reminderStatusTone: reminderStatus?.tone ?? null,
  }

  const horsesPayload = horses.map((h) => ({
    id: h.id,
    name: h.name,
    animalType: h.animal_type ?? null,
    breed: h.breed,
    sex: h.sex,
    birthYear: h.birth_year,
    age: h.birth_year != null ? new Date().getFullYear() - h.birth_year : null,
  }))

  if (!customerId) {
    const customerAddressForNavNull = null
    const stableAddressForNavOnlyNull = stallHorse ? buildStallNavLineFromHorse(stallHorse) : null
    const stableAddressForNavFallback =
      stableAddressForNavOnlyNull || customerAddressForNavNull || ''
    return NextResponse.json({
      appointment: appointmentPayload,
      customer: {
        id: '',
        customerNumber: null,
        name: 'Kein Kunde zugeordnet',
        phone: null,
        email: null,
        street: null,
        postalCode: null,
        city: null,
        stableName: stallHorse?.stable_name ?? null,
        stableStreet: stallHorse?.stable_street ?? null,
        stableCity: stallHorse?.stable_city ?? null,
        stableZip: stallHorse?.stable_zip ?? null,
        stableContact: stallHorse?.stable_contact ?? null,
        stablePhone: stallHorse?.stable_phone ?? null,
        preferredDays: '–',
        intervalWeeks: null,
        intervalLabel: horses[0]?.care_interval ? String(horses[0].care_interval) : '–',
        directions: stallHorse?.stable_directions ?? null,
        stableDisplay: stallDisplayLabel(stallHorse ?? {}, null),
        stableAddress: stallHorse ? buildStallMultilineFromHorse(stallHorse) : '',
        stableAddressForNav: stableAddressForNavFallback,
        customerAddressForNav: customerAddressForNavNull,
        stableAddressForNavOnly: stableAddressForNavOnlyNull,
      },
      preferredNavApp,
      horses: horsesPayload,
      lastAppointmentDate: null,
    })
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select(
      'id, customer_number, name, first_name, last_name, phone, email, street, postal_code, city, company, preferred_days, interval_weeks, created_at'
    )
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
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
  const customerAddressForNav = buildBillingNavLineFromCustomer(customer)
  const stableAddressForNavOnly = stallHorse ? buildStallNavLineFromHorse(stallHorse) : null
  const stableAddressForNav = stableAddressForNavOnly || customerAddressForNav || ''
  const stableDisplay = stallDisplayLabel(stallHorse ?? {}, customer.city)
  const stableAddress = stallHorse ? buildStallMultilineFromHorse(stallHorse) : ''

  const preferredDays = Array.isArray(customer.preferred_days)
    ? formatPreferredDaysGerman(customer.preferred_days)
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

  const customerNumber =
    customer.customer_number != null
      ? `K-${String(customer.customer_number).padStart(4, '0')}`
      : null

  return NextResponse.json({
    appointment: appointmentPayload,
    customer: {
      id: customer.id,
      customerNumber,
      name: customerName,
      phone: customer.phone,
      email: customer.email,
      street: customer.street,
      postalCode: customer.postal_code,
      city: customer.city,
      stableName: stallHorse?.stable_name ?? null,
      stableStreet: stallHorse?.stable_street ?? null,
      stableCity: stallHorse?.stable_city ?? null,
      stableZip: stallHorse?.stable_zip ?? null,
      stableContact: stallHorse?.stable_contact ?? null,
      stablePhone: stallHorse?.stable_phone ?? null,
      preferredDays,
      intervalWeeks: customer.interval_weeks,
      intervalLabel,
      directions: stallHorse?.stable_directions ?? null,
      stableDisplay,
      stableAddress,
      stableAddressForNav,
      customerAddressForNav,
      stableAddressForNavOnly,
    },
    preferredNavApp,
    horses: horsesPayload,
    lastAppointmentDate,
  })
}
