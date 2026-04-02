import { sendMail, type SmtpConfig } from '@/lib/email'
import { formatAppointmentTimeRangeDe } from '@/lib/appointments/appointmentDisplay'
import { minutesToDurationLabelDesktop } from '@/lib/appointments/appointmentDuration'
import { deriveAppProfile } from '@/lib/appProfile'

export type AppointmentReminderMailContext = {
  customerName: string
  customerFirstName?: string
  toEmail: string
  appointmentDate: string | null
  durationMinutes: number | null | undefined
  appointmentType: string | null
  notes: string | null
  horseNames: string[]
  fromName: string
  practitionerPhone?: string | null
  practitionerEmail?: string | null
  profession?: unknown
  animalFocus?: unknown
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
  const horseLine = ctx.horseNames.length > 0 ? ctx.horseNames.join(', ') : null
  const terminology = deriveAppProfile(ctx.profession, ctx.animalFocus).terminology
  const animalPluralLabel = terminology === 'pferd' ? 'Pferd(e)' : 'Tier(e)'
  const practitionerName = (ctx.fromName || 'AniDocs').toString().trim() || 'AniDocs'
  const customerFirstName =
    (ctx.customerFirstName ?? '').toString().trim() ||
    (ctx.customerName ?? '').toString().trim() ||
    'Hallo'
  const notes = (ctx.notes ?? '').toString().trim()
  const durationMinutes = ctx.durationMinutes != null ? String(ctx.durationMinutes) : ''
  const durationSuffix = durationMinutes ? ` &middot; ca. ${escapeHtml(durationMinutes)} Minuten` : ''
  const hasPhone = Boolean((ctx.practitionerPhone ?? '').toString().trim())
  const hasEmail = Boolean((ctx.practitionerEmail ?? '').toString().trim())
  const phone = (ctx.practitionerPhone ?? '').toString().trim()
  const email = (ctx.practitionerEmail ?? '').toString().trim()

  const subject = `Erinnerung: Termin am ${dateStr}`

  const text = [
    `Hallo${customerFirstName ? ` ${customerFirstName}` : ''},`,
    '',
    'eine kurze Erinnerung an Ihren bevorstehenden Termin:',
    '',
    `Datum: ${dateStr}`,
    `Uhrzeit: ${timeRange}`,
    `Art: ${typeLabel}`,
    durationLabel ? `Dauer: ${durationLabel}` : null,
    horseLine ? `${animalPluralLabel}: ${horseLine}` : null,
    notes ? `Hinweis: ${notes}` : null,
    '',
    'Falls Sie den Termin nicht wahrnehmen können, melden Sie sich bitte rechtzeitig:',
    hasPhone ? `Telefon: ${phone}` : null,
    hasEmail ? `E-Mail: ${email}` : null,
    '',
    `Viele Grüße${practitionerName ? `\n${practitionerName}` : ''}`,
  ]
    .filter(Boolean)
    .join('\n')

  const horsesRow = horseLine
    ? `<tr>
                              <td width="80" valign="top" style="font-size:13px;color:#9CA3AF;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(animalPluralLabel)}
                              </td>
                              <td style="font-size:13px;font-weight:600;color:#1A1A1A;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(horseLine)}
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

  const phoneRow = hasPhone
    ? `<tr>
                        <td width="70" style="font-size:13px;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Telefon
                        </td>
                        <td style="font-size:13px;color:#1A1A1A;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="tel:${escapeHtml(phone)}" style="color:#1A1A1A;text-decoration:none;">${escapeHtml(phone)}</a>
                        </td>
                      </tr>`
    : ''

  const emailRow = hasEmail
    ? `<tr>
                        <td width="70" style="font-size:13px;color:#9CA3AF;padding-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          E-Mail
                        </td>
                        <td style="font-size:13px;color:#1A1A1A;padding-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="mailto:${escapeHtml(email)}" style="color:#1A1A1A;text-decoration:none;">${escapeHtml(email)}</a>
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
  <title>Terminerinnerung</title>
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
    Erinnerung: Ihr Termin am ${escapeHtml(dateStr)} bei ${escapeHtml(practitionerName)}.
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
                    eine kurze Erinnerung an Ihren bevorstehenden Termin:
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
                          ${escapeHtml(timeRange)}${durationSuffix}
                        </td>
                      </tr>
                      <!-- Trennlinie -->
                      <tr>
                        <td style="border-top:1px solid #E5E2DC;padding-top:12px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <!-- Behandler -->
                            <tr>
                              <td width="80" valign="top" style="font-size:13px;color:#9CA3AF;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                Bei
                              </td>
                              <td style="font-size:13px;font-weight:600;color:#1A1A1A;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(practitionerName)}
                              </td>
                            </tr>
                            ${horsesRow}
                            ${notesRow}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Hinweis -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:13px;line-height:1.6;color:#9CA3AF;padding-bottom:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Falls Sie den Termin nicht wahrnehmen k&ouml;nnen, melden Sie sich bitte rechtzeitig:
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
                    Viele Gr&uuml;&szlig;e<br />
                    <strong style="color:#1A1A1A;">${escapeHtml(practitionerName)}</strong>
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
                          Diese Nachricht wurde &uuml;ber anidocs versendet.
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

  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
