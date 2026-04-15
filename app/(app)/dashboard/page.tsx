import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { countDocumentationTotalForUser } from '@/lib/documentation/countDocumentationTotalForUser'
import {
  dashboardAnimalsBetreutLabel,
  deriveAppProfile,
  newAnimalButtonLabel,
} from '@/lib/appProfile'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserPlus,
  faHorse,
  faPaw,
  faCalendarPlus,
} from '@fortawesome/free-solid-svg-icons'
import RevenueChart from '@/components/dashboard/RevenueChart'
import DashboardSearchBar from '@/components/dashboard/DashboardSearchBar'
import DashboardStats from '@/components/dashboard/DashboardStats'
import DashboardAnimatedSection from '@/components/dashboard/DashboardAnimatedSection'
import AppointmentAnimalsInline, {
  CALENDAR_OVERVIEW_ICON_CLASS,
} from '@/components/appointments/AppointmentAnimalsInline'

type CustomerRelation =
  | {
      name: string | null
      city?: string | null
    }
  | {
      name: string | null
      city?: string | null
    }[]
  | null

type Appointment = {
  id: string
  appointment_date: string | null
  notes: string | null
  customer_id: string | null
  type: string | null
  status: string | null
  customers: CustomerRelation
}

type AppointmentHorse = {
  appointment_id: string
  horse_id: string
  horses:
    | {
        id: string
        name: string | null
        animal_type?: string | null
      }
    | {
        id: string
        name: string | null
        animal_type?: string | null
      }[]
    | null
}

type DashboardAppointment = {
  id: string
  appointment_date: string | null
  notes: string | null
  customer_id: string | null
  type: string | null
  status: string | null
  customerName: string
  linkedAnimals: { name: string; animalType: string | null }[]
}

function relationName(
  value:
    | { name: string | null }
    | { name: string | null }[]
    | null
) {
  return Array.isArray(value) ? value[0]?.name ?? null : value?.name ?? null
}

function horseRelation(
  value:
    | { id: string; name: string | null; animal_type?: string | null }
    | { id: string; name: string | null; animal_type?: string | null }[]
    | null
) {
  return Array.isArray(value) ? value[0] ?? null : value
}

function getBerlinDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatGermanDateLong(dateString: string) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(dateString))
}

function formatGermanDateShort(dateString: string | null) {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(dateString))
}

function formatTime(dateString: string | null) {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(dateString))
}

function getGreeting(firstName?: string | null) {
  const berlinHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Berlin',
    }).format(new Date())
  )
  let greeting: string
  if (berlinHour < 12) greeting = 'Guten Morgen'
  else if (berlinHour < 18) greeting = 'Guten Tag'
  else greeting = 'Guten Abend'
  const name = (firstName ?? '').trim()
  return name ? `${greeting}, ${name}` : greeting
}

