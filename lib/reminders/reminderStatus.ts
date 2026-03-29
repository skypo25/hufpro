import { getAppointmentReminderDueAt } from '@/lib/appointments/reminderSchedule'

export type ReminderStatusTone = 'ok' | 'warn' | 'muted'

export type AppointmentReminderStatus = {
  text: string
  tone: ReminderStatusTone
}

function fmtDeDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
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
      text: `Erinnerung gesendet am ${fmtDeDateTime(p.reminderEmailSentAt)}`,
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
      text: `Erinnerung frühestens ab ${fmtDeDateTime(dueAt.toISOString())}`,
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
