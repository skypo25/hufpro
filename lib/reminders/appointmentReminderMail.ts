import { sendMail, type SmtpConfig } from '@/lib/email'
import { formatAppointmentTimeRangeDe } from '@/lib/appointments/appointmentDisplay'
import { minutesToDurationLabelDesktop } from '@/lib/appointments/appointmentDuration'

export type AppointmentReminderMailContext = {
  customerName: string
  toEmail: string
  appointmentDate: string | null
  durationMinutes: number | null | undefined
  appointmentType: string | null
  notes: string | null
  horseNames: string[]
  fromName: string
}

function formatDateLong(d: string | null | undefined): string {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function buildAppointmentReminderEmail(ctx: AppointmentReminderMailContext): {
  subject: string
  text: string
  html: string
} {
  const dateStr = formatDateLong(ctx.appointmentDate)
  const timeRange =
    formatAppointmentTimeRangeDe(ctx.appointmentDate, ctx.durationMinutes) || '–'
  const durationLabel = minutesToDurationLabelDesktop(ctx.durationMinutes)
  const typeLabel = ctx.appointmentType || 'Termin'
  const horseLine =
    ctx.horseNames.length > 0 ? ctx.horseNames.join(', ') : null

  const subject = `Erinnerung: Termin am ${dateStr}`

  const text = [
    `Guten Tag${ctx.customerName ? ` ${ctx.customerName}` : ''},`,
    '',
    'dies ist eine freundliche Erinnerung an Ihren Termin.',
    '',
    `Datum: ${dateStr}`,
    `Zeit: ${timeRange}`,
    `Art: ${typeLabel}`,
    `Dauer: ${durationLabel}`,
    horseLine ? `Pferd(e): ${horseLine}` : null,
    ctx.notes?.trim() ? `Hinweis: ${ctx.notes.trim()}` : null,
    '',
    'Bei Fragen melden Sie sich gerne.',
    '',
    `Ihr Team${ctx.fromName ? ` – ${ctx.fromName}` : ''}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = [
    `<p>Guten Tag${ctx.customerName ? ` ${escapeHtml(ctx.customerName)}` : ''},</p>`,
    '<p>dies ist eine freundliche Erinnerung an Ihren Termin.</p>',
    '<ul>',
    `<li>Datum: ${escapeHtml(dateStr)}</li>`,
    `<li>Zeit: ${escapeHtml(timeRange)}</li>`,
    `<li>Art: ${escapeHtml(typeLabel)}</li>`,
    `<li>Dauer: ${escapeHtml(durationLabel)}</li>`,
    horseLine ? `<li>Pferd(e): ${escapeHtml(horseLine)}</li>` : '',
    '</ul>',
    ctx.notes?.trim()
      ? `<p><strong>Hinweis:</strong> ${escapeHtml(ctx.notes.trim())}</p>`
      : '',
    ctx.fromName
      ? `<p>Bei Fragen melden Sie sich gerne.<br/>Ihr Team – ${escapeHtml(ctx.fromName)}</p>`
      : '<p>Bei Fragen melden Sie sich gerne.</p>',
  ]
    .filter(Boolean)
    .join('')

  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendAppointmentReminderEmail(
  smtp: SmtpConfig,
  ctx: AppointmentReminderMailContext
): Promise<void> {
  const { subject, text, html } = buildAppointmentReminderEmail(ctx)
  await sendMail(smtp, {
    to: ctx.toEmail,
    subject,
    text,
    html,
  })
}
