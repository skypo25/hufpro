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
          html: [
            `<p>Du hast einen Link zum Zurücksetzen deines Passworts angefordert.</p>`,
            `<p><a href="${link}">Passwort zurücksetzen</a> (30 Minuten gültig)</p>`,
            `<p>Wenn du das nicht warst, kannst du diese E-Mail ignorieren.</p>`,
          ].join(''),
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

