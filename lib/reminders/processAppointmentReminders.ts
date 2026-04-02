import type { SupabaseClient } from '@supabase/supabase-js'
import { isAppointmentReminderDueNow } from '@/lib/appointments/reminderSchedule'
import { sendAppointmentReminderEmail } from '@/lib/reminders/appointmentReminderMail'
import {
  truncateReminderEmailError,
} from '@/lib/reminders/reminderStatus'

type SettingsRow = {
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  smtpFromEmail?: string
  smtpFromName?: string
  firstName?: string
  lastName?: string
  companyName?: string
  phone?: string
  email?: string
  profession?: unknown
  animal_focus?: unknown
  emailReminders?: boolean
}

type AppointmentRow = {
  id: string
  user_id: string
  customer_id: string | null
  appointment_date: string | null
  type: string | null
  status: string | null
  duration_minutes: number | null
  notes: string | null
  reminder_minutes_before: number | null
}

function smtpFromSettings(s: SettingsRow): {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromEmail?: string
  fromName?: string
} | null {
  const host = (s.smtpHost ?? '').toString().trim()
  const user = (s.smtpUser ?? '').toString().trim()
  const password = (s.smtpPassword ?? '').toString().trim()
  if (!host || !user || !password) return null
  return {
    host,
    port: Number(s.smtpPort) || 587,
    secure: Boolean(s.smtpSecure),
    user,
    password,
    fromEmail: (s.smtpFromEmail ?? '').toString().trim() || undefined,
    fromName:
      (s.smtpFromName ?? '').toString().trim() ||
      [s.firstName, s.lastName].filter(Boolean).join(' ') ||
      (s.companyName ?? '').toString().trim() ||
      undefined,
  }
}

export type ReminderSkipBreakdown = {
  /** Noch nicht im Erinnerungsfenster (Cron läuft stündlich) */
  notDueYet: number
  /** Termin ohne Kundenverknüpfung */
  missingCustomerId: number
  /** user_settings.emailReminders === false */
  emailRemindersDisabled: number
  /** SMTP unvollständig */
  smtpNotConfigured: number
  /** Kunde ohne E-Mail */
  noCustomerEmail: number
  /** Paralleler Lauf / bereits gesendet */
  claimRace: number
}

export type ProcessRemindersResult = {
  candidates: number
  /** Rohanzahl aus DB vor „fällig“-Filter */
  pendingInQueue: number
  claimed: number
  sent: number
  skipped: number
  skippedBreakdown: ReminderSkipBreakdown
  errors: string[]
}

/**
 * Läuft mit Service-Role-Client: findet fällige Erinnerungen, markiert Versand, sendet E-Mail.
 */
