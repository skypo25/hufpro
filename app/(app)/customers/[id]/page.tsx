import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import ActionButton from '@/components/ui/ActionButton'

type CustomerPageProps = {
  params: Promise<{
    id: string
  }>
}

type Customer = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
  stable_name?: string | null
  stable_city?: string | null
  salutation?: string | null
  created_at?: string | null
}

function getCustomerLabel(salutation: string | null | undefined): string {
  return salutation === 'Frau' ? 'Kundin' : 'Kunde'
}

type Horse = {
  id: string
  name: string | null
  breed?: string | null
  sex?: string | null
  birth_year?: number | null
  usage?: string | null
  customer_id: string | null
}

type Appointment = {
  id: string
  customer_id: string | null
  appointment_date: string | null
  type?: string | null
  status?: string | null
  notes?: string | null
}

type AppointmentHorse = {
  appointment_id: string
  horse_id: string
}

function getInitials(name: string | null) {
  if (!name) return 'KU'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return `${first}${second}`.toUpperCase() || 'KU'
}

function formatGermanDate(dateString: string | null) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatLongGermanDate(dateString: string | null) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
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

function formatMonthShort(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
  }).format(date)
}

function formatYearMonth(dateString?: string | null) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getAgeFromBirthYear(birthYear?: number | null) {
  if (!birthYear) return null
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  return age >= 0 ? age : null
}

function getHorseMeta(horse: Horse) {
  const age = getAgeFromBirthYear(horse.birth_year)
  const parts = [horse.breed, horse.sex, age ? `${age} Jahre` : null, horse.usage]
  return parts.filter(Boolean).join(' · ') || '-'
}

function getStatusClass(status?: string | null) {
  const value = (status || '').toLowerCase()

  if (value.includes('bestätigt')) return 'bg-[#DCFCE7] text-[#166534]'
  if (value.includes('warteliste') || value.includes('vorgeschlagen')) {
    return 'bg-[#FEF3C7] text-[#92400E]'
  }

  return 'bg-[#edf3ef] text-[#0f301b]'
}

