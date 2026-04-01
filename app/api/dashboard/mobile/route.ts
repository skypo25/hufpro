import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  CACHE_REVALIDATE_SECONDS,
  dashboardMobileTag,
} from '@/lib/cache/tags'
import { countDocumentationTotalForUser } from '@/lib/documentation/countDocumentationTotalForUser'
import {
  dashboardAnimalsBetreutLabel,
  deriveAppProfile,
} from '@/lib/appProfile'
import {
  buildBillingNavLineFromCustomer,
  buildStallNavLineFromHorse,
  pickPrimaryStallHorse,
} from '@/lib/nav/horseStableAddress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getBerlinDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatTime(dateString: string | null) {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(dateString))
}

function formatDay(dateString: string | null) {
  if (!dateString) return ''
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(dateString))
}

function formatMonthShort(dateString: string | null) {
  if (!dateString) return ''
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(dateString))
}

type CustomerRelation =
  | {
      name: string | null
      street?: string | null
      postal_code?: string | null
      city?: string | null
      country?: string | null
    }
  | {
      name: string | null
      street?: string | null
      postal_code?: string | null
      city?: string | null
      country?: string | null
    }[]
  | null

type AppointmentRow = {
  id: string
  appointment_date: string | null
  notes: string | null
  customer_id: string | null
  type: string | null
  status: string | null
  customers: CustomerRelation
}

type StallHorseRow = {
  id: string
  name: string | null
  animal_type?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  stable_name?: string | null
}

type AppointmentHorseRow = {
  appointment_id: string
  horse_id: string
  horses: StallHorseRow | StallHorseRow[] | null
}

function relationName(value: CustomerRelation): string | null {
  return Array.isArray(value) ? value[0]?.name ?? null : value?.name ?? null
}

function horseRow(value: StallHorseRow | StallHorseRow[] | null): StallHorseRow | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function buildNavAddressForAppointment(
  customerRel: CustomerRelation,
  horses: StallHorseRow[]
): string {
  const customer = Array.isArray(customerRel) ? customerRel[0] : customerRel
  const billing = customer ? buildBillingNavLineFromCustomer(customer) : null
  const stall = buildStallNavLineFromHorse(pickPrimaryStallHorse(horses) ?? {})
  return stall || billing || ''
}

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>

async function revenueForUser(supabase: SupabaseServer, userId: string) {
  const monthly = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const year = new Date().getFullYear()
  const { data: revenueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_date')
    .eq('user_id', userId)
    .in('status', ['paid', 'sent'])
    .gte('invoice_date', `${year}-01-01`)
    .lt('invoice_date', `${year + 1}-01-01`)

  const ids = (revenueInvoices ?? []).map((r) => r.id)
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents')
      .in('invoice_id', ids)
    const sumByInvoice = new Map<string, number>()
    for (const row of items ?? []) {
      sumByInvoice.set(row.invoice_id, (sumByInvoice.get(row.invoice_id) ?? 0) + (row.amount_cents ?? 0))
    }
    for (const inv of revenueInvoices ?? []) {
      const month = new Date(inv.invoice_date).getMonth()
      monthly[month] = (monthly[month] ?? 0) + (sumByInvoice.get(inv.id) ?? 0)
    }
  }

  const totalCents = monthly.reduce((a, b) => a + b, 0)
  return { monthlyCents: monthly, totalCents }
}

