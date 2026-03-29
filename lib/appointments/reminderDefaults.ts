/**
 * Einstellungsbasierte Defaults für Termin-Erinnerungen (kein Versand).
 */

export type ReminderSettingsSlice = {
  emailReminders?: boolean
  appointmentReminderDefaultMinutes?: number | null
}

/**
 * Standard-Vorlauf für neue Termine aus user_settings.
 * - emailReminders === false → keine Erinnerung
 * - appointmentReminderDefaultMinutes explizit null → keine Voreinstellung
 * - Key fehlt → 1440 (24 h) als sinnvoller Default
 */
export function getDefaultReminderMinutesFromSettings(
  settings: ReminderSettingsSlice
): number | null {
  if (settings.emailReminders === false) return null
  if (Object.prototype.hasOwnProperty.call(settings, 'appointmentReminderDefaultMinutes')) {
    const v = settings.appointmentReminderDefaultMinutes
    if (v == null) return null
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v)
  }
  return 1440
}
