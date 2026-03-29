import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendMail } from '@/lib/email'
import crypto from 'crypto'
import { formatAppointmentTimeRangeDe } from '@/lib/appointments/appointmentDisplay'
import { minutesToDurationLabelDesktop } from '@/lib/appointments/appointmentDuration'

type SettingsSmtp = {
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
}

const TOKEN_EXPIRY_DAYS = 14

function formatDate(d: string | null | undefined): string {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatTime(d: string | null | undefined): string {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
  if (url) return url.startsWith('http') ? url : `https://${url}`
  // Vorübergehend für lokales Testen: localhost
  return process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://example.com'
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  let body: { appointmentId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const appointmentId = body.appointmentId?.trim()
  if (!appointmentId) {
    return NextResponse.json(
      { error: 'appointmentId fehlt.' },
      { status: 400 }
    )
  }

  const { data: appointment, error: appErr } = await supabase
    .from('appointments')
    .select('id, customer_id, appointment_date, type, status, duration_minutes, notes, confirmation_token, confirmation_token_expires_at')
    .eq('id', appointmentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (appErr || !appointment) {
    return NextResponse.json(
      { error: 'Termin nicht gefunden oder keine Berechtigung.' },
      { status: 404 }
    )
  }

  if (appointment.status !== 'Vorgeschlagen') {
    return NextResponse.json(
      { error: 'E-Mail wird nur bei Status „Vorgeschlagen“ versendet.' },
      { status: 400 }
    )
  }

  const customerId = appointment.customer_id
  if (!customerId) {
    return NextResponse.json(
      { error: 'Zum Termin ist kein Kunde zugeordnet.' },
      { status: 400 }
    )
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, email')
    .eq('id', customerId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (custErr || !customer) {
    return NextResponse.json(
      { error: 'Kunde nicht gefunden.' },
      { status: 404 }
    )
  }

  const toEmail = (customer.email ?? '').toString().trim()
  if (!toEmail) {
    return NextResponse.json(
      {
        error:
          'Beim Kunden ist keine E-Mail-Adresse hinterlegt. Bitte unter dem Kunden eine E-Mail eintragen.',
      },
      { status: 400 }
    )
  }

  let token = (appointment.confirmation_token ?? '').toString().trim()
  const expiresAt = appointment.confirmation_token_expires_at
  const now = new Date()
  const needNewToken = !token || (expiresAt && new Date(expiresAt) < now)

  if (needNewToken) {
    token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + TOKEN_EXPIRY_DAYS)
    await supabase
      .from('appointments')
      .update({
        confirmation_token: token,
        confirmation_token_expires_at: expiry.toISOString(),
      })
      .eq('id', appointmentId)
      .eq('user_id', user.id)
  }

  const { data: links } = await supabase
    .from('appointment_horses')
    .select('horse_id')
    .eq('appointment_id', appointmentId)
    .eq('user_id', user.id)

  const horseIds = (links ?? []).map((r) => r.horse_id).filter(Boolean)
  let horseNames: string[] = []
  if (horseIds.length > 0) {
    const { data: horses } = await supabase
      .from('horses')
      .select('name')
      .in('id', horseIds)
      .eq('user_id', user.id)
    horseNames = (horses ?? []).map((h) => h.name?.trim() || 'Pferd').filter(Boolean)
  }

  const { data: row } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const settings = (row?.settings ?? {}) as SettingsSmtp
  const host = (settings.smtpHost ?? '').toString().trim()
  const port = Number(settings.smtpPort) || 587
  const secure = Boolean(settings.smtpSecure)
  const smtpUser = (settings.smtpUser ?? '').toString().trim()
  const smtpPassword = (settings.smtpPassword ?? '').toString().trim()

  if (!host || !smtpUser || !smtpPassword) {
    return NextResponse.json(
      {
        error:
          'SMTP-Einstellungen unvollständig. Bitte unter Einstellungen → Benachrichtigungen Host, Benutzer und Passwort eintragen.',
      },
      { status: 400 }
    )
  }

  const fromEmail =
    (settings.smtpFromEmail ?? '').toString().trim() ||
    (user.email ?? '').toString().trim()
  const fromName =
    (settings.smtpFromName ?? '').toString().trim() ||
    [settings.firstName, settings.lastName].filter(Boolean).join(' ') ||
    (settings.companyName ?? 'AniDocs').toString().trim()

  const dateStr = formatDate(appointment.appointment_date)
  const timeStr =
    formatAppointmentTimeRangeDe(
      appointment.appointment_date,
      appointment.duration_minutes
    ) || formatTime(appointment.appointment_date)
  const typeLabel = (appointment.type ?? 'Termin').toString()
  const duration = minutesToDurationLabelDesktop(appointment.duration_minutes)
  const horseList =
    horseNames.length > 0
      ? horseNames.join(', ')
      : '–'

  const baseUrl = getBaseUrl().replace(/\/$/, '')
  const confirmUrl = `${baseUrl}/termin-bestaetigen/${token}`

  const subject = `Terminvorschlag – ${dateStr}, ${timeStr}`
  const text = [
    'Guten Tag,',
    '',
    'es wurde Ihnen ein Termin vorgeschlagen. Bitte bestätigen Sie diesen über den folgenden Link.',
    '',
    `Datum: ${dateStr}`,
    `Uhrzeit: ${timeStr}`,
    `Art: ${typeLabel}`,
    duration ? `Dauer: ${duration}` : null,
    horseNames.length > 0 ? `Pferd(e): ${horseList}` : null,
    appointment.notes ? `Notizen: ${appointment.notes}` : null,
    '',
    `Termin bestätigen: ${confirmUrl}`,
    '',
    `Der Link ist ${TOKEN_EXPIRY_DAYS} Tage gültig.`,
    '',
    'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
  ]
    .filter(Boolean)
    .join('\n')

  const html = [
    '<p>Guten Tag,</p>',
    '<p>es wurde Ihnen ein Termin vorgeschlagen. Bitte bestätigen Sie diesen über den folgenden Link.</p>',
    '<ul>',
    `<li>Datum: ${dateStr}</li>`,
    `<li>Uhrzeit: ${timeStr}</li>`,
    `<li>Art: ${typeLabel}</li>`,
    duration ? `<li>Dauer: ${duration}</li>` : '',
    horseNames.length > 0 ? `<li>Pferd(e): ${horseList}</li>` : '',
    '</ul>',
    appointment.notes ? `<p><strong>Notizen:</strong> ${appointment.notes}</p>` : '',
    `<p><a href="${confirmUrl}" style="display:inline-block;background:#52b788;color:white;padding:10px 18px;text-decoration:none;border-radius:8px;font-weight:600;">Termin bestätigen</a></p>`,
    `<p style="color:#6B7280;font-size:13px;">Oder kopieren Sie diesen Link in Ihren Browser:<br/><a href="${confirmUrl}">${confirmUrl}</a></p>`,
    `<p style="color:#6B7280;font-size:12px;">Der Link ist ${TOKEN_EXPIRY_DAYS} Tage gültig.</p>`,
    '<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>',
  ]
    .filter(Boolean)
    .join('')

  try {
    await sendMail(
      {
        host,
        port,
        secure,
        user: smtpUser,
        password: smtpPassword,
        fromEmail,
        fromName,
      },
      {
        to: toEmail,
        subject,
        text,
        html,
      }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'E-Mail-Versand fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
