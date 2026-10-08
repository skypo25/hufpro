import 'server-only'

import crypto from 'node:crypto'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { fetchSystemSmtp } from '@/lib/systemSmtp'
import { sendMail } from '@/lib/email'
import { BRAND_COLORS } from '@/lib/branding'

function getAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!raw) return null
  const url = raw.startsWith('http') ? raw : `https://${raw}`
  return url.replace(/\/+$/, '')
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export type PasswordResetSendResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Erzeugt Reset-Token und sendet E-Mail an den Auth-User (per userId).
 * Für Admin-Support; Rate-Limit bewusst locker (max. 5 / 15 Min. pro User).
 */
export async function createAndSendPasswordResetForUserId(
  userId: string,
  meta?: { createdIp?: string | null; createdUserAgent?: string | null }
): Promise<PasswordResetSendResult> {
  const appUrl = getAppUrl()
  if (!appUrl) return { ok: false, error: 'NEXT_PUBLIC_APP_URL fehlt.' }

  const db = createSupabaseServiceRoleClient()
  const { data: userRes, error: userErr } = await db.auth.admin.getUserById(userId)
  if (userErr || !userRes.user?.email) {
    return { ok: false, error: userErr?.message ?? 'Nutzer ohne E-Mail.' }
  }
  const email = userRes.user.email

  const sinceIso = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count: userCount } = await db
    .from('password_reset_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
  if ((userCount ?? 0) >= 5) {
    return { ok: false, error: 'Zu viele Reset-Mails in kurzer Zeit. Bitte später erneut.' }
  }

  const smtp = await fetchSystemSmtp()
  if (!smtp) return { ok: false, error: 'System-SMTP ist nicht konfiguriert.' }

  await db
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)

  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256Hex(token)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  const { error: insertErr } = await db.from('password_reset_tokens').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    created_ip: meta?.createdIp ?? null,
    created_user_agent: meta?.createdUserAgent ?? null,
  })
  if (insertErr) return { ok: false, error: insertErr.message }

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
          'Du hast einen Link zum Zurücksetzen deines Passworts erhalten (Support).',
          '',
          'Link (30 Minuten gültig):',
          link,
          '',
          'Wenn du das nicht erwartest, kannst du diese E-Mail ignorieren.',
        ].join('\n'),
        html: `<!DOCTYPE html><html lang="de"><body style="font-family:sans-serif;background:#f7f7f7;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
  <div style="font-weight:700;font-size:18px;margin-bottom:12px;">Passwort zurücksetzen</div>
  <p style="color:#6B7280;font-size:15px;line-height:1.6;">Unser Support hat einen Link zum Zurücksetzen deines Passworts ausgelöst. Der Link ist 30 Minuten gültig.</p>
  <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:${BRAND_COLORS.accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Neues Passwort vergeben</a></p>
  <p style="color:#9CA3AF;font-size:12px;word-break:break-all;">${link}</p>
</div></body></html>`,
      }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'E-Mail-Versand fehlgeschlagen'
    return { ok: false, error: msg }
  }

  return { ok: true }
}
