import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendMail } from '@/lib/email'
import { fetchInvoicePdfData } from '@/lib/pdf/invoiceData'
import InvoicePdfDocument from '@/components/pdf/InvoicePdfDocument'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { embedZugferdIntoPdf } from '@/lib/einvoice/zugferd'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SettingsSmtp = {
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  smtpFromEmail?: string
  smtpFromName?: string
  phone?: string
  email?: string
  firstName?: string
  lastName?: string
  companyName?: string
}

function fmtDeDate(d: string | null | undefined): string {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { id: invoiceId } = await params
  if (!invoiceId?.trim()) {
    return NextResponse.json({ error: 'invoiceId fehlt.' }, { status: 400 })
  }

  const { data: invRow, error: invErr } = await supabase
    .from('invoices')
    .select('id, customer_id, status, invoice_number, invoice_date, payment_due_date, sent_at')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invErr || !invRow) {
    return NextResponse.json({ error: 'Rechnung nicht gefunden.' }, { status: 404 })
  }

  if (invRow.status === 'cancelled') {
    return NextResponse.json({ error: 'Stornierte Rechnungen können nicht per E-Mail versendet werden.' }, { status: 400 })
  }

  const customerId = invRow.customer_id as string | null
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Kunde zugeordnet. Bitte Rechnungsempfänger prüfen.' }, { status: 400 })
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, email')
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Kunde nicht gefunden.' }, { status: 404 })
  }

  const toEmail = (customer.email ?? '').toString().trim()
  if (!toEmail) {
    return NextResponse.json(
      { error: 'Beim Kunden ist keine E-Mail-Adresse hinterlegt. Bitte beim Kunden eine E-Mail eintragen.' },
      { status: 400 }
    )
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const settings = (settingsRow?.settings ?? {}) as SettingsSmtp
  const host = (settings.smtpHost ?? '').toString().trim()
  const port = Number(settings.smtpPort) || 587
  const secure = Boolean(settings.smtpSecure)
  const smtpUser = (settings.smtpUser ?? '').toString().trim()
  const smtpPassword = (settings.smtpPassword ?? '').toString().trim()

  if (!host || !smtpUser || !smtpPassword) {
    return NextResponse.json(
      { error: 'SMTP-Einstellungen unvollständig. Bitte unter Einstellungen → Benachrichtigungen Host, Benutzer und Passwort eintragen.' },
      { status: 400 }
    )
  }

  const fromEmail =
    (settings.smtpFromEmail ?? '').toString().trim() ||
    (settings.email ?? '').toString().trim() ||
    (user.email ?? '').toString().trim() ||
    smtpUser
  const fromName =
    (settings.smtpFromName ?? '').toString().trim() ||
    [settings.firstName, settings.lastName].filter(Boolean).join(' ').trim() ||
    (settings.companyName ?? 'AniDocs').toString().trim()

  const practitionerFullName =
    [settings.firstName, settings.lastName].filter(Boolean).join(' ').trim() ||
    fromName ||
    'AniDocs'

  const practitionerPhone = (settings.phone ?? '').toString().trim()
  const practitionerEmail =
    (settings.email ?? '').toString().trim() || fromEmail

  const pdfData = await fetchInvoicePdfData(supabase, user.id, invoiceId)
  if (!pdfData) {
    return NextResponse.json({ error: 'PDF-Daten konnten nicht geladen werden.' }, { status: 404 })
  }

  // PDF erzeugen (wie /invoices/[id]/pdf)
  const element = React.createElement(InvoicePdfDocument, { data: pdfData })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any)
  const pdfWithZugferd = await embedZugferdIntoPdf(Buffer.from(pdfBuffer), pdfData)

  const filename = `Rechnung-${pdfData.invoiceNumber}.pdf`
  const customerName =
    (customer.name ?? '').toString().trim() ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() ||
    'Kunde/Kundin'

  const subject = `Rechnung ${pdfData.invoiceNumber}`
  const totalStr = formatCurrency(pdfData.totalCents)
  const dueStr = pdfData.paymentDueDate ? fmtDeDate(pdfData.paymentDueDate) : '–'
  const invDateStr = fmtDeDate(pdfData.invoiceDate)

  const customerFirstName =
    (customer.first_name ?? '').toString().trim() ||
    (customer.name ?? '').toString().trim() ||
    'Hallo'

  const text = [
    'Guten Tag,',
    '',
    `anbei erhalten Sie die Rechnung ${pdfData.invoiceNumber}.`,
    `Rechnungsdatum: ${invDateStr}`,
    pdfData.paymentDueDate ? `Zahlungsziel: ${dueStr}` : null,
    `Gesamtbetrag: ${totalStr}`,
    '',
    'Mit freundlichen Grüßen',
    practitionerFullName,
  ]
    .filter(Boolean)
    .join('\n')

  const dueRow = pdfData.paymentDueDate
    ? `<tr>
                            <td style="padding-bottom:12px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td width="120" style="font-size:13px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                    Zahlungsziel
                                  </td>
                                  <td style="font-size:13px;font-weight:600;color:#1A1A1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                    ${escapeHtml(dueStr)}
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>`
    : ''

  const phoneRow = practitionerPhone
    ? `<tr>
                        <td width="70" style="font-size:13px;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Telefon
                        </td>
                        <td style="font-size:13px;color:#1A1A1A;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="tel:${escapeHtml(practitionerPhone)}" style="color:#1A1A1A;text-decoration:none;">${escapeHtml(practitionerPhone)}</a>
                        </td>
                      </tr>`
    : ''

  const emailRow = practitionerEmail
    ? `<tr>
                        <td width="70" style="font-size:13px;color:#9CA3AF;padding-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          E-Mail
                        </td>
                        <td style="font-size:13px;color:#1A1A1A;padding-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="mailto:${escapeHtml(practitionerEmail)}" style="color:#1A1A1A;text-decoration:none;">${escapeHtml(practitionerEmail)}</a>
                        </td>
                      </tr>`
    : ''

  const contactBox = phoneRow || emailRow
    ? `<!-- Kontaktdaten -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="font-size:13px;line-height:1.6;color:#9CA3AF;padding-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Bei Fragen zur Rechnung erreichen Sie mich unter:
                  </td>
                </tr>
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
  <title>Rechnung ${escapeHtml(pdfData.invoiceNumber)}</title>
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
    Rechnung ${escapeHtml(pdfData.invoiceNumber)} von ${escapeHtml(practitionerFullName)} &uuml;ber ${escapeHtml(totalStr)}.
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
                    anbei erhalten Sie Ihre Rechnung von ${escapeHtml(practitionerFullName)}.
                  </td>
                </tr>
              </table>

              <!-- RECHNUNGSDETAILS -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f7f7f7;border-radius:10px;padding:20px 24px;border-left:3px solid #1A1A1A;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <!-- Label -->
                      <tr>
                        <td style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#9CA3AF;padding-bottom:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Rechnung
                        </td>
                      </tr>
                      <!-- Rechnungsnummer -->
                      <tr>
                        <td style="padding-bottom:12px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="120" style="font-size:13px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                Rechnungsnr.
                              </td>
                              <td style="font-size:13px;font-weight:600;color:#1A1A1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(pdfData.invoiceNumber)}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Rechnungsdatum -->
                      <tr>
                        <td style="padding-bottom:12px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="120" style="font-size:13px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                Datum
                              </td>
                              <td style="font-size:13px;font-weight:600;color:#1A1A1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(invDateStr)}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${dueRow}
                      <!-- Trennlinie -->
                      <tr>
                        <td style="border-top:1px solid #E5E2DC;padding-top:12px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="120" style="font-size:13px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                Gesamtbetrag
                              </td>
                              <td style="font-size:18px;font-weight:700;color:#1A1A1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                                ${escapeHtml(totalStr)}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- PDF Hinweis -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:13px;line-height:1.6;color:#9CA3AF;padding-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Die Rechnung als PDF finden Sie im Anhang dieser E-Mail.
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
                    <strong style="color:#1A1A1A;">${escapeHtml(practitionerFullName)}</strong>
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

  try {
    const out = await sendMail(
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
        attachments: [
          {
            filename,
            content: pdfWithZugferd,
            contentType: 'application/pdf',
          },
        ],
      }
    )

    // Wenn der Status noch nicht "sent" ist: als versendet führen.
    const nowIso = new Date().toISOString()
    const patch: Record<string, unknown> = { updated_at: nowIso }
    if (invRow.status === 'draft') patch.status = 'sent'
    if (!invRow.sent_at) patch.sent_at = nowIso
    await supabase.from('invoices').update(patch).eq('id', invoiceId).eq('user_id', user.id)

    return NextResponse.json({
      ok: true,
      to: toEmail,
      subject,
      messageId: out.messageId ?? null,
      accepted: out.accepted ?? null,
      rejected: out.rejected ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'E-Mail-Versand fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

