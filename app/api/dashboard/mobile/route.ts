import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
      stable_differs?: boolean | null
      stable_street?: string | null
      stable_zip?: string | null
      stable_city?: string | null
      stable_country?: string | null
    }
  | {
      name: string | null
      street?: string | null
      postal_code?: string | null
      city?: string | null
      country?: string | null
      stable_differs?: boolean | null
      stable_street?: string | null
      stable_zip?: string | null
      stable_city?: string | null
      stable_country?: string | null
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

/** Baut eine Zeile für Straße + "PLZ Ort" (Deutschland-Standard), damit Nav-Apps die Adresse präzise finden. */
function formatAddressLine(street: string | null | undefined, zip: string | null | undefined, city: string | null | undefined): string {
  const zipCity = [zip, city].filter(Boolean).join(' ')
  const parts = [street?.trim(), zipCity].filter(Boolean) as string[]
  return parts.join(', ')
}

/** Navigationsadresse: bei abweichender Stalladresse (stable_differs) Stall nutzen, sonst Kundenadresse. Vollständige Adresse für präzise Navigation. */
function buildNavAddress(c: CustomerRelation): string {
  const one = Array.isArray(c) ? c[0] : c
  if (!one) return ''
  const useStable =
    one.stable_differs &&
    (one.stable_street?.trim() || one.stable_zip?.trim() || one.stable_city?.trim())
  if (useStable) {
    return formatAddressLine(one.stable_street, one.stable_zip, one.stable_city)
  }
  return formatAddressLine(one.street, one.postal_code, one.city)
}

type AppointmentHorseRow = {
  appointment_id: string
  horse_id: string
  horses: { id: string; name: string | null } | { id: string; name: string | null }[] | null
}

function relationName(value: CustomerRelation): string | null {
  return Array.isArray(value) ? value[0]?.name ?? null : value?.name ?? null
}

function horseName(
  value: { id: string; name: string | null } | { id: string; name: string | null }[] | null
): string | null {
  return Array.isArray(value) ? value[0]?.name ?? null : value?.name ?? null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = (settingsRow?.settings ?? {}) as { firstName?: string; preferredNavApp?: string }
  const userFirstName = settings.firstName?.trim() || null
  const preferredNavApp = (settings.preferredNavApp === 'apple' || settings.preferredNavApp === 'waze')
    ? settings.preferredNavApp
    : 'google'

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
    { count: recordsCount },
    { count: appointmentsWeekCount },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('horses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('hoof_records').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('appointment_date', startOfWeek.toISOString())
      .lt('appointment_date', endOfWeek.toISOString()),
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
      customers ( name, street, postal_code, city, country, stable_differs, stable_street, stable_zip, stable_city, stable_country )
    `)
    .eq('user_id', user.id)
    .not('appointment_date', 'is', null)
    .gte('appointment_date', yesterday.toISOString())
    .order('appointment_date', { ascending: true })
    .limit(50)
    .returns<AppointmentRow[]>()

  const appointments = appointmentRows ?? []
  let horsesByAppointment = new Map<string, string[]>()

  if (appointments.length > 0) {
    const { data: appointmentHorseRows } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id, horses ( id, name )')
      .eq('user_id', user.id)
      .in('appointment_id', appointments.map((a) => a.id))
      .returns<AppointmentHorseRow[]>()
    for (const row of appointmentHorseRows ?? []) {
      const name = horseName(row.horses)
      if (!name) continue
      const existing = horsesByAppointment.get(row.appointment_id) ?? []
      horsesByAppointment.set(row.appointment_id, [...existing, name])
    }
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
      const horseNames = horsesByAppointment.get(a.id) ?? []
      let horseLabel = 'Kein Pferd zugeordnet'
      if (horseNames.length === 1) horseLabel = horseNames[0]
      else if (horseNames.length > 1) horseLabel = `${horseNames.length} Pferde`
      return {
        id: a.id,
        time: formatTime(a.appointment_date),
        name: customerName,
        detail: horseLabel + (a.notes ? ' · ' + a.notes : ''),
        status: a.status || 'Bestätigt',
        navAddress: buildNavAddress(a.customers),
      }
    })

  const allMapped = appointments.map((a) => {
    const customerName = relationName(a.customers) || 'Kunde'
    const horseNames = horsesByAppointment.get(a.id) ?? []
    let horseLabel = 'Kein Pferd zugeordnet'
    if (horseNames.length === 1) horseLabel = horseNames[0]
    else if (horseNames.length > 1) horseLabel = `${horseNames.length} Pferde`
    return {
      id: a.id,
      appointment_date: a.appointment_date,
      customerName,
      horseLabel,
      notes: a.notes,
      navAddress: buildNavAddress(a.customers),
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
      title: `${m.customerName} · ${m.horseLabel}`,
      sub: formatTime(m.appointment_date) + (m.notes ? ' · ' + m.notes : ''),
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
      label: 'Pferde betreut',
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

  return NextResponse.json({
    userFirstName,
    dateLabel,
    preferredNavApp,
    todayStrip: {
      termine: todayCount,
      pferde: horsesCount ?? 0,
      kunden: customersCount ?? 0,
    },
    stats,
    todayAppointments,
    upcomingAppointments,
  })
}
