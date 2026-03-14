'use client'

type WeekAppointment = {
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

type WeekCalendarProps = {
  weekStart: Date
  appointments: WeekAppointment[]
  onAppointmentClick: (appointmentId: string, customerId: string | null) => void
}

const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const defaultStartHour = 8
const minimumEndHour = 17
const hourHeight = 80

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTimeLabel(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function isAppointmentInPast(appointment: WeekAppointment) {
  return new Date(appointment.end).getTime() < Date.now()
}

function getAppointmentColor(
  type: string,
  status: string,
  isPast: boolean
) {
  if (isPast) {
    return {
      wrapper: 'bg-[#F3F4F6] border-l-[#9CA3AF] text-[#4B5563]',
      sub: 'text-[#9CA3AF]',
      hover: 'hover:opacity-90',
    }
  }

  const typeValue = (type || '').toLowerCase()
  const statusValue = (status || '').toLowerCase()

  if (typeValue.includes('erst')) {
    return {
      wrapper: 'bg-[#EDE9FE] border-l-[#7C3AED] text-[#5B21B6]',
      sub: 'text-[#6D59B3]',
      hover: 'hover:scale-[1.02] hover:shadow-md',
    }
  }

  if (
    statusValue.includes('offen') ||
    statusValue.includes('vorgeschlagen') ||
    typeValue.includes('kontroll') ||
    typeValue.includes('nachkontroll')
  ) {
    return {
      wrapper: 'bg-[#FEF9EE] border-l-[#F59E0B] text-[#92400E]',
      sub: 'text-[#A46A2C]',
      hover: 'hover:scale-[1.02] hover:shadow-md',
    }
  }

  return {
    wrapper: 'bg-[#EBF5EE] border-l-[#34A853] text-[#166534]',
    sub: 'text-[#4B7D5E]',
    hover: 'hover:scale-[1.02] hover:shadow-md',
  }
}

function getDayAppointments(dayDate: Date, appointments: WeekAppointment[]) {
  return appointments.filter((appointment) =>
    isSameDay(new Date(appointment.start), dayDate)
  )
}

function getDynamicEndHour(appointments: WeekAppointment[]) {
  if (appointments.length === 0) return minimumEndHour

  const latestHour = appointments.reduce((maxHour, appointment) => {
    const end = new Date(appointment.end)
    const hour = end.getHours()
    const minute = end.getMinutes()

    const roundedHour = minute > 0 ? hour + 1 : hour
    return Math.max(maxHour, roundedHour)
  }, minimumEndHour)

  return Math.max(latestHour, minimumEndHour)
}

function getBlockStyle(appointment: WeekAppointment) {
  const start = new Date(appointment.start)
  const end = new Date(appointment.end)

  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()

  const topMinutes = startMinutes - defaultStartHour * 60
  const durationMinutes = Math.max(endMinutes - startMinutes, 30)

  const top = (topMinutes / 60) * hourHeight
  const height = (durationMinutes / 60) * hourHeight

  return {
    top: `${top}px`,
    height: `${height}px`,
  }
}

export default function WeekCalendar({
  weekStart,
  appointments,
  onAppointmentClick,
}: WeekCalendarProps) {
  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const endHour = getDynamicEndHour(appointments)
  const hours = Array.from(
    { length: endHour - defaultStartHour + 1 },
    (_, index) => defaultStartHour + index
  )
  const gridHeight = hours.length * hourHeight

  return (
    <div className="huf-card">
      <div className="grid grid-cols-[70px_repeat(7,minmax(0,1fr))]">
        <div className="border-b-2 border-[#E5E2DC] bg-white" />

        {days.map((dayDate, index) => {
          const isToday = isSameDay(dayDate, today)

          return (
            <div
              key={index}
              className={[
                'border-b-2 border-[#E5E2DC] px-2 py-[14px] text-center',
                isToday ? 'bg-[#edf3ef]' : 'bg-[rgba(0,0,0,0.015)]',
              ].join(' ')}
            >
              <div
                className={[
                  'text-[11px] font-semibold uppercase tracking-[0.08em]',
                  isToday ? 'text-[#0f301b]' : 'text-[#6B7280]',
                ].join(' ')}
              >
                {dayNames[index]}
              </div>
              <div
                className={[
                  'mt-0.5 font-serif text-[20px] font-medium',
                  isToday ? 'text-[#154226]' : 'text-[#1B1F23]',
                ].join(' ')}
              >
                {dayDate.getDate()}
              </div>
            </div>
          )
        })}

        <div className="border-r border-[#E5E2DC]">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[80px] border-b border-black/5 px-2 py-1 text-right text-[11px] tabular-nums text-[#9CA3AF]"
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {days.map((dayDate, dayIndex) => {
          const dayAppointments = getDayAppointments(dayDate, appointments)

          return (
            <div
              key={dayIndex}
              className="relative border-r border-black/5 last:border-r-0"
              style={{ height: `${gridHeight}px` }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[80px] border-b border-black/5"
                />
              ))}

              {dayAppointments.map((appointment) => {
                const isPast = isAppointmentInPast(appointment)
                const colors = getAppointmentColor(
                  appointment.type,
                  appointment.status,
                  isPast
                )

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() =>
                      onAppointmentClick(appointment.id, appointment.customerId)
                    }
                    className={[
                      'absolute left-[3px] right-[3px] z-[2] overflow-hidden rounded-[8px] border-l-[3px] px-[10px] py-2 text-left transition',
                      colors.wrapper,
                      colors.hover,
                    ].join(' ')}
                    style={getBlockStyle(appointment)}
                  >
                    <div className="mb-0.5 text-[11px] font-semibold">
                      {formatTimeLabel(appointment.start)} – {formatTimeLabel(appointment.end)}
                    </div>
                    <div className="truncate text-[12px] font-semibold">
                      {appointment.customerName}
                    </div>
                    <div
                      className={
                        isPast
                          ? 'truncate text-[11px] font-normal text-[#6B7280]'
                          : 'truncate text-[11px] opacity-90'
                      }
                    >
                      {appointment.horseLabel}
                    </div>
                    <div className={`mt-0.5 truncate text-[10px] ${colors.sub}`}>
                      {appointment.locationLabel}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}