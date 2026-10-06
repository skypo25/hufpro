import { getAppointmentReminderDueAt } from '@/lib/appointments/reminderSchedule'
import { formatAppointmentDateTimeDe } from '@/lib/appointments/appointmentDisplay'

export type ReminderStatusTone = 'ok' | 'warn' | 'muted'

export type AppointmentReminderStatus = {
  text: string
  tone: ReminderStatusTone
}

/**
 * Eine Zeile für Termin-Detail / Mobile-API: operative Erinnerungslage.
 */
export function getAppointmentReminderStatusLine(
  p: {
    reminderMinutesBefore: number | null | undefined
    reminderEmailSentAt: string | null | undefined
    reminderEmailError: string | null | undefined
    appointmentDate: string | null | undefined
  },
  now: Date = new Date()
): AppointmentReminderStatus | null {
  if (p.reminderMinutesBefore == null) return null

  if (p.reminderEmailSentAt) {
    return {
      text: `Erinnerung gesendet am ${formatAppointmentDateTimeDe(p.reminderEmailSentAt)}`,
      tone: 'ok',
    }
  }

  if (p.reminderEmailError?.trim()) {
    return {
      text: `Erinnerung nicht versendet: ${p.reminderEmailError.trim()}`,
      tone: 'warn',
    }
  }

  if (!p.appointmentDate) {
    return { text: 'Erinnerung eingeplant (ohne gültiges Datum)', tone: 'muted' }
  }

  const start = new Date(p.appointmentDate)
  if (Number.isNaN(start.getTime())) {
    return { text: 'Erinnerung eingeplant', tone: 'muted' }
  }

  if (now.getTime() >= start.getTime()) {
    return {
      text: 'Termin liegt in der Vergangenheit – keine automatische Erinnerung mehr',
      tone: 'muted',
    }
  }

  const dueAt = getAppointmentReminderDueAt(
    p.appointmentDate,
    p.reminderMinutesBefore
  )
  if (dueAt && now.getTime() < dueAt.getTime()) {
    return {
      text: `Erinnerung frühestens ab ${formatAppointmentDateTimeDe(dueAt.toISOString())}`,
      tone: 'muted',
    }
  }

  return {
    text: 'Erinnerung ausstehend – wird beim nächsten Cron-Lauf versucht (SMTP & Kunden-E-Mail prüfen)',
    tone: 'muted',
  }
}

export const REMINDER_EMAIL_ERROR_MAX_LEN = 500

export function truncateReminderEmailError(message: string): string {
  const t = message.trim()
  if (t.length <= REMINDER_EMAIL_ERROR_MAX_LEN) return t
  return `${t.slice(0, REMINDER_EMAIL_ERROR_MAX_LEN - 1)}…`
}
