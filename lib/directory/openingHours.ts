/**
 * Strukturierte Öffnungszeiten (ähnlich gängigen Maps-Profilen): Wochentage mit
 * einer oder zwei Zeitspannen pro Tag oder „geschlossen“.
 */

export const DIRECTORY_WEEKDAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const
export type DirectoryWeekdayKey = (typeof DIRECTORY_WEEKDAY_KEYS)[number]

export const DIRECTORY_WEEKDAY_LABEL_DE: Record<DirectoryWeekdayKey, string> = {
  mo: 'Montag',
  tu: 'Dienstag',
  we: 'Mittwoch',
  th: 'Donnerstag',
  fr: 'Freitag',
  sa: 'Samstag',
  su: 'Sonntag',
}

export type DirectoryOpeningPeriod = { open: string; close: string }

export type DirectoryOpeningDayJson =
  | { closed: true }
  | { closed?: false; periods: DirectoryOpeningPeriod[] }

export type DirectoryOpeningHoursJson = Partial<Record<DirectoryWeekdayKey, DirectoryOpeningDayJson>>

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseHHMMToMinutes(s: string): number | null {
  const t = s.trim()
  const m = TIME_RE.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60)
  const min = total % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export type DayHoursFormState = {
  closed: boolean
  open1: string
  close1: string
  useSecondPeriod: boolean
  open2: string
  close2: string
}

export function defaultDayHoursFormState(): DayHoursFormState {
  return {
    closed: true,
    open1: '09:00',
    close1: '18:00',
    useSecondPeriod: false,
    open2: '13:00',
    close2: '17:00',
  }
}

export function openingHoursFormStateFromJson(
  json: DirectoryOpeningHoursJson | null | undefined
): Record<DirectoryWeekdayKey, DayHoursFormState> {
  const out = {} as Record<DirectoryWeekdayKey, DayHoursFormState>
  for (const k of DIRECTORY_WEEKDAY_KEYS) {
    out[k] = defaultDayHoursFormState()
  }
  if (!json || typeof json !== 'object') return out

  for (const k of DIRECTORY_WEEKDAY_KEYS) {
    const raw = json[k]
    const base = defaultDayHoursFormState()
    if (!raw || typeof raw !== 'object') {
      out[k] = base
      continue
    }
    if ('closed' in raw && raw.closed === true) {
      out[k] = { ...base, closed: true }
      continue
    }
    const periods = 'periods' in raw && Array.isArray(raw.periods) ? raw.periods : []
    const p0 = periods[0] && typeof periods[0] === 'object' ? (periods[0] as DirectoryOpeningPeriod) : null
    const p1 = periods[1] && typeof periods[1] === 'object' ? (periods[1] as DirectoryOpeningPeriod) : null
    out[k] = {
      closed: false,
      open1: typeof p0?.open === 'string' ? p0.open : '09:00',
      close1: typeof p0?.close === 'string' ? p0.close : '18:00',
      useSecondPeriod: Boolean(p1),
      open2: typeof p1?.open === 'string' ? p1.open : '13:00',
      close2: typeof p1?.close === 'string' ? p1.close : '17:00',
    }
  }
  return out
}

export type OpeningHoursSerializeResult =
  | { ok: true; json: DirectoryOpeningHoursJson | null }
  | { ok: false; error: string }

export function openingHoursJsonFromFormState(
  state: Record<DirectoryWeekdayKey, DayHoursFormState>
): OpeningHoursSerializeResult {
  const acc: DirectoryOpeningHoursJson = {}
  for (const k of DIRECTORY_WEEKDAY_KEYS) {
    const row = state[k] ?? defaultDayHoursFormState()
    if (row.closed) {
      acc[k] = { closed: true }
      continue
    }
    const o1 = parseHHMMToMinutes(row.open1)
    const c1 = parseHHMMToMinutes(row.close1)
    if (o1 == null || c1 == null) {
      return {
        ok: false,
        error: `Bitte gültige Zeiten für ${DIRECTORY_WEEKDAY_LABEL_DE[k]} eintragen (Format HH:MM).`,
      }
    }
    if (o1 >= c1) {
      return { ok: false, error: `${DIRECTORY_WEEKDAY_LABEL_DE[k]}: „Von“ muss vor „Bis“ liegen.` }
    }
    const periods: DirectoryOpeningPeriod[] = [{ open: minutesToHHMM(o1), close: minutesToHHMM(c1) }]
    if (row.useSecondPeriod) {
      const o2 = parseHHMMToMinutes(row.open2)
      const c2 = parseHHMMToMinutes(row.close2)
      if (o2 == null || c2 == null) {
        return {
          ok: false,
          error: `Bitte die zweite Zeitspanne für ${DIRECTORY_WEEKDAY_LABEL_DE[k]} vervollständigen.`,
        }
      }
      if (o2 >= c2) {
        return { ok: false, error: `${DIRECTORY_WEEKDAY_LABEL_DE[k]}: zweite Zeitspanne ungültig.` }
      }
      if (c1 > o2) {
        return {
          ok: false,
          error: `${DIRECTORY_WEEKDAY_LABEL_DE[k]}: Die erste Zeitspanne muss vor der zweiten enden.`,
        }
      }
      periods.push({ open: minutesToHHMM(o2), close: minutesToHHMM(c2) })
    }
    acc[k] = { periods }
  }
  const hasAnyPeriod = DIRECTORY_WEEKDAY_KEYS.some((k) => {
    const v = acc[k]
    return v != null && !('closed' in v && v.closed === true)
  })
  if (!hasAnyPeriod) {
    return { ok: true, json: null }
  }
  return { ok: true, json: acc }
}

