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

  let body: { to?: string; subject?: string; text?: string; html?: string; test?: boolean }
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
  const host = (settings.smtpHost ?? '').trim()
  const port = Number(settings.smtpPort) || 587
  const secure = Boolean(settings.smtpSecure)
  const smtpUser = (settings.smtpUser ?? '').trim()
  const smtpPassword = (settings.smtpPassword ?? '').trim()

  if (!host || !smtpUser || !smtpPassword) {
    return NextResponse.json(
      { error: 'SMTP-Einstellungen unvollständig. Bitte unter Einstellungen → Benachrichtigungen Host, Benutzer und Passwort eintragen.' },
      { status: 400 }
    )
  }

  const fromEmail = (settings.smtpFromEmail || settings.email || smtpUser).trim()
  const fromName = (settings.smtpFromName || [settings.firstName, settings.lastName].filter(Boolean).join(' ') || settings.companyName || 'HufPro').trim()

  if (body.test === true) {
    const to = (settings.email || user.email || '').trim()
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
          fromEmail,
          fromName,
        },
        {
          to,
          subject: 'HufPro – Test-E-Mail',
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
        fromEmail,
        fromName,
      },
      { to, subject, text, html }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Versand fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