export default async function CustomerDetailPage({
  params,
}: CustomerPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone, email, city, stable_name, stable_city, salutation, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single<Customer>()

  if (customerError || !customer) {
    return (
      <main className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Fehler</h1>
          <p className="text-red-600">Kunde konnte nicht geladen werden.</p>
        </div>
      </main>
    )
  }

  const { data: horsesData } = await supabase
    .from('horses')
    .select('id, name, breed, sex, birth_year, usage, customer_id')
    .eq('user_id', user.id)
    .eq('customer_id', customer.id)
    .order('name', { ascending: true })
    .returns<Horse[]>()

  const horses = horsesData || []

  const { data: appointmentsData } = await supabase
    .from('appointments')
    .select('id, customer_id, appointment_date, type, status, notes')
    .eq('user_id', user.id)
    .eq('customer_id', customer.id)
    .order('appointment_date', { ascending: false })
    .returns<Appointment[]>()

  const appointments = appointmentsData || []
  const appointmentIds = appointments.map((appointment) => appointment.id)

  let appointmentHorseRows: AppointmentHorse[] = []

  if (appointmentIds.length > 0) {
    const { data: linkData } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id')
      .eq('user_id', user.id)
      .in('appointment_id', appointmentIds)
      .returns<AppointmentHorse[]>()

    appointmentHorseRows = linkData || []
  }

  const horseNamesById = new Map(horses.map((horse) => [horse.id, horse.name || '-']))

  const horseNamesByAppointment = new Map<string, string[]>()
  for (const row of appointmentHorseRows) {
    const horseName = horseNamesById.get(row.horse_id)
    if (!horseName) continue
    const existing = horseNamesByAppointment.get(row.appointment_id) || []
    horseNamesByAppointment.set(row.appointment_id, [...existing, horseName])
  }

  const firstHorseIdByAppointment = new Map<string, string>()
  for (const row of appointmentHorseRows) {
    if (!firstHorseIdByAppointment.has(row.appointment_id)) {
      firstHorseIdByAppointment.set(row.appointment_id, row.horse_id)
    }
  }

  const now = new Date()

  const futureAppointments = [...appointments]
    .filter((appointment) => {
      if (!appointment.appointment_date) return false
      const date = new Date(appointment.appointment_date)
      return !Number.isNaN(date.getTime()) && date >= now
    })
    .sort(
      (a, b) =>
        new Date(a.appointment_date || '').getTime() -
        new Date(b.appointment_date || '').getTime()
    )

  const pastAppointments = [...appointments]
    .filter((appointment) => {
      if (!appointment.appointment_date) return false
      const date = new Date(appointment.appointment_date)
      return !Number.isNaN(date.getTime()) && date < now
    })
    .sort(
      (a, b) =>
        new Date(b.appointment_date || '').getTime() -
        new Date(a.appointment_date || '').getTime()
    )
    .slice(0, 4)

  const nextAppointment = futureAppointments[0] || null

  const nextAppointmentByHorse = new Map<string, string>()
  for (const appointment of futureAppointments) {
    const horseIdsForAppointment = appointmentHorseRows
      .filter((row) => row.appointment_id === appointment.id)
      .map((row) => row.horse_id)

    for (const horseId of horseIdsForAppointment) {
      if (!nextAppointmentByHorse.has(horseId) && appointment.appointment_date) {
        nextAppointmentByHorse.set(horseId, appointment.appointment_date)
      }
    }
  }

  const upcomingHorseNames = nextAppointment?.id
    ? horseNamesByAppointment.get(nextAppointment.id) || []
    : []

  const upcomingDocHorseId = nextAppointment?.id
    ? firstHorseIdByAppointment.get(nextAppointment.id)
    : null

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#154226] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/customers" className="text-[#154226] hover:underline">
          Kunden
        </Link>
        <span>›</span>
        <span>{customer.name || getCustomerLabel(customer.salutation)}</span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#154226] font-serif text-[24px] font-bold text-white">
            {getInitials(customer.name)}
          </div>

          <div>
            <h1 className="dashboard-serif text-[26px] font-medium tracking-[-0.02em] text-[#1B1F23]">
              {customer.name || getCustomerLabel(customer.salutation)}
            </h1>

            <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5">
                <i className="bi bi-geo-alt text-[14px]" />
                {customer.city || customer.stable_city || '-'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="fa-solid fa-horse text-[13px]" />
                {horses.length} {horses.length === 1 ? 'Pferd' : 'Pferde'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="bi bi-calendar3 text-[13px]" />
                {getCustomerLabel(customer.salutation)} seit {formatYearMonth(customer.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5">
          <ActionButton
            href={`/customers/${customer.id}/edit`}
            variant="outline"
            icon={<i className="bi bi-pencil-square text-[14px]" />}
          >
            Bearbeiten
          </ActionButton>

          <ActionButton
            href={`/appointments/new?customerId=${customer.id}`}
            variant="primary"
            icon={<i className="bi bi-calendar-plus text-[14px]" />}
          >
            Termin anlegen
          </ActionButton>
        </div>
      </div>

      <div className="flex gap-0 border-b-2 border-[#E5E2DC]">
        <Link
          href={`/customers/${customer.id}`}
          className="border-b-2 border-[#154226] px-5 py-3 text-[14px] font-medium text-[#154226]"
        >
          Übersicht
        </Link>
        <span className="px-5 py-3 text-[14px] font-medium text-[#6B7280]">
          Termine
        </span>
        <span className="px-5 py-3 text-[14px] font-medium text-[#6B7280]">
          Dokumentation
        </span>
        <Link
          href={`/customers/${customer.id}/invoices`}
          className="border-b-2 border-transparent px-5 py-3 text-[14px] font-medium text-[#6B7280] hover:text-[#1B1F23]"
        >
          Rechnungen
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-7">
          <div className="huf-card">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">
                Kontaktdaten
              </h3>
              <Link
                href={`/customers/${customer.id}/edit`}
                className="text-[13px] font-medium text-[#154226] hover:underline"
              >
                Bearbeiten
              </Link>
            </div>

            <div className="grid gap-5 p-[22px] md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Telefon
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="text-[#154226] hover:underline">
                      {customer.phone}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  E-Mail
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {customer.email ? (
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-[#154226] hover:underline"
                    >
                      {customer.email}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Ort
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {customer.city || '-'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Stallort
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {customer.stable_name
                    ? `${customer.stable_name}${customer.stable_city ? `, ${customer.stable_city}` : ''}`
                    : customer.stable_city || '-'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Anfahrtszeit
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">-</div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Bevorzugte Tage
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">-</div>
              </div>
            </div>
          </div>

          <div className="huf-card">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">
                Pferde ({horses.length})
              </h3>
              <Link
                href={`/horses/new?customerId=${customer.id}`}
                className="text-[13px] font-medium text-[#154226] hover:underline"
              >
                + Pferd hinzufügen
              </Link>
            </div>

            <div>
              {horses.length === 0 ? (
                <div className="px-6 py-10 text-center text-[13px] text-[#6B7280]">
                  Noch keine Pferde angelegt.
                </div>
              ) : (
                horses.map((horse, index) => {
                  const nextDate = nextAppointmentByHorse.get(horse.id) || null

                  return (
                    <Link
                      key={horse.id}
                      href={`/horses/${horse.id}`}
                      className="flex items-center gap-4 border-b border-[#E5E2DC] px-[22px] py-4 transition hover:bg-[rgba(21,66,38,0.03)] last:border-b-0"
                    >
                      <div className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-[10px] bg-[#edf3ef]">
                        <svg width="14" height="14" viewBox="0 0 576 512" fill="currentColor" className="shrink-0 text-[#154226]" aria-hidden>
                          <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-[#1B1F23]">
                          {horse.name || '-'}
                        </div>
                        <div className="truncate text-[12px] text-[#6B7280]">
                          {getHorseMeta(horse)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-[#9CA3AF]">Nächster Termin</div>
                        <div className="text-[13px] font-medium text-[#154226]">
                          {nextDate ? formatGermanDate(nextDate) : '-'}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          <div className="huf-card">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">
                Vergangene Termine
              </h3>
              <Link
                href={`/calendar?customerId=${customer.id}`}
                className="text-[13px] font-medium text-[#154226] hover:underline"
              >
                Alle anzeigen
              </Link>
            </div>

            <div>
              {pastAppointments.length === 0 ? (
                <div className="px-6 py-16 text-center text-[13px] text-[#6B7280]">
                  Noch keine vergangenen Termine vorhanden.
                </div>
              ) : (
                pastAppointments.map((appointment) => {
                  const horseNames = horseNamesByAppointment.get(appointment.id) || []
                  const date = appointment.appointment_date
                  const day = date ? new Date(date).getDate() : '--'
                  const month = formatMonthShort(date)

                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-4 border-b border-[#E5E2DC] px-[22px] py-[14px] last:border-b-0"
                    >
                      <div className="min-w-[48px] text-center">
                        <div className="font-serif text-[18px] font-medium text-[#1B1F23]">
                          {String(day).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">
                          {month}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[#1B1F23]">
                          {appointment.type || 'Termin'}
                          {horseNames.length > 0 ? ` – ${horseNames.join(', ')}` : ''}
                        </div>
                        <div className="truncate text-[12px] text-[#6B7280]">
                          {appointment.notes || `${horseNames.length} Pferde bearbeitet`}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${getStatusClass(
                          appointment.status || 'Erledigt'
                        )}`}
                      >
                        {appointment.status || 'Erledigt'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-7">
          <div className="huf-card huf-card--accent-left">
            <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">
                Nächster Termin
              </h3>
            </div>

            <div className="p-[22px]">
              {nextAppointment ? (
                <>
                  <div className="mb-1 font-serif text-[22px] font-medium text-[#154226]">
                    {formatLongGermanDate(nextAppointment.appointment_date)}
                  </div>

                  <div className="mb-3 text-[14px] text-[#1B1F23]">
                    {formatTime(nextAppointment.appointment_date)} Uhr
                    {nextAppointment.type ? ` · ${nextAppointment.type}` : ''}
                  </div>

                  <div className="text-[13px] leading-6 text-[#6B7280]">
                    {customer.stable_name || customer.stable_city || customer.city || '-'}
                    <br />
                    Pferde:{' '}
                    {upcomingHorseNames.length > 0 ? upcomingHorseNames.join(', ') : '-'}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <ActionButton
                      href={`/appointments/${nextAppointment.id}/edit`}
                      variant="outline"
                      className="flex-1"
                    >
                      Verschieben
                    </ActionButton>

                    <ActionButton
                      href={upcomingDocHorseId ? `/horses/${upcomingDocHorseId}` : '/calendar'}
                      variant="primary"
                      className="flex-1"
                    >
                      Dokumentieren
                    </ActionButton>
                  </div>
                </>
              ) : (
                <div className="text-[13px] text-[#6B7280]">
                  Aktuell ist kein kommender Termin geplant.
                </div>
              )}
            </div>
          </div>

          <div className="huf-card">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">Notizen</h3>
              <span className="text-[13px] font-medium text-[#154226]">+ Notiz</span>
            </div>

            <div className="p-[22px] text-[13px] leading-7 text-[#6B7280]">
              Noch keine Kundennotizen hinterlegt.
            </div>
          </div>

          <div className="huf-card">
            <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">Umsatz 2026</h3>
            </div>

            <div className="flex justify-between border-b border-[#E5E2DC] px-[22px] py-3 text-[14px]">
              <span>Januar</span>
              <span className="tabular-nums">-</span>
            </div>
            <div className="flex justify-between border-b border-[#E5E2DC] px-[22px] py-3 text-[14px]">
              <span>Februar</span>
              <span className="tabular-nums">-</span>
            </div>
            <div className="flex justify-between bg-[rgba(0,0,0,0.015)] px-[22px] py-3 text-[14px] font-semibold">
              <span>Gesamt 2026</span>
              <span className="tabular-nums">-</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}