import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AppointmentAnimalsInline, {
  CUSTOMER_DETAIL_ANIMAL_ICON_CLASS,
} from '@/components/appointments/AppointmentAnimalsInline'
import ActionButton from '@/components/ui/ActionButton'
import { formatCustomerNumber } from '@/lib/format'
import { pickPrimaryStallHorse, stallDisplayLabel } from '@/lib/nav/horseStableAddress'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHorse, faPaw } from '@fortawesome/free-solid-svg-icons'
import {
  animalTypeIconColor,
  faIconForAnimalType,
} from '@/lib/animalTypeDisplay'
import {
  animalsNavLabel,
  animalSingularLabel,
  deriveAppProfile,
} from '@/lib/appProfile'

type CustomerPageProps = {
  params: Promise<{
    id: string
  }>
}

type Customer = {
  id: string
  customer_number?: number | null
  name: string | null
  first_name?: string | null
  last_name?: string | null
  phone: string | null
  email: string | null
  street?: string | null
  postal_code?: string | null
  city: string | null
  country?: string | null
  company?: string | null
  drive_time?: string | null
  preferred_days?: string[] | null
  notes?: string | null
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
  animal_type?: string | null
  customer_id: string | null
  stable_name?: string | null
  stable_city?: string | null
  stable_street?: string | null
  stable_zip?: string | null
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

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function formatEuro(cents: number): string {
  if (cents === 0) return '0,00 €'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
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
    .select('id, customer_number, name, first_name, last_name, phone, email, street, postal_code, city, country, company, drive_time, preferred_days, notes, salutation, created_at')
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

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const appProfile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  const animalsPlural = animalsNavLabel(appProfile.terminology)
  const animalSingular = animalSingularLabel(appProfile.terminology)
  const headerAnimalsIcon = appProfile.terminology === 'tier' ? faPaw : faHorse

  const { data: horsesData } = await supabase
    .from('horses')
    .select(
      'id, name, breed, sex, birth_year, usage, animal_type, customer_id, stable_name, stable_city, stable_street, stable_zip'
    )
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
  const horseById = new Map(horses.map((h) => [h.id, h]))
  const animalsByAppointmentId = new Map<string, { name: string; animalType: string | null }[]>()
  for (const row of appointmentHorseRows) {
    const horseName = horseNamesById.get(row.horse_id)
    if (!horseName) continue
    const existing = horseNamesByAppointment.get(row.appointment_id) || []
    horseNamesByAppointment.set(row.appointment_id, [...existing, horseName])
  }
  for (const row of appointmentHorseRows) {
    const h = horseById.get(row.horse_id)
    if (!h) continue
    const list = animalsByAppointmentId.get(row.appointment_id) ?? []
    list.push({ name: h.name || '–', animalType: h.animal_type ?? null })
    animalsByAppointmentId.set(row.appointment_id, list)
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
    .slice(0, 5)

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

  const upcomingAnimals = nextAppointment?.id
    ? (animalsByAppointmentId.get(nextAppointment.id) ?? [])
    : []

  const upcomingDocHorseId = nextAppointment?.id
    ? firstHorseIdByAppointment.get(nextAppointment.id)
    : null

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
      sumByInvoice.set(row.invoice_id, (sumByInvoice.get(row.invoice_id) ?? 0) + (row.amount_cents ?? 0))
    }
    for (const inv of revenueInvoices ?? []) {
      const month = new Date(inv.invoice_date).getMonth()
      monthlyRevenueCents[month] = (monthlyRevenueCents[month] ?? 0) + (sumByInvoice.get(inv.id) ?? 0)
    }
  }
  const totalRevenueCents = monthlyRevenueCents.reduce((a, b) => a + b, 0)

  const primaryStallHorse = pickPrimaryStallHorse(horses)
  const headerLocationLabel =
    stallDisplayLabel(primaryStallHorse ?? {}, customer.city) || customer.city || '-'
  const upcomingPrimaryHorse =
    upcomingDocHorseId ? horses.find((h) => h.id === upcomingDocHorseId) : null
  const nextAppointmentLocationLabel =
    stallDisplayLabel(upcomingPrimaryHorse ?? {}, customer.city) || customer.city || '-'

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/customers" className="text-[#52b788] hover:underline">
          Kunden
        </Link>
        <span>›</span>
        <span>{customer.name || getCustomerLabel(customer.salutation)}</span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#52b788] font-serif text-[24px] font-bold text-white">
            {getInitials(customer.name)}
          </div>

          <div>
            <h1 className="dashboard-serif text-[26px] font-medium tracking-[-0.02em] text-[#1B1F23]">
              {customer.name || getCustomerLabel(customer.salutation)}
            </h1>

            <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-[#52b788]">
                {formatCustomerNumber(customer.customer_number)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="bi bi-geo-alt text-[14px]" />
                {headerLocationLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FontAwesomeIcon
                  icon={headerAnimalsIcon}
                  className="h-[13px] w-[13px] shrink-0"
                  style={{ color: animalTypeIconColor }}
                />
                {horses.length} {horses.length === 1 ? animalSingular : animalsPlural}
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
          className="border-b-2 border-[#52b788] px-5 py-3 text-[14px] font-medium text-[#52b788]"
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
                className="text-[13px] font-medium text-[#52b788] hover:underline"
              >
                Bearbeiten
              </Link>
            </div>

            <div className="grid gap-5 p-[22px] md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Vorname & Nachname
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {[customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || '-'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Firma
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {customer.company?.trim() || '-'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Telefon
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="text-[#52b788] hover:underline">
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
                      className="text-[#52b788] hover:underline"
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
                  Straße & Hausnummer
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {customer.street?.trim() || '-'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  Ort
                </div>
                <div className="text-[14px] font-medium text-[#1B1F23]">
                  {[customer.postal_code, customer.city].filter(Boolean).join(' ') || customer.city || '-'}
                </div>
              </div>

              {customer.drive_time?.trim() ? (
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                    Entfernung (Rechnungsadresse)
                  </div>
                  <div className="text-[14px] font-medium text-[#1B1F23]">{customer.drive_time}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="huf-card">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">
                {animalsPlural} ({horses.length})
              </h3>
              <Link
                href={`/animals/new?customerId=${customer.id}`}
                className="text-[13px] font-medium text-[#52b788] hover:underline"
              >
                + {animalSingular} hinzufügen
              </Link>
            </div>

            <div>
              {horses.length === 0 ? (
                <div className="px-6 py-10 text-center text-[13px] text-[#6B7280]">
                  Noch keine {animalsPlural.toLowerCase()} angelegt.
                </div>
              ) : (
                horses.map((horse, index) => {
                  const nextDate = nextAppointmentByHorse.get(horse.id) || null

                  return (
                    <Link
                      key={horse.id}
                      href={`/animals/${horse.id}`}
                      className="flex items-center gap-4 border-b border-[#E5E2DC] px-[22px] py-4 transition hover:bg-[rgba(21,66,38,0.03)] last:border-b-0"
                    >
                      <div className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-[10px] bg-[#edf3ef] text-[#154226]">
                        <FontAwesomeIcon
                          icon={faIconForAnimalType(horse.animal_type)}
                          className="h-[8px] w-[8px] shrink-0 text-[#154226]"
                          style={{ width: 8, height: 8, maxWidth: 8, maxHeight: 8, fontSize: 8 }}
                          aria-hidden
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-[#1B1F23]">
                          {horse.name || '-'}
                        </div>
                        <div className="truncate text-[12px] text-[#6B7280]">
                          {getHorseMeta(horse)}
                          {stallDisplayLabel(horse, customer.city) ? (
                            <span className="block truncate text-[11px] text-[#9CA3AF]">
                              Standort: {stallDisplayLabel(horse, customer.city)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-[#9CA3AF]">Nächster Termin</div>
                        <div className="text-[13px] font-medium text-[#52b788]">
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
                className="text-[13px] font-medium text-[#52b788] hover:underline"
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
                  const pastAnimals = animalsByAppointmentId.get(appointment.id) ?? []
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
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[14px] font-medium text-[#1B1F23]">
                          <span className="truncate">{appointment.type || 'Termin'}</span>
                          {pastAnimals.length > 0 ? (
                            <>
                              <span className="shrink-0 text-[#9CA3AF]">·</span>
                              <AppointmentAnimalsInline
                                animals={pastAnimals}
                                inheritTextStyle
                                iconClassName={CUSTOMER_DETAIL_ANIMAL_ICON_CLASS}
                                className="min-w-0 text-[14px] font-medium"
                              />
                            </>
                          ) : null}
                        </div>
                        <div className="truncate text-[12px] text-[#6B7280]">
                          {appointment.notes ||
                            (pastAnimals.length > 0
                              ? `${pastAnimals.length} ${pastAnimals.length === 1 ? animalSingular : animalsPlural} bearbeitet`
                              : '–')}
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
                  <div className="mb-1 font-serif text-[22px] font-medium text-[#52b788]">
                    {formatLongGermanDate(nextAppointment.appointment_date)}
                  </div>

                  <div className="mb-3 text-[14px] text-[#1B1F23]">
                    {formatTime(nextAppointment.appointment_date)} Uhr
                    {nextAppointment.type ? ` · ${nextAppointment.type}` : ''}
                  </div>

                  <div className="text-[13px] leading-6 text-[#6B7280]">
                    {nextAppointmentLocationLabel}
                    <br />
                    <span className="inline-flex flex-wrap items-center gap-x-1">
                      <span>{animalsPlural}:</span>
                      {upcomingAnimals.length > 0 ? (
                        <AppointmentAnimalsInline
                          animals={upcomingAnimals}
                          inheritTextStyle
                          iconClassName={CUSTOMER_DETAIL_ANIMAL_ICON_CLASS}
                        />
                      ) : (
                        <span>–</span>
                      )}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <ActionButton
                      href={`/appointments/${nextAppointment.id}`}
                      variant="outline"
                      className="flex-1"
                    >
                      Verschieben
                    </ActionButton>

                    <ActionButton
                      href={upcomingDocHorseId ? `/animals/${upcomingDocHorseId}` : '/calendar'}
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
              <span className="text-[13px] font-medium text-[#52b788]">+ Notiz</span>
            </div>

            <div className="p-[22px] text-[13px] leading-7 text-[#6B7280] whitespace-pre-line space-y-3">
              {customer.notes?.trim() ? (
                <p>{customer.notes.trim()}</p>
              ) : null}
              {customer.preferred_days?.length ? (
                <p>
                  <span className="font-medium text-[#1B1F23]">Bevorzugte Tage: </span>
                  {customer.preferred_days.join(', ')}
                </p>
              ) : null}
              {!customer.notes?.trim() && !customer.preferred_days?.length && (
                <p>Noch keine Kundennotizen hinterlegt.</p>
              )}
            </div>
          </div>

          <div className="huf-card">
            <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">Umsatz {revenueYear}</h3>
            </div>

            {MONTH_NAMES.map((monthName, index) => ({ monthName, cents: monthlyRevenueCents[index] ?? 0 }))
              .filter(({ cents }) => cents > 0)
              .map(({ monthName, cents }) => (
                <div key={monthName} className="flex justify-between border-b border-[#E5E2DC] px-[22px] py-3 text-[14px]">
                  <span>{monthName}</span>
                  <span className="tabular-nums">{formatEuro(cents)}</span>
                </div>
              ))}
            <div className="flex justify-between bg-[rgba(0,0,0,0.015)] px-[22px] py-3 text-[14px] font-semibold">
              <span>Gesamt {revenueYear}</span>
              <span className="tabular-nums">{formatEuro(totalRevenueCents)}</span>
            </div>
            {totalRevenueCents === 0 && (
              <div className="px-[22px] py-3 text-[13px] text-[#6B7280]">
                Noch kein Umsatz in {revenueYear}.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}