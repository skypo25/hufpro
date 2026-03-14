export function formatGermanDate(dateString: string | null) {
  if (!dateString) return '-'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatShortGermanDate(dateString: string | null) {
  if (!dateString) return '-'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

export function formatGermanDateTime(dateString: string | null) {
  if (!dateString) return '-'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getAgeFromBirthYear(birthYear: number | null) {
  if (!birthYear) return null

  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear

  if (age < 0 || age > 60) return null

  return age
}

export function getInitials(name: string | null) {
  if (!name) return 'NA'

  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''

  return `${first}${second}`.toUpperCase() || 'NA'
}

export function joinMeta(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' · ')
}

/** Kundennummer anzeigen, z. B. K-0001. Optional Präfix aus Einstellungen (z. B. "KU-"). */
export function formatCustomerNumber(
  customerNumber: number | null | undefined,
  prefix: string = 'K-'
): string {
  if (customerNumber == null) return '–'
  const p = (prefix ?? 'K-').trim() || 'K-'
  return `${p}${String(customerNumber).padStart(4, '0')}`
}