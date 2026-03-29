/**
 * Reine Zeitlogik für Termin-Erinnerungen (ohne Versand).
 */

/** Zeitpunkt, ab dem die Erinnerung „fällig“ ist (UTC). */
export function getAppointmentReminderDueAt(
  appointmentDateIso: string,
  reminderMinutesBefore: number
): Date | null {
  const start = new Date(appointmentDateIso)
  if (Number.isNaN(start.getTime())) return null
  if (!Number.isFinite(reminderMinutesBefore) || reminderMinutesBefore <= 0) return null
  return new Date(start.getTime() - reminderMinutesBefore * 60 * 1000)
}

/**
 * Erinnerung soll jetzt versendet werden: fällig, Termin noch in der Zukunft, noch nicht abgelaufen.
 */
export function isAppointmentReminderDueNow(
  appointmentDateIso: string,
  reminderMinutesBefore: number,
  now: Date = new Date()
): boolean {
  const due = getAppointmentReminderDueAt(appointmentDateIso, reminderMinutesBefore)
  if (!due) return false
  const start = new Date(appointmentDateIso)
  if (Number.isNaN(start.getTime())) return false
  return now.getTime() >= due.getTime() && now.getTime() < start.getTime()
}
