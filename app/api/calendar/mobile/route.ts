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

function startOfWeek(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function getWeekNumber(date: Date) {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstDayNr = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3)
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000)
}

function formatGermanWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  const startDay = weekStart.getDate()
  const endDay = weekEnd.getDate()
  const startMonth = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(weekStart)
  const endMonth = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(weekEnd)
  const year = weekEnd.getFullYear()
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  if (sameMonth) {
    return `${startDay}. – ${endDay}. ${endMonth} ${year}`
  }
  return `${startDay}. ${startMonth} – ${endDay}. ${endMonth} ${year}`
}

type CustomerRelation =
  | { name: string | null; stable_name?: string | null; stable_city?: string | null; city?: string | null }
  | { name: string | null; stable_name?: string | null; stable_city?: string | null; city?: string | null }[]
  | null

function relationName(c: CustomerRelation) {
  const one = Array.isArray(c) ? c[0] : c
  return one?.name ?? null
}

function getStallLabel(c: CustomerRelation) {
  const one = Array.isArray(c) ? c[0] : c
  if (!one) return ''
  return one.stable_name || one.stable_city || one.city || ''
}

function horseName(
  value: { id: string; name: string | null } | { id: string; name: string | null }[] | null
) {
  const one = Array.isArray(value) ? value[0] : value
  return one?.name ?? null
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const weekStartParam = searchParams.get('weekStart')
  const now = new Date()
  const weekStart = weekStartParam
    ? startOfWeek(new Date(weekStartParam + 'T12:00:00'))
    : startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)

  const { data: appointmentRows } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      notes,
      customer_id,
      type,
      status,
      duration_minutes,
      customers (name, stable_name, stable_city, city)
    `)
    .eq('user_id', user.id)
    .gte('appointment_date', weekStart.toISOString())
    .lt('appointment_date', weekEnd.toISOString())
    .order('appointment_date', { ascending: true })

  const appointments = appointmentRows ?? []
  let horsesByAppointment = new Map<string, string[]>()

  if (appointments.length > 0) {
    const { data: horseRows } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id, horses (id, name)')
      .eq('user_id', user.id)
      .in('appointment_id', appointments.map((a) => a.id))
    for (const row of horseRows ?? []) {
      const name = horseName((row as { horses: unknown }).horses)
      if (!name) continue
      const existing = horsesByAppointment.get(row.appointment_id) ?? []
      horsesByAppointment.set(row.appointment_id, [...existing, name])
    }
  }

  const todayKey = getBerlinDateKey(now)
  const weekdayNames = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

  type MappedApt = {
    id: string
    customerName: string
    horseLabel: string
    stallLabel: string
    time: string
    endTime: string
    type: string
    status: string
    color: 'green' | 'orange' | 'blue' | 'purple' | 'gray'
    badge: 'confirmed' | 'suggested'
    isPast: boolean
  }

  const mapped: MappedApt[] = appointments
    .filter((a) => a.appointment_date)
    .map((a) => {
      const customerName = relationName(a.customers) || 'Kunde'
      const horseNames = horsesByAppointment.get(a.id) ?? []
      const horseLabel =
        horseNames.length === 0
          ? 'Kein Pferd zugeordnet'
          : horseNames.length === 1
            ? horseNames[0]
            : horseNames.join(' + ')
      const stallLabel = getStallLabel(a.customers)
      const start = new Date(a.appointment_date!)
      const duration = a.duration_minutes ?? 60
      const end = new Date(start.getTime() + duration * 60 * 1000)
      const time = formatTime(a.appointment_date)
      const endTime = formatTime(end.toISOString())
      const type = a.type || 'Regeltermin'
      const status = a.status || 'Bestätigt'
      const typeVal = type.toLowerCase()
      const statusVal = status.toLowerCase()

      // Farbe nach Terminart
      let color: MappedApt['color'] = 'green'
      if (typeVal.includes('erst')) color = 'orange'
      else if (typeVal.includes('kontroll') || typeVal.includes('nachkontroll')) color = 'blue'
      else if (typeVal.includes('sonder')) color = 'purple'

      // Badge nach Status
      const isConfirmed = statusVal.includes('bestätigt')
      const badge: MappedApt['badge'] = isConfirmed ? 'confirmed' : 'suggested'

      const isPast = end.getTime() < now.getTime()
      const displayColor = isPast ? 'gray' : color

      return {
        id: a.id,
        customerName,
        horseLabel,
        stallLabel,
        time,
        endTime,
        type,
        status,
        color: displayColor,
        badge,
        dateKey: getBerlinDateKey(start),
        isPast,
      }
    })

  const appointmentsByDay = new Map<string, MappedApt[]>()
  for (const apt of mapped) {
    const key = apt.dateKey
    const list = appointmentsByDay.get(key) ?? []
    list.push(apt)
    appointmentsByDay.set(key, list)
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    const key = getBerlinDateKey(d)
    const apts = appointmentsByDay.get(key) ?? []
    const dotColors = apts.map((a) => a.color)
    const dayNum = d.getDate()
    const dayName = weekdayNames[i]
    const isToday = key === todayKey
    return {
      dateKey: key,
      dayName,
      dayNum,
      isToday,
      dotColors,
    }
  })

  const allApts = mapped
  const filterCounts = {
    all: allApts.length,
    confirmed: allApts.filter((a) => a.badge === 'confirmed').length,
    suggested: allApts.filter((a) => a.badge === 'suggested').length,
  }

  const appointmentsByDayObj: Record<string, Omit<MappedApt, 'dateKey'>[]> = {}
  for (const [key, list] of appointmentsByDay) {
    appointmentsByDayObj[key] = list.map(({ dateKey: _, ...rest }) => rest)
  }

  return NextResponse.json({
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    weekNumber: getWeekNumber(weekStart),
    weekLabel: formatGermanWeekRange(weekStart),
    days,
    appointmentsByDay: appointmentsByDayObj,
    filterCounts,
  })
}
