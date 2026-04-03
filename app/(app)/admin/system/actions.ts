'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { logAdminAuditEvent } from '@/lib/admin/audit'
import { sendMail } from '@/lib/email'
import { coerceDataExportRetentionDays } from '@/lib/export/dataExportRetention'

function back(q: Record<string, string> = {}) {
  const p = new URLSearchParams(q)
  const qs = p.toString()
  return `/admin/system${qs ? `?${qs}` : ''}`
}

export async function saveSystemSmtp(formData: FormData) {
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()

  const host = String(formData.get('host') ?? '').trim()
  const portRaw = Number(formData.get('port') ?? 587)
  const secure = String(formData.get('secure') ?? 'false') === 'true'
  const smtpUser = String(formData.get('user') ?? '').trim()
  const password = String(formData.get('password') ?? '').trim()
  const fromEmail = String(formData.get('from_email') ?? '').trim()
  const fromName = String(formData.get('from_name') ?? '').trim()

  const port = Number.isFinite(portRaw) ? Math.max(1, Math.min(65535, Math.floor(portRaw))) : 587

  if (!host || !smtpUser) {
    redirect(back({ err: 'smtp', msg: 'Host und User sind erforderlich.' }))
  }

  // TLS vs STARTTLS safety check (prevents "wrong version number")
  if (secure && port !== 465) {
    redirect(back({ err: 'smtp', msg: 'Für TLS (465) muss der Port 465 sein. Für Port 587 bitte STARTTLS auswählen.' }))
  }
  if (!secure && port === 465) {
    redirect(back({ err: 'smtp', msg: 'Für Port 465 bitte TLS auswählen (Secure=true). Für STARTTLS nutze Port 587.' }))
  }

  // Allow keeping the existing password by leaving the field empty.
  let pwToStore = password
  if (!pwToStore) {
    const { data: existing } = await db.from('system_smtp').select('password').eq('id', 1).maybeSingle()
    pwToStore = (existing?.password as string | undefined) ?? ''
  }
  if (!pwToStore) {
    redirect(back({ err: 'smtp', msg: 'Passwort ist erforderlich (oder leer lassen, wenn bereits gespeichert).' }))
  }

  const { error } = await db.from('system_smtp').upsert(
    {
      id: 1,
      host,
      port,
      secure,
      smtp_user: smtpUser,
      password: pwToStore,
      from_email: fromEmail || null,
      from_name: fromName || null,
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    },
    { onConflict: 'id' }
  )
  if (error) redirect(back({ err: 'smtp', msg: error.message.slice(0, 180) }))

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'system_smtp.save',
    metadata: { host, port, secure, smtp_user: smtpUser, from_email: fromEmail || null, from_name: fromName || null },
  })

  revalidatePath('/admin/system')
  redirect(back({ saved: 'smtp' }))
}

export async function testSystemSmtp(formData: FormData) {
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const toRaw = String(formData.get('to') ?? '').trim()

  const to = toRaw || admin.email || ''
  if (!to) {
    redirect(back({ err: 'smtp_test', msg: 'Keine Zieladresse: Admin hat keine E-Mail.' }))
  }

  const { data: row, error } = await db.from('system_smtp').select('*').eq('id', 1).maybeSingle()
  if (error || !row) {
    redirect(back({ err: 'smtp_test', msg: 'SMTP ist noch nicht gespeichert.' }))
  }

  try {
    await sendMail(
      {
        host: String(row.host),
        port: Number(row.port) || 587,
        secure: Boolean(row.secure),
        user: String(row.smtp_user),
        password: String(row.password),
        fromEmail: (row.from_email as string | null) ?? 'noreply@anidocs.de',
        fromName: (row.from_name as string | null) ?? 'AniDocs',
      },
      {
        to,
        subject: 'AniDocs – System SMTP Test',
        text: 'Diese E-Mail wurde über das System SMTP (Admin → System) versendet. Wenn du sie erhältst, ist die Konfiguration korrekt.',
        html: '<p>Diese E-Mail wurde über das <strong>System SMTP</strong> (Admin → System) versendet. Wenn du sie erhältst, ist die Konfiguration korrekt.</p>',
      }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Versand fehlgeschlagen'
    redirect(back({ err: 'smtp_test', msg: msg.slice(0, 180) }))
  }

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'system_smtp.test',
    metadata: { to },
  })

  revalidatePath('/admin/system')
  redirect(back({ saved: 'smtp_test' }))
}

export async function saveDataExportRetention(formData: FormData) {
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()

  const raw = Number(formData.get('data_export_retention_days'))
  const days = coerceDataExportRetentionDays(raw)

  const { error } = await db.from('system_settings').upsert(
    {
      id: 1,
      data_export_retention_days: days,
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    },
    { onConflict: 'id' }
  )
  if (error) {
    redirect(back({ err: 'retention', msg: error.message.slice(0, 180) }))
  }

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'system_settings.data_export_retention',
    metadata: { data_export_retention_days: days },
  })

  revalidatePath('/admin/system')
  redirect(back({ saved: 'retention' }))
}

