import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSuggestedDurationLabelDesktop } from '@/lib/appointments/appointmentDuration'
import { getDefaultReminderMinutesFromSettings } from '@/lib/appointments/reminderDefaults'
import AppointmentForm from '@/components/appointments/AppointmentForm'
import type {
  AppointmentCustomer,
  AppointmentDayItem,
  AppointmentFormInitialData,
  AppointmentHorse,
} from '@/components/appointments/types'

type NewAppointmentPageProps = {
  searchParams: Promise<{
    customerId?: string
    horseId?: string
    date?: string
  }>
}

type CustomerRow = {
  id: string
  customer_number?: number | null
  name: string | null
  city: string | null
  phone?: string | null
  street?: string | null
  postal_code?: string | null
  country?: string | null
}

type HorseRow = {
  id: string
  name: string | null
  breed?: string | null
  sex?: string | null
  birth_year?: number | null
  hoof_status?: string | null
  customer_id: string | null
  stable_name?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  stable_country?: string | null
  stable_contact?: string | null
  stable_phone?: string | null
  stable_directions?: string | null
}

type AppointmentRow = {
  id: string
  appointment_date: string | null
  customer_id: string | null
  type?: string | null
}

type AppointmentHorseRow = {
  appointment_id: string
  horse_id: string
}

function getTodayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultTimeValue() {
  return '08:30'
}

function getInitialTypeByHorseCount(count: number): AppointmentFormInitialData['appointmentType'] {
  return count > 0 ? 'Regeltermin' : 'Regeltermin'
}

function formatTime(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default async function NewAppointmentPage({
  searchParams,
}: NewAppointmentPageProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userSettingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const reminderSettings = (userSettingsRow?.settings ?? {}) as {
    emailReminders?: boolean
    appointmentReminderDefaultMinutes?: number | null
  }
  const emailRemindersEnabled = reminderSettings.emailReminders !== false
  const defaultReminderMinutes =
    getDefaultReminderMinutesFromSettings(reminderSettings)

  const { customerId, horseId, date } = await searchParams

  const { data: customersData, error: customersError } = await supabase
    .from('customers')
    .select('id, customer_number, name, city, phone, street, postal_code, country')
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .returns<CustomerRow[]>()

  if (customersError) {
    return (
      <main className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Fehler</h1>
          <p className="text-red-600">
            Kunden konnten nicht geladen werden: {customersError.message}
          </p>
        </div>
      </main>
    )
  }

  const { data: horsesData, error: horsesError } = await supabase
    .from('horses')
    .select(
      'id, name, breed, sex, birth_year, hoof_status, customer_id, stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions'
    )
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .returns<HorseRow[]>()

  if (horsesError) {
    return (
      <main className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Fehler</h1>
          <p className="text-red-600">
            Pferde konnten nicht geladen werden: {horsesError.message}
          </p>
        </div>
      </main>
    )
  }

  const customers: AppointmentCustomer[] = (customersData || []).map((customer) => ({
    id: customer.id,
    customer_number: customer.customer_number,
    name: customer.name,
    city: customer.city,
    phone: customer.phone,
    street: customer.street,
    postal_code: customer.postal_code,
    country: customer.country,
  }))

  const horses: AppointmentHorse[] = (horsesData || []).map((horse) => ({
    id: horse.id,
    name: horse.name,
    breed: horse.breed,
    sex: horse.sex,
    birth_year: horse.birth_year,
    hoof_status: horse.hoof_status,
    customer_id: horse.customer_id,
    stable_name: horse.stable_name,
    stable_street: horse.stable_street,
    stable_zip: horse.stable_zip,
    stable_city: horse.stable_city,
    stable_country: horse.stable_country,
    stable_contact: horse.stable_contact,
    stable_phone: horse.stable_phone,
    stable_directions: horse.stable_directions,
  }))

  let resolvedCustomerId = customerId || ''
  let resolvedHorseIds: string[] = []

  if (horseId) {
    const preselectedHorse = horses.find((horse) => horse.id === horseId)
    if (preselectedHorse) {
      resolvedHorseIds = [preselectedHorse.id]
      resolvedCustomerId = preselectedHorse.customer_id || resolvedCustomerId
    }
  }

  if (!horseId && resolvedCustomerId) {
    const horsesForCustomer = horses.filter(
      (horse) => horse.customer_id === resolvedCustomerId
    )

    if (horsesForCustomer.length === 1) {
      resolvedHorseIds = [horsesForCustomer[0].id]
    }
  }

  const selectedDate = date || getTodayDateValue()

  const dayStart = `${selectedDate}T00:00:00`
  const dayEnd = `${selectedDate}T23:59:59`

  const { data: appointmentRows } = await supabase
    .from('appointments')
    .select('id, appointment_date, customer_id, type')
    .eq('user_id', user.id)
    .gte('appointment_date', dayStart)
    .lte('appointment_date', dayEnd)
    .order('appointment_date', { ascending: true })
    .returns<AppointmentRow[]>()

  const appointmentIds = (appointmentRows || []).map((item) => item.id)

  let appointmentHorseRows: AppointmentHorseRow[] = []

  if (appointmentIds.length > 0) {
    const { data: linkRows } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id')
      .eq('user_id', user.id)
      .in('appointment_id', appointmentIds)
      .returns<AppointmentHorseRow[]>()

    appointmentHorseRows = linkRows || []
  }

  const horsesById = new Map(horses.map((horse) => [horse.id, horse]))
  const customersById = new Map(customers.map((customer) => [customer.id, customer]))

  const horseNamesByAppointment = new Map<string, string[]>()

  for (const link of appointmentHorseRows) {
    const horse = horsesById.get(link.horse_id)
    if (!horse?.name) continue

    const existing = horseNamesByAppointment.get(link.appointment_id) || []
    horseNamesByAppointment.set(link.appointment_id, [...existing, horse.name])
  }

  const dayItems: AppointmentDayItem[] = (appointmentRows || []).map((appointment) => ({
    id: appointment.id,
    time: formatTime(appointment.appointment_date),
    customerName:
      customersById.get(appointment.customer_id || '')?.name || 'Unbekannter Kunde',
    horseNames: horseNamesByAppointment.get(appointment.id) || [],
    typeLabel: appointment.type || null,
  }))

  const initialData: AppointmentFormInitialData = {
    customerId: resolvedCustomerId,
    selectedHorseIds: resolvedHorseIds,
    appointmentType: getInitialTypeByHorseCount(resolvedHorseIds.length),
    appointmentDate: selectedDate,
    appointmentTime: getDefaultTimeValue(),
    duration: getSuggestedDurationLabelDesktop(resolvedHorseIds.length),
    notes: '',
    status: 'Bestätigt',
    reminderMinutesBefore: defaultReminderMinutes,
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/calendar" className="text-[#52b788] hover:underline">
          Termine
        </Link>
        <span>›</span>
        <span>Neuen Termin anlegen</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Neuen Termin anlegen
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Pflichtfelder sind mit * gekennzeichnet
        </p>
      </div>

      <AppointmentForm
        mode="create"
        customers={customers}
        horses={horses}
        initialData={initialData}
        dayItems={dayItems}
        emailRemindersEnabled={emailRemindersEnabled}
      />
    </main>
  )
}