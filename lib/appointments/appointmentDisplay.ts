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

export const APPOINTMENT_DISPLAY_TIMEZONE = 'Europe/Berlin'

const DE_TIME_BERLIN = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APPOINTMENT_DISPLAY_TIMEZONE,
})

const DE_LONG_DATE_BERLIN = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: APPOINTMENT_DISPLAY_TIMEZONE,
})

const DE_SHORT_MONTH_BERLIN = new Intl.DateTimeFormat('de-DE', {
  month: 'short',
  timeZone: APPOINTMENT_DISPLAY_TIMEZONE,
})

const DE_DAY_BERLIN = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  timeZone: APPOINTMENT_DISPLAY_TIMEZONE,
})

/** Einzelne Uhrzeit in Europe/Berlin (SSR und Client identisch). */
export function formatAppointmentTimeDe(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return DE_TIME_BERLIN.format(date)
}

export function formatAppointmentLongDateDe(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return DE_LONG_DATE_BERLIN.format(date)
}

export function formatAppointmentShortMonthDe(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return DE_SHORT_MONTH_BERLIN.format(date)
}

export function formatAppointmentDayDe(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return DE_DAY_BERLIN.format(date)
}

const DE_DATETIME_BERLIN = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APPOINTMENT_DISPLAY_TIMEZONE,
})

export function formatAppointmentDateTimeDe(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return DE_DATETIME_BERLIN.format(date)
}

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