function getStatusBadgeClass(status: string | null) {
  const value = (status || '').toLowerCase()

  if (value.includes('offen') || value.includes('vorgeschlagen')) {
    return 'bg-[#FEF3C7] text-[#92400E]'
  }

  if (value.includes('warteliste')) {
    return 'bg-[#EDE9FE] text-[#5B21B6]'
  }

  return 'bg-[#DCFCE7] text-[#166534]'
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = (settingsRow?.settings ?? {}) as Record<string, unknown>
  const userFirstName = String(settings.firstName ?? '').trim() || null
  const profile = deriveAppProfile(settings.profession, settings.animal_focus)
  const term = profile.terminology

  const now = new Date()
  const todayBerlinKey = getBerlinDateKey(now)

  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  const [
    { count: customersCount },
    { count: horsesCount },
    recordsCount,
    { count: appointmentsWeekCount },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('horses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    countDocumentationTotalForUser(supabase, user.id),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('appointment_date', startOfWeek.toISOString())
      .lt('appointment_date', endOfWeek.toISOString()),
  ])

  // Wir laden alle Termine ab gestern, damit heutige Termine sicher dabei sind,
  // und filtern "heute" anschließend sauber in Europe/Berlin.
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: appointmentRows, error: appointmentsError } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      notes,
      customer_id,
      type,
      status,
      customers (
        name,
        city
      )
    `)
    .eq('user_id', user.id)
    .not('appointment_date', 'is', null)
    .gte('appointment_date', yesterday.toISOString())
    .order('appointment_date', { ascending: true })
    .limit(50)
    .returns<Appointment[]>()

  const appointments = appointmentRows || []

  let appointmentHorses: AppointmentHorse[] = []

  if (!appointmentsError && appointments.length > 0) {
    const appointmentIds = appointments.map((appointment) => appointment.id)

    const { data: appointmentHorseRows } = await supabase
      .from('appointment_horses')
      .select(`
        appointment_id,
        horse_id,
        horses (
          id,
          name,
          animal_type
        )
      `)
      .eq('user_id', user.id)
      .in('appointment_id', appointmentIds)
      .returns<AppointmentHorse[]>()

    appointmentHorses = appointmentHorseRows || []
  }

  const animalsByAppointment = new Map<string, { name: string; animalType: string | null }[]>()

  for (const row of appointmentHorses) {
    const h = horseRelation(row.horses)
    if (!h?.name) continue
    const existing = animalsByAppointment.get(row.appointment_id) || []
    animalsByAppointment.set(row.appointment_id, [
      ...existing,
      { name: h.name, animalType: h.animal_type ?? null },
    ])
  }

  const mappedAppointments: DashboardAppointment[] = appointments.map((appointment) => {
    const customerName = relationName(appointment.customers) || 'Kunde'
    const linkedAnimals = animalsByAppointment.get(appointment.id) || []

    return {
      id: appointment.id,
      appointment_date: appointment.appointment_date,
      notes: appointment.notes,
      customer_id: appointment.customer_id,
      type: appointment.type,
      status: appointment.status,
      customerName,
      linkedAnimals,
    }
  })

  const todayAppointments = mappedAppointments
    .filter((appointment) => {
      if (!appointment.appointment_date) return false
      return getBerlinDateKey(new Date(appointment.appointment_date)) === todayBerlinKey
    })
    .sort(
      (a, b) =>
        new Date(a.appointment_date || '').getTime() -
        new Date(b.appointment_date || '').getTime()
    )
    .slice(0, 5)

  const upcomingAppointments = mappedAppointments
    .filter((appointment) => {
      if (!appointment.appointment_date) return false
      return new Date(appointment.appointment_date).getTime() >= now.getTime()
    })
    .sort(
      (a, b) =>
        new Date(a.appointment_date || '').getTime() -
        new Date(b.appointment_date || '').getTime()
    )
    .slice(0, 6)

  // Umsatz 2026: Rechnungen (paid/sent) + Summe invoice_items pro Monat
  const monthlyRevenueCents: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const { data: revenueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_date')
    .eq('user_id', user.id)
    .in('status', ['paid', 'sent'])
    .gte('invoice_date', '2026-01-01')
    .lt('invoice_date', '2027-01-01')
  const revenueInvoiceIds = (revenueInvoices ?? []).map((r) => r.id)
  if (revenueInvoiceIds.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents')
      .in('invoice_id', revenueInvoiceIds)
    const sumByInvoice = new Map<string, number>()
    for (const row of items ?? []) {
      sumByInvoice.set(row.invoice_id, (sumByInvoice.get(row.invoice_id) ?? 0) + (row.amount_cents ?? 0))
    }
    for (const inv of revenueInvoices ?? []) {
      const month = new Date(inv.invoice_date).getMonth()
      monthlyRevenueCents[month] = (monthlyRevenueCents[month] ?? 0) + (sumByInvoice.get(inv.id) ?? 0)
    }
  }
  const totalRevenueCents = monthlyRevenueCents.reduce((a, b) => a + b, 0)

  const quickActions = [
    { title: 'Kunde anlegen', href: '/customers/new', icon: faUserPlus },
    { title: newAnimalButtonLabel(term), href: '/animals/new', icon: term === 'tier' ? faPaw : faHorse },
    { title: 'Termin erstellen', href: '/appointments/new', icon: faCalendarPlus },
  ]

  const stats = [
    { label: 'Kunden gesamt', value: customersCount ?? 0, badge: 'aktive Kunden', tone: 'bg-[#f4eadf]' },
    {
      label: dashboardAnimalsBetreutLabel(term),
      value: horsesCount ?? 0,
      badge: 'im System',
      tone: 'bg-[#e8f1e7]',
    },
    { label: 'Termine diese Woche', value: appointmentsWeekCount ?? 0, badge: 'geplant', tone: 'bg-[#ece9f7]' },
    { label: 'Dokumentationen', value: recordsCount ?? 0, badge: 'erfasst', tone: 'bg-[#f8efe3]' },
  ]

  return (
    <div className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23] md:text-[32px]">
            {getGreeting(userFirstName)}
          </h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            {formatGermanDateLong(now.toISOString())} — Du hast heute {todayAppointments.length} Termine
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DashboardSearchBar />

          <Link
            href="/appointments/new"
            className="huf-btn-dark inline-flex items-center justify-center gap-2 rounded-lg bg-[#52b788] px-[18px] py-[10px] text-[14px] font-medium text-white shadow-sm hover:bg-[#0f301b]"
          >
            <i className="bi bi-plus-lg text-[15px]" />
            Neuer Termin
          </Link>
        </div>
      </div>

      <DashboardAnimatedSection>
        <div className="grid gap-3 md:grid-cols-3">
          {quickActions.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="huf-card p-[18px] text-center transition hover:-translate-y-[1px] hover:border-[#52b788] hover:shadow-md"
            >
              <div className="mx-auto mb-[10px] flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#edf3ef] text-[#154226]">
                <FontAwesomeIcon
                  icon={item.icon}
                  className="!h-[18px] !w-[18px] shrink-0"
                  aria-hidden
                />
              </div>
              <div className="text-[14px] font-medium text-[#1B1F23]">{item.title}</div>
            </Link>
          ))}
        </div>
      </DashboardAnimatedSection>

      <DashboardStats stats={stats} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-7">
          <DashboardAnimatedSection delay={0}>
            <section className="huf-card">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h3 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Heutige Termine
                </h3>
                <Link href="/calendar" className="text-[13px] font-medium text-[#52b788] hover:underline">
                  Alle Termine →
                </Link>
              </div>

              <div>
                {todayAppointments.length === 0 && (
                  <div className="px-[22px] py-8 text-sm text-[#6B7280]">
                    Für heute sind keine Termine vorhanden.
                  </div>
                )}

                {todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-col gap-4 border-b border-[#E5E2DC] px-[22px] py-[14px] hover:bg-[rgba(21,66,38,0.03)] md:flex-row md:items-center"
                  >
                    <div className="min-w-[52px] text-[13px] font-semibold tabular-nums text-[#1B1F23]">
                      {formatTime(appointment.appointment_date)}
                    </div>

                    <div className="flex-1">
                      <div className="text-[14px] font-medium text-[#1B1F23]">
                        {appointment.customerName}
                      </div>
                      <div className="appt-animal-icons-8 text-[12px] text-[#6B7280]">
                        <AppointmentAnimalsInline
                          animals={appointment.linkedAnimals}
                          inheritTextStyle
                          iconClassName={CALENDAR_OVERVIEW_ICON_CLASS}
                        />
                        {appointment.notes ? ` · ${appointment.notes}` : ''}
                      </div>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${getStatusBadgeClass(
                        appointment.status
                      )}`}
                    >
                      {appointment.status || 'Bestätigt'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </DashboardAnimatedSection>

          <DashboardAnimatedSection delay={80}>
            <section className="huf-card">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h3 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Umsatz 2026
                </h3>
                <Link href="/invoices" className="text-[13px] font-medium text-[#52b788] hover:underline">
                  Details →
                </Link>
              </div>

              <RevenueChart monthlyCents={monthlyRevenueCents} totalCents={totalRevenueCents} />
            </section>
          </DashboardAnimatedSection>
        </div>

        <div className="space-y-7">
          <DashboardAnimatedSection delay={0}>
            <section className="huf-card">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h3 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Nächste Termine
                </h3>
                <Link href="/calendar" className="text-[13px] font-medium text-[#52b788] hover:underline">
                  Kalender →
                </Link>
              </div>

              <div>
                {upcomingAppointments.length === 0 && (
                  <div className="px-[22px] py-8 text-sm text-[#6B7280]">
                    Keine kommenden Termine vorhanden.
                  </div>
                )}

                {upcomingAppointments.slice(0, 4).map((appointment) => {
                  const parts = formatGermanDateShort(appointment.appointment_date).split(' ')

                  return (
                    <div key={appointment.id} className="flex gap-[14px] border-b border-[#E5E2DC] px-[22px] py-[14px]">
                      <div className="min-w-[44px] text-center">
                        <div className="dashboard-serif text-[22px] font-medium leading-none text-[#52b788]">
                          {parts[0] || ''}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-[#6B7280]">
                          {parts[1] || ''}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="appt-animal-icons-8 flex flex-wrap items-center gap-x-1 text-[14px] font-medium text-[#1B1F23]">
                          <span>{appointment.customerName}</span>
                          {appointment.linkedAnimals.length > 0 ? (
                            <>
                              <span className="text-[#9CA3AF]">·</span>
                              <AppointmentAnimalsInline
                                animals={appointment.linkedAnimals}
                                inheritTextStyle
                                iconClassName={CALENDAR_OVERVIEW_ICON_CLASS}
                              />
                            </>
                          ) : null}
                        </div>
                        <div className="text-[12px] text-[#6B7280]">
                          {formatTime(appointment.appointment_date)}
                          {appointment.notes ? ` · ${appointment.notes}` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </DashboardAnimatedSection>

          <DashboardAnimatedSection delay={80}>
            <section className="huf-card">
              <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h3 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Letzte Aktivitäten
                </h3>
              </div>

              <div className="px-[22px] py-3">
                {[
                  { dot: 'bg-[#52b788]', text: 'Neue Termine, Kunden und Pferde erscheinen hier als Nächstes.' },
                  { dot: 'bg-[#34A853]', text: 'Die Box ist vorbereitet und kann später mit echten Aktivitäten befüllt werden.' },
                  { dot: 'bg-[#6366F1]', text: 'Dashboard-Stil wurde an dein Wunschlayout angepasst.' },
                ].map((item, index) => (
                  <div key={index} className="flex gap-3 border-b border-[rgba(0,0,0,0.04)] py-3 last:border-b-0">
                    <span className={`mt-[6px] h-2 w-2 rounded-full ${item.dot}`} />
                    <div className="text-[13px] leading-[1.5] text-[#1B1F23]">
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </DashboardAnimatedSection>
        </div>
      </div>
    </div>
  )
}