export async function processAppointmentReminders(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<ProcessRemindersResult> {
  const breakdown: ReminderSkipBreakdown = {
    notDueYet: 0,
    missingCustomerId: 0,
    emailRemindersDisabled: 0,
    smtpNotConfigured: 0,
    noCustomerEmail: 0,
    claimRace: 0,
  }

  const result: ProcessRemindersResult = {
    candidates: 0,
    pendingInQueue: 0,
    claimed: 0,
    sent: 0,
    skipped: 0,
    skippedBreakdown: breakdown,
    errors: [],
  }

  const { data: rows, error: qErr } = await supabase
    .from('appointments')
    .select(
      'id, user_id, customer_id, appointment_date, type, status, duration_minutes, notes, reminder_minutes_before'
    )
    .eq('status', 'Bestätigt')
    .not('reminder_minutes_before', 'is', null)
    .is('reminder_email_sent_at', null)
    .gt('appointment_date', now.toISOString())

  if (qErr) {
    result.errors.push(qErr.message)
    return result
  }

  const list = (rows ?? []) as AppointmentRow[]
  result.pendingInQueue = list.length

  const due = list.filter((a) => {
    if (a.reminder_minutes_before == null || !a.appointment_date) {
      return false
    }
    return isAppointmentReminderDueNow(
      a.appointment_date,
      a.reminder_minutes_before,
      now
    )
  })

  breakdown.notDueYet = list.length - due.length
  result.candidates = due.length

  const missingCust = due.filter((a) => !a.customer_id)
  breakdown.missingCustomerId = missingCust.length
  result.skipped += missingCust.length

  const dueRunnable = due.filter((a) => a.customer_id)
  const userIds = [...new Set(dueRunnable.map((a) => a.user_id))]
  const customerIds = [...new Set(dueRunnable.map((a) => a.customer_id!))]

  const { data: settingsRows } = await supabase
    .from('user_settings')
    .select('user_id, settings')
    .in('user_id', userIds)

  const settingsByUser = new Map<string, SettingsRow>()
  for (const r of settingsRows ?? []) {
    settingsByUser.set(
      r.user_id as string,
      (r.settings ?? {}) as SettingsRow
    )
  }

  const { data: customers } =
    customerIds.length > 0
      ? await supabase
          .from('customers')
          .select('id, name, first_name, last_name, email')
          .in('id', customerIds)
      : { data: [] as { id: string; name: string | null; first_name: string | null; last_name: string | null; email: string | null }[] }

  const customerById = new Map(
    (customers ?? []).map((c) => [c.id, c] as const)
  )

  for (const apt of dueRunnable) {
    const settings = settingsByUser.get(apt.user_id)
    const emailReminders = settings?.emailReminders
    if (emailReminders === false) {
      breakdown.emailRemindersDisabled += 1
      result.skipped += 1
      continue
    }

    const smtp = settings ? smtpFromSettings(settings) : null
    if (!smtp) {
      breakdown.smtpNotConfigured += 1
      result.skipped += 1
      continue
    }

    const customer = customerById.get(apt.customer_id!)
    const toEmail = (customer?.email ?? '').toString().trim()
    if (!toEmail) {
      breakdown.noCustomerEmail += 1
      result.skipped += 1
      continue
    }

    const customerName =
      customer?.name?.trim() ||
      [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
      ''
    const customerFirstName =
      (customer?.first_name ?? '').toString().trim() ||
      (customer?.name ?? '').toString().trim() ||
      ''

    const { data: claimed, error: claimErr } = await supabase
      .from('appointments')
      .update({
        reminder_email_sent_at: now.toISOString(),
        reminder_email_error: null,
      })
      .eq('id', apt.id)
      .is('reminder_email_sent_at', null)
      .select('id')
      .maybeSingle()

    if (claimErr) {
      result.errors.push(`${apt.id}: ${claimErr.message}`)
      continue
    }

    if (!claimed) {
      breakdown.claimRace += 1
      result.skipped += 1
      continue
    }

    result.claimed += 1

    const { data: links } = await supabase
      .from('appointment_horses')
      .select('horse_id')
      .eq('appointment_id', apt.id)

    const horseIds = (links ?? []).map((l) => l.horse_id).filter(Boolean)
    let horseNames: string[] = []
    if (horseIds.length > 0) {
      const { data: horses } = await supabase
        .from('horses')
        .select('name')
        .in('id', horseIds)
      horseNames = (horses ?? [])
        .map((h) => h.name?.trim())
        .filter(Boolean) as string[]
    }

    const fromName =
      smtp.fromName ||
      [settings?.firstName, settings?.lastName].filter(Boolean).join(' ') ||
      (settings?.companyName ?? '').toString().trim() ||
      'AniDocs'

    try {
      await sendAppointmentReminderEmail(smtp, {
        toEmail,
        customerName,
        customerFirstName,
        appointmentDate: apt.appointment_date,
        durationMinutes: apt.duration_minutes,
        appointmentType: apt.type,
        notes: apt.notes,
        horseNames,
        fromName,
        practitionerPhone: (settings?.phone ?? '').toString().trim() || null,
        practitionerEmail: (settings?.email ?? '').toString().trim() || null,
        profession: settings?.profession ?? null,
        animalFocus: settings?.animal_focus ?? null,
      })
      result.sent += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${apt.id}: ${msg}`)
      await supabase
        .from('appointments')
        .update({
          reminder_email_sent_at: null,
          reminder_email_error: truncateReminderEmailError(msg),
        })
        .eq('id', apt.id)
    }
  }

  result.skippedBreakdown = breakdown
  return result
}
