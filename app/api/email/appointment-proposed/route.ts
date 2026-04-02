import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendMail } from '@/lib/email'
import crypto from 'crypto'
import { formatAppointmentTimeRangeDe } from '@/lib/appointments/appointmentDisplay'
import { minutesToDurationLabelDesktop } from '@/lib/appointments/appointmentDuration'
import { deriveAppProfile } from '@/lib/appProfile'

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
  phone?: string
  email?: string
  profession?: unknown
  animal_focus?: unknown
}

const TOKEN_EXPIRY_DAYS = 14

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

  const { data: row } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const settings = (row?.settings ?? {}) as SettingsSmtp
  const terminology = deriveAppProfile(settings.profession, settings.animal_focus).terminology
  const animalPluralLabel = terminology === 'pferd' ? 'Pferd(e)' : 'Tier(e)'
  const animalFallbackName = terminology === 'pferd' ? 'Pferd' : 'Tier'

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
    horseNames = (horses ?? []).map((h) => h.name?.trim() || animalFallbackName).filter(Boolean)
  }
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

  const practitionerName = (fromName || 'AniDocs').toString().trim() || 'AniDocs'
  const practitionerFullName =
    [settings.firstName, settings.lastName].filter(Boolean).join(' ').trim() || practitionerName
  const companyNameLine = (settings.companyName ?? '').toString().trim()

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
    horseNames.length > 0 ? `${animalPluralLabel}: ${horseList}` : null,
    appointment.notes ? `Notizen: ${appointment.notes}` : null,
    '',
    `Termin bestätigen: ${confirmUrl}`,
    '',
    `Der Link ist ${TOKEN_EXPIRY_DAYS} Tage gültig.`,
    '',
    'Passt der Termin nicht? Melden Sie sich direkt bei mir.',
    '',
    'Viele Grüße',
    practitionerFullName,
    ...(companyNameLine ? [companyNameLine] : []),
  ]
    .filter(Boolean)
    .join('\n')

  const customerFirstName =
    (customer.first_name ?? '').toString().trim() ||
    (customer.name ?? '').toString().trim() ||
    'Hallo'
  const durationMinutes = appointment.duration_minutes != null ? String(appointment.duration_minutes) : ''
  const notes = (appointment.notes ?? '').toString().trim()
  const practitionerPhone = (settings.phone ?? '').toString().trim()
  const practitionerEmail = (settings.email ?? '').toString().trim()
  const hasPhone = Boolean(practitionerPhone)
  const hasEmail = Boolean(practitionerEmail)

  const horsesRow = horseNames.length > 0
    ? `<tr>
                              <td width="80" valign="top" style="font-size:13px;color:#9CA3AF;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(animalPluralLabel)}
                              </td>
                              <td style="font-size:13px;font-weight:600;color:#1A1A1A;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(horseList)}
                              </td>
                            </tr>`
    : ''

  const notesRow = notes
    ? `<tr>
                              <td width="80" valign="top" style="font-size:13px;color:#9CA3AF;padding-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                Hinweis
                              </td>
                              <td style="font-size:13px;color:#6B7280;padding-bottom:0;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(notes)}
                              </td>
                            </tr>`
    : ''

  const durationSuffix = durationMinutes ? ` &middot; ca. ${escapeHtml(durationMinutes)} Minuten` : ''

  const phoneRow = hasPhone
    ? `<tr>
                        <td width="70" style="font-size:13px;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Telefon
                        </td>
                        <td style="font-size:13px;color:#1A1A1A;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="tel:${escapeHtml(practitionerPhone)}" style="color:#1A1A1A;text-decoration:none;">${escapeHtml(practitionerPhone)}</a>
                        </td>
                      </tr>`
    : ''

  const emailRow = hasEmail
    ? `<tr>
                        <td width="70" style="font-size:13px;color:#9CA3AF;padding-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          E-Mail
                        </td>
                        <td style="font-size:13px;color:#1A1A1A;padding-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="mailto:${escapeHtml(practitionerEmail)}" style="color:#1A1A1A;text-decoration:none;">${escapeHtml(practitionerEmail)}</a>
                        </td>
                      </tr>`
    : ''

  const contactBox = hasPhone || hasEmail
    ? `<!-- Kontaktdaten -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f7f7f7;border-radius:10px;padding:16px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      ${phoneRow}
                      ${emailRow}
                    </table>
                  </td>
                </tr>
              </table>`
    : ''

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="de">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Terminvorschlag</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
    body{margin:0;padding:0;width:100%!important;height:100%!important}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}
    @media only screen and (max-width:620px){
      .email-container{width:100%!important;max-width:100%!important}
      .mobile-padding{padding-left:20px!important;padding-right:20px!important}
    }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- PREVIEW TEXT -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(practitionerFullName)} hat Ihnen einen Termin vorgeschlagen.
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <!-- OUTER WRAPPER -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f7f7f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- EMAIL CONTAINER -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px;width:100%;">

          <!-- ========== BODY ========== -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 36px 36px;border-radius:12px 12px 0 0;" class="mobile-padding">

              <!-- Greeting -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:15px;line-height:1.7;color:#1A1A1A;padding-bottom:6px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Hallo ${escapeHtml(customerFirstName)},
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.7;color:#6B7280;padding-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    ${escapeHtml(practitionerFullName)} hat Ihnen einen Termin vorgeschlagen:
                  </td>
                </tr>
              </table>

              <!-- TERMIN DETAILS -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f7f7f7;border-radius:10px;padding:20px 24px;border-left:3px solid #1A1A1A;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <!-- Terminart -->
                      <tr>
                        <td style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#9CA3AF;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          ${escapeHtml(typeLabel)}
                        </td>
                      </tr>
                      <!-- Datum -->
                      <tr>
                        <td style="font-size:18px;font-weight:700;color:#1A1A1A;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          ${escapeHtml(dateStr)}
                        </td>
                      </tr>
                      <!-- Uhrzeit + Dauer -->
                      <tr>
                        <td style="font-size:15px;color:#6B7280;padding-bottom:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          ${escapeHtml(timeStr)}${durationSuffix}
                        </td>
                      </tr>
                      <!-- Trennlinie -->
                      <tr>
                        <td style="border-top:1px solid #E5E2DC;padding-top:12px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            ${horsesRow}
                            ${notesRow}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius:10px;background-color:#1A1A1A;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${confirmUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" strokecolor="#1A1A1A" fillcolor="#1A1A1A">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Termin bestätigen</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${confirmUrl}" target="_blank" style="display:inline-block;padding:14px 44px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Termin best&auml;tigen</a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Secondary text -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-size:13px;color:#9CA3AF;padding-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Passt der Termin nicht? Melden Sie sich direkt bei mir.
                  </td>
                </tr>
              </table>

              ${contactBox}

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:20px;">
                <tr>
                  <td style="border-top:1px solid #E5E2DC;">&nbsp;</td>
                </tr>
              </table>

              <!-- Signature -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:14px;line-height:1.7;color:#6B7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Viele Grüße<br />
                    <strong style="color:#1A1A1A;">${escapeHtml(practitionerFullName)}</strong>${companyNameLine ? `<br /><span style="color:#6B7280;">${escapeHtml(companyNameLine)}</span>` : ''}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ========== FALLBACK LINK ========== -->
          <tr>
            <td style="background-color:#ffffff;padding:0 36px 28px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#f7f7f7;border-radius:8px;padding:12px 16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;line-height:1.55;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <strong style="color:#6B7280;">Link funktioniert nicht?</strong> Kopieren Sie diese Adresse in Ihren Browser:<br />
                          <a href="${confirmUrl}" style="color:#6B7280;text-decoration:underline;word-break:break-all;font-size:11px;">${escapeHtml(confirmUrl)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ========== FOOTER ========== -->
          <tr>
            <td style="background-color:#ffffff;padding:0 36px 32px;border-radius:0 0 12px 12px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid #E5E2DC;padding-top:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;line-height:1.5;color:#C4C4C4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Diese Nachricht wurde über anidocs versendet.
                          Der Bestätigungslink ist ${TOKEN_EXPIRY_DAYS} Tage gültig.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`

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
