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
        html: `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="padding:24px 12px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="padding:32px 28px 8px;">
      <div style="font-weight:700;font-size:20px;color:#1A1A1A;margin-bottom:14px;">Passwort zurücksetzen</div>
      <p style="color:#6B7280;font-size:15px;line-height:1.7;margin:0 0 24px;">Unser Support hat einen Link zum Zurücksetzen deines Passworts ausgelöst. Der Link ist 30 Minuten gültig.</p>
      <p style="text-align:center;margin:0 0 28px;">
        <a href="${link}" style="display:inline-block;background:${BRAND_COLORS.accent};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;">Neues Passwort vergeben</a>
      </p>
    </div>
    <div style="padding:0 28px 28px;">
      <div style="background:#f7f7f7;border-radius:8px;padding:14px 16px;">
        <div style="font-size:11px;line-height:1.55;color:#9CA3AF;">
          <strong style="color:#6B7280;">Button funktioniert nicht?</strong> Kopiere diesen Link in den Browser:<br />
          <a href="${link}" style="color:${BRAND_COLORS.accent};text-decoration:none;word-break:break-all;font-size:11px;">${link}</a>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`,
      }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'E-Mail-Versand fehlgeschlagen'
    return { ok: false, error: msg }
  }

  return { ok: true }
}