/** Server: Roh-JSON aus dem Client parsen und absichern. Liefert null wenn leer oder nur geschlossen. */
export function normalizeOpeningHoursJson(raw: unknown): DirectoryOpeningHoursJson | null {
  if (raw == null) return null
  if (typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const acc: DirectoryOpeningHoursJson = {}
  for (const k of DIRECTORY_WEEKDAY_KEYS) {
    if (!(k in o)) continue
    const day = o[k]
    if (!day || typeof day !== 'object') continue
    const d = day as Record<string, unknown>
    if (d.closed === true) {
      acc[k] = { closed: true }
      continue
    }
    const periodsRaw = d.periods
    if (!Array.isArray(periodsRaw) || periodsRaw.length === 0) continue
    const periods: DirectoryOpeningPeriod[] = []
    for (const pr of periodsRaw.slice(0, 2)) {
      if (!pr || typeof pr !== 'object') continue
      const p = pr as Record<string, unknown>
      const open = typeof p.open === 'string' ? p.open.trim() : ''
      const close = typeof p.close === 'string' ? p.close.trim() : ''
      if (!TIME_RE.test(open) || !TIME_RE.test(close)) return null
      const om = parseHHMMToMinutes(open)
      const cm = parseHHMMToMinutes(close)
      if (om == null || cm == null || om >= cm) return null
      periods.push({ open, close })
    }
    if (periods.length === 0) continue
    if (periods.length === 2) {
      const c1 = parseHHMMToMinutes(periods[0]!.close)
      const o2 = parseHHMMToMinutes(periods[1]!.open)
      if (c1 == null || o2 == null || c1 > o2) return null
    }
    acc[k] = { periods }
  }
  const hasPeriod = DIRECTORY_WEEKDAY_KEYS.some((k) => {
    const v = acc[k]
    return v != null && 'periods' in v && Array.isArray(v.periods) && v.periods.length > 0
  })
  if (!hasPeriod) return null
  return acc
}

export type OpeningHoursDisplayLine = {
  key: DirectoryWeekdayKey
  label: string
  value: string
}

/** Wochentag (mo–su) für „heute“ in Europe/Berlin (SSR/Client konsistent zur Anzeige). */
export function directoryWeekdayKeyEuropeBerlin(at: Date = new Date()): DirectoryWeekdayKey {
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
  }).format(at)
  const norm = w.replace(/\.$/, '').trim()
  const map: Record<string, DirectoryWeekdayKey> = {
    Mon: 'mo',
    Tue: 'tu',
    Wed: 'we',
    Thu: 'th',
    Fri: 'fr',
    Sat: 'sa',
    Sun: 'su',
  }
  return map[norm] ?? 'mo'
}

export function formatOpeningHoursForDisplay(
  json: DirectoryOpeningHoursJson | null | undefined
): OpeningHoursDisplayLine[] {
  if (!json || typeof json !== 'object') return []
  const lines: OpeningHoursDisplayLine[] = []
  for (const k of DIRECTORY_WEEKDAY_KEYS) {
    const d = json[k]
    if (!d) continue
    const label = DIRECTORY_WEEKDAY_LABEL_DE[k]
    if ('closed' in d && d.closed === true) {
      lines.push({ key: k, label, value: 'Geschlossen' })
      continue
    }
    if ('periods' in d && Array.isArray(d.periods) && d.periods.length > 0) {
      const parts = d.periods.map((p) => `${p.open}–${p.close}`).join(', ')
      lines.push({ key: k, label, value: parts })
    }
  }
  return lines
}

export function hasPublicOpeningHoursDisplay(
  json: DirectoryOpeningHoursJson | null | undefined,
  note: string | null | undefined
): boolean {
  const n = (note ?? '').trim()
  if (n.length > 0) return true
  const lines = formatOpeningHoursForDisplay(json)
  return lines.length > 0
}
