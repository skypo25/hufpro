function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Convert a local date+time (from <input type="date/time">) into a UTC ISO string
 * suitable for storing in a timestamptz column.
 */
export function localDateTimeToUtcIso(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`)
  return local.toISOString()
}

export function localDateToUtcIsoStartOfDay(date: string): string {
  const local = new Date(`${date}T00:00:00`)
  return local.toISOString()
}

export function isoToLocalDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function isoToLocalTimeInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

