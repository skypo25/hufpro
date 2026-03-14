import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { sendMail } from '@/lib/email'

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json(
      { error: 'Token fehlt.' },
      { status: 400 }
    )
  }

  let supabase
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: 'Konfiguration fehlt (SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 }
    )
  }
  const { data: appointment, error: appErr } = await supabase
    .from('appointments')
    .select('id, appointment_date, type, duration_minutes, notes, confirmation_token_expires_at, status')
    .eq('confirmation_token', token)
    .maybeSingle()

  if (appErr || !appointment) {
    return NextResponse.json(
      { error: 'Link ungültig oder abgelaufen.' },
      { status: 404 }
    )
  }

  const expiresAt = appointment.confirmation_token_expires_at
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return NextResponse.json(
      { error: 'Der Bestätigungs-Link ist abgelaufen.' },
      { status: 410 }
    )
  }

  if (appointment.status !== 'Vorgeschlagen') {
    return NextResponse.json(
      { error: 'Dieser Termin wurde bereits bestätigt oder geändert.' },
      { status: 400 }
    )
  }

  const { data: links } = await supabase
    .from('appointment_horses')
    .select('horse_id')
    .eq('appointment_id', appointment.id)

  const horseIds = (links ?? []).map((r) => r.horse_id).filter(Boolean)
  let horseNames: string[] = []
  if (horseIds.length > 0) {
    const { data: horses } = await supabase
      .from('horses')
      .select('name')
      .in('id', horseIds)
    horseNames = (horses ?? []).map((h) => h.name?.trim() || 'Pferd').filter(Boolean)
  }

  const duration =
    appointment.duration_minutes != null
      ? `${appointment.duration_minutes} Min.`
      : null

  return NextResponse.json({
    appointmentId: appointment.id,
    date: formatDate(appointment.appointment_date),
    time: formatTime(appointment.appointment_date),
    type: (appointment.type ?? 'Termin').toString(),
    duration,
    horseNames,
    notes: appointment.notes?.trim() || null,
  })
}

export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json(
      { error: 'Token fehlt.' },
      { status: 400 }
    )
  }

  let supabase
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: 'Konfiguration fehlt (SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 }
    )
  }

  const { data: appointment, error: appErr } = await supabase
    .from('appointments')
    .select('id, user_id, customer_id, appointment_date, type, duration_minutes, notes, confirmation_token_expires_at, status')
    .eq('confirmation_token', token)
    .maybeSingle()

  if (appErr || !appointment) {
    return NextResponse.json(
      { error: 'Link ungültig oder abgelaufen.' },
      { status: 404 }
    )
  }

  const expiresAt = appointment.confirmation_token_expires_at
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return NextResponse.json(
      { error: 'Der Bestätigungs-Link ist abgelaufen.' },
      { status: 410 }
    )
  }

  if (appointment.status !== 'Vorgeschlagen') {
    return NextResponse.json(
      { error: 'Dieser Termin wurde bereits bestätigt oder geändert.' },
      { status: 400 }
    )
  }

  const { error: updateErr } = await supabase
    .from('appointments')
    .update({
      status: 'Bestätigt',
      confirmation_token: null,
      confirmation_token_expires_at: null,
    })
    .eq('id', appointment.id)

  if (updateErr) {
    return NextResponse.json(
      { error: 'Bestätigung konnte nicht gespeichert werden.' },
      { status: 500 }
    )
  }

  const customerId = appointment.customer_id
  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, first_name, last_name, email')
      .eq('id', customerId)
      .single()

    const toEmail = (customer?.email ?? '').toString().trim()
    if (toEmail) {
      const { data: row } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', appointment.user_id)
        .maybeSingle()

      const settings = (row?.settings ?? {}) as SettingsSmtp
      const host = (settings.smtpHost ?? '').toString().trim()
      const smtpUser = (settings.smtpUser ?? '').toString().trim()
      const smtpPassword = (settings.smtpPassword ?? '').toString().trim()

      if (host && smtpUser && smtpPassword) {
        const port = Number(settings.smtpPort) || 587
        const secure = Boolean(settings.smtpSecure)
        const fromEmail =
          (settings.smtpFromEmail ?? '').toString().trim() || smtpUser
        const fromName =
          (settings.smtpFromName ?? '').toString().trim() ||
          [settings.firstName, settings.lastName].filter(Boolean).join(' ') ||
          (settings.companyName ?? 'HufPro').toString().trim()

        const customerName =
          customer?.name?.trim() ||
          [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
          'Kunde/Kundin'
        const dateStr = formatDate(appointment.appointment_date)
        const timeStr = formatTime(appointment.appointment_date)
        const typeLabel = (appointment.type ?? 'Termin').toString()
        const duration =
          appointment.duration_minutes != null
            ? `${appointment.duration_minutes} Min.`
            : ''

        const { data: links } = await supabase
          .from('appointment_horses')
          .select('horse_id')
          .eq('appointment_id', appointment.id)
        const horseIds = (links ?? []).map((r) => r.horse_id).filter(Boolean)
        let horseNames: string[] = []
        if (horseIds.length > 0) {
          const { data: horses } = await supabase
            .from('horses')
            .select('name')
            .in('id', horseIds)
          horseNames = (horses ?? []).map((h) => h.name?.trim() || 'Pferd').filter(Boolean)
        }
        const horseList = horseNames.length > 0 ? horseNames.join(', ') : '–'

        const subject = `Termin bestätigt – ${dateStr}, ${timeStr}`
        const text = [
          'Guten Tag,',
          '',
          'Sie haben Ihren Termin bestätigt. Vielen Dank.',
          '',
          `Datum: ${dateStr}`,
          `Uhrzeit: ${timeStr}`,
          `Art: ${typeLabel}`,
          duration ? `Dauer: ${duration}` : null,
          horseNames.length > 0 ? `Pferd(e): ${horseList}` : null,
          appointment.notes ? `Notizen: ${appointment.notes}` : null,
          '',
          'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
        ]
          .filter(Boolean)
          .join('\n')

        const html = [
          '<p>Guten Tag,</p>',
          '<p>Sie haben Ihren Termin bestätigt. Vielen Dank.</p>',
          '<ul>',
          `<li>Datum: ${dateStr}</li>`,
          `<li>Uhrzeit: ${timeStr}</li>`,
          `<li>Art: ${typeLabel}</li>`,
          duration ? `<li>Dauer: ${duration}</li>` : '',
          horseNames.length > 0 ? `<li>Pferd(e): ${horseList}</li>` : '',
          '</ul>',
          appointment.notes ? `<p><strong>Notizen:</strong> ${appointment.notes}</p>` : '',
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
            { to: toEmail, subject, text, html }
          )
        } catch {
          // Bestätigung ist gespeichert; E-Mail optional
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
