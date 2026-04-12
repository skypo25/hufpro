/**
 * HTML-E-Mail an Profilinhaber:in nach Kontaktformular (Verzeichnis).
 * Alle Nutzerdaten werden für HTML escaped; mailto:/tel: mit encodeURIComponent.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function previewPlain(s: string): string {
  return escapeHtml(s.replace(/\s+/g, ' ').trim()).slice(0, 140)
}

function telHref(phone: string): string {
  const compact = phone.replace(/[^\d+]/g, '')
  return compact ? `tel:${encodeURIComponent(compact)}` : '#'
}

export function buildDirectoryContactOwnerEmailHtml(args: {
  ownerDisplayName: string
  profileSlug: string
  contactName: string
  contactEmail: string
  contactPhone: string | null | undefined
  contactMessage: string
}): string {
  const owner = escapeHtml(args.ownerDisplayName.trim() || args.profileSlug)
  const slug = escapeHtml(args.profileSlug)
  const cName = escapeHtml(args.contactName.trim())
  const cEmail = escapeHtml(args.contactEmail.trim())
  const cEmailHref = encodeURIComponent(args.contactEmail.trim())
  const phoneRaw = (args.contactPhone ?? '').trim()
  const hasPhone = phoneRaw.length > 0
  const cPhone = hasPhone ? escapeHtml(phoneRaw) : ''
  const cPhoneHref = hasPhone ? telHref(phoneRaw) : '#'
  const cMsg = escapeHtml(args.contactMessage)

  const preview = previewPlain(`Neue Anfrage von ${args.contactName.trim()} über dein anidocs-Profil`)

  const phoneBlock = hasPhone
    ? `
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr><td style="border-top:1px solid #E5E2DC;padding-bottom:16px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Telefon
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;color:#1A1A1A;padding-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="${cPhoneHref}" style="color:#1A1A1A;text-decoration:none;">${cPhone}</a>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr><td style="border-top:1px solid #E5E2DC;padding-bottom:16px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
`
    : `
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr><td style="border-top:1px solid #E5E2DC;padding-bottom:16px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Telefon
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;color:#6B7280;padding-bottom:16px;font-style:italic;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Nicht angegeben
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr><td style="border-top:1px solid #E5E2DC;padding-bottom:16px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
`

  const callHintRow = hasPhone
    ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-size:13px;color:#9CA3AF;padding-top:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    oder direkt anrufen: <a href="${cPhoneHref}" style="color:#52b788;font-weight:600;text-decoration:none;">${cPhone}</a>
                  </td>
                </tr>
              </table>
`
    : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="de">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Neue Anfrage über dein anidocs-Profil</title>
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
      .mobile-stack{display:block!important;width:100%!important}
      .mobile-center{text-align:center!important}
      .mobile-hide{display:none!important}
      .mobile-full{width:100%!important}
    }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#f0efed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    ${preview}
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0efed;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px;width:100%;">

          <tr>
            <td style="background-color:#1c2023;padding:28px 36px;border-radius:12px 12px 0 0;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="40" valign="middle" style="padding-right:12px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:#52b788;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;font-size:16px;font-weight:700;color:#1c2023;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          a
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    anidocs
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#52b788;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:40px 36px 32px;" class="mobile-padding">

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1A1A1A;padding-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Neue Anfrage über dein Profil
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.65;color:#6B7280;padding-bottom:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Hallo ${owner},<br /><br />
                    du hast eine neue Anfrage über dein anidocs-Verzeichnisprofil erhalten. Hier sind die Details:
                  </td>
                </tr>
                <tr>
                  <td style="font-size:13px;line-height:1.5;color:#9CA3AF;padding-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Profil: <span style="color:#6B7280;font-weight:600;">${owner}</span>
                    <span style="color:#D1D5DB;"> · </span>
                    <span style="font-family:ui-monospace,monospace;color:#6B7280;">/behandler/${slug}</span>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f6f5f3;border:1px solid #E5E2DC;border-radius:10px;padding:24px;">

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Vor- und Nachname
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;font-weight:700;color:#1A1A1A;padding-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          ${cName}
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr><td style="border-top:1px solid #E5E2DC;padding-bottom:16px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          E-Mail
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;color:#1A1A1A;padding-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <a href="mailto:${cEmailHref}" style="color:#52b788;text-decoration:none;font-weight:600;">${cEmail}</a>
                        </td>
                      </tr>
                    </table>
${phoneBlock}
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;padding-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Nachricht
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;line-height:1.65;color:#1A1A1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;white-space:pre-wrap;">${cMsg}</td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:#52b788;border-radius:10px;text-align:center;">
                          <a href="mailto:${cEmailHref}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                            Per E-Mail antworten
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
${callHintRow}

            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:0 36px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid #E5E2DC;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:24px 36px 32px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#f6f5f3;border-radius:8px;padding:16px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="32" valign="top" style="padding-right:12px;padding-top:2px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="background-color:rgba(82,183,136,0.1);border-radius:6px;width:28px;height:28px;text-align:center;vertical-align:middle;font-size:14px;color:#52b788;">
                                &#128161;
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="font-size:13px;line-height:1.55;color:#6B7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <strong style="color:#1A1A1A;">Tipp:</strong> Antworte möglichst innerhalb von 24 Stunden. Schnelle Antworten hinterlassen einen professionellen Eindruck bei potenziellen Kunden.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1c2023;padding:28px 36px;border-radius:0 0 12px 12px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                <tr>
                  <td style="padding-bottom:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:#52b788;border-radius:7px;width:28px;height:28px;text-align:center;vertical-align:middle;font-size:13px;font-weight:700;color:#1c2023;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          a
                        </td>
                        <td style="padding-left:10px;font-size:14px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          anidocs
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="font-size:12px;line-height:1.6;color:rgba(255,255,255,0.35);padding-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Verzeichnis für Tierbehandler<br />
                    Made in Germany
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right:16px;">
                          <a href="https://anidocs.de" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Website</a>
                        </td>
                        <td style="padding-right:16px;">
                          <a href="https://anidocs.de/hilfe" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Hilfe</a>
                        </td>
                        <td style="padding-right:16px;">
                          <a href="https://anidocs.de/datenschutz" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Datenschutz</a>
                        </td>
                        <td>
                          <a href="https://anidocs.de/impressum" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Impressum</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;line-height:1.5;color:rgba(255,255,255,0.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Du erhältst diese E-Mail, weil jemand das Kontaktformular auf deinem anidocs-Verzeichnisprofil ausgefüllt hat.
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:11px;color:rgba(255,255,255,0.2);padding-top:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          &copy; ${new Date().getFullYear()} AniDocs &middot; wee-media.de &middot; Dernbach, Deutschland
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
}
