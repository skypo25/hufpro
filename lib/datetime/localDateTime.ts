import { APPOINTMENT_DISPLAY_TIMEZONE } from '@/lib/appointments/appointmentDisplay'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Convert a local date+time (from <input type="date/time">) into a UTC ISO string
 * suitable for storing in a timestamptz column.
 * Interpretiert als Browser-Lokalzeit (Nutzer in DE ≈ Europe/Berlin).
 */
export function localDateTimeToUtcIso(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`)
  return local.toISOString()
}

export function localDateToUtcIsoStartOfDay(date: string): string {
  const local = new Date(`${date}T00:00:00`)
  return local.toISOString()
}

/** YYYY-MM-DD in Europe/Berlin — SSR (UTC) und Client (Browser) konsistent. */
export function isoToLocalDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APPOINTMENT_DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** HH:MM in Europe/Berlin — SSR (UTC) und Client (Browser) konsistent. */
export function isoToLocalTimeInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APPOINTMENT_DISPLAY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  // en-GB kann "24" für Mitternacht liefern → normalisieren
  const h = hour === '24' ? '00' : hour
  return `${pad2(Number(h))}:${pad2(Number(minute))}`
}
