/**
 * Vordefinierte Vorlaufzeiten für E-Mail-Erinnerungen (Minuten bis zum Terminbeginn).
 * Erweiterbar durch weitere Einträge.
 */

export type ReminderMinutesOption = {
  minutes: number | null
  label: string
}

export const APPOINTMENT_REMINDER_MINUTES_OPTIONS: ReminderMinutesOption[] = [
  { minutes: null, label: 'Keine E-Mail-Erinnerung' },
  { minutes: 1440, label: '24 Stunden vorher' },
  { minutes: 2880, label: '48 Stunden vorher' },
  { minutes: 10080, label: '1 Woche vorher' },
]

/** Behält abweichende DB-Werte in der Auswahl (kein stiller Verlust beim Bearbeiten). */
export function reminderOptionsForSelect(
  storedMinutes: number | null | undefined
): ReminderMinutesOption[] {
  const base = APPOINTMENT_REMINDER_MINUTES_OPTIONS
  if (
    storedMinutes != null &&
    Number.isFinite(storedMinutes) &&
    !base.some((o) => o.minutes === storedMinutes)
  ) {
    return [
      base[0],
      {
        minutes: storedMinutes,
        label: `${storedMinutes} Min. (gespeichert)`,
      },
      ...base.slice(1),
    ]
  }
  return base
}

export function formValueToReminderMinutesBefore(
  value: string
): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}
