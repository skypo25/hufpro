'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import WeekCalendar from '@/components/appointments/calendar/WeekCalendar'

type Appointment = {
  id: string
  customer_id: string | null
  appointment_date: string | null
  notes: string | null
  type: string | null
  status: string | null
  customers:
    | {
        name: string | null
        stable_name?: string | null
        stable_city?: string | null
        city?: string | null
      }
    | {
        name: string | null
        stable_name?: string | null
        stable_city?: string | null
        city?: string | null
      }[]
    | null
}

type AppointmentHorse = {
  appointment_id: string
  horse_id: string
  horses:
    | {
        id: string
        name: string | null
      }
    | {
        id: string
        name: string | null
      }[]
    | null
}

type CalendarAppointment = {
  id: string
  customerId: string | null
  customerName: string
  horseLabel: string
  locationLabel: string
  type: string
  status: string
  start: string
  end: string
}

function getCustomerRelation(
  value:
    | {
        name: string | null
        stable_name?: string | null
        stable_city?: string | null
        city?: string | null
      }
    | {
        name: string | null
        stable_name?: string | null
        stable_city?: string | null
        city?: string | null
      }[]
    | null
) {
  return Array.isArray(value) ? value[0] ?? null : value
}

function getHorseName(
  value:
    | { id: string; name: string | null }
    | { id: string; name: string | null }[]
    | null
) {
  return Array.isArray(value) ? value[0]?.name ?? null : value?.name ?? null
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

function addHours(date: Date, hours: number) {
  const copy = new Date(date)
  copy.setHours(copy.getHours() + hours)
  return copy
}

function formatGermanWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)

  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()

  const startDay = weekStart.getDate()
  const endDay = weekEnd.getDate()

  const startMonth = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(weekStart)
  const endMonth = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(weekEnd)
  const year = weekEnd.getFullYear()

  if (sameMonth) {
    return `${startDay}. – ${endDay}. ${endMonth} ${year}`
  }

  return `${startDay}. ${startMonth} – ${endDay}. ${endMonth} ${year}`
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

function startOfMonth(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), 1)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function formatGermanMonth(date: Date) {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date)
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

type ViewMode = 'week' | 'month' | 'list'

function getStatusFilterCount(
  appointments: CalendarAppointment[],
  filter: 'all' | 'confirmed' | 'open' | 'firstvisit'
) {
  if (filter === 'all') return appointments.length
  if (filter === 'firstvisit') {
    return appointments.filter((item) => item.type.toLowerCase().includes('erst')).length
  }
  if (filter === 'confirmed') {
    return appointments.filter((item) => {
      const value = item.status.toLowerCase()
      return value.includes('bestätigt') || value.includes('confirmed') || value === ''
    }).length
  }
  return appointments.filter((item) => {
    const value = item.status.toLowerCase()
    return value.includes('offen') || value.includes('vorgeschlagen')
  }).length
}

