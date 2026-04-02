import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { fetchSystemSmtp } from '@/lib/systemSmtp'
import { sendMail } from '@/lib/email'
import { logAdminAuditEvent } from '@/lib/admin/audit'

function getAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!raw) return null
  const url = raw.startsWith('http') ? raw : `https://${raw}`
  return url.replace(/\/+$/, '')
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

async function findUserIdByEmail(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  email: string
): Promise<{ id: string; email: string } | null> {
  // Supabase Admin API is the reliable way to access auth users (without depending on PostgREST exposing auth schema).
  const target = email.trim().toLowerCase()
  const perPage = 200
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`)
    const users = data?.users ?? []
    const hit = users.find((u) => String(u.email ?? '').trim().toLowerCase() === target)
    if (hit?.id && hit.email) return { id: hit.id, email: hit.email }
    if (users.length < perPage) break
  }
  return null
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()
  try {
    const body = (await req.json().catch(() => null)) as { email?: string } | null
    const email = String(body?.email ?? '').trim().toLowerCase()

    // Always respond success to avoid user enumeration.
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: true })
    }

    const appUrl = getAppUrl()
    if (!appUrl) {
      return NextResponse.json({ ok: true })
    }

    const db = createSupabaseServiceRoleClient()
    const userRow = await findUserIdByEmail(db, email)

    if (!userRow?.id) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[password-reset][request]', { requestId, status: 'user_not_found' })
      }
      return NextResponse.json({ ok: true })
    }

    const smtp = await fetchSystemSmtp()
    if (!smtp) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[password-reset][request]', { requestId, status: 'smtp_missing' })
      }
      return NextResponse.json({ ok: true })
    }

    // Invalidate any previous unused tokens for this user.
    await db
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userRow.id)
      .is('used_at', null)

    const token = crypto.randomBytes(32).toString('base64url')
    const tokenHash = sha256Hex(token)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 min

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null
    const userAgent = req.headers.get('user-agent')

    await db.from('password_reset_tokens').insert({
      user_id: userRow.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_ip: ip,
      created_user_agent: userAgent,
    })
    if (process.env.NODE_ENV !== 'production') {
      console.info('[password-reset][request]', { requestId, status: 'token_created' })
    }

    const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`

    const fromEmail = smtp.from_email || 'noreply@anidocs.de'
    const fromName = smtp.from_name || 'AniDocs'

    try {
      await sendMail(
        {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.smtp_user,
          password: smtp.password,
          fromEmail,
          fromName,
        },
        {
          to: email,
          subject: 'Passwort zurücksetzen – AniDocs',
          text: [
            'Du hast einen Link zum Zurücksetzen deines Passworts angefordert.',
            '',
            'Link (30 Minuten gültig):',
            link,
            '',
            'Wenn du das nicht warst, kannst du diese E-Mail ignorieren.',
          ].join('\n'),
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="de">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Passwort zurücksetzen – anidocs</title>
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
    Setzen Sie jetzt Ihr anidocs-Passwort zurück.
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <!-- OUTER WRAPPER -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f7f7f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- EMAIL CONTAINER -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px;width:100%;">

          <!-- ========== HEADER ========== -->
          <tr>
            <td style="background-color:#1b1f23;padding:28px 36px;border-radius:12px 12px 0 0;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="40" valign="middle" style="padding-right:12px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:#52b788;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;font-size:16px;font-weight:700;color:#1b1f23;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
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

          <!-- ========== ACCENT LINE ========== -->
          <tr>
            <td style="background-color:#52b788;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ========== BODY ========== -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 36px 36px;" class="mobile-padding">

              <!-- Greeting -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1A1A1A;padding-bottom:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Passwort zurücksetzen
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.7;color:#6B7280;padding-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt. Klicken Sie auf den Button, um ein neues Passwort zu vergeben.
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius:10px;background-color:#52b788;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${link}" style="height:50px;v-text-anchor:middle;width:320px;" arcsize="20%" strokecolor="#52b788" fillcolor="#52b788">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Neues Passwort vergeben</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${link}" target="_blank" style="display:inline-block;padding:15px 48px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Neues Passwort vergeben</a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Continued text -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:15px;line-height:1.7;color:#6B7280;padding-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Dieser Link ist aus Sicherheitsgründen nur für eine begrenzte Zeit gültig. Falls der Link abgelaufen ist, können Sie jederzeit einen neuen anfordern.
                  </td>
                </tr>
                <tr>
                  <td style="font-size:13px;line-height:1.6;color:#9CA3AF;padding-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Falls Sie kein neues Passwort angefordert haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="border-top:1px solid #E5E2DC;">&nbsp;</td>
                </tr>
              </table>

              <!-- Signature -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:15px;line-height:1.7;color:#6B7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Freundliche Grüße<br />
                    <strong style="color:#1A1A1A;">Ihr anidocs Team</strong>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ========== FALLBACK LINK ========== -->
          <tr>
            <td style="background-color:#ffffff;padding:0 36px 32px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#f7f7f7;border-radius:8px;padding:14px 18px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;line-height:1.55;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <strong style="color:#6B7280;">Button funktioniert nicht?</strong> Kopieren Sie diesen Link in Ihren Browser:<br />
                          <a href="${link}" style="color:#52b788;text-decoration:none;word-break:break-all;font-size:11px;">${link}</a>
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
            <td style="background-color:#1b1f23;padding:28px 36px;border-radius:0 0 12px 12px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                <!-- Footer Logo -->
                <tr>
                  <td style="padding-bottom:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:#52b788;border-radius:7px;width:28px;height:28px;text-align:center;vertical-align:middle;font-size:13px;font-weight:700;color:#1b1f23;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          a
                        </td>
                        <td style="padding-left:10px;font-size:14px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          anidocs
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Tagline -->
                <tr>
                  <td style="font-size:12px;line-height:1.6;color:rgba(255,255,255,0.35);padding-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    Dokumentation für Tiertherapeuten<br />
                    Made in Germany
                  </td>
                </tr>

                <!-- Links -->
                <tr>
                  <td style="padding-bottom:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right:16px;">
                          <a href="https://app.anidocs.de" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">App</a>
                        </td>
                        <td style="padding-right:16px;">
                          <a href="https://app.anidocs.de/hilfe" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Hilfe</a>
                        </td>
                        <td style="padding-right:16px;">
                          <a href="https://app.anidocs.de/datenschutz" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Datenschutz</a>
                        </td>
                        <td>
                          <a href="https://app.anidocs.de/impressum" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Impressum</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Legal -->
                <tr>
                  <td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:11px;line-height:1.5;color:rgba(255,255,255,0.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          Diese E-Mail wurde automatisch versendet, weil jemand das Zurücksetzen des Passworts für diesen anidocs-Account angefordert hat. Falls Sie das nicht waren, können Sie diese E-Mail ignorieren.
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:11px;color:rgba(255,255,255,0.2);padding-top:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          © 2026 anidocs · anidocs.de · Dernbach, Deutschland
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
</html>`,
        }
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'send_failed'
      console.error('[password-reset][request]', { requestId, msg })
      await logAdminAuditEvent({
        actorUserId: null,
        targetUserId: userRow.id,
        action: 'password_reset.email_failed',
        message: msg.slice(0, 180),
        metadata: { requestId },
      }).catch(() => null)
      return NextResponse.json({ ok: true })
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info('[password-reset][request]', { requestId, status: 'email_sent' })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'server_error'
    console.error('[password-reset][request]', { requestId, msg })
    // Still return ok to keep UX consistent and avoid enumeration.
    return NextResponse.json({ ok: true })
  }
}

