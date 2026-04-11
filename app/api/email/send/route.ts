import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendMail } from '@/lib/email'

type SettingsSmtp = {
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  smtpFromEmail?: string
  smtpFromName?: string
  email?: string
  firstName?: string
  lastName?: string
  companyName?: string
}

const isProduction = process.env.NODE_ENV === 'production'

function auditEmailSendApi(entry: {
  userId?: string
  kind: 'smtp_test' | 'relay_blocked' | 'unauthenticated'
  ok: boolean
  statusCode: number
}) {
  console.info(
    JSON.stringify({
      event: 'email_send_api',
      ...entry,
      at: new Date().toISOString(),
    })
  )
}

/**
 * Nur noch SMTP-Testversand (test: true). Kein freies Relay.
 * Nächster Schritt bei Bedarf: Rate-Limiting (z. B. pro userId/IP).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    auditEmailSendApi({ kind: 'unauthenticated', ok: false, statusCode: 401 })
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  let body: {
    test?: boolean
    smtpHost?: string
    smtpPort?: number
    smtpSecure?: boolean
    smtpUser?: string
    smtpPassword?: string
    smtpFromEmail?: string
    smtpFromName?: string
    email?: string
    firstName?: string
    lastName?: string
    companyName?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  if (body.test !== true) {
    auditEmailSendApi({
      userId: user.id,
      kind: 'relay_blocked',
      ok: false,
      statusCode: 403,
    })
    return NextResponse.json(
      {
        error:
          'Freies Versenden über diesen Endpunkt ist deaktiviert. Nur der SMTP-Testversand (test: true) ist erlaubt.',
      },
      { status: 403 }
    )
  }

  const { data: row } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const settings = (row?.settings ?? {}) as SettingsSmtp
  const host = ((body.smtpHost ?? settings.smtpHost) ?? '').toString().trim()
  const port = Number(body.smtpPort ?? settings.smtpPort) || 587
  const secure = Boolean(body.smtpSecure ?? settings.smtpSecure)
  const smtpUser = ((body.smtpUser ?? settings.smtpUser) ?? '').toString().trim()
  const bodyPw = (body.smtpPassword ?? '').toString().trim()
  const storedPw = (settings.smtpPassword ?? '').toString().trim()
  const smtpPassword = bodyPw || storedPw

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
    (body.smtpFromEmail ?? settings.smtpFromEmail) ||
    (body.email ?? settings.email) ||
    smtpUser
  const fromName =
    (body.smtpFromName ?? settings.smtpFromName) ||
    [body.firstName ?? settings.firstName, body.lastName ?? settings.lastName].filter(Boolean).join(' ') ||
    (body.companyName ?? settings.companyName) ||
    'AniDocs'
  const fromEmailTrim = (fromEmail ?? '').toString().trim()
  const fromNameTrim = (fromName ?? '').toString().trim()

  // Empfänger nur aus vertrauenswürdigen Quellen — niemals frei aus dem Request-Body (kein Relay).
  const to = ((user.email ?? '').toString().trim() || (settings.email ?? '').toString().trim())
  if (!to) {
    return NextResponse.json(
      {
        error:
          'Keine Zieladresse: Bitte in deinem Konto eine E-Mail hinterlegen oder unter Einstellungen → Mein Betrieb eine E-Mail speichern.',
      },
      { status: 400 }
    )
  }

  try {
    const out = await sendMail(
      {
        host,
        port,
        secure,
        user: smtpUser,
        password: smtpPassword,
        fromEmail: fromEmailTrim,
        fromName: fromNameTrim,
      },
      {
        to,
        subject: 'AniDocs – Test-E-Mail',
        text: 'Diese E-Mail wurde über deine SMTP-Einstellungen versendet. Wenn du sie erhalten hast, ist die Konfiguration korrekt.',
        html: '<p>Diese E-Mail wurde über deine SMTP-Einstellungen versendet. Wenn du sie erhalten hast, ist die Konfiguration korrekt.</p>',
      }
    )
    auditEmailSendApi({ userId: user.id, kind: 'smtp_test', ok: true, statusCode: 200 })

    if (isProduction) {
      return NextResponse.json({
        ok: true,
        messageId: out.messageId ?? null,
      })
    }

    return NextResponse.json({
      ok: true,
      debug: {
        host,
        port,
        secure,
        smtpUser,
        fromEmail: fromEmailTrim,
        fromName: fromNameTrim,
        to,
        messageId: out.messageId ?? null,
        accepted: out.accepted ?? null,
        rejected: out.rejected ?? null,
        response: out.response ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Versand fehlgeschlagen'
    auditEmailSendApi({ userId: user.id, kind: 'smtp_test', ok: false, statusCode: 500 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
