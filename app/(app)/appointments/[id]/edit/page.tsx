import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AppointmentForm from '@/components/appointments/AppointmentForm'
import type {
  AppointmentCustomer,
  AppointmentDayItem,
  AppointmentFormInitialData,
  AppointmentHorse,
} from '@/components/appointments/types'

type EditAppointmentPageProps = {
  params: Promise<{
    id: string
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
  stable_differs?: boolean | null
  stable_name?: string | null
  stable_city?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_country?: string | null
  directions?: string | null
}

type HorseRow = {
  id: string
  name: string | null
  breed?: string | null
  sex?: string | null
  birth_year?: number | null
  hoof_status?: string | null
  customer_id: string | null
}

type AppointmentRow = {
  id: string
  customer_id: string | null
  appointment_date: string | null
  notes: string | null
  type: 'Regeltermin' | 'Ersttermin' | 'Kontrolle' | 'Sondertermin' | null
  status: 'Bestätigt' | 'Vorgeschlagen' | 'Warteliste' | null
  duration_minutes: number | null
}

type AppointmentHorseRow = {
  appointment_id: string
  horse_id: string
}

function toDateInputValue(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTimeInputValue(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function minutesToDurationLabel(minutes: number | null) {
  switch (minutes) {
    case 30:
      return '30 Minuten'
    case 45:
      return '45 Minuten'
    case 60:
      return '60 Minuten'
    case 90:
      return '90 Minuten'
    case 120:
      return '120 Minuten'
    default:
      return '45 Minuten'
  }
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

export default async function EditAppointmentPage({
  params,
}: EditAppointmentPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, customer_id, appointment_date, notes, type, status, duration_minutes')
    .eq('id', id)
    .eq('user_id', user.id)
    .single<AppointmentRow>()

  if (appointmentError || !appointment) {
    return (
      <main className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Fehler</h1>
          <p className="text-red-600">
            Termin konnte nicht geladen werden.
          </p>
        </div>
      </main>
    )
  }

  const { data: customersData } = await supabase
    .from('customers')
    .select(
      'id, customer_number, name, city, phone, street, postal_code, country, stable_differs, stable_name, stable_city, stable_street, stable_zip, stable_country, directions'
    )
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .returns<CustomerRow[]>()

  const { data: horsesData } = await supabase
    .from('horses')
    .select('id, name, breed, sex, birth_year, hoof_status, customer_id')
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .returns<HorseRow[]>()

  const { data: appointmentHorseRows } = await supabase
    .from('appointment_horses')
    .select('appointment_id, horse_id')
    .eq('user_id', user.id)
    .eq('appointment_id', appointment.id)
    .returns<AppointmentHorseRow[]>()

  const customers: AppointmentCustomer[] = (customersData || []).map((customer) => ({
    id: customer.id,
    customer_number: customer.customer_number,
    name: customer.name,
    city: customer.city,
    phone: customer.phone,
    street: customer.street,
    postal_code: customer.postal_code,
    country: customer.country,
    stable_differs: customer.stable_differs,
    stable_name: customer.stable_name,
    stable_city: customer.stable_city,
    stable_street: customer.stable_street,
    stable_zip: customer.stable_zip,
    stable_country: customer.stable_country,
    directions: customer.directions,
  }))

  const horses: AppointmentHorse[] = (horsesData || []).map((horse) => ({
    id: horse.id,
    name: horse.name,
    breed: horse.breed,
    sex: horse.sex,
    birth_year: horse.birth_year,
    hoof_status: horse.hoof_status,
    customer_id: horse.customer_id,
  }))

  const selectedHorseIds = (appointmentHorseRows || []).map((row) => row.horse_id)

  const appointmentDateValue = toDateInputValue(appointment.appointment_date)

  const dayStart = `${appointmentDateValue}T00:00:00`
  const dayEnd = `${appointmentDateValue}T23:59:59`

  const { data: appointmentRows } = await supabase
    .from('appointments')
    .select('id, appointment_date, customer_id, type')
    .eq('user_id', user.id)
    .gte('appointment_date', dayStart)
    .lte('appointment_date', dayEnd)
    .order('appointment_date', { ascending: true })
    .returns<
      Array<{
        id: string
        appointment_date: string | null
        customer_id: string | null
        type: string | null
      }>
    >()

  const appointmentIds = (appointmentRows || []).map((item) => item.id)

  let dayItems: AppointmentDayItem[] = []

  if (appointmentIds.length > 0) {
    const { data: dayLinks } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id')
      .eq('user_id', user.id)
      .in('appointment_id', appointmentIds)
      .returns<AppointmentHorseRow[]>()

    const horsesById = new Map(horses.map((horse) => [horse.id, horse]))
    const customersById = new Map(customers.map((customer) => [customer.id, customer]))

    const horseNamesByAppointment = new Map<string, string[]>()

    for (const link of dayLinks || []) {
      const horse = horsesById.get(link.horse_id)
      if (!horse?.name) continue

      const existing = horseNamesByAppointment.get(link.appointment_id) || []
      horseNamesByAppointment.set(link.appointment_id, [...existing, horse.name])
    }

    dayItems = (appointmentRows || []).map((item) => ({
      id: item.id,
      time: formatTime(item.appointment_date),
      customerName:
        customersById.get(item.customer_id || '')?.name || 'Unbekannter Kunde',
      horseNames: horseNamesByAppointment.get(item.id) || [],
      typeLabel: item.type || null,
    }))
  }

  const initialData: AppointmentFormInitialData = {
    appointmentId: appointment.id,
    customerId: appointment.customer_id || '',
    selectedHorseIds,
    appointmentType: appointment.type || 'Regeltermin',
    appointmentDate: toDateInputValue(appointment.appointment_date),
    appointmentTime: toTimeInputValue(appointment.appointment_date),
    duration: minutesToDurationLabel(appointment.duration_minutes),
    notes: appointment.notes || '',
    status: appointment.status || 'Bestätigt',
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#154226] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/calendar" className="text-[#154226] hover:underline">
          Termine
        </Link>
        <span>›</span>
        <span>Termin bearbeiten</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Termin bearbeiten
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Bestehenden Termin anpassen
        </p>
      </div>

      <AppointmentForm
        mode="edit"
        customers={customers}
        horses={horses}
        initialData={initialData}
        dayItems={dayItems}
      />
    </main>
  )
}