async function buildDashboardMobilePayload(supabase: SupabaseServer, user: { id: string }) {
  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = (settingsRow?.settings ?? {}) as Record<string, unknown>
  const userFirstName =
    typeof settings.firstName === 'string' ? settings.firstName.trim() || null : null
  const preferredNavAppRaw = settings.preferredNavApp
  const preferredNavApp =
    preferredNavAppRaw === 'apple' || preferredNavAppRaw === 'waze'
      ? preferredNavAppRaw
      : 'google'
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
    revenue,
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
    revenueForUser(supabase, user.id),
  ])

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: appointmentRows } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      notes,
      customer_id,
      type,
      status,
      customers ( name, street, postal_code, city, country )
    `)
    .eq('user_id', user.id)
    .not('appointment_date', 'is', null)
    .gte('appointment_date', yesterday.toISOString())
    .order('appointment_date', { ascending: true })
    .limit(50)
    .returns<AppointmentRow[]>()

  const appointments = appointmentRows ?? []
  const horseRowsByAppointment = new Map<string, StallHorseRow[]>()

  if (appointments.length > 0) {
    const { data: appointmentHorseRows } = await supabase
      .from('appointment_horses')
      .select(
        'appointment_id, horse_id, horses ( id, name, animal_type, stable_street, stable_zip, stable_city, stable_name )'
      )
      .eq('user_id', user.id)
      .in('appointment_id', appointments.map((a) => a.id))
      .returns<AppointmentHorseRow[]>()
    for (const row of appointmentHorseRows ?? []) {
      const h = horseRow(row.horses)
      if (!h?.name) continue
      const rows = horseRowsByAppointment.get(row.appointment_id) ?? []
      horseRowsByAppointment.set(row.appointment_id, [...rows, h])
    }
  }

  function animalsForAppointment(appointmentId: string) {
    return (horseRowsByAppointment.get(appointmentId) ?? [])
      .filter((h) => h.name)
      .map((h) => ({
        name: h.name as string,
        animalType: h.animal_type ?? null,
      }))
  }

  const todayAppointments = appointments
    .filter((a) => a.appointment_date && getBerlinDateKey(new Date(a.appointment_date)) === todayBerlinKey)
    .sort(
      (a, b) =>
        new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime()
    )
    .slice(0, 5)
    .map((a) => {
      const customerName = relationName(a.customers) || 'Kunde'
      const animals = animalsForAppointment(a.id)
      return {
        id: a.id,
        time: formatTime(a.appointment_date),
        name: customerName,
        animals,
        notes: a.notes,
        status: a.status || 'Bestätigt',
        navAddress: buildNavAddressForAppointment(
          a.customers,
          horseRowsByAppointment.get(a.id) ?? []
        ),
      }
    })

  const allMapped = appointments.map((a) => {
    const customerName = relationName(a.customers) || 'Kunde'
    return {
      id: a.id,
      appointment_date: a.appointment_date,
      customerName,
      animals: animalsForAppointment(a.id),
      notes: a.notes,
      navAddress: buildNavAddressForAppointment(
        a.customers,
        horseRowsByAppointment.get(a.id) ?? []
      ),
    }
  })

  const upcomingAppointments = allMapped
    .filter((m) => m.appointment_date && new Date(m.appointment_date).getTime() >= now.getTime())
    .sort(
      (a, b) =>
        new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime()
    )
    .slice(0, 6)
    .map((m) => ({
      id: m.id,
      day: formatDay(m.appointment_date) + '.',
      month: formatMonthShort(m.appointment_date),
      customerName: m.customerName,
      animals: m.animals,
      time: formatTime(m.appointment_date),
      notes: m.notes,
      navAddress: m.navAddress,
    }))

  const dateLabel = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(now)

  const todayCount = todayAppointments.length
  const stats = [
    {
      label: 'Kunden gesamt',
      value: String(customersCount ?? 0),
      sub: 'aktive Kunden',
      subClass: 'green' as const,
    },
    {
      label: dashboardAnimalsBetreutLabel(term),
      value: String(horsesCount ?? 0),
      sub: 'im System',
      subClass: 'neutral' as const,
    },
    {
      label: 'Termine diese Woche',
      value: String(appointmentsWeekCount ?? 0),
      sub: 'geplant',
      subClass: 'neutral' as const,
    },
    {
      label: 'Dokumentationen',
      value: String(recordsCount ?? 0),
      sub: 'erfasst',
      subClass: 'red' as const,
    },
  ]

  return {
    userFirstName,
    dateLabel,
    preferredNavApp,
    terminology: term,
    monthlyCents: revenue.monthlyCents,
    totalCents: revenue.totalCents,
    todayStrip: {
      termine: todayCount,
      pferde: horsesCount ?? 0,
      kunden: customersCount ?? 0,
    },
    stats,
    todayAppointments,
    upcomingAppointments,
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const payload = await buildDashboardMobilePayload(supabase, user)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dashboard konnte nicht geladen werden.'
    console.error('[api/dashboard/mobile]', { userId: user.id, msg })
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
