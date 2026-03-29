/**
 * Dauer-Logik für Termin-Create/Edit (Desktop + Mobile).
 * Einheitlich mit Kalender-Anzeige: gleiche Minuten-Optionen, gleicher Default wie resolveDurationMinutes.
 */

import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  resolveDurationMinutes,
} from './appointmentDisplay'

/** Erlaubte Dauer-Optionen in Formularen (Minuten). */
export const APPOINTMENT_DURATION_MINUTES_ALLOWED = [30, 45, 60, 90, 120] as const

export const APPOINTMENT_DURATION_CHOICES = [
  { minutes: 30, labelDesktop: '30 Minuten', labelMobile: '30 min' },
  { minutes: 45, labelDesktop: '45 Minuten', labelMobile: '45 min' },
  { minutes: 60, labelDesktop: '60 Minuten', labelMobile: '60 min' },
  { minutes: 90, labelDesktop: '90 Minuten', labelMobile: '90 min' },
  { minutes: 120, labelDesktop: '120 Minuten', labelMobile: '120 min' },
] as const

/**
 * DB- oder Rohwert auf eine erlaubte Formular-Minute snappen (nächster Wert).
 * Entspricht fachlich der Auswahl in den Dropdowns.
 */
export function normalizeDurationMinutesForForm(
  minutes: number | null | undefined
): number {
  const raw = resolveDurationMinutes(minutes)
  const allowed = APPOINTMENT_DURATION_MINUTES_ALLOWED
  if (allowed.includes(raw as (typeof allowed)[number])) return raw
  return allowed.reduce((best, m) =>
    Math.abs(m - raw) < Math.abs(best - raw) ? m : best
  )
}

/**
 * UI-Label (Desktop oder Mobile) → Minuten für Supabase-Write.
 */
export function parseDurationLabelToMinutes(label: string): number {
  const t = label.trim()
  for (const c of APPOINTMENT_DURATION_CHOICES) {
    if (c.labelDesktop === t || c.labelMobile === t) return c.minutes
  }
  return DEFAULT_APPOINTMENT_DURATION_MINUTES
}

/** Label aus Formular → normalisierte Minuten für `duration_minutes`. */
export function durationLabelToMinutesForWrite(label: string): number {
  return normalizeDurationMinutesForForm(parseDurationLabelToMinutes(label))
}

export function minutesToDurationLabelDesktop(
  minutes: number | null | undefined
): string {
  const m = normalizeDurationMinutesForForm(minutes)
  const c = APPOINTMENT_DURATION_CHOICES.find((x) => x.minutes === m)
  return c?.labelDesktop ?? '45 Minuten'
}

export function minutesToDurationLabelMobile(
  minutes: number | null | undefined
): string {
  const m = normalizeDurationMinutesForForm(minutes)
  const c = APPOINTMENT_DURATION_CHOICES.find((x) => x.minutes === m)
  return c?.labelMobile ?? '45 min'
}

/** Vorschlagsdauer ab Anzahl Pferde (wie bisher: 1→45, 2→60, 3→90, sonst 120). */
export function getSuggestedDurationMinutesByHorseCount(horseCount: number): number {
  if (horseCount <= 1) return 45
  if (horseCount === 2) return 60
  if (horseCount === 3) return 90
  return 120
}

export function getSuggestedDurationLabelDesktop(horseCount: number): string {
  return minutesToDurationLabelDesktop(
    getSuggestedDurationMinutesByHorseCount(horseCount)
  )
}

export function getSuggestedDurationLabelMobile(horseCount: number): string {
  return minutesToDurationLabelMobile(
    getSuggestedDurationMinutesByHorseCount(horseCount)
  )
}
