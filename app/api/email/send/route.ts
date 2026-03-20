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

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  let body: {
    to?: string
    subject?: string
    text?: string
    html?: string
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

  const { data: row } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const settings = (row?.settings ?? {}) as SettingsSmtp
  // Beim Test-Versand können die aktuellen Formularwerte mitgeschickt werden (Passwort wird nie zurückgegeben)
  const useBody = body.test === true
  const host = ((useBody ? body.smtpHost ?? settings.smtpHost : settings.smtpHost) ?? '').toString().trim()
  const port = Number(useBody ? body.smtpPort ?? settings.smtpPort : settings.smtpPort) || 587
  const secure = Boolean(useBody ? body.smtpSecure ?? settings.smtpSecure : settings.smtpSecure)
  const smtpUser = ((useBody ? body.smtpUser ?? settings.smtpUser : settings.smtpUser) ?? '').toString().trim()
  const smtpPassword = ((useBody ? body.smtpPassword ?? settings.smtpPassword : settings.smtpPassword) ?? '').toString().trim()

  if (!host || !smtpUser || !smtpPassword) {
    return NextResponse.json(
      { error: 'SMTP-Einstellungen unvollständig. Bitte unter Einstellungen → Benachrichtigungen Host, Benutzer und Passwort eintragen.' },
      { status: 400 }
    )
  }

  const fromEmail = (useBody ? body.smtpFromEmail ?? settings.smtpFromEmail : settings.smtpFromEmail) || (useBody ? body.email ?? settings.email : settings.email) || smtpUser
  const fromName = (useBody ? body.smtpFromName ?? settings.smtpFromName : settings.smtpFromName) || (useBody ? [body.firstName, body.lastName].filter(Boolean).join(' ') : [settings.firstName, settings.lastName].filter(Boolean).join(' ')) || (useBody ? body.companyName : settings.companyName) || 'AniDocs'
  const fromEmailTrim = (fromEmail ?? '').toString().trim()
  const fromNameTrim = (fromName ?? '').toString().trim()

  if (body.test === true) {
    const to = ((useBody ? body.email ?? settings.email : settings.email) || user.email || '').toString().trim()
    if (!to) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse hinterlegt. Bitte unter Einstellungen → Mein Betrieb deine E-Mail eintragen.' },
        { status: 400 }
      )
    }
    try {
      await sendMail(
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
      return NextResponse.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Versand fehlgeschlagen'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  const to = (body.to ?? '').trim()
  const subject = (body.subject ?? '').trim()
  const text = body.text?.trim()
  const html = body.html?.trim()
  if (!to || !subject || (!text && !html)) {
    return NextResponse.json(
      { error: 'Angaben unvollständig: Empfänger, Betreff und Text oder HTML erforderlich.' },
      { status: 400 }
    )
  }

  try {
    await sendMail(
      {
        host,
        port,
        secure,
        user: smtpUser,
        password: smtpPassword,
        fromEmail: fromEmailTrim,
        fromName: fromNameTrim,
      },
      { to, subject, text, html }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Versand fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
