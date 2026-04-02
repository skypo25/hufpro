/**
 * Gemeinsame Anzeige-Logik für Termine (Desktop-Kalender, Mobile-Kalender-API, …).
 * Endzeit immer aus appointment_date + duration_minutes, mit einheitlichem Default.
 */

/** Wenn duration_minutes in der DB fehlt oder ungültig ist (wie bisher Mobile: 60). */
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60

export function resolveDurationMinutes(
  durationMinutes: number | null | undefined
): number {
  if (
    durationMinutes == null ||
    Number.isNaN(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return DEFAULT_APPOINTMENT_DURATION_MINUTES
  }
  return Math.round(durationMinutes)
}

export function getAppointmentEndDate(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60 * 1000)
}

export type AppointmentStartEnd = {
  start: Date
  end: Date
  startIso: string
  endIso: string
  durationMinutesResolved: number
}

/**
 * Start/Ende aus einer appointments-Zeile (appointment_date + duration_minutes).
 */
export function getAppointmentStartEndFromRow(
  appointmentDate: string | null,
  durationMinutes: number | null | undefined
): AppointmentStartEnd | null {
  if (!appointmentDate) return null
  const start = new Date(appointmentDate)
  if (Number.isNaN(start.getTime())) return null
  const durationMinutesResolved = resolveDurationMinutes(durationMinutes)
  const end = getAppointmentEndDate(start, durationMinutesResolved)
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    durationMinutesResolved,
  }
}

const DE_TIME_BERLIN = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
})

/**
 * Zeitspanne „HH:MM – HH:MM Uhr“ (Start/Ende wie Kalender/Detail, inkl. Default-Dauer).
 */
export function formatAppointmentTimeRangeDe(
  appointmentDate: string | null,
  durationMinutes: number | null | undefined
): string {
  const slot = getAppointmentStartEndFromRow(appointmentDate, durationMinutes)
  if (!slot) return ''
  return `${DE_TIME_BERLIN.format(slot.start)} – ${DE_TIME_BERLIN.format(slot.end)} Uhr`
}