export default function CalendarPage() {
  const router = useRouter()

  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()))
  const [currentMonthStart, setCurrentMonthStart] = useState(startOfMonth(new Date()))
  const [activeFilter, setActiveFilter] = useState<'all' | 'confirmed' | 'open' | 'firstvisit'>('all')

  useEffect(() => {
    async function loadAppointments() {
      setLoading(true)
      setMessage('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setMessage('Du bist nicht eingeloggt.')
        setLoading(false)
        router.push('/login')
        return
      }

      const { data: appointmentRows, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          customer_id,
          appointment_date,
          notes,
          type,
          status,
          customers (
            name,
            stable_name,
            stable_city,
            city
          )
        `)
        .eq('user_id', user.id)
        .not('appointment_date', 'is', null)
        .order('appointment_date', { ascending: true })
        .returns<Appointment[]>()

      if (appointmentsError) {
        setMessage(`Fehler beim Laden der Termine: ${appointmentsError.message}`)
        setLoading(false)
        return
      }

      const appointmentIds = (appointmentRows || []).map((appointment) => appointment.id)
      let appointmentHorses: AppointmentHorse[] = []

      if (appointmentIds.length > 0) {
        const { data, error } = await supabase
          .from('appointment_horses')
          .select(`
            appointment_id,
            horse_id,
            horses (
              id,
              name
            )
          `)
          .eq('user_id', user.id)
          .in('appointment_id', appointmentIds)
          .returns<AppointmentHorse[]>()

        if (error) {
          setMessage(`Fehler beim Laden der Pferdezuordnungen: ${error.message}`)
          setLoading(false)
          return
        }

        appointmentHorses = data || []
      }

      const horsesByAppointment = new Map<string, string[]>()

      for (const row of appointmentHorses) {
        const horseName = getHorseName(row.horses)
        if (!horseName) continue

        const existing = horsesByAppointment.get(row.appointment_id) || []
        horsesByAppointment.set(row.appointment_id, [...existing, horseName])
      }

      const mappedAppointments: CalendarAppointment[] = (appointmentRows || [])
        .filter((appointment) => appointment.appointment_date)
        .map((appointment) => {
          const customer = getCustomerRelation(appointment.customers)
          const customerName = customer?.name || 'Kunde'
          const horseNames = horsesByAppointment.get(appointment.id) || []

          let horseLabel = 'Kein Pferd zugeordnet'
          if (horseNames.length === 1) {
            horseLabel = horseNames[0]
          } else if (horseNames.length > 1) {
            horseLabel = `${horseNames.length} Pferde`
          }

          const locationLabel =
            customer?.stable_name ||
            customer?.stable_city ||
            customer?.city ||
            'Kein Ort hinterlegt'

          const start = new Date(appointment.appointment_date as string)
          const end = addHours(start, 1)

          return {
            id: appointment.id,
            customerId: appointment.customer_id,
            customerName,
            horseLabel:
              horseNames.length > 1
                ? `${horseNames.join(' + ')}`
                : horseLabel,
            locationLabel,
            type: appointment.type || 'Regeltermin',
            status: appointment.status || 'Bestätigt',
            start: start.toISOString(),
            end: end.toISOString(),
          }
        })

      setAppointments(mappedAppointments)
      setLoading(false)
    }

    void loadAppointments()
  }, [router])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      if (activeFilter === 'all') return true

      if (activeFilter === 'firstvisit') {
        return appointment.type.toLowerCase().includes('erst')
      }

      if (activeFilter === 'confirmed') {
        const value = appointment.status.toLowerCase()
        return value.includes('bestätigt') || value.includes('confirmed') || value === ''
      }

      const value = appointment.status.toLowerCase()
      return value.includes('offen') || value.includes('vorgeschlagen')
    })
  }, [appointments, activeFilter])

  const monthGridDays = useMemo(() => {
    const start = startOfWeek(currentMonthStart)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [currentMonthStart])

  const appointmentsByDayInMonth = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>()
    for (const d of monthGridDays) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayStart = new Date(d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)
      const onDay = filteredAppointments.filter((a) => {
        const start = new Date(a.start)
        return start >= dayStart && start <= dayEnd
      })
      map.set(key, onDay)
    }
    return map
  }, [monthGridDays, filteredAppointments])

  const listViewGrouped = useMemo(() => {
    const sorted = [...filteredAppointments].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )
    const groups: { dateLabel: string; date: Date; items: CalendarAppointment[] }[] = []
    let lastKey = ''
    for (const a of sorted) {
      const d = new Date(a.start)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getDate()}`
      if (key !== lastKey) {
        groups.push({
          dateLabel: new Intl.DateTimeFormat('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(d),
          date: d,
          items: [],
        })
        lastKey = key
      }
      groups[groups.length - 1].items.push(a)
    }
    return groups
  }, [filteredAppointments])

  function handleAppointmentClick(appointmentId: string, customerId: string | null) {
    if (customerId) {
      router.push(`/appointments/${appointmentId}/edit`)
      return
    }

    router.push(`/appointments/${appointmentId}/edit`)
  }

  function goToPreviousWeek() {
    setCurrentWeekStart((prev) => addDays(prev, -7))
  }

  function goToNextWeek() {
    setCurrentWeekStart((prev) => addDays(prev, 7))
  }

  function goToPreviousMonth() {
    setCurrentMonthStart((prev) => addMonths(prev, -1))
  }

  function goToNextMonth() {
    setCurrentMonthStart((prev) => addMonths(prev, 1))
  }

  function goToToday() {
    const today = new Date()
    setCurrentWeekStart(startOfWeek(today))
    setCurrentMonthStart(startOfMonth(today))
  }

  function handlePrevious() {
    if (viewMode === 'week') goToPreviousWeek()
    else if (viewMode === 'month') goToPreviousMonth()
  }

  function handleNext() {
    if (viewMode === 'week') goToNextWeek()
    else if (viewMode === 'month') goToNextMonth()
  }

  const weekLabel = formatGermanWeekRange(currentWeekStart)
  const weekNumber = getWeekNumber(currentWeekStart)
  const monthLabel = formatGermanMonth(currentMonthStart)
  const navLabel = viewMode === 'week' ? weekLabel : viewMode === 'month' ? monthLabel : 'Terminliste'
  const navSubLabel =
    viewMode === 'week' ? `KW ${weekNumber} · ${weekLabel}` : viewMode === 'month' ? monthLabel : 'Chronologische Übersicht'

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
            Termine
          </h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            {navSubLabel}
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-[18px] py-[10px] text-[14px] font-medium text-[#1B1F23] transition hover:border-[#9CA3AF]"
          >
            <i className="bi bi-download text-[14px]" />
            Exportieren
          </button>

          <button
            type="button"
            onClick={() => router.push('/appointments/new')}
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-[18px] py-[10px] text-[14px] font-medium text-white transition hover:bg-[#0f301b]"
          >
            <i className="bi bi-plus-lg text-[14px]" />
            Neuer Termin
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {viewMode !== 'list' && (
            <>
              <button
                type="button"
                onClick={handlePrevious}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E2DC] bg-white text-[#1B1F23] transition hover:border-[#154226] hover:text-[#154226]"
              >
                <i className="bi bi-chevron-left text-[14px]" />
              </button>

              <div className="min-w-[220px] text-center font-serif text-[18px] font-medium text-[#1B1F23]">
                {navLabel}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E2DC] bg-white text-[#1B1F23] transition hover:border-[#154226] hover:text-[#154226]"
              >
                <i className="bi bi-chevron-right text-[14px]" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={goToToday}
            className="rounded-md border border-[#154226] bg-transparent px-3 py-1.5 text-[14px] font-semibold text-[#154226] transition hover:bg-[#154226] hover:text-white"
          >
            Heute
          </button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={[
                'rounded-full border px-4 py-1.5 text-[14px] font-medium transition',
                activeFilter === 'all'
                  ? 'huf-btn-dark border-[#154226] bg-[#154226] text-white'
                  : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#154226] hover:text-[#154226]',
              ].join(' ')}
            >
              Alle ({getStatusFilterCount(appointments, 'all')})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('confirmed')}
              className={[
                'rounded-full border px-4 py-1.5 text-[14px] font-medium transition',
                activeFilter === 'confirmed'
                  ? 'huf-btn-dark border-[#154226] bg-[#154226] text-white'
                  : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#154226] hover:text-[#154226]',
              ].join(' ')}
            >
              Bestätigt ({getStatusFilterCount(appointments, 'confirmed')})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('open')}
              className={[
                'rounded-full border px-4 py-1.5 text-[14px] font-medium transition',
                activeFilter === 'open'
                  ? 'huf-btn-dark border-[#154226] bg-[#154226] text-white'
                  : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#154226] hover:text-[#154226]',
              ].join(' ')}
            >
              Offen ({getStatusFilterCount(appointments, 'open')})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('firstvisit')}
              className={[
                'rounded-full border px-4 py-1.5 text-[14px] font-medium transition',
                activeFilter === 'firstvisit'
                  ? 'huf-btn-dark border-[#154226] bg-[#154226] text-white'
                  : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#154226] hover:text-[#154226]',
              ].join(' ')}
            >
              Ersttermin ({getStatusFilterCount(appointments, 'firstvisit')})
            </button>
          </div>

          <div className="flex overflow-hidden rounded-lg border border-[#E5E2DC]">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={[
                'border-r border-[#E5E2DC] px-4 py-2 text-[14px] font-medium transition',
                viewMode === 'week'
                  ? 'huf-btn-dark bg-[#154226] text-white'
                  : 'bg-white text-[#6B7280] hover:bg-[#f4f5f4]',
              ].join(' ')}
            >
              Woche
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={[
                'border-r border-[#E5E2DC] px-4 py-2 text-[14px] font-medium transition',
                viewMode === 'month'
                  ? 'huf-btn-dark bg-[#154226] text-white'
                  : 'bg-white text-[#6B7280] hover:bg-[#f4f5f4]',
              ].join(' ')}
            >
              Monat
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={[
                'px-4 py-2 text-[14px] font-medium transition',
                viewMode === 'list'
                  ? 'huf-btn-dark bg-[#154226] text-white'
                  : 'bg-white text-[#6B7280] hover:bg-[#f4f5f4]',
              ].join(' ')}
            >
              Liste
            </button>
          </div>
        </div>
      </div>

      <div className="huf-card p-3">
        {loading ? (
          <p className="p-4 text-sm text-[#6B7280]">Lade Termine ...</p>
        ) : viewMode === 'week' ? (
          <WeekCalendar
            weekStart={currentWeekStart}
            appointments={filteredAppointments}
            onAppointmentClick={handleAppointmentClick}
          />
        ) : viewMode === 'month' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-7 border-b border-[#E5E2DC] text-center text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                  <div key={d} className="border-r border-[#E5E2DC] py-2 last:border-r-0">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthGridDays.map((day, i) => {
                  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                  const dayAppointments = appointmentsByDayInMonth.get(key) || []
                  const isCurrentMonth = day.getMonth() === currentMonthStart.getMonth()
                  const isToday =
                    day.getDate() === new Date().getDate() &&
                    day.getMonth() === new Date().getMonth() &&
                    day.getFullYear() === new Date().getFullYear()
                  return (
                    <div
                      key={i}
                      className={[
                        'min-h-[80px] border-b border-r border-[#E5E2DC] p-1.5 last:border-r-0',
                        !isCurrentMonth && 'bg-[#f9f9f8] text-[#9CA3AF]',
                        isToday && 'bg-[#edf3ef]',
                      ].join(' ')}
                    >
                      <div className="mb-1 text-right text-[12px] font-medium text-[#6B7280]">
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => handleAppointmentClick(a.id, a.customerId)}
                            className="w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-[#166534] transition hover:bg-[#EBF5EE]"
                          >
                            {new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(
                              new Date(a.start)
                            )}{' '}
                            {a.customerName}
                          </button>
                        ))}
                        {dayAppointments.length > 3 && (
                          <span className="block truncate px-1.5 text-[10px] text-[#9CA3AF]">
                            +{dayAppointments.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {listViewGrouped.length === 0 ? (
              <p className="p-6 text-center text-[14px] text-[#6B7280]">Keine Termine in der Liste.</p>
            ) : (
              <div className="divide-y divide-[#E5E2DC]">
                {listViewGrouped.map((group) => (
                  <div key={group.dateLabel} className="py-4">
                    <h4 className="mb-3 px-2 text-[13px] font-semibold uppercase tracking-wider text-[#6B7280]">
                      {group.dateLabel}
                    </h4>
                    <div className="space-y-2">
                      {group.items.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handleAppointmentClick(a.id, a.customerId)}
                          className="flex w-full items-center gap-4 rounded-lg border border-[#E5E2DC] px-4 py-3 text-left transition hover:border-[#154226] hover:bg-[#edf3ef]"
                        >
                          <span className="min-w-[52px] text-[13px] font-semibold tabular-nums text-[#1B1F23]">
                            {new Intl.DateTimeFormat('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(a.start))}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-medium text-[#1B1F23]">
                              {a.customerName}
                            </div>
                            <div className="text-[12px] text-[#6B7280]">
                              {a.horseLabel}
                              {a.type ? ` · ${a.type}` : ''}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}